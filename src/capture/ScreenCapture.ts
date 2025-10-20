import screenshot from 'screenshot-desktop';

export interface Display {
  id: string;
  name: string;
}

export interface CaptureOptions {
  displayId?: string;
  format?: 'png' | 'jpg';
}

/**
 * Handles screen capture functionality using the screenshot-desktop library
 */
export class ScreenCapture {
  private currentDisplayId?: string;

  /**
   * Get a list of all available displays
   */
  async getDisplays(): Promise<Display[]> {
    try {
      const displays = await screenshot.listDisplays();
      return displays;
    } catch (error) {
      console.error('Error listing displays:', error);
      throw new Error('Failed to list displays');
    }
  }

  /**
   * Set the display to capture from
   */
  setDisplay(displayId: string): void {
    this.currentDisplayId = displayId;
  }

  /**
   * Capture a screenshot from the current or specified display
   * @returns Buffer containing the screenshot image data
   */
  async capture(options: CaptureOptions = {}): Promise<Buffer> {
    try {
      const displayId = options.displayId || this.currentDisplayId;
      const format = options.format || 'jpg';

      const captureOptions: any = { format };

      if (displayId) {
        captureOptions.screen = displayId;
      }

      const imgBuffer = await screenshot(captureOptions);
      return imgBuffer;
    } catch (error) {
      console.error('Error capturing screenshot:', error);
      throw new Error('Failed to capture screenshot');
    }
  }

  /**
   * Capture screenshots from all displays
   */
  async captureAll(): Promise<Buffer[]> {
    try {
      const images = await screenshot.all();
      return images;
    } catch (error) {
      console.error('Error capturing all displays:', error);
      throw new Error('Failed to capture all displays');
    }
  }
}
