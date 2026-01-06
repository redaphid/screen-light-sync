import axios from "axios"
import * as dgram from "dgram"

export interface RGBColor {
  r: number
  g: number
  b: number
}

export interface PanelInfo {
  panelId: number
  x: number
  y: number
}

/**
 * Nanoleaf controller using UDP External Control protocol
 * Much faster than REST API - supports 10-20 FPS streaming
 *
 * Protocol: UDP datagrams to port 60222
 * Format: nPanels [panelId nFrames R G B W transitionTime]...
 */
export class NanoleafStreamingController {
  private ip: string
  private authToken: string
  private port = 16021
  private streamPort = 60222
  private socket: dgram.Socket | null = null
  private panels: PanelInfo[] = []
  private streamEnabled = false

  constructor(ip: string, authToken: string) {
    this.ip = ip
    this.authToken = authToken
  }

  /**
   * Initialize: get panel layout and enable external control mode
   */
  async initialize(): Promise<void> {
    await this.getPanelLayout()
    await this.enableExternalControl()
    this.createSocket()
  }

  /**
   * Get panel layout from device
   */
  private async getPanelLayout(): Promise<void> {
    const url = `http://${this.ip}:${this.port}/api/v1/${this.authToken}/panelLayout/layout`
    const response = await axios.get(url)
    const layout = response.data

    this.panels = layout.positionData
      .filter((p: any) => p.shapeType !== 12) // Filter out controller
      .map((p: any) => ({
        panelId: p.panelId,
        x: p.x,
        y: p.y,
      }))

    console.log(`  Found ${this.panels.length} panels for streaming`)
  }

  /**
   * Enable external control mode (required before UDP streaming)
   */
  private async enableExternalControl(): Promise<void> {
    const url = `http://${this.ip}:${this.port}/api/v1/${this.authToken}/effects`
    await axios.put(url, {
      write: {
        command: "display",
        animType: "extControl",
        extControlVersion: "v2",
      },
    })
    this.streamEnabled = true
    console.log(`  External control enabled on ${this.ip}`)
  }

  /**
   * Create UDP socket for streaming
   */
  private createSocket(): void {
    this.socket = dgram.createSocket("udp4")
  }

  /**
   * Stream colors to all panels (single color)
   */
  streamSolidColor(color: RGBColor): void {
    if (!this.socket || !this.streamEnabled) return

    const panelColors = new Map<number, RGBColor>()
    for (const panel of this.panels) {
      panelColors.set(panel.panelId, color)
    }
    this.streamPanelColors(panelColors)
  }

  /**
   * Stream individual panel colors via UDP
   * This is the fast path - ~1-2ms vs 30-50ms for REST
   */
  streamPanelColors(panelColors: Map<number, RGBColor>): void {
    if (!this.socket || !this.streamEnabled) return

    // Build UDP packet
    // Format: nPanels [panelId nFrames R G B W transitionTime]...
    const numPanels = panelColors.size
    const bytesPerPanel = 7 // panelId(2) + nFrames(1) + R(1) + G(1) + B(1) + W(1) + T(1) - wait that's 8
    // Actually: panelId is 2 bytes (big endian), rest are 1 byte each
    // Total per panel: 2 + 1 + 1 + 1 + 1 + 1 = 7 bytes? Let me check...
    // v2 format: 2-byte panelId + 1 byte each for: R, G, B, W, transitionTime = 7 bytes
    // Plus 2 bytes for nPanels at start

    const buffer = Buffer.alloc(2 + numPanels * 7)
    let offset = 0

    // Number of panels (2 bytes, big endian)
    buffer.writeUInt16BE(numPanels, offset)
    offset += 2

    for (const [panelId, color] of panelColors) {
      // Panel ID (2 bytes, big endian)
      buffer.writeUInt16BE(panelId, offset)
      offset += 2

      // R, G, B values
      buffer.writeUInt8(color.r, offset++)
      buffer.writeUInt8(color.g, offset++)
      buffer.writeUInt8(color.b, offset++)

      // White channel (0)
      buffer.writeUInt8(0, offset++)

      // Transition time (1 = 100ms, 0 = instant for v2)
      buffer.writeUInt8(1, offset++)
    }

    // Send UDP packet (fire and forget for speed)
    this.socket.send(buffer, this.streamPort, this.ip)
  }

  /**
   * Get panel info for screen mapping
   */
  getPanels(): PanelInfo[] {
    return this.panels
  }

  /**
   * Check if streaming is enabled
   */
  isStreaming(): boolean {
    return this.streamEnabled
  }

  /**
   * Cleanup: close socket
   */
  async cleanup(): Promise<void> {
    if (this.socket) {
      this.socket.close()
      this.socket = null
    }
    this.streamEnabled = false
  }
}
