import { dtls } from "node-dtls-client"
import axios from "axios"

export interface RGBColor {
  r: number
  g: number
  b: number
}

export interface HueStreamingConfig {
  bridgeIp: string
  username: string
  clientKey: string
  entertainmentGroupId?: string
}

export class HueStreamingController {
  private socket: any = null
  private config: HueStreamingConfig
  private lightIds: string[] = []
  private streamEnabled = false
  private groupId = ""

  constructor(config: HueStreamingConfig) {
    this.config = config
  }

  initialize = async () => {
    const groups = await this.getEntertainmentGroups()

    if (groups.length === 0)
      throw new Error("No entertainment areas. Create one in the Hue app.")

    const group = this.config.entertainmentGroupId
      ? groups.find(g => g.id === this.config.entertainmentGroupId) || groups[0]
      : groups[0]

    this.groupId = group.id
    this.lightIds = group.lights

    console.log(`  Hue Entertainment: ${group.name} (${this.lightIds.length} lights)`)

    await this.resetEntertainmentMode()
    await this.createDtlsSocket()

    console.log(`  ✓ Hue DTLS streaming ready`)
  }

  private getEntertainmentGroups = async () => {
    const url = `http://${this.config.bridgeIp}/api/${this.config.username}/groups`
    const response = await axios.get(url)

    return Object.entries(response.data)
      .filter(([_, g]: [string, any]) => g.type === "Entertainment")
      .map(([id, g]: [string, any]) => ({
        id,
        name: g.name,
        lights: g.lights,
      }))
  }

  private resetEntertainmentMode = async () => {
    const url = `http://${this.config.bridgeIp}/api/${this.config.username}/groups/${this.groupId}`
    await axios.put(url, { stream: { active: false } }).catch(() => {})
    await new Promise(r => setTimeout(r, 500))
    await axios.put(url, { stream: { active: true } })
    await new Promise(r => setTimeout(r, 500))
  }

  private createDtlsSocket = async () => {
    return new Promise<void>((resolve, reject) => {
      const socket = dtls.createSocket({
        type: "udp4",
        address: this.config.bridgeIp,
        port: 2100,
        psk: { [this.config.username]: Buffer.from(this.config.clientKey, "hex") },
        cipherSuites: ["TLS_PSK_WITH_AES_128_GCM_SHA256"],
        timeout: 30000,
      } as any)

      socket.on("connected", () => {
        this.socket = socket
        this.streamEnabled = true
        resolve()
      })

      socket.on("error", (err: Error) => {
        reject(new Error(`DTLS error: ${err.message}`))
      })

      socket.on("close", () => {
        this.streamEnabled = false
      })
    })
  }

  private buildMessage = (lightColors: Array<{ id: string, r: number, g: number, b: number }>) => {
    const header = Buffer.from([
      0x48, 0x75, 0x65, 0x53, 0x74, 0x72, 0x65, 0x61, 0x6d,
      0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    ])

    const lightData = Buffer.alloc(lightColors.length * 9)
    let offset = 0

    for (const light of lightColors) {
      const id = parseInt(light.id)
      const r16 = Math.round(light.r) << 8
      const g16 = Math.round(light.g) << 8
      const b16 = Math.round(light.b) << 8

      lightData.writeUInt8(0x00, offset++)
      lightData.writeUInt8(0x00, offset++)
      lightData.writeUInt8(id, offset++)
      lightData.writeUInt16BE(r16, offset)
      offset += 2
      lightData.writeUInt16BE(g16, offset)
      offset += 2
      lightData.writeUInt16BE(b16, offset)
      offset += 2
    }

    return Buffer.concat([header, lightData])
  }

  streamSolidColor = (color: RGBColor) => {
    if (!this.socket || !this.streamEnabled) return

    const lightColors = this.lightIds.map(id => ({
      id,
      r: Math.round(color.r),
      g: Math.round(color.g),
      b: Math.round(color.b),
    }))

    const message = this.buildMessage(lightColors)
    this.socket.send(message)
  }

  getLightIds = () => this.lightIds

  isStreaming = () => this.streamEnabled

  cleanup = async () => {
    if (this.socket) {
      this.socket.close()
      this.socket = null
    }

    const url = `http://${this.config.bridgeIp}/api/${this.config.username}/groups/${this.groupId}`
    await axios.put(url, { stream: { active: false } }).catch(() => {})

    this.streamEnabled = false
  }
}
