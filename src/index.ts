import * as readline from 'readline';
import { ConfigManager } from './config/ConfigManager';
import { HueController } from './hue/HueController';
import { NanoleafController } from './nanoleaf/NanoleafController';
import { SyncEngine } from './sync/SyncEngine';

/**
 * Simple readline interface for user input
 */
function createReadline() {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

/**
 * Ask a yes/no question
 */
async function askYesNo(question: string): Promise<boolean> {
  const rl = createReadline();
  return new Promise((resolve) => {
    rl.question(`${question} (y/n): `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
}

/**
 * Ask for text input
 */
async function askInput(question: string): Promise<string> {
  const rl = createReadline();
  return new Promise((resolve) => {
    rl.question(`${question}: `, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

/**
 * Setup wizard for first-time configuration
 */
async function runSetupWizard(configManager: ConfigManager): Promise<void> {
  console.log(`\n${'='.repeat(60)}`);
  console.log('🎨 Welcome to Screen-Light Sync Setup Wizard!');
  console.log(`${'='.repeat(60)}\n`);

  const config = ConfigManager.createDefaultConfig();

  // Philips Hue Setup
  const setupHue = await askYesNo('Do you have Philips Hue lights?');
  if (setupHue) {
    console.log('\n--- Philips Hue Setup ---');
    const hueController = new HueController();

    console.log('Discovering Hue bridges...');
    const bridges = await hueController.discoverBridges();

    if (bridges.length === 0) {
      console.log('⚠ No Hue bridges found on your network');
    } else {
      console.log(`\nFound ${bridges.length} bridge(s):`);
      bridges.forEach((bridge, i) => {
        console.log(`  ${i + 1}. ${bridge.ipaddress} (${bridge.name || 'Unknown'})`);
      });

      const bridgeIp = bridges[0].ipaddress;
      console.log(`\nUsing bridge: ${bridgeIp}`);

      // Create user
      const username = await hueController.createUser(bridgeIp);

      config.hue = {
        bridgeIp,
        username,
        lightIds: [], // Empty means use all lights
        entertainmentAreaId: null,
      };

      console.log('✓ Hue setup complete!');
    }
  } else {
    config.sync!.enableHue = false;
  }

  // Nanoleaf Setup
  const setupNanoleaf = await askYesNo('\nDo you have Nanoleaf panels?');
  if (setupNanoleaf) {
    console.log('\n--- Nanoleaf Setup ---');
    const nanoleafIp = await askInput('Enter your Nanoleaf IP address');

    const nanoleafController = new NanoleafController();
    const authToken = await nanoleafController.createAuthToken(nanoleafIp);

    config.nanoleaf = {
      ip: nanoleafIp,
      authToken,
    };

    console.log('✓ Nanoleaf setup complete!');
  } else {
    config.sync!.enableNanoleaf = false;
  }

  // Sync Settings
  console.log('\n--- Sync Settings ---');
  const fpsInput = await askInput('Frames per second (1-60, default: 10)');
  const fps = parseInt(fpsInput) || 10;
  config.sync!.fps = Math.min(60, Math.max(1, fps));

  const brightnessInput = await askInput('Brightness (0-255, default: 255)');
  const brightness = parseInt(brightnessInput) || 255;
  config.sync!.brightness = Math.min(255, Math.max(0, brightness));

  // Save configuration
  await configManager.save(config);

  console.log('\n✓ Setup complete! Configuration saved.');
}

/**
 * Main application
 */
async function main() {
  const configManager = new ConfigManager();

  // Load configuration
  await configManager.load();
  let config = configManager.get();

  // Check if setup is needed
  const needsSetup = !config.hue?.bridgeIp && !config.nanoleaf?.ip;

  if (needsSetup) {
    const runSetup = await askYesNo('\nNo configuration found. Run setup wizard?');
    if (runSetup) {
      await runSetupWizard(configManager);
      config = configManager.get();
    } else {
      console.log('\n⚠ Cannot proceed without configuration. Exiting...');
      process.exit(0);
    }
  }

  // Initialize controllers
  let hueController: HueController | undefined;
  let nanoleafController: NanoleafController | undefined;

  if (config.sync?.enableHue && config.hue?.bridgeIp && config.hue?.username) {
    console.log('\n🔵 Initializing Philips Hue...');
    hueController = new HueController({
      bridgeIp: config.hue.bridgeIp,
      username: config.hue.username,
    });
    await hueController.connect();

    // List lights
    const lights = await hueController.getLights();
    console.log(`   Found ${lights.length} light(s):`);
    lights.forEach(light => {
      console.log(`   - ${light.name} (ID: ${light.id})`);
    });
  }

  if (config.sync?.enableNanoleaf && config.nanoleaf?.ip && config.nanoleaf?.authToken) {
    console.log('\n🔶 Initializing Nanoleaf...');
    nanoleafController = new NanoleafController({
      ip: config.nanoleaf.ip,
      authToken: config.nanoleaf.authToken,
    });
    await nanoleafController.connect(config.nanoleaf.ip, config.nanoleaf.authToken);
  }

  if (!hueController && !nanoleafController) {
    console.log('\n⚠ No devices configured. Please run setup again.');
    process.exit(0);
  }

  // Create sync engine
  const syncEngine = new SyncEngine(hueController, nanoleafController, config.sync);

  // Handle exit gracefully
  process.on('SIGINT', async () => {
    console.log('\n\n🛑 Shutting down...');
    syncEngine.stop();

    if (hueController) {
      const turnOff = await askYesNo('Turn off Hue lights?');
      if (turnOff) {
        await hueController.turnOffAll();
      }
    }

    if (nanoleafController) {
      const turnOff = await askYesNo('Turn off Nanoleaf?');
      if (turnOff) {
        await nanoleafController.turnOff();
      }
    }

    console.log('👋 Goodbye!');
    process.exit(0);
  });

  // Start synchronization
  await syncEngine.start();

  console.log('\n💡 Press Ctrl+C to stop\n');
}

// Run the application
main().catch((error) => {
  console.error('\n❌ Fatal error:', error.message);
  process.exit(1);
});
