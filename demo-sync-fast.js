// Fast Screen-to-Hue Sync using Entertainment API
const robot = require('robotjs');
const { HueEntertainmentDirect } = require('./hue-entertainment-direct');

console.log('╔════════════════════════════════════════════════════════════════════╗');
console.log('║  ⚡ FAST SCREEN-TO-HUE SYNC (Entertainment API)                   ║');
console.log('╚════════════════════════════════════════════════════════════════════╝\n');

// Configuration
const BRIDGE_IP = '10.0.194.117';
const USERNAME = 'TEKWU841KiQLygGaesVQFTokoS0T8Q5bs6wdp1wB';
const ENTERTAINMENT_AREA_ID = 201; // "Music area" - 10 lights
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

  // Sample every 50th pixel for speed
  const sampleStep = 50;
  const colorBuckets = {};

  for (let y = 0; y < height; y += sampleStep) {
    for (let x = 0; x < width; x += sampleStep) {
      const i = (y * width + x) * 4;

      const b = pixels[i];
      const g = pixels[i + 1];
      const r = pixels[i + 2];

      // Skip very dark colors
      if (r < 30 && g < 30 && b < 30) continue;

      // Quantize colors
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

// Convert RGB to Hue/Sat/Bri (0-254 range for Hue API)
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

async function syncLoop(hue, areaInfo) {
  console.log('🎬 Starting fast sync loop...\n');
  console.log('Press Ctrl+C to stop\n');

  const screenSize = robot.getScreenSize();
  console.log(`Screen: ${screenSize.width}x${screenSize.height}`);
  console.log(`Entertainment Area: ${areaInfo.name} (${areaInfo.lights.length} lights)\n`);
  console.log('═'.repeat(70));

  let running = true;
  let lastColor = null;

  // Ctrl+C handler
  process.on('SIGINT', async () => {
    running = false;
    console.log('\n\nStopping sync...');
    await hue.deactivateEntertainmentArea(ENTERTAINMENT_AREA_ID);
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
      const { hue: hueValue, sat, bri } = rgbToHueSat(color.r, color.g, color.b);

      // Only update if color changed significantly
      const colorChanged = !lastColor ||
        Math.abs(color.r - lastColor.r) > 10 ||
        Math.abs(color.g - lastColor.g) > 10 ||
        Math.abs(color.b - lastColor.b) > 10;

      if (colorChanged) {
        // 4. Update Entertainment group (fast!)
        const updateStart = Date.now();
        await hue.updateEntertainmentGroup(
          ENTERTAINMENT_AREA_ID,
          hueValue,
          sat,
          Math.max(50, bri)  // Minimum brightness
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
          `Cap: ${captureTime}ms | ` +
          `Col: ${colorTime}ms | ` +
          `Upd: ${updateTime}ms | ` +
          `Tot: ${totalTime}ms | ` +
          `FPS: ${currentFPS}`
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

  const speedup = 2100 / avgUpdate;
  console.log(`⚡ Entertainment API speedup: ${speedup.toFixed(1)}x faster!`);
  console.log('✅ Sync stopped');
}

async function main() {
  try {
    const hue = new HueEntertainmentDirect(BRIDGE_IP, USERNAME);

    console.log('🔍 Discovering Entertainment areas...');
    const areas = await hue.getEntertainmentAreas();

    const area = areas.find(a => a.id === ENTERTAINMENT_AREA_ID);
    if (!area) {
      console.log(`❌ Entertainment area ${ENTERTAINMENT_AREA_ID} not found`);
      console.log('\nAvailable areas:');
      areas.forEach(a => {
        console.log(`  ${a.id}. ${a.name} (${a.lights.length} lights)`);
      });
      process.exit(1);
    }

    console.log(`✅ Found: ${area.name} (${area.lights.length} lights)\n`);

    console.log('🎬 Activating Entertainment mode...');
    await hue.activateEntertainmentArea(ENTERTAINMENT_AREA_ID);
    console.log('✅ Entertainment mode active\n');

    await syncLoop(hue, area);

  } catch (error) {
    console.error(`\n❌ ERROR: ${error.message}`);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

main();
