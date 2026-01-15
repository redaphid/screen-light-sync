import { DxgiCapture, RGBColor, CaptureRegion } from '../capture/DxgiCapture'
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
}

export interface SyncStats {
  fps: number
  captureTime: number
  colorExtractionTime: number
  lightUpdateTime: number
  totalFrameTime: number
}

export class SyncEngine {
  private capture: DxgiCapture
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
    this.capture = new DxgiCapture()
    this.hueController = hueController
    this.nanoleafController = nanoleafController

    this.config = {
      fps: config.fps || 30,
      brightness: config.brightness || 255,
      colorBoost: config.colorBoost || 1.2,
      hueLightIds: config.hueLightIds || [],
      enableHue: config.enableHue !== false,
      enableNanoleaf: config.enableNanoleaf !== false,
    }
  }

  initCapture = async () => {
    await this.capture.initialize()
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

  stop(): void {
    if (!this.isRunning) {
      console.log('⚠ Sync engine is not running')
      return
    }

    console.log('\n🛑 Stopping screen-light synchronization...')

    if (this.syncInterval) {
      clearInterval(this.syncInterval)
      this.syncInterval = undefined
    }

    this.capture.cleanup()
    this.isRunning = false
  }

  private async syncFrame(): Promise<void> {
    const frameStart = Date.now()

    try {
      const captureStart = Date.now()

      // Build regions for Hue lights
      const huePositions = this.hueStreaming?.getNormalizedPositions() || []
      const hueRegions: CaptureRegion[] = huePositions.map(p => ({ x: p.x, y: p.y, size: 0.15 }))

      // Build regions for Nanoleaf panels
      const nanoleafRegions: CaptureRegion[] = []
      const streamerPanelCounts: number[] = []

      for (const streamer of this.nanoleafStreamers) {
        if (!streamer.isStreaming()) continue
        const panels = streamer.getNormalizedPanels()
        streamerPanelCounts.push(panels.length)
        for (const panel of panels) {
          nanoleafRegions.push({ x: panel.x, y: panel.y, size: 0.08 })
        }
      }

      // Capture all regions in one call
      const allRegions = [...hueRegions, ...nanoleafRegions]
      const colors = await this.capture.captureRegions(allRegions)
      const captureTime = Date.now() - captureStart

      const colorStart = Date.now()
      const enhanced = colors.map(c => this.enhanceColor(c, this.config.colorBoost))
      const hueColors = enhanced.slice(0, huePositions.length)
      const nanoleafColors = enhanced.slice(huePositions.length)
      const colorTime = Date.now() - colorStart

      const lightStart = Date.now()
      await this.updateLights(hueColors, huePositions, nanoleafColors, streamerPanelCounts)
      const lightTime = Date.now() - lightStart

      const totalTime = Date.now() - frameStart
      this.updateStats(captureTime, colorTime, lightTime, totalTime)
    } catch (error: any) {
      console.error('Error in sync frame:', error.message)
    }
  }

  private enhanceColor = (color: RGBColor, boost: number): RGBColor => {
    const max = Math.max(color.r, color.g, color.b)
    const min = Math.min(color.r, color.g, color.b)
    if (max === min) return color

    const mid = (max + min) / 2
    return {
      r: Math.min(255, Math.max(0, Math.round(mid + (color.r - mid) * boost))),
      g: Math.min(255, Math.max(0, Math.round(mid + (color.g - mid) * boost))),
      b: Math.min(255, Math.max(0, Math.round(mid + (color.b - mid) * boost))),
    }
  }

  private async updateLights(
    hueColors: RGBColor[],
    huePositions: Array<{ id: string, x: number, y: number }>,
    nanoleafColors: RGBColor[],
    streamerPanelCounts: number[]
  ): Promise<void> {
    // Send per-light colors to Hue
    if (this.config.enableHue && this.hueStreaming?.isStreaming()) {
      const lightColors = new Map<string, RGBColor>()
      huePositions.forEach((pos, i) => {
        lightColors.set(pos.id, hueColors[i] || { r: 0, g: 0, b: 0 })
      })
      this.hueStreaming.streamLightColors(lightColors)
    }

    // Distribute colors to Nanoleaf streamers
    if (this.config.enableNanoleaf) {
      let colorIdx = 0

      for (const streamer of this.nanoleafStreamers) {
        if (!streamer.isStreaming()) continue

        const panels = streamer.getNormalizedPanels()
        const panelColors = new Map<number, RGBColor>()

        for (const panel of panels) {
          panelColors.set(panel.panelId, nanoleafColors[colorIdx] || { r: 0, g: 0, b: 0 })
          colorIdx++
        }

        streamer.streamPanelColors(panelColors)
      }
    }
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
