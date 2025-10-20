# Quick Start Guide 🚀

Get up and running in **5 minutes**!

## 🎯 Prerequisites Check

Before starting, ensure you have:

- [ ] **Windows 10 or 11**
- [ ] **Node.js 18+** installed ([Download](https://nodejs.org))
- [ ] **Philips Hue Bridge** on your network
- [ ] **Hue lights** (any number, 1-100+)
- [ ] **Nanoleaf panels** (optional)
- [ ] All devices connected to **same WiFi network**

---

## 📦 Step 1: Installation (2 minutes)

```bash
cd D:\mechs\lights

# Install dependencies
npm install

# Build the project
npm run build
```

**Expected output:**
```
added 73 packages
✓ Build complete
```

---

## ⚙️ Step 2: Setup (2 minutes)

### Option A: Advanced Mode (Recommended for 26 bulbs)

```bash
npm run dev:advanced
```

### Option B: Basic Mode (Simpler, slower)

```bash
npm run dev
```

### Follow the wizard:

#### For Hue:
1. Answer `y` to "Do you have Philips Hue lights?"
2. **Press the link button** on your bridge when prompted
3. Wait 30 seconds
4. Choose entertainment area (if using advanced mode)

#### For Nanoleaf:
1. Answer `y` to "Do you have Nanoleaf panels?"
2. Enter IP address (find in Nanoleaf app: Settings → Device)
3. **Hold power button 5-7 seconds** when prompted
4. Wait 30 seconds

#### Settings:
- **FPS**: Recommend `15` for advanced, `10` for basic
- **Brightness**: `255` (full)
- **Advanced color detection**: `y` (yes)

---

## 🎮 Step 3: Run (1 minute)

```bash
# Start syncing!
npm run dev:advanced

# Or basic mode
npm run dev
```

**You should see:**
```
🚀 Starting ADVANCED screen-light synchronization...
✓ Entertainment area 1 activated
✓ Detected 15 Nanoleaf panels
📊 FPS=15.2 | Cap=45ms | Col=12ms | HueEnt=8ms...

💡 Sync running! Press Ctrl+C to stop
```

**Test it:**
1. Open a bright red image → lights turn red
2. Open a blue video → lights turn blue
3. Play a game → lights sync in real-time!

---

## 🛑 Stopping

Press **Ctrl+C**

You'll be asked:
- Turn off Hue lights? → Choose `y` or `n`
- Turn off Nanoleaf? → Choose `y` or `n`

---

## ⚙️ Adjusting Settings

Edit `config.json`:

```json
{
  "sync": {
    "fps": 15,                           // ← Change FPS (5-60)
    "brightness": 255,                    // ← Change brightness (0-255)
    "colorBoost": 1.2,                    // ← More vibrant (1.0-2.0)
    "useAdvancedColorDetection": true     // ← false for average color
  }
}
```

Save and restart the app.

---

## 🐛 Common Issues

### "No bridges found"
→ Check bridge is powered on and on same network
→ Try entering IP manually in `config.json`

### "Failed to create user"
→ Make sure you pressed the link button!
→ You have 30 seconds after it prompts you
→ Try again: delete `config.json` and re-run setup

### "Entertainment area already active"
→ Another app is using it (Hue Sync, games)
→ Close other apps or use basic mode

### Lights not changing
→ Check FPS in console (should be 10-20)
→ Try lowering FPS in config
→ Verify lights are reachable in Hue app

### Colors too dull
→ Increase `colorBoost` to `1.5` or `2.0`
→ Enable `useAdvancedColorDetection: true`

---

## 📊 What's Happening?

### Advanced Mode (Dual API):
```
Screen → Capture → Color Extract
              ↓
    ┌─────────┴──────────┐
    ↓                    ↓
Entertainment API    Regular API
(10 lights, fast)    (16 lights, normal)
    ↓                    ↓
   ALL 26 LIGHTS SYNC!
```

### Nanoleaf Mapping:
```
Screen divided into regions:
┌────────────────┐
│ 🔺  🔺    🔺  │ ← Top panels get top screen colors
│   🔺  🔺      │ ← Middle panels get middle colors
│ 🔺    🔺  🔺  │ ← Bottom panels get bottom colors
└────────────────┘
Each panel independently synced!
```

---

## 🎯 Optimization Tips

### For Gaming (Low Latency):
```json
{
  "sync": {
    "fps": 20,
    "useAdvancedColorDetection": true
  }
}
```

### For Movies (Subtle):
```json
{
  "sync": {
    "fps": 10,
    "colorBoost": 1.0,
    "brightness": 180
  }
}
```

### For Maximum Performance:
- Use Entertainment API (advanced mode)
- Close other apps
- Lower FPS if CPU struggles
- Disable advanced color detection if slow

---

## 📚 Next Steps

- Read **README_ADVANCED.md** for detailed features
- Check **TESTING.md** for full test checklist
- Adjust settings in `config.json` to your taste
- Create entertainment area profiles for different scenarios

---

## 💬 Getting Help

If you're stuck:

1. Check error messages in console
2. Review TESTING.md checklist
3. Try basic mode if advanced fails
4. Check Hue app → lights are reachable
5. Restart Hue bridge if needed

---

**Enjoy your ambient lighting! 🌈✨**
