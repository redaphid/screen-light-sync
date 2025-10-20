// Simple Screen-to-Hue Sync Demo
const robot = require('robotjs');
const v3 = require('node-hue-api').v3;
const LightState = v3.lightStates.LightState;

console.log('╔════════════════════════════════════════════════════════════════════╗');
console.log('║  🎨 SCREEN-TO-HUE SYNC DEMO                                       ║');
console.log('╚════════════════════════════════════════════════════════════════════╝\n');

// Configuration
const BRIDGE_IP = '10.0.194.117';
const USERNAME = 'TEKWU841KiQLygGaesVQFTokoS0T8Q5bs6wdp1wB';
const LIGHT_IDS = [1, 2, 3, 5, 9, 10, 12, 13, 14, 15, 16, 17, 18, 19, 21, 31];
const TARGET_FPS = 10;
const FRAME_DELAY = Math.floor(1000 / TARGET_FPS);

// Stats tracking
const stats = {
  frameCount: 0,
  captureTimes: [],
  colorTimes: [],
  updateTimes: [],
  totalTimes: [],
  startTime: Date.now()
};

// Extract dominant color from screen using downsampling
function extractDominantColor(img) {
  const { width, height, image: pixels } = img;

  // Sample every 50th pixel for speed (400x reduction in pixels processed)
  const sampleStep = 50;
  const colorBuckets = {};

  for (let y = 0; y < height; y += sampleStep) {
    for (let x = 0; x < width; x += sampleStep) {
      const i = (y * width + x) * 4;

      const b = pixels[i];
      const g = pixels[i + 1];
      const r = pixels[i + 2];

      // Skip very dark colors (likely black UI elements)
      if (r < 30 && g < 30 && b < 30) continue;

      // Quantize to reduce bucket count (group similar colors)
      const rq = Math.floor(r / 32) * 32;
      const gq = Math.floor(g / 32) * 32;
      const bq = Math.floor(b / 32) * 32;

      const key = `${rq},${gq},${bq}`;
      colorBuckets[key] = (colorBuckets[key] || 0) + 1;
    }
  }

  // Find most common color
  let maxCount = 0;
  let dominantColor = { r: 255, g: 255, b: 255 };

  for (const [key, count] of Object.entries(colorBuckets)) {
    if (count > maxCount) {
      maxCount = count;
      const [r, g, b] = key.split(',').map(Number);
      dominantColor = { r, g, b };
    }
  }

  return dominantColor;
}

// Convert RGB to Hue/Sat
function rgbToHueSat(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;

  let h = 0;
  let s = max === 0 ? 0 : delta / max;

  if (delta !== 0) {
    if (max === r) {
      h = ((g - b) / delta + (g < b ? 6 : 0)) / 6;
    } else if (max === g) {
      h = ((b - r) / delta + 2) / 6;
    } else {
      h = ((r - g) / delta + 4) / 6;
    }
  }

  return {
    hue: Math.round(h * 65535),
    sat: Math.round(s * 254),
    bri: Math.round(max * 254)
  };
}

