import { ScreenCapture } from '../capture/ScreenCapture';
import { ColorExtractor, RGBColor, ScreenZone } from '../color/ColorExtractor';
import { HueController } from '../hue/HueController';
import { NanoleafController } from '../nanoleaf/NanoleafController';

export interface SyncConfig {
  fps?: number;                    // Frames per second (default: 10)
  brightness?: number;              // Global brightness 0-255 (default: 255)
  colorBoost?: number;              // Saturation boost multiplier (default: 1.2)
  zones?: ScreenZone[];             // Screen zones for multi-light setups
  hueLightIds?: number[];           // Specific Hue lights to control
  enableHue?: boolean;              // Enable Hue lights (default: true)
  enableNanoleaf?: boolean;         // Enable Nanoleaf (default: true)
}

export interface SyncStats {
  fps: number;
  captureTime: number;
  colorExtractionTime: number;
  lightUpdateTime: number;
  totalFrameTime: number;
}

/**
 * Main synchronization engine that coordinates screen capture and light updates
 */
export class SyncEngine {
  private screenCapture: ScreenCapture;
  private colorExtractor: ColorExtractor;
  private hueController?: HueController;
  private nanoleafController?: NanoleafController;

  private isRunning = false;
  private syncInterval?: NodeJS.Timeout;
  private config: Required<SyncConfig>;

  // Performance tracking
  private lastFrameTime = 0;
  private frameCount = 0;
  private stats: SyncStats = {
    fps: 0,
    captureTime: 0,
    colorExtractionTime: 0,
    lightUpdateTime: 0,
    totalFrameTime: 0,
  };

  constructor(
    hueController?: HueController,
    nanoleafController?: NanoleafController,
    config: SyncConfig = {}
  ) {
    this.screenCapture = new ScreenCapture();
    this.colorExtractor = new ColorExtractor();
    this.hueController = hueController;
    this.nanoleafController = nanoleafController;

    // Set defaults
    this.config = {
      fps: config.fps || 10,
      brightness: config.brightness || 255,
      colorBoost: config.colorBoost || 1.2,
      zones: config.zones || [],
      hueLightIds: config.hueLightIds || [],
      enableHue: config.enableHue !== false,
      enableNanoleaf: config.enableNanoleaf !== false,
    };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<SyncConfig>): void {
    this.config = { ...this.config, ...config };

    if (this.isRunning) {
      this.stop();
      this.start();
    }
  }

  /**
   * Start the synchronization loop
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('⚠ Sync engine is already running');
      return;
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log('🚀 Starting screen-light synchronization...');
    console.log(`   FPS: ${this.config.fps}`);
    console.log(`   Brightness: ${this.config.brightness}`);
    console.log(`   Color Boost: ${this.config.colorBoost}x`);
    console.log(`   Hue Enabled: ${this.config.enableHue}`);
    console.log(`   Nanoleaf Enabled: ${this.config.enableNanoleaf}`);
    console.log(`${'='.repeat(60)}\n`);

    this.isRunning = true;
    this.lastFrameTime = Date.now();

    const intervalMs = 1000 / this.config.fps;

    this.syncInterval = setInterval(async () => {
      await this.syncFrame();
    }, intervalMs);

    // Log stats every 5 seconds
    setInterval(() => {
      if (this.isRunning) {
        this.logStats();
      }
    }, 5000);
  }

  /**
   * Stop the synchronization loop
   */
  stop(): void {
    if (!this.isRunning) {
      console.log('⚠ Sync engine is not running');
      return;
    }

    console.log('\n🛑 Stopping screen-light synchronization...');

    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = undefined;
    }

