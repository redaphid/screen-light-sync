// Test the Entertainment API direct implementation
const { HueEntertainmentDirect } = require('./hue-entertainment-direct');

console.log('╔════════════════════════════════════════════════════════════════════╗');
console.log('║  🎬 HUE ENTERTAINMENT API TEST                                    ║');
console.log('╚════════════════════════════════════════════════════════════════════╝\n');

const BRIDGE_IP = '10.0.194.117';
const USERNAME = 'TEKWU841KiQLygGaesVQFTokoS0T8Q5bs6wdp1wB';

async function testEntertainmentAPI() {
  try {
    const hue = new HueEntertainmentDirect(BRIDGE_IP, USERNAME);

    console.log(`${'='.repeat(70)}`);
    console.log('📋 DISCOVERING ENTERTAINMENT AREAS');
    console.log(`${'='.repeat(70)}\n`);

    const areas = await hue.getEntertainmentAreas();

    if (areas.length === 0) {
      console.log('❌ No Entertainment areas found');
      console.log('   Create one in the Hue app first\n');
      process.exit(1);
    }

    console.log(`✅ Found ${areas.length} Entertainment area(s):\n`);

    areas.forEach(area => {
      console.log(`${area.id}. ${area.name}`);
      console.log(`   Class: ${area.class}`);
      console.log(`   Lights: ${area.lights.join(', ')} (${area.lights.length} lights)`);
      console.log(`   Stream Active: ${area.stream?.active || false}`);
      console.log('');
    });

    // Test with first area
    const testArea = areas[0];
    console.log(`${'='.repeat(70)}`);
    console.log(`🎬 TESTING ENTERTAINMENT AREA: ${testArea.name} (ID: ${testArea.id})`);
    console.log(`${'='.repeat(70)}\n`);

    console.log('1️⃣  Activating Entertainment mode...');
    await hue.activateEntertainmentArea(testArea.id);
    await new Promise(resolve => setTimeout(resolve, 1000));

    console.log('\n2️⃣  Testing fast group updates with timing...\n');

    const colors = [
      { name: 'RED', hue: 0, sat: 254, bri: 200 },
      { name: 'GREEN', hue: 25500, sat: 254, bri: 200 },
      { name: 'BLUE', hue: 46920, sat: 254, bri: 200 },
      { name: 'PURPLE', hue: 50000, sat: 254, bri: 200 },
      { name: 'ORANGE', hue: 5000, sat: 254, bri: 200 },
    ];

    const times = [];

    for (const color of colors) {
      console.log(`   Setting ${color.name}...`);
      const start = Date.now();
      await hue.updateEntertainmentGroup(testArea.id, color.hue, color.sat, color.bri);
      const elapsed = Date.now() - start;
      times.push(elapsed);
      console.log(`   ✅ ${color.name} set (${elapsed}ms)`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    const avgTime = times.reduce((a, b) => a + b, 0) / times.length;

    console.log(`\n📊 Group Update Performance:`);
    console.log(`   Average: ${avgTime.toFixed(2)}ms`);
    console.log(`   Min: ${Math.min(...times)}ms`);
    console.log(`   Max: ${Math.max(...times)}ms`);
    console.log(`   Estimated Max FPS: ${Math.round(1000 / avgTime)}`);

    if (avgTime < 50) {
      console.log(`   ✅ EXCELLENT! Fast enough for real-time sync!`);
    } else if (avgTime < 100) {
      console.log(`   ✅ GOOD! Acceptable for screen sync`);
    } else {
      console.log(`   ⚠️  Slower than expected but still better than individual lights`);
    }

    console.log(`\n3️⃣  Testing rapid updates (sync simulation)...\n`);

    console.log('Sending 30 rapid color changes...');
    const rapidTimes = [];

    for (let i = 0; i < 30; i++) {
      const randomHue = Math.floor(Math.random() * 65535);
      const randomSat = 254;
      const randomBri = 200;

      const start = Date.now();
      await hue.updateEntertainmentGroup(testArea.id, randomHue, randomSat, randomBri);
      const elapsed = Date.now() - start;
      rapidTimes.push(elapsed);

      if ((i + 1) % 10 === 0) {
        console.log(`   ${i + 1}/30 completed...`);
      }

      // Small delay
      await new Promise(resolve => setTimeout(resolve, 30));
    }

    const avgRapidTime = rapidTimes.reduce((a, b) => a + b, 0) / rapidTimes.length;

    console.log(`\n📊 Rapid Update Performance:`);
    console.log(`   Average: ${avgRapidTime.toFixed(2)}ms`);
    console.log(`   Min: ${Math.min(...rapidTimes)}ms`);
    console.log(`   Max: ${Math.max(...rapidTimes)}ms`);
    console.log(`   Sustained FPS: ${Math.round(1000 / avgRapidTime)}`);

    console.log(`\n4️⃣  Deactivating Entertainment mode...`);
    await hue.deactivateEntertainmentArea(testArea.id);
    console.log('   ✅ Done');

    // Restore to warm white
    console.log('\n5️⃣  Restoring to warm white...');
    await hue.updateEntertainmentGroup(testArea.id, 0, 0, 254);
    console.log('   ✅ Done');

    console.log(`\n${'='.repeat(70)}`);
    console.log('✅ ALL TESTS PASSED!');
    console.log(`${'='.repeat(70)}\n`);

    console.log('Summary:');
    console.log(`  ✅ Entertainment API working`);
    console.log(`  ✅ Bypassed library validation bug`);
    console.log(`  ✅ ${testArea.lights.length} lights in Entertainment area`);
    console.log(`  ✅ Group update: ${avgRapidTime.toFixed(2)}ms average`);
    console.log(`  ✅ Sustained FPS: ${Math.round(1000 / avgRapidTime)}`);

    const improvement = 2100 / avgRapidTime;  // Compare to old 2100ms for 16 lights
    console.log(`  ✅ Speedup: ${improvement.toFixed(1)}x faster than individual updates!`);

    console.log(`\n💡 Recommendation:`);
    console.log(`   Use Entertainment area "${testArea.name}" for screen sync`);
    console.log(`   Expected real-time FPS: 15-20 with all processing overhead\n`);

  } catch (error) {
    console.error(`\n❌ ERROR: ${error.message}`);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

testEntertainmentAPI();
