# Screen-Light Sync 🎨💡

Real-time screen-scraping light synchronization for **Philips Hue** and **Nanoleaf** devices on Windows. Create an immersive ambilight experience that syncs your smart lights to your screen content!

## Features

- **Real-time screen capture** using Windows Desktop Duplication API
- **Color extraction** with intelligent color enhancement
- **Philips Hue support** - Control individual lights or groups
- **Nanoleaf support** - Sync your canvas/shapes/triangles
- **Configurable FPS** - Adjust performance vs smoothness (1-60 FPS)
- **Screen zones** - Support for multi-light setups (coming soon)
- **Performance stats** - Monitor sync performance in real-time
- **Easy setup wizard** - Get started in minutes

## Prerequisites

- Windows 10/11
- Node.js 18+ installed
- Philips Hue Bridge (optional)
- Nanoleaf panels (optional)
- Your devices must be on the same network as your PC

## Installation

1. **Clone or download this repository**

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Build the project:**
   ```bash
   npm run build
   ```

## First-Time Setup

Run the setup wizard to configure your devices:

```bash
npm run dev
```

The wizard will guide you through:

1. **Philips Hue Setup**
   - Auto-discovers your Hue bridge
   - Press the link button on your bridge when prompted
   - Creates authentication credentials

2. **Nanoleaf Setup**
   - Enter your Nanoleaf's IP address
   - Hold the power button for 5-7 seconds when prompted
   - Creates authentication token

3. **Sync Settings**
   - Set your preferred FPS (default: 10)
   - Set brightness level (default: 255)

Your configuration is saved to `config.json` for future use.

## Usage

### Start Syncing

```bash
npm start
```

Or for development mode with auto-reload:

```bash
npm run dev
```

### Stop Syncing

Press `Ctrl+C` - you'll be prompted to turn off your lights.

## Configuration

The `config.json` file stores your settings:

```json
{
  "hue": {
    "bridgeIp": "192.168.1.x",
    "username": "your-username-here",
    "lightIds": []
  },
  "nanoleaf": {
    "ip": "192.168.1.x",
    "authToken": "your-token-here"
  },
  "sync": {
    "fps": 10,
    "brightness": 255,
    "colorBoost": 1.2,
    "enableHue": true,
    "enableNanoleaf": true,
    "zones": []
  }
}
```

### Configuration Options

| Option | Description | Default |
|--------|-------------|---------|
| `fps` | Frames per second (1-60) | 10 |
| `brightness` | Global brightness (0-255) | 255 |
| `colorBoost` | Saturation multiplier | 1.2 |
| `enableHue` | Enable Hue lights | true |
| `enableNanoleaf` | Enable Nanoleaf | true |
| `lightIds` | Specific Hue lights (empty = all) | [] |

### Advanced: Screen Zones

For multi-light setups, you can define screen zones in `config.json`:

```json
{
  "sync": {
    "zones": [
      {
        "name": "left",
        "x": 0,
        "y": 0,
        "width": 0.5,
        "height": 1
      },
      {
        "name": "right",
        "x": 0.5,
        "y": 0,
        "width": 0.5,
        "height": 1
      }
    ]
  }
}
```

Coordinates are percentages (0-1) of screen dimensions.

## Performance Tips

- **Lower FPS = Better performance**: 10 FPS is smooth for most content
- **Increase FPS for gaming**: 15-20 FPS for fast-paced content
- **Color boost**: Higher values = more saturated colors (1.0-2.0 recommended)
- **Brightness**: Lower values reduce eye strain in dark rooms

## Troubleshooting

### "No bridges found"
- Ensure your Hue bridge is powered on
- Check that your PC is on the same network
- Try manually entering the bridge IP in `config.json`

### "Failed to create user"
- Make sure you press the link button within 30 seconds
- The button is the large round button on top of the bridge
- Re-run the setup if you miss the window

### "Connection timeout"
- Check firewall settings
- Ensure devices are on the same network
- Verify IP addresses in `config.json`

### Poor performance
- Lower the FPS setting
- Close other resource-intensive applications
- Disable Nanoleaf if you only have Hue (or vice versa)

### Colors not accurate
- Adjust `colorBoost` setting (try 1.0 for more accurate colors)
- Some content has limited color range
- Try different brightness levels

## Project Structure

```
src/
├── capture/
│   └── ScreenCapture.ts     # Screen capture functionality
├── color/
│   └── ColorExtractor.ts    # Color extraction and enhancement
├── hue/
│   └── HueController.ts     # Philips Hue integration
├── nanoleaf/
│   └── NanoleafController.ts # Nanoleaf integration
├── sync/
│   └── SyncEngine.ts        # Main synchronization loop
├── config/
│   └── ConfigManager.ts     # Configuration management
└── index.ts                 # Application entry point
```

## API References

- [Philips Hue API](https://developers.meethue.com/)
- [Nanoleaf API](https://forum.nanoleaf.me/docs)
- [node-hue-api](https://github.com/peter-murray/node-hue-api)
- [screenshot-desktop](https://github.com/bencevans/screenshot-desktop)

## Known Limitations

- Windows only (uses Windows-specific screen capture)
- Single display support (multi-monitor coming soon)
- Zone-based lighting needs manual configuration
- Maximum ~60 FPS due to API rate limits

## Future Enhancements

- [ ] Multi-monitor support
- [ ] Zone-to-light mapping UI
- [ ] Music visualization mode
- [ ] Game-specific profiles
- [ ] Web UI for remote control
- [ ] Linux/macOS support

## License

MIT

## Acknowledgments

Built with:
- [screenshot-desktop](https://github.com/bencevans/screenshot-desktop) - Screen capture
- [sharp](https://sharp.pixelplumbing.com/) - Image processing
- [node-hue-api](https://github.com/peter-murray/node-hue-api) - Philips Hue control
- TypeScript and Node.js

---

**Enjoy your immersive lighting experience! 🌈**
