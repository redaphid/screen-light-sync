import { ScreenCapture } from '../capture/ScreenCapture';
import { ColorExtractor, RGBColor } from '../color/ColorExtractor';
import { AdvancedColorExtractor } from '../color/ColorExtractor_advanced';
import { HueController } from '../hue/HueController';
import { HueEntertainmentController } from '../hue/HueEntertainmentController';
import { NanoleafAdvancedController } from '../nanoleaf/NanoleafAdvancedController';

export interface AdvancedSyncConfig {
  fps: number;
  brightness: number;
  colorBoost: number;

  // Hue configuration
  enableHue: boolean;
  hueEntertainmentAreaId: number | null;
  hueRegularLightIds: number[];  // Lights not in entertainment area

  // Nanoleaf configuration
  enableNanoleaf: boolean;
  useAdvancedColorDetection: boolean;  // Use "most important color" algorithm
}

export interface SyncStats {
  fps: number;
  captureTime: number;
  colorExtractionTime: number;
  hueEntertainmentTime: number;
  hueRegularTime: number;
  nanoleafTime: number;
  totalFrameTime: number;
}

/**
 * Advanced synchronization engine with hybrid Entertainment + Regular API
 * and per-panel Nanoleaf mapping
 */
export class AdvancedSyncEngine {
  private screenCapture: ScreenCapture;
  private colorExtractor: ColorExtractor;
  private advancedColorExtractor: AdvancedColorExtractor;

  private hueRegular?: HueController;
  private hueEntertainment?: HueEntertainmentController;
  private nanoleaf?: NanoleafAdvancedController;

  private isRunning = false;
  private syncInterval?: NodeJS.Timeout;
  private config: Required<AdvancedSyncConfig>;

  // Performance tracking
  private lastFrameTime = 0;
  private frameCount = 0;
  private stats: SyncStats = {
    fps: 0,
    captureTime: 0,
    colorExtractionTime: 0,
    hueEntertainmentTime: 0,
    hueRegularTime: 0,
    nanoleafTime: 0,
    totalFrameTime: 0,
  };

  constructor(
    hueRegular?: HueController,
    hueEntertainment?: HueEntertainmentController,
    nanoleaf?: NanoleafAdvancedController,
    config: Partial<AdvancedSyncConfig> = {}
  ) {
    this.screenCapture = new ScreenCapture();
    this.colorExtractor = new ColorExtractor();
    this.advancedColorExtractor = new AdvancedColorExtractor();

    this.hueRegular = hueRegular;
    this.hueEntertainment = hueEntertainment;
    this.nanoleaf = nanoleaf;

    this.config = {
      fps: config.fps ?? 15,
      brightness: config.brightness ?? 255,
      colorBoost: config.colorBoost ?? 1.2,
      enableHue: config.enableHue ?? true,
      hueEntertainmentAreaId: config.hueEntertainmentAreaId ?? null,
      hueRegularLightIds: config.hueRegularLightIds ?? [],
      enableNanoleaf: config.enableNanoleaf ?? true,
      useAdvancedColorDetection: config.useAdvancedColorDetection ?? true,
    };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<AdvancedSyncConfig>): void {
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

    console.log(`\n${'='.repeat(70)}`);
    console.log('🚀 Starting ADVANCED screen-light synchronization...');
    console.log(`   FPS: ${this.config.fps}`);
    console.log(`   Brightness: ${this.config.brightness}`);
    console.log(`   Color Detection: ${this.config.useAdvancedColorDetection ? 'Advanced (Most Important)' : 'Average'}`);
    console.log(`   Hue Entertainment API: ${this.hueEntertainment ? '✓ ENABLED (Fast)' : '✗ Disabled'}`);
    console.log(`   Hue Regular API: ${this.config.hueRegularLightIds.length > 0 ? '✓ ENABLED' : '✗ Disabled'}`);
    console.log(`   Nanoleaf Panel Mapping: ${this.nanoleaf ? '✓ ENABLED' : '✗ Disabled'}`);
    console.log(`${'='.repeat(70)}\n`);

    // Activate entertainment area if configured
    if (this.hueEntertainment && this.config.hueEntertainmentAreaId !== null) {
      console.log('Activating Hue Entertainment area...');
      await this.hueEntertainment.activateEntertainmentArea(this.config.hueEntertainmentAreaId);
    }

    // Get Nanoleaf panel layout and create mappings
    if (this.nanoleaf) {
      console.log('Mapping Nanoleaf panels to screen regions...');
      await this.nanoleaf.getPanelLayout();
      this.nanoleaf.createScreenMapping();
    }

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
  async stop(): Promise<void> {
    if (!this.isRunning) {
      console.log('⚠ Sync engine is not running');
      return;
    }

    console.log('\n🛑 Stopping screen-light synchronization...');

    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = undefined;
    }

    // Deactivate entertainment area
    if (this.hueEntertainment) {
      await this.hueEntertainment.deactivateEntertainmentArea();
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

      // 2. Extract colors for different components
      const colorStart = Date.now();

      // For Hue Entertainment & Regular API - use whole screen
      let mainColor: RGBColor;
      if (this.config.useAdvancedColorDetection) {
        mainColor = await this.advancedColorExtractor.getMostImportantColor(screenshot);
      } else {
        mainColor = await this.colorExtractor.getAverageColor(screenshot);
      }
      mainColor = this.colorExtractor.enhanceColor(mainColor, this.config.colorBoost);

      // For Nanoleaf - get colors for each panel's screen zone
      let nanoleafColors: Map<number, RGBColor> | undefined;
      if (this.nanoleaf && this.config.enableNanoleaf) {
        const mappings = this.nanoleaf.getScreenMappings();
        const zones = mappings.map(m => m.screenZone);

        let zoneColors: RGBColor[];
        if (this.config.useAdvancedColorDetection) {
          zoneColors = await this.advancedColorExtractor.getImportantColorsByZone(screenshot, zones);
        } else {
          const zoneColorData = await this.colorExtractor.getZoneColors(
            screenshot,
            zones.map((z, i) => ({ name: `panel${i}`, ...z }))
          );
          zoneColors = zoneColorData.map(zc => zc.color);
        }

        // Enhance all zone colors
        zoneColors = zoneColors.map(c => this.colorExtractor.enhanceColor(c, this.config.colorBoost));

        // Map colors to panel IDs
        nanoleafColors = new Map();
        mappings.forEach((mapping, index) => {
          nanoleafColors!.set(mapping.panelId, zoneColors[index]);
        });
      }

      const colorTime = Date.now() - colorStart;

      // 3. Update all lights in parallel
      const updatePromises: Promise<number>[] = [];

      // Update Hue Entertainment API (fast path)
      if (this.hueEntertainment && this.config.enableHue && this.config.hueEntertainmentAreaId !== null) {
        updatePromises.push(this.updateHueEntertainment(mainColor));
      }

      // Update Hue Regular API (remaining lights)
      if (this.hueRegular && this.config.enableHue && this.config.hueRegularLightIds.length > 0) {
        updatePromises.push(this.updateHueRegular(mainColor));
      }

      // Update Nanoleaf with per-panel colors
      if (this.nanoleaf && this.config.enableNanoleaf && nanoleafColors) {
        updatePromises.push(this.updateNanoleaf(nanoleafColors));
      }

      const [hueEntTime = 0, hueRegTime = 0, nanoleafTime = 0] = await Promise.all(updatePromises);

      // Update stats
      const totalTime = Date.now() - frameStart;
      this.updateStats(captureTime, colorTime, hueEntTime, hueRegTime, nanoleafTime, totalTime);

    } catch (error: any) {
      console.error('Error in sync frame:', error.message);
    }
  }

