import * as robot from 'robotjs';
import sharp from 'sharp';

export interface Display {
  id: string;
  name: string;
}

export interface CaptureOptions {
  displayId?: string;
  format?: 'png' | 'jpg';
}

/**
 * Handles screen capture functionality using robotjs (fast Windows Desktop Duplication API)
 * Performance: ~30ms per capture on typical systems
 */
export class ScreenCapture {
  private screenSize: { width: number; height: number };

  constructor() {
    // Cache screen size for performance
    this.screenSize = robot.getScreenSize();
  }

  /**
   * Get a list of all available displays
   * Note: robotjs captures the primary display only
   */
  async getDisplays(): Promise<Display[]> {
    return [
      {
        id: 'primary',
        name: `Primary Display (${this.screenSize.width}x${this.screenSize.height})`
      }
    ];
  }

  /**
   * Set the display to capture from
   * Note: robotjs only supports primary display
   */
  setDisplay(displayId: string): void {
    // robotjs only supports primary display, so this is a no-op
    // Kept for API compatibility
  }

  /**
   * Capture a screenshot from the primary display
   * @returns Buffer containing the screenshot image data
   */
  async capture(options: CaptureOptions = {}): Promise<Buffer> {
    try {
      const format = options.format || 'jpg';

      // Capture screen using robotjs (very fast, ~30ms)
      const img = robot.screen.capture();

      // robotjs returns BGRA pixel data
      // We need to convert it to RGB for sharp
      const { width, height, image: pixelData } = img;

      // Create RGB buffer from BGRA data
      const rgbBuffer = Buffer.alloc(width * height * 3);
      let rgbIndex = 0;

      // robotjs uses BGRA format (4 bytes per pixel)
      for (let i = 0; i < pixelData.length; i += 4) {
        const b = pixelData[i];
        const g = pixelData[i + 1];
        const r = pixelData[i + 2];
        // Skip alpha channel (i + 3)

        rgbBuffer[rgbIndex++] = r;
        rgbBuffer[rgbIndex++] = g;
        rgbBuffer[rgbIndex++] = b;
      }

      // Convert RGB buffer to PNG or JPEG using sharp
      let sharpInstance = sharp(rgbBuffer, {
        raw: {
          width,
          height,
          channels: 3
        }
      });

      if (format === 'jpg') {
        sharpInstance = sharpInstance.jpeg({ quality: 80 });
      } else {
        sharpInstance = sharpInstance.png();
      }

      return await sharpInstance.toBuffer();
    } catch (error) {
      console.error('Error capturing screenshot:', error);
      throw new Error('Failed to capture screenshot');
    }
  }

  /**
   * Capture screenshots from all displays
   * Note: robotjs only supports primary display
   */
  async captureAll(): Promise<Buffer[]> {
    return [await this.capture()];
  }

  /**
   * Get raw pixel data directly (fastest option for color extraction)
   * Returns BGRA pixel buffer without image encoding
   */
  captureRaw(): { width: number; height: number; data: Buffer } {
    const img = robot.screen.capture();
    return {
      width: img.width,
      height: img.height,
      data: img.image
    };
  }
}
