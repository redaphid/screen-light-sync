declare module 'screenshot-desktop' {
  export interface Display {
    id: string;
    name: string;
  }

  export interface ScreenshotOptions {
    screen?: string;
    format?: 'png' | 'jpg';
    filename?: string;
  }

  function screenshot(options?: ScreenshotOptions): Promise<Buffer>;

  namespace screenshot {
    function listDisplays(): Promise<Display[]>;
    function all(): Promise<Buffer[]>;
  }

  export default screenshot;
}
