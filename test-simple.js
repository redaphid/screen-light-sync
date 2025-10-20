// Simple test using Node directly
const screenshot = require('screenshot-desktop');

console.log('Testing screenshot-desktop...\n');

// Test with a simple callback
screenshot({ format: 'jpg' })
  .then(img => {
    console.log('✅ SUCCESS! Captured screenshot:');
    console.log(`   Size: ${img.length} bytes`);
    console.log(`   Type: ${typeof img}`);
    console.log(`   Is Buffer: ${Buffer.isBuffer(img)}`);
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ ERROR:', err.message);
    console.error('\nFull error:');
    console.error(err);
    process.exit(1);
  });
