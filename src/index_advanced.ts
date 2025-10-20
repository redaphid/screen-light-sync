import * as readline from 'readline';
import { ConfigManager } from './config/ConfigManager';
import { HueController } from './hue/HueController';
import { HueEntertainmentController } from './hue/HueEntertainmentController';
import { NanoleafAdvancedController } from './nanoleaf/NanoleafAdvancedController';
import { AdvancedSyncEngine } from './sync/AdvancedSyncEngine';

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

async function askInput(question: string, defaultValue?: string): Promise<string> {
  const rl = createReadline();
  const prompt = defaultValue ? `${question} [${defaultValue}]: ` : `${question}: `;
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      rl.close();
      resolve(answer.trim() || defaultValue || '');
    });
  });
}

async function askNumber(question: string, min: number, max: number, defaultValue: number): Promise<number> {
  const input = await askInput(`${question} (${min}-${max})`, defaultValue.toString());
  const num = parseInt(input) || defaultValue;
  return Math.min(max, Math.max(min, num));
}

/**
 * Advanced setup wizard
 */
async function runAdvancedSetupWizard(configManager: ConfigManager): Promise<void> {
  console.log(`\n${'='.repeat(70)}`);
  console.log('🎨 ADVANCED Screen-Light Sync Setup Wizard');
  console.log(`${'='.repeat(70)}\n`);

  const config: any = {
    hue: {},
    nanoleaf: {},
    sync: {
      fps: 15,
      brightness: 255,
      colorBoost: 1.2,
      enableHue: false,
      enableNanoleaf: false,
      useAdvancedColorDetection: true,
      hueEntertainmentAreaId: undefined,
      hueRegularLightIds: [],
    },
  };

  // Philips Hue Setup
  const setupHue = await askYesNo('\n💡 Do you have Philips Hue lights?');
  if (setupHue) {
    console.log('\n--- Philips Hue Setup ---');
    const hueController = new HueController();

    console.log('Discovering Hue bridges...');
    const bridges = await hueController.discoverBridges();

    if (bridges.length === 0) {
      console.log('⚠ No Hue bridges found');
    } else {
      console.log(`\nFound ${bridges.length} bridge(s):`);
      bridges.forEach((bridge, i) => {
        console.log(`  ${i + 1}. ${bridge.ipaddress}`);
      });

      const bridgeIp = bridges[0].ipaddress;
      console.log(`\nUsing bridge: ${bridgeIp}`);

      const username = await hueController.createUser(bridgeIp);
      config.hue.bridgeIp = bridgeIp;
      config.hue.username = username;

      // Connect and list lights
      await hueController.connect(bridgeIp, username);
      const allLights = await hueController.getLights();
      console.log(`\n📋 Found ${allLights.length} total lights:`);
      allLights.forEach(light => {
        console.log(`   ${light.id}. ${light.name}`);
      });

      // Check for Entertainment API
      const useEntertainment = await askYesNo('\n⚡ Use Entertainment API for faster sync?');

      if (useEntertainment) {
        const entController = new HueEntertainmentController(bridgeIp, username);
        await entController.connect();

        const areas = await entController.getEntertainmentAreas();

        if (areas.length === 0) {
          console.log('\n⚠ No entertainment areas configured on your bridge');
          console.log('   Please create one in the Hue app first');
          config.sync.enableHue = true;
          config.sync.hueRegularLightIds = allLights.map(l => l.id);
        } else {
          console.log(`\n🎮 Found ${areas.length} entertainment area(s):`);
          areas.forEach((area, i) => {
            console.log(`   ${i + 1}. "${area.name}" (ID: ${area.id}) - ${area.lights.length} lights`);
            console.log(`      Lights: ${area.lights.join(', ')}`);
          });

          const areaIndex = await askNumber('\nWhich entertainment area to use?', 1, areas.length, 1);
          const selectedArea = areas[areaIndex - 1];

          config.sync.hueEntertainmentAreaId = selectedArea.id;
          config.hue.entertainmentAreaId = selectedArea.id;

          // Ask about remaining lights
          const entertainmentLights = new Set(selectedArea.lights);
          const remainingLights = allLights.filter(l => !entertainmentLights.has(l.id));

          if (remainingLights.length > 0) {
            console.log(`\n📌 ${remainingLights.length} lights NOT in entertainment area:`);
            remainingLights.forEach(light => {
              console.log(`   ${light.id}. ${light.name}`);
            });

            const useRemaining = await askYesNo('Control these lights with regular API?');
            if (useRemaining) {
              config.sync.hueRegularLightIds = remainingLights.map(l => l.id);
            }
          }

          config.sync.enableHue = true;
          console.log(`\n✓ Entertainment area "${selectedArea.name}" configured!`);
          console.log(`  Fast lights: ${selectedArea.lights.length}`);
          console.log(`  Regular lights: ${config.sync.hueRegularLightIds.length}`);
        }
      } else {
        config.sync.enableHue = true;
        config.sync.hueRegularLightIds = allLights.map(l => l.id);
        console.log(`✓ Using regular API for all ${allLights.length} lights`);
      }
    }
  }

  // Nanoleaf Setup
  const setupNanoleaf = await askYesNo('\n🔶 Do you have Nanoleaf panels?');
  if (setupNanoleaf) {
    console.log('\n--- Nanoleaf Advanced Setup ---');
    const nanoleafIp = await askInput('Enter your Nanoleaf IP address');

    const basicController = await import('./nanoleaf/NanoleafController');
    const tempController = new basicController.NanoleafController();
    const authToken = await tempController.createAuthToken(nanoleafIp);

    config.nanoleaf.ip = nanoleafIp;
    config.nanoleaf.authToken = authToken;
    config.sync.enableNanoleaf = true;

    console.log('\n✓ Nanoleaf configured with panel-based screen mapping!');
    console.log('  Each panel will display colors from its corresponding screen region');
  }

  // Sync Settings
  console.log('\n--- Performance Settings ---');
  config.sync.fps = await askNumber('Target FPS', 5, 60, 15);
  config.sync.brightness = await askNumber('Brightness', 0, 255, 255);

  const useAdvanced = await askYesNo('\nUse "Most Important Color" detection? (vs average)');
  config.sync.useAdvancedColorDetection = useAdvanced;

  await configManager.save(config);
  console.log('\n✓ Advanced setup complete! Configuration saved.');
}

