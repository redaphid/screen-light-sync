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

export class DxgiCapture {
  private dd: any = null
  private width = 0
  private height = 0

  initialize = async (): Promise<void> => {
    this.dd = new DesktopDuplication(0)
    this.dd.initialize()

    // Capture a test frame to get dimensions
    const frame = this.dd.getFrame()
    this.width = frame.width
    this.height = frame.height

    console.log(`  ✓ DXGI capture ready (${this.width}x${this.height})`)
  }

  captureRegions = async (regions: CaptureRegion[]): Promise<RGBColor[]> => {
    try {
      const frame = this.dd.getFrame()
      const { data, width, height } = frame

      return regions.map(region => {
        const centerX = Math.floor(region.x * width)
        const centerY = Math.floor(region.y * height)
        const size = Math.floor((region.size || 0.08) * Math.min(width, height))
        const half = Math.floor(size / 2)

        const x1 = Math.max(0, centerX - half)
        const y1 = Math.max(0, centerY - half)
        const x2 = Math.min(width, centerX + half)
        const y2 = Math.min(height, centerY + half)

        let rSum = 0, gSum = 0, bSum = 0, count = 0
        const step = 4

        for (let y = y1; y < y2; y += step) {
          for (let x = x1; x < x2; x += step) {
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
      })
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
