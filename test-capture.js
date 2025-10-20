// Quick test: Can we capture the screen?
const screenshot = require('screenshot-desktop');
const sharp = require('sharp');

console.log('🖥️  Testing Screen Capture...\n');

async function test() {
  try {
    // Test 1: List displays
    console.log('1️⃣  Listing displays...');
    const displays = await screenshot.listDisplays();
    console.log(`   ✓ Found ${displays.length} display(s):`);
    displays.forEach((d, i) => {
      console.log(`     ${i + 1}. ${d.name} (ID: ${d.id})`);
    });

    // Test 2: Capture screenshot
    console.log('\n2️⃣  Capturing screenshot...');
    const start = Date.now();
    const img = await screenshot({ format: 'jpg' });
    const captureTime = Date.now() - start;
    console.log(`   ✓ Captured ${img.length} bytes in ${captureTime}ms`);

    // Test 3: Extract average color
    console.log('\n3️⃣  Extracting color...');
    const colorStart = Date.now();
    const image = sharp(img).resize(100, 100, { fit: 'fill' });
    const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });

    let r = 0, g = 0, b = 0;
    const pixelCount = info.width * info.height;

    for (let i = 0; i < data.length; i += info.channels) {
      r += data[i];
      g += data[i + 1];
      b += data[i + 2];
    }

    const avgColor = {
      r: Math.round(r / pixelCount),
      g: Math.round(g / pixelCount),
      b: Math.round(b / pixelCount)
    };

    const colorTime = Date.now() - colorStart;
    console.log(`   ✓ Average color: RGB(${avgColor.r}, ${avgColor.g}, ${avgColor.b})`);
    console.log(`   ✓ Extracted in ${colorTime}ms`);

    // Test 4: Performance estimate
    const totalTime = captureTime + colorTime;
    const estimatedFPS = Math.round(1000 / totalTime);
    console.log(`\n📊 Performance:`);
    console.log(`   Total frame time: ${totalTime}ms`);
    console.log(`   Estimated max FPS: ${estimatedFPS}`);

    console.log('\n✅ All tests passed! Core functionality works!\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

test();
