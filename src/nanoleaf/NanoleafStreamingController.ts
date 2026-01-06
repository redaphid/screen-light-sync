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

type ProtocolVersion = "v1" | "v2"

export class NanoleafStreamingController {
  private ip: string
  private authToken: string
  private port = 16021
  private streamPort = 60222
  private socket: dgram.Socket | null = null
  private panels: PanelInfo[] = []
  private streamEnabled = false
  private protocolVersion: ProtocolVersion = "v2"
  private deviceName = ""

  constructor(ip: string, authToken: string) {
    this.ip = ip
    this.authToken = authToken
  }

  initialize = async () => {
    await this.getDeviceInfo()
    await this.getPanelLayout()
    await this.enableExternalControl()
    this.createSocket()
  }

  private getDeviceInfo = async () => {
    const url = `http://${this.ip}:${this.port}/api/v1/${this.authToken}`
    const response = await axios.get(url)
    this.deviceName = response.data.name || "Unknown"
    const model = response.data.model || ""

    if (model === "NL22") {
      this.protocolVersion = "v1"
      this.streamPort = 60221
      return
    }

    this.protocolVersion = "v2"
    this.streamPort = 60222
  }

  private getPanelLayout = async () => {
    const url = `http://${this.ip}:${this.port}/api/v1/${this.authToken}/panelLayout/layout`
    const response = await axios.get(url)

    this.panels = response.data.positionData
      .filter((p: any) => p.shapeType !== 12)
      .map((p: any) => ({
        panelId: p.panelId,
        x: p.x,
        y: p.y,
      }))

    console.log(`  ${this.deviceName}: ${this.panels.length} panels (${this.protocolVersion})`)
  }

  private enableExternalControl = async () => {
    const url = `http://${this.ip}:${this.port}/api/v1/${this.authToken}/effects`

    const tryVersion = async (version: ProtocolVersion) => {
      await axios.put(url, {
        write: {
          command: "display",
          animType: "extControl",
          extControlVersion: version,
        },
      })
    }

    try {
      await tryVersion(this.protocolVersion)
      this.streamEnabled = true
      return
    } catch (err: any) {
      if (this.protocolVersion !== "v2" || err.response?.status !== 400) throw err
    }

    this.protocolVersion = "v1"
    this.streamPort = 60221
    await tryVersion("v1")
    this.streamEnabled = true
  }

  private createSocket = () => {
    this.socket = dgram.createSocket("udp4")
  }

  streamSolidColor = (color: RGBColor) => {
    if (!this.socket || !this.streamEnabled) return

    const panelColors = new Map<number, RGBColor>()
    for (const panel of this.panels)
      panelColors.set(panel.panelId, color)

    this.streamPanelColors(panelColors)
  }

  streamPanelColors = (panelColors: Map<number, RGBColor>) => {
    if (!this.socket || !this.streamEnabled) return

    const buffer = this.protocolVersion === "v1"
      ? this.buildV1Packet(panelColors)
      : this.buildV2Packet(panelColors)

    this.socket.send(buffer, this.streamPort, this.ip)
  }

  private buildV1Packet = (panelColors: Map<number, RGBColor>) => {
    const numPanels = panelColors.size
    const buffer = Buffer.alloc(1 + numPanels * 7)
    let offset = 0

    buffer.writeUInt8(numPanels, offset++)

    for (const [panelId, color] of panelColors) {
      buffer.writeUInt8(panelId & 0xFF, offset++)
      buffer.writeUInt8(1, offset++)
      buffer.writeUInt8(color.r, offset++)
      buffer.writeUInt8(color.g, offset++)
      buffer.writeUInt8(color.b, offset++)
      buffer.writeUInt8(0, offset++)
      buffer.writeUInt8(1, offset++)
    }

    return buffer
  }

  private buildV2Packet = (panelColors: Map<number, RGBColor>) => {
    const numPanels = panelColors.size
    const buffer = Buffer.alloc(2 + numPanels * 8)
    let offset = 0

    buffer.writeUInt16BE(numPanels, offset)
    offset += 2

    for (const [panelId, color] of panelColors) {
      buffer.writeUInt16BE(panelId, offset)
      offset += 2
      buffer.writeUInt8(color.r, offset++)
      buffer.writeUInt8(color.g, offset++)
      buffer.writeUInt8(color.b, offset++)
      buffer.writeUInt8(0, offset++)
      buffer.writeUInt16BE(1, offset)
      offset += 2
    }

    return buffer
  }

  getPanels = () => this.panels

  isStreaming = () => this.streamEnabled

  cleanup = async () => {
    if (this.socket) {
      this.socket.close()
      this.socket = null
    }
    this.streamEnabled = false
  }
}
