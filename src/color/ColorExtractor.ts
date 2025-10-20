import sharp from 'sharp';

export interface RGBColor {
  r: number;
  g: number;
  b: number;
}

export interface ScreenZone {
  name: string;
  x: number;      // X position (0-1, percentage of screen width)
  y: number;      // Y position (0-1, percentage of screen height)
  width: number;  // Width (0-1, percentage of screen width)
  height: number; // Height (0-1, percentage of screen height)
}

export interface ZoneColor {
  zone: string;
  color: RGBColor;
}

/**
 * Extracts colors from screen captures for light synchronization
 */
export class ColorExtractor {
  /**
   * Extract average color from an entire image
   */
  async getAverageColor(imageBuffer: Buffer): Promise<RGBColor> {
    try {
      const image = sharp(imageBuffer);
      const metadata = await image.metadata();

      // Resize to speed up processing (smaller image = faster color calc)
      const { data, info } = await image
        .resize(100, 100, { fit: 'fill' })
        .raw()
        .toBuffer({ resolveWithObject: true });

      // Calculate average RGB values
      let r = 0, g = 0, b = 0;
      const pixelCount = info.width * info.height;

      for (let i = 0; i < data.length; i += info.channels) {
        r += data[i];
        g += data[i + 1];
        b += data[i + 2];
      }

      return {
        r: Math.round(r / pixelCount),
        g: Math.round(g / pixelCount),
        b: Math.round(b / pixelCount),
      };
    } catch (error) {
      console.error('Error extracting average color:', error);
      throw new Error('Failed to extract average color');
    }
  }

  /**
   * Extract colors from specific zones of the screen
   * This is useful for multi-light setups (e.g., left/right/top/bottom lights)
   */
  async getZoneColors(imageBuffer: Buffer, zones: ScreenZone[]): Promise<ZoneColor[]> {
    try {
      const image = sharp(imageBuffer);
      const metadata = await image.metadata();

      if (!metadata.width || !metadata.height) {
        throw new Error('Could not determine image dimensions');
      }

      const zoneColors: ZoneColor[] = [];

      for (const zone of zones) {
        // Calculate pixel coordinates from percentages
        const left = Math.round(zone.x * metadata.width);
        const top = Math.round(zone.y * metadata.height);
        const width = Math.round(zone.width * metadata.width);
        const height = Math.round(zone.height * metadata.height);

        // Extract the zone
        const zoneBuffer = await image
          .extract({ left, top, width, height })
          .toBuffer();

        // Get average color for this zone
        const color = await this.getAverageColor(zoneBuffer);

        zoneColors.push({
          zone: zone.name,
          color,
        });
      }

      return zoneColors;
    } catch (error) {
      console.error('Error extracting zone colors:', error);
      throw new Error('Failed to extract zone colors');
    }
  }

  /**
   * Enhance colors for better visual impact
   * Increases saturation and adjusts brightness
   */
  enhanceColor(color: RGBColor, saturationBoost: number = 1.2, brightnessMin: number = 30): RGBColor {
    // Convert RGB to HSV for easier manipulation
    const r = color.r / 255;
    const g = color.g / 255;
    const b = color.b / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const delta = max - min;

    // Calculate HSV
    let h = 0;
    if (delta !== 0) {
      if (max === r) {
        h = ((g - b) / delta) % 6;
      } else if (max === g) {
        h = (b - r) / delta + 2;
      } else {
        h = (r - g) / delta + 4;
      }
      h = Math.round(h * 60);
      if (h < 0) h += 360;
    }

    let s = max === 0 ? 0 : delta / max;
    let v = max;

    // Enhance saturation
    s = Math.min(1, s * saturationBoost);

    // Ensure minimum brightness
    v = Math.max(v, brightnessMin / 255);

    // Convert back to RGB
    const c = v * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = v - c;

    let rPrime = 0, gPrime = 0, bPrime = 0;

    if (h >= 0 && h < 60) {
      rPrime = c; gPrime = x; bPrime = 0;
    } else if (h >= 60 && h < 120) {
      rPrime = x; gPrime = c; bPrime = 0;
    } else if (h >= 120 && h < 180) {
      rPrime = 0; gPrime = c; bPrime = x;
    } else if (h >= 180 && h < 240) {
      rPrime = 0; gPrime = x; bPrime = c;
    } else if (h >= 240 && h < 300) {
      rPrime = x; gPrime = 0; bPrime = c;
    } else {
      rPrime = c; gPrime = 0; bPrime = x;
    }

    return {
      r: Math.round((rPrime + m) * 255),
      g: Math.round((gPrime + m) * 255),
      b: Math.round((bPrime + m) * 255),
    };
  }
}