/**
 * Main application
 */
async function main() {
  console.log('╔════════════════════════════════════════════════════════════════════╗');
  console.log('║  🎨 SCREEN-LIGHT SYNC - Advanced Edition                          ║');
  console.log('║                                                                    ║');
  console.log('║  Features:                                                         ║');
  console.log('║  • Hue Entertainment API (60 FPS capable)                          ║');
  console.log('║  • Hybrid dual-API support (Entertainment + Regular)               ║');
  console.log('║  • Per-panel Nanoleaf screen mapping                               ║');
  console.log('║  • Advanced "Most Important Color" detection                       ║');
  console.log('╚════════════════════════════════════════════════════════════════════╝\n');

  const configManager = new ConfigManager();
  await configManager.load();
  let config = configManager.get();

  const needsSetup = !config.hue.bridgeIp && !config.nanoleaf.ip;

  if (needsSetup) {
    const runSetup = await askYesNo('No configuration found. Run setup wizard?');
    if (runSetup) {
      await runAdvancedSetupWizard(configManager);
      config = configManager.get();
    } else {
      console.log('\n⚠ Cannot proceed without configuration. Exiting...');
      process.exit(0);
    }
  }

  // Initialize controllers
  let hueRegular: HueController | undefined;
  let hueEntertainment: HueEntertainmentController | undefined;
  let nanoleaf: NanoleafAdvancedController | undefined;

  // Set up Hue controllers
  if (config.sync.enableHue && config.hue.bridgeIp && config.hue.username) {
    console.log('\n🔵 Initializing Philips Hue...');

    // Regular API controller
    if (config.sync.hueRegularLightIds.length > 0) {
      hueRegular = new HueController({
        bridgeIp: config.hue.bridgeIp,
        username: config.hue.username,
      });
      await hueRegular.connect();
      console.log(`   Regular API: ${config.sync.hueRegularLightIds.length} light(s)`);
    }

    // Entertainment API controller
    if (config.sync.hueEntertainmentAreaId !== null) {
      hueEntertainment = new HueEntertainmentController(
        config.hue.bridgeIp,
        config.hue.username
      );
      await hueEntertainment.connect();

      const areas = await hueEntertainment.getEntertainmentAreas();
      const area = areas.find(a => a.id === config.sync.hueEntertainmentAreaId);
      if (area) {
        console.log(`   Entertainment API: Area "${area.name}" with ${area.lights.length} light(s)`);
      }
    }
  }

  // Set up Nanoleaf
  if (config.sync.enableNanoleaf && config.nanoleaf.ip && config.nanoleaf.authToken) {
    console.log('\n🔶 Initializing Nanoleaf...');
    nanoleaf = new NanoleafAdvancedController(
      config.nanoleaf.ip,
      config.nanoleaf.authToken
    );

    const info = await nanoleaf.getInfo();
    console.log(`   Device: ${info.name || 'Nanoleaf'}`);
    console.log(`   Panel-based screen mapping will be configured at start`);
  }

  if (!hueRegular && !hueEntertainment && !nanoleaf) {
    console.log('\n⚠ No devices configured. Please run setup again.');
    process.exit(0);
  }

  // Create advanced sync engine
  const syncEngine = new AdvancedSyncEngine(
    hueRegular,
    hueEntertainment,
    nanoleaf,
    config.sync
  );

  // Handle exit gracefully
  process.on('SIGINT', async () => {
    console.log('\n\n🛑 Shutting down...');
    await syncEngine.stop();

    if (hueRegular) {
      const turnOff = await askYesNo('Turn off Hue lights?');
      if (turnOff) {
        await hueRegular.turnOffAll();
      }
    }

    if (nanoleaf) {
      const turnOff = await askYesNo('Turn off Nanoleaf?');
      if (turnOff) {
        await nanoleaf.turnOff();
      }
    }

    console.log('👋 Goodbye!');
    process.exit(0);
  });

  // Start synchronization
  await syncEngine.start();

  console.log('\n💡 Sync running! Press Ctrl+C to stop\n');
}

main().catch((error) => {
  console.error('\n❌ Fatal error:', error.message);
  console.error(error.stack);
  process.exit(1);
});
