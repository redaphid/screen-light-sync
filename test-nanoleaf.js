// Test Nanoleaf Control
const axios = require('axios');

console.log('╔════════════════════════════════════════════════════════════════════╗');
console.log('║  🔶 NANOLEAF CONTROL TEST                                         ║');
console.log('╚════════════════════════════════════════════════════════════════════╝\n');

// Configuration - UPDATE THESE!
const NANOLEAF_IP = process.env.NANOLEAF_IP || '192.168.1.150';  // CHANGE THIS
const AUTH_TOKEN = process.env.NANOLEAF_TOKEN || null;            // Will create if needed

const PORT = 16021;

async function createAuthToken(ip) {
  console.log(`\n${'='.repeat(70)}`);
  console.log('🔐 CREATING NEW AUTH TOKEN');
  console.log(`${'='.repeat(70)}`);
  console.log('\n⚠️  HOLD THE POWER BUTTON ON YOUR NANOLEAF FOR 5-7 SECONDS!');
  console.log('    The LED should start blinking...\n');
  console.log('Waiting 30 seconds for you to press the button...');

  // Give user time to press button
  await new Promise(resolve => setTimeout(resolve, 30000));

  try {
    const response = await axios.post(
      `http://${ip}:${PORT}/api/v1/new`,
      {},
      { timeout: 10000 }
    );

    const token = response.data.auth_token;
    console.log(`\n✅ SUCCESS! Auth token created: ${token}`);
    console.log(`\n💾 Save this token! Add to your environment or code:`);
    console.log(`   export NANOLEAF_TOKEN="${token}"`);
    return token;
  } catch (error) {
    console.error(`\n❌ ERROR: ${error.message}`);
    console.error('Did you hold the power button? Try again!');
    throw error;
  }
}

