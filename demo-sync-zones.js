// Zoned Screen-to-Hue Sync - Each light shows a different screen region
const robot = require('robotjs');
const { HueEntertainmentDirect } = require('./hue-entertainment-direct');

console.log('╔════════════════════════════════════════════════════════════════════╗');
console.log('║  🎯 ZONED SCREEN-TO-HUE SYNC (Per-Light Regions)                 ║');
console.log('╚════════════════════════════════════════════════════════════════════╝\n');

// Configuration
const BRIDGE_IP = '10.0.194.117';
const USERNAME = 'TEKWU841KiQLygGaesVQFTokoS0T8Q5bs6wdp1wB';
const ENTERTAINMENT_AREA_ID = 201; // "Music area" - 10 lights
const TARGET_FPS = 8;
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

// Extract dominant color from a specific screen region
function extractColorFromRegion(img, region) {
  const { width, height, image: pixels } = img;
  const { x, y, w, h } = region;

  // Convert normalized coordinates to pixels
  const startX = Math.floor(x * width);
  const startY = Math.floor(y * height);
  const endX = Math.min(width, Math.floor((x + w) * width));
  const endY = Math.min(height, Math.floor((y + h) * height));

  // Sample pixels in this region (every 30th pixel for speed)
  const sampleStep = 30;
  const colorBuckets = {};

  for (let py = startY; py < endY; py += sampleStep) {
    for (let px = startX; px < endX; px += sampleStep) {
      const i = (py * width + px) * 4;

      const b = pixels[i];
      const g = pixels[i + 1];
      const r = pixels[i + 2];

      // Skip very dark colors
      if (r < 25 && g < 25 && b < 25) continue;

      // Quantize colors
      const rq = Math.floor(r / 40) * 40;
      const gq = Math.floor(g / 40) * 40;
      const bq = Math.floor(b / 40) * 40;

      const key = `${rq},${gq},${bq}`;
      colorBuckets[key] = (colorBuckets[key] || 0) + 1;
    }
  }

  // Find most common color
  let maxCount = 0;
  let dominantColor = { r: 128, g: 128, b: 128 };

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
function rgbToHueSatBri(r, g, b) {
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

// Create screen zones for each light
// Divides screen into a grid based on number of lights
function createScreenZones(numLights) {
  const zones = [];

  // Calculate grid dimensions (roughly square)
  const cols = Math.ceil(Math.sqrt(numLights));
  const rows = Math.ceil(numLights / cols);

  const zoneWidth = 1.0 / cols;
  const zoneHeight = 1.0 / rows;

  console.log(`\n📐 Screen divided into ${cols}x${rows} grid:`);

  for (let i = 0; i < numLights; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);

    const zone = {
      index: i,
      x: col * zoneWidth,
      y: row * zoneHeight,
      w: zoneWidth,
      h: zoneHeight
    };

    zones.push(zone);

    const xPercent = Math.round(zone.x * 100);
    const yPercent = Math.round(zone.y * 100);
    const wPercent = Math.round(zone.w * 100);
    const hPercent = Math.round(zone.h * 100);

    console.log(`   Zone ${i + 1}: ${xPercent}%-${xPercent + wPercent}% x ${yPercent}%-${yPercent + hPercent}%`);
  }

  return zones;
}

async function syncLoop(hue, areaInfo) {
  console.log('\n🎬 Starting zoned sync loop...\n');
  console.log('Press Ctrl+C to stop\n');

  const screenSize = robot.getScreenSize();
  console.log(`Screen: ${screenSize.width}x${screenSize.height}`);
  console.log(`Entertainment Area: ${areaInfo.name} (${areaInfo.lights.length} lights)`);

  // Create screen zones - one per light
  const zones = createScreenZones(areaInfo.lights.length);

  console.log('\n' + '═'.repeat(70));

  let running = true;
  const lastColors = new Array(areaInfo.lights.length).fill(null);

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

      // 2. Extract color for each zone
      const colorStart = Date.now();
      const zoneColors = [];

      for (let i = 0; i < zones.length; i++) {
        const color = extractColorFromRegion(img, zones[i]);
        zoneColors.push(color);
      }

      const colorTime = Date.now() - colorStart;

      // 3. Update each light with its zone color
      const updateStart = Date.now();
      const updatePromises = [];

      for (let i = 0; i < areaInfo.lights.length; i++) {
        const lightId = areaInfo.lights[i];
        const color = zoneColors[i];

        // Check if color changed significantly
        const lastColor = lastColors[i];
        const colorChanged = !lastColor ||
          Math.abs(color.r - lastColor.r) > 15 ||
          Math.abs(color.g - lastColor.g) > 15 ||
          Math.abs(color.b - lastColor.b) > 15;

        if (colorChanged) {
          const { hue: hueValue, sat, bri } = rgbToHueSatBri(color.r, color.g, color.b);
          updatePromises.push(
            hue.updateLight(lightId, hueValue, sat, Math.max(50, bri))
          );
          lastColors[i] = color;
        }
      }

      await Promise.all(updatePromises);
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

      // Print status with color preview
      process.stdout.write('\r\x1b[K'); // Clear line
      const colorSample = zoneColors[0]; // Show first zone color
      process.stdout.write(
        `Frame ${stats.frameCount} | ` +
        `Updates: ${updatePromises.length} | ` +
        `Sample: RGB(${colorSample.r},${colorSample.g},${colorSample.b}) | ` +
        `Cap: ${captureTime}ms | ` +
        `Col: ${colorTime}ms | ` +
        `Upd: ${updateTime}ms | ` +
        `FPS: ${currentFPS}`
      );

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
  console.log(`  Color extract:   ${avgColor.toFixed(2)}ms (${zones.length} zones)`);
  console.log(`  Light updates:   ${avgUpdate.toFixed(2)}ms (${areaInfo.lights.length} lights)`);
  console.log(`  Total per frame: ${avgTotal.toFixed(2)}ms`);
  console.log('');
  console.log('✅ Zoned sync stopped');
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

    console.log(`✅ Found: ${area.name} (${area.lights.length} lights)`);
    console.log(`   Lights: ${area.lights.join(', ')}`);

    console.log('\n🎬 Activating Entertainment mode...');
    await hue.activateEntertainmentArea(ENTERTAINMENT_AREA_ID);
    console.log('✅ Entertainment mode active');

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
