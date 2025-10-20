import sharp from 'sharp';
import { RGBColor } from './ColorExtractor';

/**
 * Advanced color detection methods for "most important color" extraction
 */
export class AdvancedColorExtractor {
  /**
   * Get the most important/dominant color from an image region
   * Uses color quantization and weighs by saturation/brightness
   */
  async getMostImportantColor(imageBuffer: Buffer): Promise<RGBColor> {
    try {
      const image = sharp(imageBuffer);

      // Resize for faster processing
      const { data, info } = await image
        .resize(200, 200, { fit: 'fill' })
        .raw()
        .toBuffer({ resolveWithObject: true });

      // Build color histogram with quantized colors (reduce to 64 colors)
      const colorCounts = new Map<string, { count: number; rgb: RGBColor; score: number }>();

      for (let i = 0; i < data.length; i += info.channels) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];

        // Quantize to reduce similar colors (group into buckets of 32)
        const qR = Math.floor(r / 32) * 32;
        const qG = Math.floor(g / 32) * 32;
        const qB = Math.floor(b / 32) * 32;

        const key = `${qR},${qG},${qB}`;

        if (!colorCounts.has(key)) {
          // Calculate importance score based on saturation and brightness
          const score = this.calculateColorImportance(qR, qG, qB);
          colorCounts.set(key, {
            count: 1,
            rgb: { r: qR, g: qG, b: qB },
            score,
          });
        } else {
          const entry = colorCounts.get(key)!;
          entry.count++;
        }
      }

      // Find the most important color (weighted by count and score)
      let maxWeight = 0;
      let dominantColor: RGBColor = { r: 128, g: 128, b: 128 };

      for (const [_, data] of colorCounts) {
        // Weight = frequency * importance score
        const weight = data.count * data.score;

        if (weight > maxWeight) {
          maxWeight = weight;
          dominantColor = data.rgb;
        }
      }

      return dominantColor;
    } catch (error) {
      console.error('Error extracting most important color:', error);
      throw new Error('Failed to extract most important color');
    }
  }

  /**
   * Calculate color importance score
   * Higher score = more vibrant, saturated, and visually prominent
   */
  private calculateColorImportance(r: number, g: number, b: number): number {
    // Convert to HSV for better analysis
    const rNorm = r / 255;
    const gNorm = g / 255;
    const bNorm = b / 255;

    const max = Math.max(rNorm, gNorm, bNorm);
    const min = Math.min(rNorm, gNorm, bNorm);
    const delta = max - min;

    // Calculate saturation
    const saturation = max === 0 ? 0 : delta / max;

    // Calculate brightness (value in HSV)
    const brightness = max;

    // Ignore very dark colors (brightness < 0.2)
    if (brightness < 0.2) {
      return 0;
    }

    // Ignore very desaturated colors (grayscale)
    if (saturation < 0.15) {
      return 0.1;
    }

    // Score formula: prioritize saturated and moderately bright colors
    // Saturation weight: 2.0 (most important for visual pop)
    // Brightness weight: 1.0 (moderate brightness preferred)
    // Penalty for very bright colors (blown out highlights)
    const brightnessPenalty = brightness > 0.9 ? 0.5 : 1.0;

    const score = (saturation * 2.0 + brightness * 1.0) * brightnessPenalty;

    return score;
  }

  /**
   * Get multiple important colors from different regions
   * Useful for multi-zone setups
   */
  async getImportantColorsByZone(
    imageBuffer: Buffer,
    zones: Array<{ x: number; y: number; width: number; height: number }>
  ): Promise<RGBColor[]> {
    try {
      const image = sharp(imageBuffer);
      const metadata = await image.metadata();

      if (!metadata.width || !metadata.height) {
        throw new Error('Could not determine image dimensions');
      }

      const colors: RGBColor[] = [];

      for (const zone of zones) {
        // Calculate pixel coordinates
        const left = Math.round(zone.x * metadata.width);
        const top = Math.round(zone.y * metadata.height);
        const width = Math.round(zone.width * metadata.width);
        const height = Math.round(zone.height * metadata.height);

        // Extract the zone
        const zoneBuffer = await image
          .extract({ left, top, width, height })
          .toBuffer();

        // Get the most important color for this zone
        const color = await this.getMostImportantColor(zoneBuffer);
        colors.push(color);
      }

      return colors;
    } catch (error) {
      console.error('Error extracting zone colors:', error);
      throw new Error('Failed to extract zone colors');
    }
  }

  /**
   * Get color with edge detection emphasis
   * Focuses on edges and high-contrast areas which are visually important
   */
  async getMostImportantColorWithEdgeDetection(imageBuffer: Buffer): Promise<RGBColor> {
    try {
      const image = sharp(imageBuffer);

      // Apply edge detection
      const edgeDetected = await image
        .resize(200, 200, { fit: 'fill' })
        .convolve({
          width: 3,
          height: 3,
          kernel: [-1, -1, -1, -1, 8, -1, -1, -1, -1], // Edge detection kernel
        })
        .raw()
        .toBuffer();

      // Now get the most important color from edge-emphasized image
      const color = await this.getMostImportantColor(edgeDetected);

      return color;
    } catch (error) {
      console.error('Error with edge detection:', error);
      // Fallback to regular important color
      return this.getMostImportantColor(imageBuffer);
    }
  }
}
