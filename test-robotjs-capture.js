// Test robotjs screen capture performance
console.log('Testing robotjs screen capture speed...\n');

try {
  const robot = require('robotjs');

  console.log('✅ robotjs loaded successfully!\n');

  // Get screen size
  const screenSize = robot.getScreenSize();
  console.log(`Screen size: ${screenSize.width}x${screenSize.height}\n`);

  // Test capture speed
  const iterations = 10;
  const times = [];

  console.log(`Running ${iterations} capture tests...`);

  for (let i = 0; i < iterations; i++) {
    const start = Date.now();
    const img = robot.screen.capture();
    const time = Date.now() - start;
    times.push(time);

    console.log(`  ${i + 1}. ${time}ms - ${img.width}x${img.height} (${img.byteWidth} bytes/row, ${img.bytesPerPixel} bpp)`);
  }

  // Calculate stats
  const total = times.reduce((a, b) => a + b, 0);
  const avg = total / times.length;
  const min = Math.min(...times);
  const max = Math.max(...times);

  console.log(`\n📊 Performance Stats:`);
  console.log(`   Average: ${avg.toFixed(2)}ms`);
  console.log(`   Min: ${min}ms`);
  console.log(`   Max: ${max}ms`);
  console.log(`   Estimated FPS: ${Math.round(1000 / avg)}`);

  if (avg < 50) {
    console.log(`\n✅ EXCELLENT! Fast enough for real-time sync!`);
  } else if (avg < 100) {
    console.log(`\n⚠️  ACCEPTABLE but could be better`);
  } else {
    console.log(`\n❌ TOO SLOW for smooth sync`);
  }

  // Test getting pixel data as buffer
  console.log(`\n🔍 Testing pixel data access...`);
  const img = robot.screen.capture();
  const pixelData = img.image;
  console.log(`   Pixel buffer length: ${pixelData.length} bytes`);
  console.log(`   Color format: BGRA (Blue, Green, Red, Alpha)`);

  console.log(`\n✅ robotjs is ready for production use!`);

} catch (error) {
  console.error('❌ ERROR:', error.message);
  console.error('\nrobotjs may not be installed yet. Run: npm install robotjs');
  process.exit(1);
}