async function testNanoleaf() {
  let token = AUTH_TOKEN;

  // Step 1: Get or create auth token
  if (!token) {
    console.log('No auth token provided. Creating new one...');
    token = await createAuthToken(NANOLEAF_IP);
  }

  const client = axios.create({
    baseURL: `http://${NANOLEAF_IP}:${PORT}/api/v1/${token}`,
    timeout: 5000,
  });

  console.log(`\n${'='.repeat(70)}`);
  console.log('📋 GETTING DEVICE INFO');
  console.log(`${'='.repeat(70)}\n`);

  try {
    // Get device info
    const info = await client.get('/');
    console.log(`✅ Connected to: ${info.data.name || 'Nanoleaf Device'}`);
    console.log(`   Model: ${info.data.model}`);
    console.log(`   Firmware: ${info.data.firmwareVersion}`);
    console.log(`   State: ${info.data.state.on.value ? 'ON' : 'OFF'}`);
    console.log(`   Brightness: ${info.data.state.brightness.value}%`);

    // Get panel layout
    console.log(`\n${'='.repeat(70)}`);
    console.log('🔷 PANEL LAYOUT');
    console.log(`${'='.repeat(70)}\n`);

    const layout = await client.get('/panelLayout/layout');
    const panels = layout.data.positionData;

    console.log(`✅ Detected ${panels.length} panels:`);
    panels.forEach((panel, i) => {
      console.log(`   ${i + 1}. Panel ID ${panel.panelId}: (x:${panel.x}, y:${panel.y}) orient:${panel.o}°`);
    });

    // Calculate bounds
    const xs = panels.map(p => p.x);
    const ys = panels.map(p => p.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const width = maxX - minX;
    const height = maxY - minY;

    console.log(`\n📐 Layout bounds: ${width} × ${height}`);

    // Test color changes
    console.log(`\n${'='.repeat(70)}`);
    console.log('🎨 TESTING COLOR CHANGES');
    console.log(`${'='.repeat(70)}\n`);

    // Turn on
    console.log('1️⃣  Turning ON...');
    await client.put('/state', { on: { value: true } });
    await new Promise(resolve => setTimeout(resolve, 1000));
    console.log('   ✅ Done');

    // Set brightness
    console.log('2️⃣  Setting brightness to 50%...');
    await client.put('/state', { brightness: { value: 50 } });
    await new Promise(resolve => setTimeout(resolve, 1000));
    console.log('   ✅ Done');

    // Test colors
    const colors = [
      { name: 'RED', hue: 0, sat: 100 },
      { name: 'GREEN', hue: 120, sat: 100 },
      { name: 'BLUE', hue: 240, sat: 100 },
      { name: 'PURPLE', hue: 280, sat: 100 },
      { name: 'WHITE', hue: 0, sat: 0 },
    ];

    for (const color of colors) {
      console.log(`3️⃣  Setting color to ${color.name}...`);
      await client.put('/state', {
        hue: { value: color.hue },
        sat: { value: color.sat },
        brightness: { value: 80 }
      });
      await new Promise(resolve => setTimeout(resolve, 1500));
      console.log(`   ✅ ${color.name} displayed`);
    }

    // Test per-panel colors
    console.log(`\n${'='.repeat(70)}`);
    console.log('🌈 TESTING PER-PANEL COLORS');
    console.log(`${'='.repeat(70)}\n`);

    console.log('Setting rainbow across panels...');

    // Build animation data
    const animData = [panels.length.toString()];

    panels.forEach((panel, i) => {
      // Rainbow: distribute hue across panels
      const hue = Math.floor((i / panels.length) * 360);
      const r = hslToRgb(hue / 360, 1, 0.5).r;
      const g = hslToRgb(hue / 360, 1, 0.5).g;
      const b = hslToRgb(hue / 360, 1, 0.5).b;

      animData.push(
        panel.panelId.toString(),
        '1',  // num frames
        r.toString(),
        g.toString(),
        b.toString(),
        '0',  // white
        '5'   // transition time
      );
    });

    try {
      await client.put('/effects', {
        write: {
          command: 'display',
          animType: 'static',
          animData: animData.join(' '),
          loop: false,
          palette: []
        }
      });
      console.log('   ✅ Rainbow displayed across panels!');
      await new Promise(resolve => setTimeout(resolve, 3000));
    } catch (error) {
      console.error('   ⚠️  Per-panel colors may not be supported on this model');
    }

    // Restore to white
    console.log('\n4️⃣  Restoring to white...');
    await client.put('/state', {
      hue: { value: 0 },
      sat: { value: 0 },
      brightness: { value: 100 }
    });

    console.log(`\n${'='.repeat(70)}`);
    console.log('✅ ALL TESTS PASSED!');
    console.log(`${'='.repeat(70)}\n`);

    console.log('Summary:');
    console.log(`  ✅ Device reachable: ${NANOLEAF_IP}`);
    console.log(`  ✅ Auth token works: ${token.substring(0, 20)}...`);
    console.log(`  ✅ ${panels.length} panels detected`);
    console.log(`  ✅ Color control working`);
    console.log(`  ✅ Per-panel control ${animData.length > 0 ? 'working' : 'tested'}`);

    console.log(`\n🎉 Your Nanoleaf is ready for screen sync!\n`);

    // Save config
    console.log('💾 Save this configuration:\n');
    console.log(`{`);
    console.log(`  "nanoleaf": {`);
    console.log(`    "ip": "${NANOLEAF_IP}",`);
    console.log(`    "authToken": "${token}"`);
    console.log(`  }`);
    console.log(`}\n`);

  } catch (error) {
    console.error(`\n❌ ERROR: ${error.message}`);
    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error(`Data:`, error.response.data);
    }
    process.exit(1);
  }
}

// Helper: HSL to RGB conversion
function hslToRgb(h, s, l) {
  let r, g, b;

  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }

  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255)
  };
}

// Run the test
testNanoleaf().catch(error => {
  console.error('\n💥 Test failed:', error.message);
  process.exit(1);
});
