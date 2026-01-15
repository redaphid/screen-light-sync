import * as robot from "robotjs"

export interface RGBColor {
  r: number
  g: number
  b: number
}

export interface SampleRegion {
  x: number
  y: number
  width: number
  height: number
}

export interface ScreenData {
  width: number
  height: number
  data: Buffer
}

export class FastColorSampler {
  private screenWidth: number
  private screenHeight: number
  private sampleStep: number

  constructor(sampleStep = 10) {
    const size = robot.getScreenSize()
    this.screenWidth = size.width
    this.screenHeight = size.height
    this.sampleStep = sampleStep
  }

  captureScreen = (): ScreenData => {
    const img = robot.screen.capture()
    return {
      width: img.width,
      height: img.height,
      data: img.image,
    }
  }

  getAverageColorFromData = (screen: ScreenData): RGBColor => {
    const { width, height, data } = screen
    let rSum = 0, gSum = 0, bSum = 0, count = 0

    for (let y = 0; y < height; y += this.sampleStep) {
      for (let x = 0; x < width; x += this.sampleStep) {
        const idx = (y * width + x) * 4
        bSum += data[idx]
        gSum += data[idx + 1]
        rSum += data[idx + 2]
        count++
      }
    }

    if (count === 0) return { r: 0, g: 0, b: 0 }

    return {
      r: Math.round(rSum / count),
      g: Math.round(gSum / count),
      b: Math.round(bSum / count),
    }
  }

  getColorAtPosition = (screen: ScreenData, normX: number, normY: number, regionSize = 0.1): RGBColor => {
    const { width, height, data } = screen

    const centerX = Math.floor(normX * width)
    const centerY = Math.floor(normY * height)
    const halfSize = Math.floor((regionSize * Math.min(width, height)) / 2)

    const startX = Math.max(0, centerX - halfSize)
    const startY = Math.max(0, centerY - halfSize)
    const endX = Math.min(width, centerX + halfSize)
    const endY = Math.min(height, centerY + halfSize)

    let rSum = 0, gSum = 0, bSum = 0, count = 0

    for (let y = startY; y < endY; y += 5) {
      for (let x = startX; x < endX; x += 5) {
        const idx = (y * width + x) * 4
        bSum += data[idx]
        gSum += data[idx + 1]
        rSum += data[idx + 2]
        count++
      }
    }

    if (count === 0) return { r: 0, g: 0, b: 0 }

    return {
      r: Math.round(rSum / count),
      g: Math.round(gSum / count),
      b: Math.round(bSum / count),
    }
  }

  /**
   * Get average color from entire screen
   * Samples every Nth pixel for speed
   */
  getAverageColor(): RGBColor {
    const img = robot.screen.capture()
    const { width, height, image: data } = img

    let rSum = 0, gSum = 0, bSum = 0, count = 0

    // BGRA format: 4 bytes per pixel
    // Sample every sampleStep pixels in both dimensions
    for (let y = 0; y < height; y += this.sampleStep) {
      for (let x = 0; x < width; x += this.sampleStep) {
        const idx = (y * width + x) * 4
        bSum += data[idx]
        gSum += data[idx + 1]
        rSum += data[idx + 2]
        count++
      }
    }

    if (count === 0) return { r: 0, g: 0, b: 0 }

    return {
      r: Math.round(rSum / count),
      g: Math.round(gSum / count),
      b: Math.round(bSum / count),
    }
  }

  /**
   * Get average color from a specific screen region
   */
  getRegionColor(region: SampleRegion): RGBColor {
    const img = robot.screen.capture()
    const { width, height, image: data } = img

    const startX = Math.floor(region.x * width)
    const startY = Math.floor(region.y * height)
    const endX = Math.floor((region.x + region.width) * width)
    const endY = Math.floor((region.y + region.height) * height)

    let rSum = 0, gSum = 0, bSum = 0, count = 0

    for (let y = startY; y < endY; y += this.sampleStep) {
      for (let x = startX; x < endX; x += this.sampleStep) {
        const idx = (y * width + x) * 4
        bSum += data[idx]
        gSum += data[idx + 1]
        rSum += data[idx + 2]
        count++
      }
    }

    if (count === 0) return { r: 0, g: 0, b: 0 }

    return {
      r: Math.round(rSum / count),
      g: Math.round(gSum / count),
      b: Math.round(bSum / count),
    }
  }

  /**
   * Get colors for multiple regions in a single capture
   * Much more efficient than calling getRegionColor multiple times
   */
  getMultipleRegionColors(regions: SampleRegion[]): RGBColor[] {
    const img = robot.screen.capture()
    const { width, height, image: data } = img

    return regions.map(region => {
      const startX = Math.floor(region.x * width)
      const startY = Math.floor(region.y * height)
      const endX = Math.floor((region.x + region.width) * width)
      const endY = Math.floor((region.y + region.height) * height)

      let rSum = 0, gSum = 0, bSum = 0, count = 0

      for (let y = startY; y < endY; y += this.sampleStep) {
        for (let x = startX; x < endX; x += this.sampleStep) {
          const idx = (y * width + x) * 4
          bSum += data[idx]
          gSum += data[idx + 1]
          rSum += data[idx + 2]
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
  }

  /**
   * Enhance color saturation for more vivid lights
   */
  enhanceColor(color: RGBColor, boost = 1.2): RGBColor {
    const max = Math.max(color.r, color.g, color.b)
    const min = Math.min(color.r, color.g, color.b)

    if (max === min) return color // Grayscale, no saturation to boost

    const factor = boost
    const mid = (max + min) / 2

    return {
      r: Math.min(255, Math.max(0, Math.round(mid + (color.r - mid) * factor))),
      g: Math.min(255, Math.max(0, Math.round(mid + (color.g - mid) * factor))),
      b: Math.min(255, Math.max(0, Math.round(mid + (color.b - mid) * factor))),
    }
  }

  /**
   * Get the most vibrant/saturated color (ignores dark/gray pixels)
   */
  getMostVibrantColor(): RGBColor {
    const img = robot.screen.capture()
    const { width, height, image: data } = img

    let bestColor: RGBColor = { r: 128, g: 128, b: 128 }
    let bestSaturation = 0

    for (let y = 0; y < height; y += this.sampleStep) {
      for (let x = 0; x < width; x += this.sampleStep) {
        const idx = (y * width + x) * 4
        const b = data[idx]
        const g = data[idx + 1]
        const r = data[idx + 2]

        const max = Math.max(r, g, b)
        const min = Math.min(r, g, b)

        // Skip dark pixels
        if (max < 30) continue

        const saturation = (max - min) / max
        const brightness = max / 255

        // Weight by both saturation and brightness
        const score = saturation * brightness

        if (score > bestSaturation) {
          bestSaturation = score
          bestColor = { r, g, b }
        }
      }
    }

    return bestColor
  }
}