  /**
   * Update Hue Entertainment API lights
   */
  private async updateHueEntertainment(color: RGBColor): Promise<number> {
    const start = Date.now();

    if (!this.hueEntertainment) return 0;

    try {
      // Get entertainment area lights
      const areas = await this.hueEntertainment.getEntertainmentAreas();
      const area = areas.find(a => a.id === this.config.hueEntertainmentAreaId);

      if (area) {
        const lightColors = new Map<number, RGBColor>();
        for (const lightId of area.lights) {
          lightColors.set(lightId, color);
        }
        await this.hueEntertainment.setEntertainmentLights(lightColors);
      }
    } catch (error: any) {
      // Ignore errors in fast mode
    }

    return Date.now() - start;
  }

  /**
   * Update Hue Regular API lights
   */
  private async updateHueRegular(color: RGBColor): Promise<number> {
    const start = Date.now();

    if (!this.hueRegular) return 0;

    try {
      const lightColors = new Map<number, RGBColor>();
      for (const lightId of this.config.hueRegularLightIds) {
        lightColors.set(lightId, color);
      }
      await this.hueRegular.setMultipleLights(lightColors, this.config.brightness);
    } catch (error: any) {
      // Ignore errors
    }

    return Date.now() - start;
  }

  /**
   * Update Nanoleaf panels
   */
  private async updateNanoleaf(panelColors: Map<number, RGBColor>): Promise<number> {
    const start = Date.now();

    if (!this.nanoleaf) return 0;

    try {
      await this.nanoleaf.setPanelColors(panelColors);
    } catch (error: any) {
      // Ignore errors
    }

    return Date.now() - start;
  }

  /**
   * Update performance statistics
   */
  private updateStats(
    captureTime: number,
    colorTime: number,
    hueEntTime: number,
    hueRegTime: number,
    nanoleafTime: number,
    totalTime: number
  ): void {
    this.frameCount++;

    const now = Date.now();
    const elapsed = now - this.lastFrameTime;
    const currentFps = 1000 / elapsed;

    const alpha = 0.1;
    this.stats.fps = this.stats.fps * (1 - alpha) + currentFps * alpha;
    this.stats.captureTime = this.stats.captureTime * (1 - alpha) + captureTime * alpha;
    this.stats.colorExtractionTime = this.stats.colorExtractionTime * (1 - alpha) + colorTime * alpha;
    this.stats.hueEntertainmentTime = this.stats.hueEntertainmentTime * (1 - alpha) + hueEntTime * alpha;
    this.stats.hueRegularTime = this.stats.hueRegularTime * (1 - alpha) + hueRegTime * alpha;
    this.stats.nanoleafTime = this.stats.nanoleafTime * (1 - alpha) + nanoleafTime * alpha;
    this.stats.totalFrameTime = this.stats.totalFrameTime * (1 - alpha) + totalTime * alpha;

    this.lastFrameTime = now;
  }

  /**
   * Log performance statistics
   */
  private logStats(): void {
    console.log(
      `📊 FPS=${this.stats.fps.toFixed(1)} | ` +
      `Cap=${this.stats.captureTime.toFixed(0)}ms | ` +
      `Col=${this.stats.colorExtractionTime.toFixed(0)}ms | ` +
      `HueEnt=${this.stats.hueEntertainmentTime.toFixed(0)}ms | ` +
      `HueReg=${this.stats.hueRegularTime.toFixed(0)}ms | ` +
      `Nano=${this.stats.nanoleafTime.toFixed(0)}ms | ` +
      `Tot=${this.stats.totalFrameTime.toFixed(0)}ms`
    );
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
