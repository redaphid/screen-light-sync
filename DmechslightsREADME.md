# Screen-to-Light Sync

Real-time screen scraping and light synchronization for Philips Hue and Nanoleaf devices.

## Features

✨ **Fast Screen Capture** - 31ms average using robotjs (32 FPS capable)  
🎬 **Entertainment API** - 15x faster than standard API  
🎯 **Zoned Mapping** - Each light shows a different screen region  
🌈 **Color Extraction** - Intelligent "most important color" algorithm  
⚡ **Real-time Sync** - 5-8 FPS sustained performance  

## Quick Start

### Installation

```bash
npm install
```

### Run Screen Sync

**Unified mode** (all lights same color):
```bash
node demo-sync-fast.js
```

**Zoned mode** (each light different screen region):
```bash
node demo-sync-zones.js
```

Press `Ctrl+C` to stop.

## Configuration

Edit the following in the demo scripts:

```javascript
const BRIDGE_IP = '10.0.194.117';           // Your Hue bridge IP
const USERNAME = 'your-username-here';       // Your Hue username
const ENTERTAINMENT_AREA_ID = 201;          // Your Entertainment area ID
```

### Find Your Entertainment Areas

```bash
node test-entertainment-api.js
```

## Performance

| Component | Time | Notes |
|-----------|------|-------|
| Screen Capture | 31ms | robotjs with Desktop Duplication API |
| Color Extract | 1ms | Downsampled dominant color |
| Entertainment Update | 140ms | 10 lights simultaneously |
| **Total** | **172ms** | **~5-8 FPS** |

## Project Structure

```
demo-sync-fast.js          # Unified color sync (fastest)
demo-sync-zones.js         # Per-light screen zones (coolest)
hue-entertainment-direct.js # Entertainment API implementation

src/
  capture/ScreenCapture.ts          # Fast robotjs screen capture
  color/ColorExtractor_advanced.ts  # Smart color detection
  hue/HueEntertainmentController.ts # Entertainment API
  nanoleaf/NanoleafAdvancedController.ts # Per-panel mapping
  sync/AdvancedSyncEngine.ts        # Sync orchestration
```

## Testing

Test individual components:

```bash
node test-hue-lights.js          # Test Hue connection
node test-entertainment-api.js   # Test Entertainment API
node test-robotjs-capture.js     # Test screen capture
node test-nanoleaf.js           # Test Nanoleaf (needs IP)
```

## Technical Details

### Screen Capture
- Uses robotjs native bindings
- Windows Desktop Duplication API
- BGRA pixel format, converted to RGB
- ~30ms per frame at 2560x1440

### Entertainment API
- Direct HTTP implementation (bypasses library bugs)
- Supports "Free" class Entertainment areas
- Group updates for all lights simultaneously
- 15x faster than individual light updates

### Color Extraction
- Downsampled grid sampling (every 30-50 pixels)
- Color quantization for performance
- Filters dark/black UI elements
- Configurable zone mapping for multi-light setups

## Requirements

- Node.js 14+
- Windows (robotjs requirement)
- Philips Hue Bridge with Entertainment area configured
- Optional: Nanoleaf devices

## Troubleshooting

**"gyp ERR! find VS"** - Install Visual Studio Build Tools:
```bash
winget install Microsoft.VisualStudio.2022.BuildTools
```

**Slow performance** - Use Entertainment API mode with `demo-sync-fast.js`

**No Entertainment areas found** - Create one in the Hue mobile app under Settings → Entertainment areas

## License

MIT

---

🤖 Built with Claude Code
