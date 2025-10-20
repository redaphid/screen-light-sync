// Test Hue Bridge and Lights
const v3 = require('node-hue-api').v3;
const LightState = v3.lightStates.LightState;

console.log('╔════════════════════════════════════════════════════════════════════╗');
console.log('║  💡 HUE BRIDGE & LIGHTS TEST                                      ║');
console.log('╚════════════════════════════════════════════════════════════════════╝\n');

// Configuration from config.json
const BRIDGE_IP = '10.0.194.117';
const USERNAME = 'TEKWU841KiQLygGaesVQFTokoS0T8Q5bs6wdp1wB';

async function testHueBridge() {
  try {
    console.log(`${'='.repeat(70)}`);
    console.log('🔌 CONNECTING TO BRIDGE');
    console.log(`${'='.repeat(70)}\n`);
    console.log(`Bridge IP: ${BRIDGE_IP}`);
    console.log(`Username: ${USERNAME.substring(0, 20)}...\n`);

    const api = await v3.api.createLocal(BRIDGE_IP).connect(USERNAME);
    console.log('✅ Connected to Hue Bridge!\n');

    // Get bridge config
    console.log(`${'='.repeat(70)}`);
    console.log('📋 BRIDGE INFO');
    console.log(`${'='.repeat(70)}\n`);

    const config = await api.configuration.getConfiguration();
    console.log(`Name: ${config.name}`);
    console.log(`Model: ${config.modelid}`);
    console.log(`API Version: ${config.apiversion}`);
    console.log(`Software Version: ${config.swversion}`);
    console.log(`Zigbee Channel: ${config.zigbeechannel}\n`);

    // List all lights
    console.log(`${'='.repeat(70)}`);
    console.log('💡 LISTING ALL LIGHTS');
    console.log(`${'='.repeat(70)}\n`);

    const lights = await api.lights.getAll();
    console.log(`Found ${lights.length} lights:\n`);

    const lightList = [];
    for (const light of lights) {
      const status = light.state.on ? '🟢 ON' : '⚫ OFF';
      const brightness = light.state.bri ? Math.round((light.state.bri / 254) * 100) : 0;
      const reachable = light.state.reachable ? '✅' : '❌';

      console.log(`${reachable} ${light.id}. ${light.name}`);
      console.log(`   Type: ${light.type}`);
      console.log(`   Model: ${light.modelid}`);
      console.log(`   Status: ${status} | Brightness: ${brightness}%`);

      if (light.state.colormode) {
        console.log(`   Color Mode: ${light.state.colormode}`);
      }
      console.log('');

      lightList.push({
        id: light.id,
        name: light.name,
        on: light.state.on,
        reachable: light.state.reachable
      });
    }

    // Get Entertainment Areas
    console.log(`${'='.repeat(70)}`);
    console.log('🎬 ENTERTAINMENT AREAS');
    console.log(`${'='.repeat(70)}\n`);

    let entertainmentAreas = [];
    try {
      const groups = await api.groups.getAll();
      entertainmentAreas = groups.filter(g => g.type === 'Entertainment');

      if (entertainmentAreas.length === 0) {
        console.log('⚠️  No Entertainment areas configured');
        console.log('   Create one in the Hue app for faster sync!\n');
      } else {
        console.log(`Found ${entertainmentAreas.length} Entertainment area(s):\n`);

        for (const area of entertainmentAreas) {
          console.log(`${area.id}. ${area.name}`);
          console.log(`   Class: ${area.class}`);
          console.log(`   Lights: ${area.lights.join(', ')}`);
          console.log(`   Stream Active: ${area.stream ? area.stream.active : 'N/A'}`);
          console.log('');
        }
      }
    } catch (error) {
      console.log('⚠️  Could not retrieve Entertainment areas');
      console.log(`   Error: ${error.message}`);
      console.log('   This may be due to API compatibility issues\n');
      console.log('   You can still use regular API for all lights\n');
    }

    // Test color control
    console.log(`${'='.repeat(70)}`);
    console.log('🎨 TESTING COLOR CONTROL');
    console.log(`${'='.repeat(70)}\n`);

    // Find a reachable light to test with
    const testLight = lightList.find(l => l.reachable);

    if (!testLight) {
      console.log('❌ No reachable lights found for testing');
      return;
    }

    console.log(`Testing with light: ${testLight.name} (ID: ${testLight.id})\n`);

    // Turn on
    console.log('1️⃣  Turning ON...');
    const onState = new LightState().on(true);
    await api.lights.setLightState(testLight.id, onState);
    await new Promise(resolve => setTimeout(resolve, 1000));
    console.log('   ✅ Done');

    // Test brightness
    console.log('2️⃣  Setting brightness to 50%...');
    const brightState = new LightState().brightness(50);
    await api.lights.setLightState(testLight.id, brightState);
    await new Promise(resolve => setTimeout(resolve, 1000));
    console.log('   ✅ Done');

    // Test colors with timing
    const colors = [
      { name: 'RED', hue: 0, sat: 254 },
      { name: 'GREEN', hue: 25500, sat: 254 },
      { name: 'BLUE', hue: 46920, sat: 254 },
      { name: 'PURPLE', hue: 50000, sat: 254 },
      { name: 'ORANGE', hue: 5000, sat: 254 },
    ];

    console.log('\nTesting color changes with timing...\n');
    const colorTimes = [];

    for (const color of colors) {
      console.log(`3️⃣  Setting color to ${color.name}...`);

      const start = Date.now();
      const colorState = new LightState()
        .on(true)
        .hue(color.hue)
        .sat(color.sat)
        .brightness(80);

      await api.lights.setLightState(testLight.id, colorState);
      const elapsed = Date.now() - start;
      colorTimes.push(elapsed);

      console.log(`   ✅ ${color.name} set (${elapsed}ms)`);
      await new Promise(resolve => setTimeout(resolve, 1500));
    }

    // Calculate color change performance
    const avgColorTime = colorTimes.reduce((a, b) => a + b, 0) / colorTimes.length;
    console.log(`\n📊 Color Change Performance:`);
    console.log(`   Average: ${avgColorTime.toFixed(2)}ms`);
    console.log(`   Min: ${Math.min(...colorTimes)}ms`);
    console.log(`   Max: ${Math.max(...colorTimes)}ms`);

    // Test rapid color changes (sync simulation)
    console.log(`\n${'='.repeat(70)}`);
    console.log('⚡ RAPID COLOR CHANGE TEST (SYNC SIMULATION)');
    console.log(`${'='.repeat(70)}\n`);

    console.log('Sending 20 rapid color changes...\n');

    const rapidTimes = [];
    for (let i = 0; i < 20; i++) {
      const hue = Math.floor(Math.random() * 65535);
      const sat = 100;  // 0-100 percentage
      const bri = 80;   // 0-100 percentage

      const start = Date.now();
      const state = new LightState().hue(hue).sat(sat).brightness(bri);
      await api.lights.setLightState(testLight.id, state);
      const elapsed = Date.now() - start;
      rapidTimes.push(elapsed);

      if ((i + 1) % 5 === 0) {
        console.log(`   ${i + 1}/20 completed...`);
      }

      // Small delay between changes
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    const avgRapidTime = rapidTimes.reduce((a, b) => a + b, 0) / rapidTimes.length;
    console.log(`\n📊 Rapid Change Performance:`);
    console.log(`   Average: ${avgRapidTime.toFixed(2)}ms`);
    console.log(`   Min: ${Math.min(...rapidTimes)}ms`);
    console.log(`   Max: ${Math.max(...rapidTimes)}ms`);
    console.log(`   Estimated Max FPS: ${Math.round(1000 / avgRapidTime)}`);

    if (avgRapidTime < 50) {
      console.log(`   ✅ EXCELLENT for screen sync!`);
    } else if (avgRapidTime < 100) {
      console.log(`   ⚠️  ACCEPTABLE but could benefit from Entertainment API`);
    } else {
      console.log(`   ⚠️  SLOW - Entertainment API strongly recommended`);
    }

    // Restore to white
    console.log(`\n4️⃣  Restoring to warm white...`);
    const whiteState = new LightState()
      .on(true)
      .ct(366)  // Warm white
      .brightness(100);
    await api.lights.setLightState(testLight.id, whiteState);
    console.log('   ✅ Done');

    // Final summary
    console.log(`\n${'='.repeat(70)}`);
    console.log('✅ ALL TESTS PASSED!');
    console.log(`${'='.repeat(70)}\n`);

    console.log('Summary:');
    console.log(`  ✅ Bridge reachable: ${BRIDGE_IP}`);
    console.log(`  ✅ Authentication working`);
    console.log(`  ✅ ${lights.length} lights detected`);
    console.log(`  ✅ ${lightList.filter(l => l.reachable).length} lights reachable`);
    console.log(`  ✅ ${entertainmentAreas.length} Entertainment area(s)`);
    console.log(`  ✅ Color control working`);
    console.log(`  ✅ Average color change: ${avgRapidTime.toFixed(2)}ms`);

    if (entertainmentAreas.length > 0) {
      console.log(`\n🎬 Entertainment Areas Available:`);
      entertainmentAreas.forEach(area => {
        console.log(`   - "${area.name}" (ID: ${area.id}) with ${area.lights.length} lights`);
      });
      console.log(`\n💡 Recommendation:`);
      console.log(`   Use Entertainment API for lights in area: ${entertainmentAreas[0].lights.join(', ')}`);
      console.log(`   Use Regular API for remaining lights`);
    }

    console.log(`\n🎉 Your Hue bridge is ready for screen sync!\n`);

    // Update config recommendation
    console.log('💾 Update config.json with these IDs:\n');
    console.log(`{`);
    console.log(`  "hue": {`);
    console.log(`    "bridgeIp": "${BRIDGE_IP}",`);
    console.log(`    "username": "${USERNAME}",`);
    console.log(`    "lightIds": [${lightList.map(l => l.id).join(', ')}]`);
    if (entertainmentAreas.length > 0) {
      console.log(`  },`);
      console.log(`  "sync": {`);
      console.log(`    "fps": 20,`);
      console.log(`    "hueEntertainmentAreaId": ${entertainmentAreas[0].id},`);
      console.log(`    "hueRegularLightIds": [${lightList.filter(l => !entertainmentAreas[0].lights.includes(l.id.toString())).map(l => l.id).join(', ')}]`);
      console.log(`  }`);
    }
    console.log(`}\n`);

  } catch (error) {
    console.error(`\n❌ ERROR: ${error.message}`);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Run the test
testHueBridge().catch(error => {
  console.error('\n💥 Test failed:', error.message);
  process.exit(1);
});
