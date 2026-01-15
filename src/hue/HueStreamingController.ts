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
  enableAllLights?: boolean
}

interface LightPosition {
  id: string
  x: number
  y: number
}

interface RestLight {
  id: string
  name: string
  x: number
  y: number
  supportsColor: boolean
}

export class HueStreamingController {
  private socket: any = null
  private config: HueStreamingConfig
  private lightIds: string[] = []
  private lightPositions: LightPosition[] = []
  private streamEnabled = false
  private groupId = ""

  private restLights: RestLight[] = []
  private lastRestUpdate = 0
  private restUpdateInterval = 200

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

    // Extract and normalize light positions (x: -1 to 1, z: -1 to 1 for height)
    // Hue uses: x = left/right, y = front/back, z = up/down
    // We map x to screen x, z to screen y
    if (group.locations) {
      this.lightPositions = group.lights.map(id => {
        const loc = group.locations[id] || [0, 0, 0]
        return {
          id,
          x: (loc[0] + 1) / 2,  // -1..1 -> 0..1
          y: 1 - (loc[2] + 1) / 2,  // -1..1 -> 1..0 (invert for screen coords)
        }
      })
    }

    console.log(`  Hue Entertainment: ${group.name} (${this.lightIds.length} lights)`)

    await this.resetEntertainmentMode()
    await this.createDtlsSocket()

    console.log(`  ✓ Hue DTLS streaming ready`)

    if (this.config.enableAllLights) {
      await this.initRestLights()
    }
  }

  private initRestLights = async () => {
    const url = `http://${this.config.bridgeIp}/api/${this.config.username}/lights`
    const response = await axios.get(url)

    const entertainmentSet = new Set(this.lightIds)
    const allLights = Object.entries(response.data) as [string, any][]

    this.restLights = allLights
      .filter(([id]) => !entertainmentSet.has(id))
      .filter(([_, light]) => light.state?.reachable !== false)
      .map(([id, light], index, arr) => ({
        id,
        name: light.name,
        x: (index + 0.5) / arr.length,
        y: 0.5,
        supportsColor: light.type?.toLowerCase().includes('color') ||
          !!light.capabilities?.control?.colorgamut,
      }))

    if (this.restLights.length > 0) {
      console.log(`  REST lights (non-entertainment): ${this.restLights.map(l => l.name).join(', ')}`)
    }
  }

  private getEntertainmentGroups = async () => {
    const url = `http://${this.config.bridgeIp}/api/${this.config.username}/groups`
    const response = await axios.get(url)

    return Object.entries(response.data)
      .filter(([_, g]: [string, any]) => g.type === "Entertainment")
      .map(([id, g]: [string, any]) => ({
        id,
        name: g.name,
        lights: g.lights as string[],
        locations: g.locations as Record<string, [number, number, number]>,
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

  getNormalizedPositions = () => this.lightPositions

  streamLightColors = (colors: Map<string, RGBColor>) => {
    if (!this.socket || !this.streamEnabled) return

    const lightColors = this.lightIds.map(id => {
      const color = colors.get(id) || { r: 0, g: 0, b: 0 }
      return { id, r: color.r, g: color.g, b: color.b }
    })

    const message = this.buildMessage(lightColors)
    this.socket.send(message)
  }

  getRestLightPositions = (): LightPosition[] => {
    return this.restLights.map(l => ({ id: l.id, x: l.x, y: l.y }))
  }

  private restLightIndex = 0

  updateRestLights = async (colors: Map<string, RGBColor>) => {
    const now = Date.now()
    if (now - this.lastRestUpdate < this.restUpdateInterval) return
    if (this.restLights.length === 0) return
    this.lastRestUpdate = now

    // Round-robin: update one light at a time to stay within rate limits
    const light = this.restLights[this.restLightIndex]
    this.restLightIndex = (this.restLightIndex + 1) % this.restLights.length

    const color = colors.get(light.id)
    if (!color) return

    const url = `http://${this.config.bridgeIp}/api/${this.config.username}/lights/${light.id}/state`

    try {
      if (light.supportsColor) {
        const [h, s, b] = this.rgbToHsb(color)
        axios.put(url, { on: true, hue: h, sat: s, bri: b, transitiontime: 2 }, { timeout: 1000 })
      } else {
        const bri = Math.round(0.299 * color.r + 0.587 * color.g + 0.114 * color.b)
        axios.put(url, { on: true, bri: Math.max(1, bri), transitiontime: 2 }, { timeout: 1000 })
      }
    } catch {
      // Ignore errors to prevent blocking
    }
  }

  private rgbToHsb = (color: RGBColor): [number, number, number] => {
    const r = color.r / 255, g = color.g / 255, b = color.b / 255
    const max = Math.max(r, g, b), min = Math.min(r, g, b)
    const d = max - min

    let h = 0
    if (d !== 0) {
      if (max === r) h = ((g - b) / d + 6) % 6
      else if (max === g) h = (b - r) / d + 2
      else h = (r - g) / d + 4
    }

    const s = max === 0 ? 0 : d / max
    return [
      Math.round(h / 6 * 65535),
      Math.round(s * 254),
      Math.round(max * 254),
    ]
  }

  isStreaming = () => this.streamEnabled

  hasRestLights = () => this.restLights.length > 0

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
