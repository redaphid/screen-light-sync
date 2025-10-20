import { HueController } from './hue/HueController';
import { ConfigManager } from './config/ConfigManager';
import * as readline from 'readline';

function createReadline() {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

async function askYesNo(question: string): Promise<boolean> {
  const rl = createReadline();
  return new Promise((resolve) => {
    rl.question(`${question} (y/n): `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testHue() {
  console.log('\n==========================================================');
  console.log('🔵 PHILIPS HUE TEST');
  console.log('==========================================================\n');

  const configManager = new ConfigManager();
  await configManager.load();
  const config = configManager.get();

  const hueController = new HueController();

  // Step 1: Discovery
  console.log('📡 Step 1: Discovering Hue bridges...\n');
  const bridges = await hueController.discoverBridges();

  if (bridges.length === 0) {
    console.log('❌ No bridges found!');
    console.log('   - Make sure your Hue bridge is powered on');
    console.log('   - Check that it\'s connected to your network');
    console.log('   - Ensure your PC is on the same network');
    return;
  }

  console.log(`✓ Found ${bridges.length} bridge(s):\n`);
  bridges.forEach((bridge, i) => {
    console.log(`   ${i + 1}. IP: ${bridge.ipaddress}`);
    if (bridge.name) console.log(`      Name: ${bridge.name}`);
  });

  const bridgeIp = bridges[0].ipaddress;
  console.log(`\n→ Using bridge at ${bridgeIp}\n`);

  // Step 2: Authentication
  let username = config.hue?.username;

  if (!username || config.hue?.bridgeIp !== bridgeIp) {
    console.log('🔐 Step 2: Creating new user (authentication)...\n');
    console.log('⚠  PRESS THE LINK BUTTON ON YOUR HUE BRIDGE NOW!');
    console.log('   (The large button on top of the bridge)\n');

    const proceed = await askYesNo('Have you pressed the button? Ready to continue?');

    if (!proceed) {
      console.log('\n❌ Test cancelled. Please press the button and try again.');
      return;
    }

    try {
      username = await hueController.createUser(bridgeIp);

      // Save credentials
      await configManager.update({
        hue: {
          bridgeIp,
          username,
          lightIds: [],
        },
      });

      console.log('\n✓ Credentials saved to config.json\n');
    } catch (error: any) {
      console.log('\n❌ Failed to create user:', error.message);
      console.log('   - Make sure you pressed the link button');
      console.log('   - Try pressing it again and re-run the test');
      return;
    }
  } else {
    console.log('✓ Using existing credentials from config.json\n');
  }

  // Step 3: Connect
  console.log('🔗 Step 3: Connecting to bridge...\n');
  try {
    await hueController.connect(bridgeIp, username);
  } catch (error: any) {
    console.log('❌ Connection failed:', error.message);
    return;
  }

  // Step 4: List lights
  console.log('\n💡 Step 4: Discovering lights...\n');
  const lights = await hueController.getLights();

  if (lights.length === 0) {
    console.log('⚠  No lights found!');
    console.log('   - Make sure your lights are turned on');
    console.log('   - Check they are paired with the bridge');
    return;
  }

  console.log(`✓ Found ${lights.length} light(s):\n`);

  const colorLights = await hueController.getColorLights();
  const colorLightIds = new Set(colorLights.map((l: any) => l.id));

  lights.forEach((light: any) => {
    const supportsColor = colorLightIds.has(light.id);
    console.log(`   ${light.id}. ${light.name}`);
    console.log(`      Type: ${light.type}`);
    console.log(`      Model: ${light.modelid || 'Unknown'}`);
    console.log(`      Color Support: ${supportsColor ? '✓ Yes (RGB)' : '✗ No (Brightness only)'}`);
    console.log(`      On: ${light.state.on ? 'Yes' : 'No'}`);
    console.log('');
  });

  if (colorLights.length < lights.length) {
    console.log(`   ℹ  ${lights.length - colorLights.length} light(s) don't support color.`);
    console.log(`      They will sync to screen brightness instead.\n`);
  }

  // Step 5: Color test
  const testColors = await askYesNo('Do you want to test color changes?');

  if (testColors) {
    console.log('\n🎨 Step 5: Testing colors...\n');
    console.log('   Your lights will cycle through colors:');
    console.log('   Red → Green → Blue → White\n');

    const testSequence = [
      { name: 'Red', r: 255, g: 0, b: 0 },
      { name: 'Green', r: 0, g: 255, b: 0 },
      { name: 'Blue', r: 0, g: 0, b: 255 },
      { name: 'White', r: 255, g: 255, b: 255 },
    ];

    for (const color of testSequence) {
      console.log(`   → Setting all lights to ${color.name}...`);

      const lightColors = new Map();
      lights.forEach((light: any) => {
        lightColors.set(light.id, { r: color.r, g: color.g, b: color.b });
      });

      await hueController.setMultipleLights(lightColors, 255);
      await sleep(2000);
    }

    console.log('\n✓ Color test complete!\n');

    const turnOff = await askYesNo('Turn off lights?');
    if (turnOff) {
      await hueController.turnOffAll();
      console.log('✓ Lights turned off\n');
    }
  }

  console.log('==========================================================');
  console.log('✅ HUE TEST COMPLETED SUCCESSFULLY!');
  console.log('==========================================================\n');
  console.log('Your Hue setup is working correctly.');
  console.log('You can now run the full screen sync: npm start\n');
}

testHue().catch((error) => {
  console.error('\n❌ Test failed:', error.message);
  console.error('\nStack trace:');
  console.error(error.stack);
  process.exit(1);
});