    this.isRunning = false;
  }

  /**
   * Synchronize one frame
   */
  private async syncFrame(): Promise<void> {
    const frameStart = Date.now();

    try {
      // 1. Capture screen
      const captureStart = Date.now();
      const screenshot = await this.screenCapture.capture({ format: 'jpg' });
      const captureTime = Date.now() - captureStart;

      // 2. Extract color
      const colorStart = Date.now();
      let color: RGBColor;

      if (this.config.zones.length > 0) {
        // Multi-zone mode: Use first zone for now
        // TODO: Implement per-light zone mapping
        const zoneColors = await this.colorExtractor.getZoneColors(screenshot, this.config.zones);
        color = zoneColors[0]?.color || { r: 0, g: 0, b: 0 };
      } else {
        // Full screen average
        color = await this.colorExtractor.getAverageColor(screenshot);
      }

      // Enhance the color
      color = this.colorExtractor.enhanceColor(color, this.config.colorBoost);

      const colorTime = Date.now() - colorStart;

      // 3. Update lights
      const lightStart = Date.now();
      await this.updateLights(color);
      const lightTime = Date.now() - lightStart;

      // Update stats
      const totalTime = Date.now() - frameStart;
      this.updateStats(captureTime, colorTime, lightTime, totalTime);

    } catch (error: any) {
      console.error('Error in sync frame:', error.message);
    }
  }

  /**
   * Update all connected lights
   */
  private async updateLights(color: RGBColor): Promise<void> {
    const promises: Promise<any>[] = [];

    // Update Hue lights
    if (this.config.enableHue && this.hueController) {
      if (this.config.hueLightIds.length > 0) {
        // Update specific lights
        const lightColors = new Map<number, RGBColor>();
        for (const lightId of this.config.hueLightIds) {
          lightColors.set(lightId, color);
        }
        promises.push(
          this.hueController.setMultipleLights(lightColors, this.config.brightness)
        );
      } else {
        // Update all lights
        const lights = await this.hueController.getLights();
        const lightColors = new Map<number, RGBColor>();
        for (const light of lights) {
          lightColors.set(light.id, color);
        }
        promises.push(
          this.hueController.setMultipleLights(lightColors, this.config.brightness)
        );
      }
    }

    // Update Nanoleaf
    if (this.config.enableNanoleaf && this.nanoleafController) {
      promises.push(this.nanoleafController.setSolidColor(color));
    }

    await Promise.all(promises);
  }

  /**
   * Update performance statistics
   */
  private updateStats(captureTime: number, colorTime: number, lightTime: number, totalTime: number): void {
    this.frameCount++;

    const now = Date.now();
    const elapsed = now - this.lastFrameTime;

    // Calculate actual FPS
    const currentFps = 1000 / elapsed;

    // Update stats (moving average)
    const alpha = 0.1; // Smoothing factor
    this.stats.fps = this.stats.fps * (1 - alpha) + currentFps * alpha;
    this.stats.captureTime = this.stats.captureTime * (1 - alpha) + captureTime * alpha;
    this.stats.colorExtractionTime = this.stats.colorExtractionTime * (1 - alpha) + colorTime * alpha;
    this.stats.lightUpdateTime = this.stats.lightUpdateTime * (1 - alpha) + lightTime * alpha;
    this.stats.totalFrameTime = this.stats.totalFrameTime * (1 - alpha) + totalTime * alpha;

    this.lastFrameTime = now;
  }

  /**
   * Log performance statistics
   */
  private logStats(): void {
    console.log(`📊 Stats: FPS=${this.stats.fps.toFixed(1)} | ` +
      `Capture=${this.stats.captureTime.toFixed(1)}ms | ` +
      `Color=${this.stats.colorExtractionTime.toFixed(1)}ms | ` +
      `Lights=${this.stats.lightUpdateTime.toFixed(1)}ms | ` +
      `Total=${this.stats.totalFrameTime.toFixed(1)}ms`);
  }

  /**
   * Get current statistics
   */
  getStats(): SyncStats {
    return { ...this.stats };
  }

  /**
   * Check if the engine is running
   */
  isActive(): boolean {
    return this.isRunning;
  }
}
