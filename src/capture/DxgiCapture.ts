const { DesktopDuplication } = require('windows-desktop-duplication')

export interface RGBColor {
  r: number
  g: number
  b: number
}

export interface CaptureRegion {
  x: number
  y: number
  size?: number
}

interface PrecomputedRegion {
  x1: number
  y1: number
  x2: number
  y2: number
}

export class DxgiCapture {
  private dd: any = null
  private width = 0
  private height = 0
  private cachedRegions: PrecomputedRegion[] = []
  private lastRegionKey = ''
  private sampleStep = 8

  initialize = async (): Promise<void> => {
    this.dd = new DesktopDuplication(0)
    this.dd.initialize()

    const frame = this.dd.getFrame()
    this.width = frame.width
    this.height = frame.height

    console.log(`  ✓ DXGI capture ready (${this.width}x${this.height})`)
  }

  setSampleStep = (step: number) => {
    this.sampleStep = step
  }

  private precomputeRegions = (regions: CaptureRegion[]) => {
    const key = regions.map(r => `${r.x},${r.y},${r.size}`).join('|')
    if (key === this.lastRegionKey) return

    this.lastRegionKey = key
    const minDim = Math.min(this.width, this.height)

    this.cachedRegions = regions.map(region => {
      const centerX = Math.floor(region.x * this.width)
      const centerY = Math.floor(region.y * this.height)
      const size = Math.floor((region.size || 0.08) * minDim)
      const half = Math.floor(size / 2)

      return {
        x1: Math.max(0, centerX - half),
        y1: Math.max(0, centerY - half),
        x2: Math.min(this.width, centerX + half),
        y2: Math.min(this.height, centerY + half),
      }
    })
  }

  captureRegions = async (regions: CaptureRegion[]): Promise<RGBColor[]> => {
    try {
      const frame = this.dd.getFrame()
      const { data, width } = frame

      this.precomputeRegions(regions)
      const step = this.sampleStep
      const results: RGBColor[] = new Array(regions.length)

      for (let i = 0; i < this.cachedRegions.length; i++) {
        const { x1, y1, x2, y2 } = this.cachedRegions[i]
        let rSum = 0, gSum = 0, bSum = 0, count = 0

        for (let y = y1; y < y2; y += step) {
          const rowOffset = y * width * 4
          for (let x = x1; x < x2; x += step) {
            const idx = rowOffset + x * 4
            rSum += data[idx]
            gSum += data[idx + 1]
            bSum += data[idx + 2]
            count++
          }
        }

        results[i] = count > 0
          ? { r: Math.round(rSum / count), g: Math.round(gSum / count), b: Math.round(bSum / count) }
          : { r: 0, g: 0, b: 0 }
      }

      return results
    } catch (err) {
      return regions.map(() => ({ r: 0, g: 0, b: 0 }))
    }
  }

  captureAverage = async (): Promise<RGBColor> => {
    try {
      const frame = this.dd.getFrame()
      const { data, width, height } = frame

      let rSum = 0, gSum = 0, bSum = 0, count = 0
      const step = 10

      for (let y = 0; y < height; y += step) {
        for (let x = 0; x < width; x += step) {
          const idx = (y * width + x) * 4
          rSum += data[idx]
          gSum += data[idx + 1]
          bSum += data[idx + 2]
          count++
        }
      }

      if (count === 0) return { r: 0, g: 0, b: 0 }

      return {
        r: Math.round(rSum / count),
        g: Math.round(gSum / count),
        b: Math.round(bSum / count),
      }
    } catch {
      return { r: 0, g: 0, b: 0 }
    }
  }

  cleanup = () => {
    // Library doesn't require explicit cleanup
  }
}
