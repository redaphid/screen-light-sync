import axios, { AxiosInstance } from 'axios';
import { RGBColor } from '../color/ColorExtractor';

export interface NanoleafDevice {
  ip: string;
  name?: string;
}

export interface NanoleafConfig {
  ip?: string;
  authToken?: string;
}

interface EffectData {
  command: string;
  animType: string;
  animData: string;
  loop: boolean;
  palette: any[];
}

/**
 * Controls Nanoleaf devices for screen synchronization
 */
export class NanoleafController {
  private ip?: string;
  private authToken?: string;
  private client?: AxiosInstance;
  private readonly port = 16021;

  constructor(config: NanoleafConfig = {}) {
    this.ip = config.ip;
    this.authToken = config.authToken;

    if (this.ip && this.authToken) {
      this.initClient();
    }
  }

  /**
   * Initialize the HTTP client
   */
  private initClient(): void {
    if (!this.ip || !this.authToken) {
      return;
    }

    this.client = axios.create({
      baseURL: `http://${this.ip}:${this.port}/api/v1/${this.authToken}`,
      timeout: 5000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Create a new authentication token
   * NOTE: You must hold the power button on the Nanoleaf for 5-7 seconds first!
   */
  async createAuthToken(ip: string): Promise<string> {
    try {
      console.log(`\n${'='.repeat(60)}`);
      console.log('HOLD THE POWER BUTTON ON YOUR NANOLEAF FOR 5-7 SECONDS!');
      console.log('The LED should start blinking.');
      console.log(`${'='.repeat(60)}\n`);
      console.log('Waiting 30 seconds for button press...');

      await new Promise(resolve => setTimeout(resolve, 30000));

      const response = await axios.post(
        `http://${ip}:${this.port}/api/v1/new`,
        {},
        { timeout: 10000 }
      );

      const authToken = response.data.auth_token;
      console.log(`✓ Auth token created successfully: ${authToken}`);

      this.ip = ip;
      this.authToken = authToken;
      this.initClient();

      return authToken;
    } catch (error: any) {
      console.error('Error creating auth token:', error.message);
      throw new Error('Failed to create auth token. Did you hold the power button?');
    }
  }

  /**
   * Connect to a Nanoleaf device with existing credentials
   */
  async connect(ip: string, authToken: string): Promise<void> {
    try {
      this.ip = ip;
      this.authToken = authToken;
      this.initClient();

      // Test the connection
      const info = await this.getInfo();
      console.log(`✓ Connected to Nanoleaf: ${info.name || 'Unknown'}`);
    } catch (error: any) {
      console.error('Error connecting to Nanoleaf:', error.message);
      throw new Error('Failed to connect to Nanoleaf device');
    }
  }

  /**
   * Get device information
   */
  async getInfo(): Promise<any> {
    if (!this.client) {
      throw new Error('Not connected to Nanoleaf device');
    }

    try {
      const response = await this.client.get('/');
      return response.data;
    } catch (error: any) {
      console.error('Error getting device info:', error.message);
      throw new Error('Failed to get device info');
    }
  }

  /**
   * Set the brightness (0-100)
   */
  async setBrightness(brightness: number): Promise<void> {
    if (!this.client) {
      throw new Error('Not connected to Nanoleaf device');
    }

    try {
      await this.client.put('/state', {
        brightness: { value: Math.min(100, Math.max(0, brightness)) },
      });
    } catch (error: any) {
      console.error('Error setting brightness:', error.message);
    }
  }

  /**
   * Turn on the Nanoleaf
   */
  async turnOn(): Promise<void> {
    if (!this.client) {
      throw new Error('Not connected to Nanoleaf device');
    }

    try {
      await this.client.put('/state', { on: { value: true } });
    } catch (error: any) {
      console.error('Error turning on:', error.message);
    }
  }

  /**
   * Turn off the Nanoleaf
   */
  async turnOff(): Promise<void> {
    if (!this.client) {
      throw new Error('Not connected to Nanoleaf device');
    }

    try {
      await this.client.put('/state', { on: { value: false } });
      console.log('✓ Nanoleaf turned off');
    } catch (error: any) {
      console.error('Error turning off:', error.message);
    }
  }

  /**
   * Set a solid color across all panels
   */
  async setSolidColor(color: RGBColor): Promise<void> {
    if (!this.client) {
      throw new Error('Not connected to Nanoleaf device');
    }

    try {
      // Nanoleaf uses HSV, but we can set RGB via effects
      // We'll use the write API with a solid color effect
      await this.client.put('/state', {
        hue: { value: this.rgbToHue(color) },
        sat: { value: this.rgbToSaturation(color) },
        brightness: { value: this.rgbToBrightness(color) },
      });
    } catch (error: any) {
      console.error('Error setting color:', error.message);
    }
  }

  /**
   * Convert RGB to Hue (0-360)
   */
  private rgbToHue(color: RGBColor): number {
    const r = color.r / 255;
    const g = color.g / 255;
    const b = color.b / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const delta = max - min;

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

    return h;
  }

  /**
   * Convert RGB to Saturation (0-100)
   */
  private rgbToSaturation(color: RGBColor): number {
    const r = color.r / 255;
    const g = color.g / 255;
    const b = color.b / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);

    if (max === 0) return 0;

    const s = (max - min) / max;
    return Math.round(s * 100);
  }

  /**
   * Convert RGB to Brightness (0-100)
   */
  private rgbToBrightness(color: RGBColor): number {
    const max = Math.max(color.r, color.g, color.b);
    return Math.round((max / 255) * 100);
  }

  /**
   * Get the current configuration
   */
  getConfig(): NanoleafConfig {
    return {
      ip: this.ip,
      authToken: this.authToken,
    };
  }
}
