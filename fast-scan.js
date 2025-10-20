// Fast parallel scan for Nanoleaf
const axios = require('axios');
const os = require('os');

console.log('🔍 Fast scanning for Nanoleaf devices...\n');

// Get all network interfaces
const interfaces = os.networkInterfaces();
const networks = new Set();

for (const name of Object.keys(interfaces)) {
  for (const iface of interfaces[name]) {
    if (iface.family === 'IPv4' && !iface.internal) {
      const parts = iface.address.split('.');
      const baseIP = `${parts[0]}.${parts[1]}.${parts[2]}`;
      networks.add(baseIP);
      console.log(`📡 Will scan: ${baseIP}.x`);
    }
  }
}

async function checkNanoleaf(ip) {
  try {
    const response = await axios.get(`http://${ip}:16021/api/v1/`, {
      timeout: 300
    });
    return { ip, found: true };
  } catch (error) {
    return { ip, found: false };
  }
}

async function scanAll() {
  const promises = [];

  for (const base of networks) {
    // Scan entire range 1-254
    for (let i = 1; i <= 254; i++) {
      const ip = `${base}.${i}`;
      promises.push(checkNanoleaf(ip));
    }
  }

  console.log(`\nScanning ${promises.length} addresses (this will take ~30 seconds)...\n`);

  const results = await Promise.allSettled(promises);
  const found = results
    .filter(r => r.status === 'fulfilled' && r.value.found)
    .map(r => r.value.ip);

  return found;
}

scanAll().then(found => {
  console.log('\n' + '='.repeat(70));
  if (found.length === 0) {
    console.log('❌ No Nanoleaf found');
    console.log('\n💡 Please check Nanoleaf app for IP address');
  } else {
    console.log(`✅ Found ${found.length} Nanoleaf device(s):\n`);
    found.forEach((ip, i) => {
      console.log(`   ${i + 1}. ${ip}`);
    });
    console.log(`\n🚀 Run this to test:`);
    console.log(`   NANOLEAF_IP=${found[0]} node test-nanoleaf.js`);
  }
  console.log('='.repeat(70));
});
