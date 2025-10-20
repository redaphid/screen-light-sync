// Test desktop-screenshot
const screenshot = require('desktop-screenshot');
const fs = require('fs');
const path = require('path');

console.log('Testing desktop-screenshot...\n');

const outputPath = path.join(__dirname, 'test.png');

const start = Date.now();

screenshot(outputPath, (error, complete) => {
  const time = Date.now() - start;

  if (error) {
    console.error('❌ ERROR:', error);
    process.exit(1);
  }

  if (complete && fs.existsSync(outputPath)) {
    const stats = fs.statSync(outputPath);
    const buffer = fs.readFileSync(outputPath);

    console.log('✅ SUCCESS!');
    console.log(`   Capture time: ${time}ms`);
    console.log(`   File size: ${stats.size} bytes`);
    console.log(`   Buffer size: ${buffer.length} bytes`);

    fs.unlinkSync(outputPath);
    process.exit(0);
  } else {
    console.error('❌ File not created');
    process.exit(1);
  }
});
