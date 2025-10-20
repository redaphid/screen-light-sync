// Test windows-ss library
const windowsSS = require('windows-ss');

console.log('Testing windows-ss...\n');

windowsSS.capture()
  .then(buffer => {
    console.log('✅ SUCCESS! Captured screenshot:');
    console.log(`   Size: ${buffer.length} bytes`);
    console.log(`   Type: ${typeof buffer}`);
    console.log(`   Is Buffer: ${Buffer.isBuffer(buffer)}`);
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ ERROR:', err.message);
    console.error(err);
    process.exit(1);
  });
