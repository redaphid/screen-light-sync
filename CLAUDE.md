# Screen-Light Sync

Real-time screen capture synchronized to Philips Hue and Nanoleaf lights.

## Style

Follow [STYLE_GUIDE.md](./STYLE_GUIDE.md) strictly.

## Project Structure

```
src/           # TypeScript source
dist/          # Compiled output
*.js           # Standalone test/demo scripts
```

## Commands

```bash
npm run build          # Compile TypeScript
npm run dev            # Run with ts-node
npm run dev:advanced   # Run advanced mode
npm run setup          # Interactive device setup
```

## Device Discovery

- Nanoleaf Desktop app stores device info at `%APPDATA%/Nanoleaf Desktop/appData.json`
- Hue bridges identified by OUI `00:17:88`
- Nanoleaf devices identified by OUI `00:55:DA` and `80:8A:F7`
- Use `arp -a` to get current IP addresses from MAC

## Key Dependencies

- `sharp` - Fast image processing for screen capture
- `node-hue-api` - Philips Hue integration
- `axios` - HTTP client for Nanoleaf API
- `bonjour-service` - mDNS discovery

## Testing

Run tests with `--run` flag to prevent hanging:
```bash
npm test -- --run
```

## Platform

Windows-specific. Uses PowerShell and Windows APIs for screen capture.