async function syncLoop(api) {
  console.log('🎬 Starting sync loop...\n');
  console.log('Press Ctrl+C to stop\n');

  const screenSize = robot.getScreenSize();
  console.log(`Screen: ${screenSize.width}x${screenSize.height}\n`);
  console.log('═'.repeat(70));

  let running = true;
  let lastColor = null;

  // Ctrl+C handler
  process.on('SIGINT', () => {
    running = false;
  });

  while (running) {
    const frameStart = Date.now();

    try {
      // 1. Capture screen
      const captureStart = Date.now();
      const img = robot.screen.capture();
      const captureTime = Date.now() - captureStart;

      // 2. Extract color
      const colorStart = Date.now();
      const color = extractDominantColor(img);
      const colorTime = Date.now() - colorStart;

      // 3. Convert to Hue format
      const { hue, sat, bri } = rgbToHueSat(color.r, color.g, color.b);

      // Only update if color changed significantly
      const colorChanged = !lastColor ||
        Math.abs(color.r - lastColor.r) > 10 ||
        Math.abs(color.g - lastColor.g) > 10 ||
        Math.abs(color.b - lastColor.b) > 10;

      if (colorChanged) {
        // 4. Update lights
        const updateStart = Date.now();
        const state = new LightState()
          .on(true)
          .hue(hue)
          .sat(sat)
          .brightness(Math.max(20, Math.round((bri / 254) * 100)))
          .transitiontime(0);  // Instant transition

        // Update all lights in parallel
        await Promise.all(
          LIGHT_IDS.map(id => api.lights.setLightState(id, state).catch(() => {}))
        );

        const updateTime = Date.now() - updateStart;
        const totalTime = Date.now() - frameStart;

        // Track stats
        stats.frameCount++;
        stats.captureTimes.push(captureTime);
        stats.colorTimes.push(colorTime);
        stats.updateTimes.push(updateTime);
        stats.totalTimes.push(totalTime);

        // Keep only last 20 samples
        if (stats.captureTimes.length > 20) {
          stats.captureTimes.shift();
          stats.colorTimes.shift();
          stats.updateTimes.shift();
          stats.totalTimes.shift();
        }

        // Calculate averages
        const avgCapture = stats.captureTimes.reduce((a, b) => a + b, 0) / stats.captureTimes.length;
        const avgColor = stats.colorTimes.reduce((a, b) => a + b, 0) / stats.colorTimes.length;
        const avgUpdate = stats.updateTimes.reduce((a, b) => a + b, 0) / stats.updateTimes.length;
        const avgTotal = stats.totalTimes.reduce((a, b) => a + b, 0) / stats.totalTimes.length;
        const currentFPS = Math.round(1000 / avgTotal);

        // Print status
        process.stdout.write('\r\x1b[K'); // Clear line
        process.stdout.write(
          `Frame ${stats.frameCount} | ` +
          `RGB(${color.r},${color.g},${color.b}) | ` +
          `Capture: ${captureTime}ms | ` +
          `Color: ${colorTime}ms | ` +
          `Update: ${updateTime}ms | ` +
          `Total: ${totalTime}ms | ` +
          `Avg FPS: ${currentFPS}`
        );

        lastColor = color;
      }

      // Wait for next frame
      const elapsed = Date.now() - frameStart;
      const delay = Math.max(0, FRAME_DELAY - elapsed);
      await new Promise(resolve => setTimeout(resolve, delay));

    } catch (error) {
      console.error(`\n❌ Error in sync loop: ${error.message}`);
    }
  }

  // Print final stats
  console.log('\n\n' + '═'.repeat(70));
  console.log('📊 FINAL STATISTICS');
  console.log('═'.repeat(70) + '\n');

  const avgCapture = stats.captureTimes.reduce((a, b) => a + b, 0) / stats.captureTimes.length;
  const avgColor = stats.colorTimes.reduce((a, b) => a + b, 0) / stats.colorTimes.length;
  const avgUpdate = stats.updateTimes.reduce((a, b) => a + b, 0) / stats.updateTimes.length;
  const avgTotal = stats.totalTimes.reduce((a, b) => a + b, 0) / stats.totalTimes.length;
  const actualFPS = Math.round(1000 / avgTotal);
  const runtime = ((Date.now() - stats.startTime) / 1000).toFixed(1);

  console.log(`Runtime: ${runtime}s`);
  console.log(`Frames synced: ${stats.frameCount}`);
  console.log(`Average FPS: ${actualFPS}`);
  console.log('');
  console.log('Timing breakdown:');
  console.log(`  Screen capture:  ${avgCapture.toFixed(2)}ms`);
  console.log(`  Color extract:   ${avgColor.toFixed(2)}ms`);
  console.log(`  Light update:    ${avgUpdate.toFixed(2)}ms`);
  console.log(`  Total per frame: ${avgTotal.toFixed(2)}ms`);
  console.log('');
  console.log('✅ Sync stopped');
}

async function main() {
  try {
    console.log('🔌 Connecting to Hue Bridge...');
    const api = await v3.api.createLocal(BRIDGE_IP).connect(USERNAME);
    console.log(`✅ Connected to bridge at ${BRIDGE_IP}\n`);

    console.log(`🔆 Will sync ${LIGHT_IDS.length} lights:`);
    console.log(`   Light IDs: ${LIGHT_IDS.join(', ')}\n`);

    await syncLoop(api);

  } catch (error) {
    console.error(`\n❌ ERROR: ${error.message}`);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

main();
