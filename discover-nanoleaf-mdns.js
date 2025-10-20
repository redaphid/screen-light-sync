// Discover Nanoleaf using mDNS (the proper way)
const { Bonjour } = require('bonjour-service');
const axios = require('axios');

console.log('╔════════════════════════════════════════════════════════════════════╗');
console.log('║  🔶 NANOLEAF mDNS DISCOVERY                                       ║');
console.log('╚════════════════════════════════════════════════════════════════════╝\n');

console.log('🔍 Searching for Nanoleaf devices via mDNS...\n');
console.log('   (This may take 10-15 seconds)\n');

const bonjour = new Bonjour();
const foundDevices = [];

// Search for Nanoleaf service
const browser = bonjour.find({ type: 'nanoleafapi' }, (service) => {
  console.log(`✅ Found Nanoleaf device!`);
  console.log(`   Name: ${service.name}`);
  console.log(`   Host: ${service.host}`);
  console.log(`   IP: ${service.referer.address}`);
  console.log(`   Port: ${service.port}\n`);

  foundDevices.push({
    name: service.name,
    ip: service.referer.address,
    port: service.port || 16021
  });
});

// Also try generic HTTP service discovery
const httpBrowser = bonjour.find({ type: 'http' }, (service) => {
  if (service.name && service.name.toLowerCase().includes('nanoleaf')) {
    console.log(`✅ Found potential Nanoleaf (HTTP service):`);
    console.log(`   Name: ${service.name}`);
    console.log(`   IP: ${service.referer.address}\n`);

    foundDevices.push({
      name: service.name,
      ip: service.referer.address,
      port: 16021
    });
  }
});

// Wait for discovery
setTimeout(async () => {
  browser.stop();
  httpBrowser.stop();
  bonjour.destroy();

  console.log(`\n${'='.repeat(70)}\n`);

  if (foundDevices.length === 0) {
    console.log('❌ No Nanoleaf devices found via mDNS\n');
    console.log('💡 Troubleshooting:');
    console.log('   1. Check Nanoleaf app → Settings → Device Info for IP address');
    console.log('   2. Make sure Nanoleaf and PC are on same WiFi network');
    console.log('   3. Try manually: node test-nanoleaf.js with IP address\n');
    console.log('📱 To find IP in Nanoleaf app:');
    console.log('   Open app → Select device → Settings (gear icon) → Device Info\n');
    process.exit(1);
  }

  console.log(`Found ${foundDevices.length} device(s). Testing authentication...\n`);

  // Try to authenticate
  for (const device of foundDevices) {
    console.log(`${'='.repeat(70)}`);
    console.log(`Testing ${device.name} at ${device.ip}...`);
    console.log('='.repeat(70));

    try {
      console.log('Creating auth token (device should be in pairing mode)...');

      const response = await axios.post(
        `http://${device.ip}:${device.port}/api/v1/new`,
        {},
        { timeout: 10000 }
      );

      const token = response.data.auth_token;
      console.log(`✅ Auth token created: ${token}\n`);

      // Test connection
      const testResponse = await axios.get(
        `http://${device.ip}:${device.port}/api/v1/${token}/`,
        { timeout: 5000 }
      );

      const info = testResponse.data;
      console.log(`📋 Device verified:`);
      console.log(`   Name: ${info.name}`);
      console.log(`   Model: ${info.model}`);
      console.log(`   Firmware: ${info.firmwareVersion}`);

      // Get panels
      const layoutResponse = await axios.get(
        `http://${device.ip}:${device.port}/api/v1/${token}/panelLayout/layout`
      );
      const panels = layoutResponse.data.positionData;
      console.log(`   Panels: ${panels.length}`);

      console.log(`\n${'='.repeat(70)}`);
      console.log('✅ SUCCESS! NANOLEAF CONFIGURED');
      console.log('='.repeat(70));
      console.log(`\n💾 Save this to config.json:\n`);
      console.log(`{`);
      console.log(`  "nanoleaf": {`);
      console.log(`    "ip": "${device.ip}",`);
      console.log(`    "authToken": "${token}"`);
      console.log(`  }`);
      console.log(`}\n`);

      console.log(`🎨 Test color control:`);
      console.log(`   NANOLEAF_IP=${device.ip} NANOLEAF_TOKEN=${token} node test-nanoleaf.js\n`);

      process.exit(0);

    } catch (error) {
      console.error(`❌ Failed: ${error.message}`);
      if (error.response) {
        console.error(`   Status: ${error.response.status}`);
      }
      console.log('   Is device still in pairing mode?\n');
    }
  }

  console.log('\n❌ Could not authenticate with any devices');
  console.log('   Make sure device is in pairing mode!');
  process.exit(1);

}, 15000);  // Wait 15 seconds for mDNS responses
