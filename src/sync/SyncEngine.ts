import { FastColorSampler, RGBColor } from '../capture/FastColorSampler'
import { HueController } from '../hue/HueController'
import { HueStreamingController } from '../hue/HueStreamingController'
import { NanoleafController } from '../nanoleaf/NanoleafController'
import { NanoleafStreamingController } from '../nanoleaf/NanoleafStreamingController'

export interface SyncConfig {
  fps?: number
  brightness?: number
  colorBoost?: number
  hueLightIds?: number[]
  enableHue?: boolean
  enableNanoleaf?: boolean
  sampleStep?: number  // Sample every Nth pixel (default: 10)
}

export interface SyncStats {
  fps: number;
  captureTime: number;
  colorExtractionTime: number;
  lightUpdateTime: number;
  totalFrameTime: number;
}

/**
 * Main synchronization engine using FastColorSampler for low-latency capture
 */
export class SyncEngine {
  private sampler: FastColorSampler
  private hueController?: HueController
  private hueStreaming?: HueStreamingController
  private nanoleafController?: NanoleafController
  private nanoleafStreamers: NanoleafStreamingController[] = []

  private isRunning = false
  private syncInterval?: NodeJS.Timeout
  private config: Required<SyncConfig>

  private lastFrameTime = 0
  private frameCount = 0
  private stats: SyncStats = {
    fps: 0,
    captureTime: 0,
    colorExtractionTime: 0,
    lightUpdateTime: 0,
    totalFrameTime: 0,
  }

  constructor(
    hueController?: HueController,
    nanoleafController?: NanoleafController,
    config: SyncConfig = {}
  ) {
    const sampleStep = config.sampleStep || 10
    this.sampler = new FastColorSampler(sampleStep)
    this.hueController = hueController
    this.nanoleafController = nanoleafController

    this.config = {
      fps: config.fps || 10,
      brightness: config.brightness || 255,
      colorBoost: config.colorBoost || 1.2,
      hueLightIds: config.hueLightIds || [],
      enableHue: config.enableHue !== false,
      enableNanoleaf: config.enableNanoleaf !== false,
      sampleStep,
    }
  }

  async initNanoleafStreaming(ip: string, authToken: string): Promise<void> {
    const streamer = new NanoleafStreamingController(ip, authToken)
    await streamer.initialize()
    this.nanoleafStreamers.push(streamer)
  }

  async initHueStreaming(bridgeIp: string, username: string, clientKey: string, groupId?: string): Promise<void> {
    this.hueStreaming = new HueStreamingController({
      bridgeIp,
      username,
      clientKey,
      entertainmentGroupId: groupId,
    })
    await this.hueStreaming.initialize()
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

  private async syncFrame(): Promise<void> {
    const frameStart = Date.now()

    try {
      // 1. Capture + extract color in one step (no JPEG encoding!)
      const captureStart = Date.now()
      let color = this.sampler.getAverageColor()
      const captureTime = Date.now() - captureStart

      // 2. Enhance color
      const colorStart = Date.now()
      color = this.sampler.enhanceColor(color, this.config.colorBoost)
      const colorTime = Date.now() - colorStart

      // 3. Update lights
      const lightStart = Date.now()
      await this.updateLights(color)
      const lightTime = Date.now() - lightStart

      const totalTime = Date.now() - frameStart
      this.updateStats(captureTime, colorTime, lightTime, totalTime)
    } catch (error: any) {
      console.error('Error in sync frame:', error.message)
    }
  }

  /**
   * Update all connected lights
   */
  private async updateLights(color: RGBColor): Promise<void> {
    const promises: Promise<any>[] = [];

    // Update Hue lights - prefer DTLS streaming over REST
    if (this.config.enableHue) {
      if (this.hueStreaming?.isStreaming()) {
        this.hueStreaming.streamSolidColor(color)
      } else if (this.hueController) {
        if (this.config.hueLightIds.length > 0) {
          const lightColors = new Map<number, RGBColor>()
          for (const lightId of this.config.hueLightIds) {
            lightColors.set(lightId, color)
          }
          promises.push(this.hueController.setMultipleLights(lightColors, this.config.brightness))
        } else {
          const lights = await this.hueController.getLights()
          const lightColors = new Map<number, RGBColor>()
          for (const light of lights) {
            lightColors.set(light.id, color)
          }
          promises.push(this.hueController.setMultipleLights(lightColors, this.config.brightness))
        }
      }
    }

    // Update Nanoleaf - prefer UDP streaming over REST
    if (this.config.enableNanoleaf) {
      if (this.nanoleafStreamers.length > 0) {
        for (const streamer of this.nanoleafStreamers) {
          if (streamer.isStreaming()) {
            streamer.streamSolidColor(color)
          }
        }
      } else if (this.nanoleafController) {
        promises.push(this.nanoleafController.setSolidColor(color))
      }
    }

    if (promises.length > 0) await Promise.all(promises)
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
