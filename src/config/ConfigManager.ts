import * as fs from 'fs/promises';
import * as path from 'path';
import { ScreenZone } from '../color/ColorExtractor';

export interface NanoleafDevice {
  ip: string
  authToken: string
}

export interface AppConfig {
  hue: {
    bridgeIp: string
    username: string
    clientKey?: string
    lightIds: number[]
    entertainmentAreaId?: string | null
  }
  nanoleaf: NanoleafDevice
  nanoleafDevices?: NanoleafDevice[]
  sync: {
    fps: number;
    brightness: number;
    colorBoost: number;
    zones: ScreenZone[];
    enableHue: boolean;
    enableNanoleaf: boolean;
    useAdvancedColorDetection: boolean;
    hueEntertainmentAreaId: number | null;
    hueRegularLightIds: number[];
  };
}

/**
 * Manages application configuration persistence
 */
export class ConfigManager {
  private configPath: string;
  private config: AppConfig;

  constructor(configPath: string = './config.json') {
    this.configPath = path.resolve(configPath);
    this.config = ConfigManager.createDefaultConfig();
  }

  /**
   * Load configuration from file
   */
  async load(): Promise<AppConfig> {
    try {
      const data = await fs.readFile(this.configPath, 'utf-8');
      const loadedConfig = JSON.parse(data);
      // Merge with defaults to ensure all required fields exist
      this.config = this.mergeDeep(ConfigManager.createDefaultConfig(), loadedConfig);
      console.log(`✓ Configuration loaded from ${this.configPath}`);
      return this.config;
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        console.log('ℹ No configuration file found, starting with defaults');
        this.config = ConfigManager.createDefaultConfig();
        return this.config;
      }
      console.error('Error loading configuration:', error.message);
      throw error;
    }
  }

  /**
   * Save configuration to file
   */
  async save(config?: AppConfig): Promise<void> {
    try {
      const configToSave = config || this.config;
      const data = JSON.stringify(configToSave, null, 2);
      await fs.writeFile(this.configPath, data, 'utf-8');
      this.config = configToSave;
      console.log(`✓ Configuration saved to ${this.configPath}`);
    } catch (error: any) {
      console.error('Error saving configuration:', error.message);
      throw error;
    }
  }

  /**
   * Update partial configuration
   */
  async update(updates: Partial<AppConfig>): Promise<void> {
    this.config = this.mergeDeep(this.config, updates);
    await this.save();
  }

  /**
   * Get current configuration
   */
  get(): AppConfig {
    return { ...this.config };
  }

  /**
   * Deep merge objects
   */
  private mergeDeep(target: any, source: any): any {
    const output = { ...target };
    if (this.isObject(target) && this.isObject(source)) {
      Object.keys(source).forEach(key => {
        if (this.isObject(source[key])) {
          if (!(key in target)) {
            Object.assign(output, { [key]: source[key] });
          } else {
            output[key] = this.mergeDeep(target[key], source[key]);
          }
        } else {
          Object.assign(output, { [key]: source[key] });
        }
      });
    }
    return output;
  }

  /**
   * Check if value is an object
   */
  private isObject(item: any): boolean {
    return item && typeof item === 'object' && !Array.isArray(item);
  }

  /**
   * Create a default configuration template
   */
  static createDefaultConfig(): AppConfig {
    return {
      hue: {
        bridgeIp: '',
        username: '',
        lightIds: [],
        entertainmentAreaId: null,
      },
      nanoleaf: {
        ip: '',
        authToken: '',
      },
      sync: {
        fps: 15,
        brightness: 255,
        colorBoost: 1.2,
        enableHue: false,
        enableNanoleaf: false,
        zones: [],
        useAdvancedColorDetection: true,
        hueEntertainmentAreaId: null,
        hueRegularLightIds: [],
      },
    };
  }
}
