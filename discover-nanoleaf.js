// Discover Nanoleaf on network
const axios = require('axios');

console.log('🔍 Searching for Nanoleaf devices on your network...\n');

// Try common IP ranges
async function scanNetwork() {
  // Get local IP to determine network range
  const os = require('os');
  const interfaces = os.networkInterfaces();

  let baseIP = null;
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        const parts = iface.address.split('.');
        baseIP = `${parts[0]}.${parts[1]}.${parts[2]}`;
        console.log(`📡 Scanning network: ${baseIP}.x\n`);
        break;
      }
    }
    if (baseIP) break;
  }

  if (!baseIP) {
    console.error('❌ Could not determine network range');
    return null;
  }

  // Scan common device IPs (1-254) but focus on common ranges first
  const promises = [];
  const commonRanges = [
    ...Array.from({length: 50}, (_, i) => i + 100),  // 100-150
    ...Array.from({length: 50}, (_, i) => i + 150),  // 150-200
    ...Array.from({length: 50}, (_, i) => i + 200),  // 200-250
    ...Array.from({length: 50}, (_, i) => i + 50),   // 50-100
    ...Array.from({length: 50}, (_, i) => i + 1),    // 1-50
  ];

  for (const i of commonRanges) {
    const ip = `${baseIP}.${i}`;
    promises.push(checkNanoleaf(ip));
  }

  const results = await Promise.allSettled(promises);
  const found = results
    .filter(r => r.status === 'fulfilled' && r.value)
    .map(r => r.value);

  return found;
}

async function checkNanoleaf(ip) {
  try {
    const response = await axios.get(`http://${ip}:16021/api/v1/`, {
      timeout: 500
    });

    // If we get here, it's likely a Nanoleaf
    console.log(`✅ Found potential Nanoleaf at ${ip}`);
    return ip;
  } catch (error) {
    return null;
  }
}

async function createAuthToken(ip) {
  console.log(`\n🔐 Creating auth token for ${ip}...`);
  console.log('   Device should already be in pairing mode!\n');

  try {
    const response = await axios.post(
      `http://${ip}:16021/api/v1/new`,
      {},
      { timeout: 10000 }
    );

    const token = response.data.auth_token;
    console.log(`✅ SUCCESS! Auth token: ${token}\n`);
    return token;
  } catch (error) {
    console.error(`❌ Failed to create token: ${error.message}`);
    return null;
  }
}

async function testConnection(ip, token) {
  try {
    const response = await axios.get(
      `http://${ip}:16021/api/v1/${token}/`,
      { timeout: 5000 }
    );

    const info = response.data;
    console.log(`\n📋 Device Info:`);
    console.log(`   Name: ${info.name || 'Nanoleaf'}`);
    console.log(`   Model: ${info.model}`);
    console.log(`   Firmware: ${info.firmwareVersion}`);
    console.log(`   Serial: ${info.serialNo}`);

    // Get panel layout
    const layoutResponse = await axios.get(
      `http://${ip}:16021/api/v1/${token}/panelLayout/layout`,
      { timeout: 5000 }
    );

    const panels = layoutResponse.data.positionData;
    console.log(`\n🔷 Panels: ${panels.length} detected`);

    return true;
  } catch (error) {
    console.error(`❌ Failed to connect: ${error.message}`);
    return false;
  }
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════════════╗');
  console.log('║  🔶 NANOLEAF DISCOVERY & SETUP                                    ║');
  console.log('╚════════════════════════════════════════════════════════════════════╝\n');

  const devices = await scanNetwork();

  if (!devices || devices.length === 0) {
    console.log('\n❌ No Nanoleaf devices found on network');
    console.log('   Make sure device is powered on and connected to WiFi');
    process.exit(1);
  }

  console.log(`\n✅ Found ${devices.length} device(s):\n`);
  devices.forEach((ip, i) => {
    console.log(`   ${i + 1}. ${ip}`);
  });

  // Try to authenticate with each
  for (const ip of devices) {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`Testing ${ip}...`);
    console.log('='.repeat(70));

    const token = await createAuthToken(ip);
    if (token) {
      const success = await testConnection(ip, token);
      if (success) {
        console.log(`\n${'='.repeat(70)}`);
        console.log('✅ NANOLEAF CONFIGURED SUCCESSFULLY!');
        console.log('='.repeat(70));
        console.log(`\n💾 Save this configuration:\n`);
        console.log(`{`);
        console.log(`  "nanoleaf": {`);
        console.log(`    "ip": "${ip}",`);
        console.log(`    "authToken": "${token}"`);
        console.log(`  }`);
        console.log(`}\n`);

        console.log(`🚀 Now run the full test:`);
        console.log(`   NANOLEAF_IP=${ip} NANOLEAF_TOKEN=${token} node test-nanoleaf.js\n`);
        process.exit(0);
      }
    }
  }

  console.log('\n❌ Could not authenticate with any devices');
  console.log('   Make sure device is in pairing mode (hold power button 5-7 sec)');
  process.exit(1);
}

main();
