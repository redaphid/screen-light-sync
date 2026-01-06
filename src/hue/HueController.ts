import { v3 } from 'node-hue-api';
import { RGBColor } from '../color/ColorExtractor';

const discovery = v3.discovery;
const hueApi = v3.api;
const LightState = v3.lightStates.LightState;

export interface HueBridge {
  ipaddress: string;
  name?: string;
}

export interface HueConfig {
  bridgeIp?: string;
  username?: string;
  appName?: string;
  deviceName?: string;
}

/**
 * Controls Philips Hue lights for screen synchronization
 */
export class HueController {
  private bridgeIp?: string;
  private username?: string;
  private apiInstance?: any;
  private appName: string;
  private deviceName: string;

  constructor(config: HueConfig = {}) {
    this.bridgeIp = config.bridgeIp;
    this.username = config.username;
    this.appName = config.appName || 'screen-light-sync';
    this.deviceName = config.deviceName || 'windows-pc';
  }

  /**
   * Discover Hue bridges on the network using N-UPnP (fast method)
   */
  async discoverBridges(): Promise<HueBridge[]> {
    try {
      console.log('Discovering Hue bridges...');
      const results = await discovery.nupnpSearch();

      if (results.length === 0) {
        console.log('No bridges found with N-UPnP, trying UPnP...');
        const upnpResults = await discovery.upnpSearch(5000);
        return upnpResults;
      }

      return results;
    } catch (error) {
      console.error('Error discovering bridges:', error);
      throw new Error('Failed to discover Hue bridges');
    }
  }

  async createUser(bridgeIp: string, askContinue?: () => Promise<boolean>): Promise<string> {
    const maxAttempts = 5
    const waitSeconds = 30

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      console.log(`\n${'='.repeat(60)}`)
      console.log(`  HUE BRIDGE PAIRING - ${bridgeIp}`)
      console.log(`${'='.repeat(60)}`)
      console.log('')
      console.log('  1. Find the large button on top of your Hue Bridge')
      console.log('  2. Press it once (it will light up)')
      console.log('  3. Pairing will happen automatically')
      console.log('')
      console.log(`${'='.repeat(60)}\n`)
      console.log(`Attempt ${attempt}/${maxAttempts}: Waiting ${waitSeconds}s for button press...`)

      await new Promise(resolve => setTimeout(resolve, waitSeconds * 1000))

      try {
        const unauthenticatedApi = await hueApi.createLocal(bridgeIp).connect()
        const createdUser = await unauthenticatedApi.users.createUser(
          this.appName,
          this.deviceName
        )

        const username = createdUser.username
        console.log(`✓ User created successfully: ${username}`)
        return username
      } catch (error: any) {
        console.log(`✗ Attempt ${attempt} failed: ${error.message}`)

        if (attempt === maxAttempts) {
          if (!askContinue) throw new Error('Failed to create user after maximum attempts')

          const shouldContinue = await askContinue()
          if (!shouldContinue) throw new Error('User cancelled authentication')

          return this.createUser(bridgeIp, askContinue)
        }
      }
    }

    throw new Error('Failed to create user')
  }

  /**
   * Connect to the Hue bridge
   */
  async connect(bridgeIp?: string, username?: string): Promise<void> {
    try {
      const ip = bridgeIp || this.bridgeIp;
      const user = username || this.username;

      if (!ip) {
        throw new Error('Bridge IP address is required');
      }

      if (!user) {
        throw new Error('Username is required. Create a user first.');
      }

      this.apiInstance = await hueApi.createLocal(ip).connect(user);
      this.bridgeIp = ip;
      this.username = user;

      console.log(`✓ Connected to Hue bridge at ${ip}`);
    } catch (error) {
      console.error('Error connecting to bridge:', error);
      throw new Error('Failed to connect to Hue bridge');
    }
  }

  /**
   * Get all lights on the bridge
   */
  async getLights(): Promise<any[]> {
    if (!this.apiInstance) {
      throw new Error('Not connected to bridge');
    }

    try {
      const lights = await this.apiInstance.lights.getAll();
      return lights;
    } catch (error) {
      console.error('Error getting lights:', error);
      throw new Error('Failed to get lights');
    }
  }

  /**
   * Check if a light supports color (has Color Gamut)
   */
  private supportsColor(light: any): boolean {
    // Check if light has color gamut capability
    if (light.capabilities?.control?.colorgamut) {
      return true;
    }
    // Also check the type - Extended color lights support RGB
    if (light.type?.toLowerCase().includes('color')) {
      return true;
    }
    return false;
  }

  /**
   * Get only color-capable lights
   */
  async getColorLights(): Promise<any[]> {
    const allLights = await this.getLights();
    return allLights.filter(light => this.supportsColor(light));
  }

  /**
   * Set a light to a specific RGB color
   * Automatically handles non-color lights by setting brightness only
   */
  async setLightColor(lightId: number, color: RGBColor, brightness: number = 255): Promise<void> {
    if (!this.apiInstance) {
      throw new Error('Not connected to bridge');
    }

    try {
      // Get the light to check capabilities
      const light = await this.apiInstance.lights.getLight(lightId);

      let state: any;

      if (this.supportsColor(light)) {
        // Color-capable light: set RGB color
        state = new LightState()
          .on(true)
          .rgb(color.r, color.g, color.b)
          .brightness(Math.round((brightness / 255) * 100));
      } else {
        // Non-color light: just set brightness based on color luminance
        const luminance = Math.round((0.299 * color.r + 0.587 * color.g + 0.114 * color.b));
        const adjustedBrightness = Math.round((luminance / 255) * (brightness / 255) * 100);

        state = new LightState()
          .on(true)
          .brightness(Math.max(1, adjustedBrightness)); // Minimum 1% brightness
      }

      await this.apiInstance.lights.setLightState(lightId, state);
    } catch (error) {
      console.error(`Error setting light ${lightId}:`, error);
      // Don't throw - keep going for other lights
    }
  }

  /**
   * Set multiple lights to different colors
   * Optimized for fast updates
   */
  async setMultipleLights(lightColors: Map<number, RGBColor>, brightness: number = 255): Promise<void> {
    if (!this.apiInstance) {
      throw new Error('Not connected to bridge');
    }

    const promises: Promise<void>[] = [];

    for (const [lightId, color] of lightColors) {
      promises.push(this.setLightColor(lightId, color, brightness));
    }

    await Promise.all(promises);
  }

  /**
   * Turn off all lights
   */
  async turnOffAll(): Promise<void> {
    if (!this.apiInstance) {
      throw new Error('Not connected to bridge');
    }

    try {
      const lights = await this.getLights();
      const state = new LightState().off();
      const promises = lights.map(light =>
        this.apiInstance.lights.setLightState(light.id, state)
      );

      await Promise.allSettled(promises);
      console.log('✓ All lights turned off');
    } catch (error) {
      console.error('Error turning off lights:', error);
      throw new Error('Failed to turn off lights');
    }
  }

  /**
   * Get the current configuration
   */
  getConfig(): HueConfig {
    return {
      bridgeIp: this.bridgeIp,
      username: this.username,
      appName: this.appName,
      deviceName: this.deviceName,
    };
  }
}
