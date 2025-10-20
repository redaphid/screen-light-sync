# Testing Checklist ✅

## Pre-Flight Checks

### Build & Dependencies
- [x] TypeScript builds without errors
- [x] All dependencies installed correctly
- [x] Type system enforces required fields
- [x] No undefined/null type issues

### Configuration System
- [ ] Config loads from file
- [ ] Config creates with defaults if missing
- [ ] Config saves properly
- [ ] Config merges partial updates

---

## Component Testing

### 1. Screen Capture (`ScreenCapture.ts`)
```bash
# Test: Can capture screen
npm run dev:advanced
# Expected: No capture errors in logs
```

- [ ] Captures default display
- [ ] Returns valid Buffer
- [ ] JPG format works
- [ ] PNG format works
- [ ] Handles errors gracefully

### 2. Color Extraction (`ColorExtractor.ts`)
```bash
# Test: Basic color extraction
# Watch console for color values (R, G, B)
```

- [ ] Average color calculated correctly
- [ ] Zone colors extracted properly
- [ ] Color enhancement works (saturation boost)
- [ ] Handles invalid images gracefully

### 3. Advanced Color Detection (`ColorExtractor_advanced.ts`)

- [ ] "Most important color" detects vibrant colors
- [ ] Ignores dull/gray colors
- [ ] Ignores very dark colors
- [ ] Per-zone important colors work
- [ ] Edge detection mode functional

### 4. Hue Controller (`HueController.ts`)

#### Discovery
- [ ] Discovers bridges via N-UPnP
- [ ] Falls back to UPnP if needed
- [ ] Handles no bridges found

#### Authentication
- [ ] Creates user with link button
- [ ] 30-second wait timeout works
- [ ] Fails gracefully if button not pressed
- [ ] Stores credentials correctly

#### Control
- [ ] Connects to bridge
- [ ] Lists all lights
- [ ] Sets individual light colors
- [ ] Sets multiple lights simultaneously
- [ ] Turns off all lights
- [ ] Handles unreachable lights

### 5. Hue Entertainment Controller (`HueEntertainmentController.ts`)

- [ ] Gets entertainment areas
- [ ] Activates entertainment area
- [ ] Deactivates on cleanup
- [ ] Handles "already active" error
- [ ] Fast light updates work

### 6. Nanoleaf Controller (`NanoleafController.ts`)

- [ ] Creates auth token with button hold
- [ ] Connects to device
- [ ] Gets device info
- [ ] Sets brightness
- [ ] Sets solid colors (RGB → HSV conversion)
- [ ] Turns on/off

### 7. Advanced Nanoleaf Controller (`NanoleafAdvancedController.ts`)

- [ ] Gets panel layout from API
- [ ] Calculates panel bounds correctly
- [ ] Creates screen mappings
- [ ] Maps panel positions to screen zones (0-1 range)
- [ ] Sets per-panel colors
- [ ] Handles missing panels gracefully

### 8. Sync Engine (`AdvancedSyncEngine.ts`)

#### Startup
- [ ] Initializes all components
- [ ] Activates entertainment area
- [ ] Detects Nanoleaf panel layout
- [ ] Creates screen mappings
- [ ] Starts sync loop at correct FPS

#### Runtime
- [ ] Captures screen every frame
- [ ] Extracts colors (average or advanced)
- [ ] Updates Entertainment API lights
- [ ] Updates Regular API lights
- [ ] Updates Nanoleaf panels
- [ ] Runs in parallel
- [ ] Maintains target FPS

#### Performance
- [ ] Logs stats every 5 seconds
- [ ] FPS counter accurate
- [ ] Timing breakdown shows bottlenecks
- [ ] No memory leaks over time

#### Shutdown
- [ ] Stops sync loop cleanly
- [ ] Deactivates entertainment area
- [ ] Offers to turn off lights
- [ ] Exits gracefully on Ctrl+C

---

## Integration Testing

### Scenario 1: Hue Only (Entertainment API)
```bash
# Config: enableHue=true, enableNanoleaf=false
# Entertainment area with 10 lights
npm run dev:advanced
```

**Expected:**
- ✓ Entertainment area activates
- ✓ All 10 lights sync to screen
- ✓ FPS: 15-20
- ✓ Low latency (~60ms total)

**Test:**
- [ ] Open bright red image → lights turn red
- [ ] Open bright blue video → lights turn blue
- [ ] Play game → lights respond quickly
- [ ] Colors are vibrant and accurate

### Scenario 2: Hue Hybrid (Entertainment + Regular)
```bash
# Config: 10 lights in entertainment, 16 in regular
npm run dev:advanced
```

**Expected:**
- ✓ Entertainment lights update fast
- ✓ Regular lights update slower but work
- ✓ All 26 lights synced to same color
- ✓ FPS: 13-16

**Test:**
- [ ] All lights change color together
- [ ] Entertainment lights noticeably faster
- [ ] No lights are left out
- [ ] No flickering or glitches

### Scenario 3: Nanoleaf Only
```bash
# Config: enableHue=false, enableNanoleaf=true
# 15 panels detected
npm run dev:advanced
```

**Expected:**
- ✓ Panel layout detected
- ✓ Screen mappings created (15 zones)
- ✓ Each panel shows different color
- ✓ Colors match screen regions

**Test:**
- [ ] Open colorful wallpaper with distinct regions
- [ ] Each panel shows its corresponding screen color
- [ ] Left panels match left side of screen
- [ ] Right panels match right side of screen
- [ ] Colors update smoothly

### Scenario 4: Full System (26 Hue + 15 Nanoleaf)
```bash
# Config: All devices enabled
# Total: 26 Hue + 15 Nanoleaf = 41 lights
npm run dev:advanced
```

**Expected:**
- ✓ All devices initialize
- ✓ Entertainment area activates
- ✓ Nanoleaf mappings created
- ✓ FPS: 13-15
- ✓ Total frame time: <120ms

**Test:**
- [ ] All 41 lights respond
- [ ] Hue shows whole-screen color
- [ ] Nanoleaf shows per-region colors
- [ ] System handles load well
- [ ] No timeouts or errors

### Scenario 5: Advanced Color Detection
```bash
# Config: useAdvancedColorDetection=true
# Open images with subtle vs vibrant colors
npm run dev:advanced
```

**Test Images:**
1. **Vibrant Sunset**
   - [ ] Detects orange/pink (not washed out gray)

2. **Dark Scene with Bright Accent**
   - [ ] Ignores dark areas
   - [ ] Picks up the bright accent color

3. **Colorful UI (Red button on gray background)**
   - [ ] Detects red button (not gray average)

4. **Movie Scene (Mostly dark)**
   - [ ] Picks most prominent color
   - [ ] Not pitch black

---

## Error Handling Tests

### Network Issues
- [ ] Hue bridge unreachable → error logged, continues
- [ ] Nanoleaf offline → error logged, continues
- [ ] Slow network → doesn't crash, just slower FPS

### Invalid Config
- [ ] Missing bridge IP → prompts setup
- [ ] Invalid entertainment area ID → error message
- [ ] Empty light IDs array → uses all lights

### Hardware Limits
- [ ] More than 10 lights in entertainment → error message
- [ ] Entertainment area already active → handles gracefully
- [ ] Nanoleaf max update rate → throttles appropriately

---

## Performance Tests

### Sustained Operation
```bash
# Run for 30 minutes
npm run dev:advanced
# Watch for memory leaks, FPS degradation
```

- [ ] FPS stable over time
- [ ] Memory usage stable (no leaks)
- [ ] CPU usage reasonable (<20%)
- [ ] No crashes or hangs

### High FPS Mode
```bash
# Edit config.json: "fps": 30
npm run dev:advanced
```

- [ ] Achieves ~25-30 FPS
- [ ] Entertainment API keeps up
- [ ] Regular API may lag (expected)
- [ ] System remains stable

### Low-End System
```bash
# Test on slower PC if available
npm run dev:advanced
```

- [ ] Gracefully degrades FPS
- [ ] Doesn't freeze/hang
- [ ] Error messages helpful

---

## User Experience Tests

### First-Time Setup
```bash
# Delete config.json
npm run dev:advanced
```

- [ ] Setup wizard launches automatically
- [ ] Instructions are clear
- [ ] Wait times are reasonable (30s)
- [ ] Success messages displayed
- [ ] Config saves correctly

### Reconfiguration
```bash
# Change settings in config.json
# Restart app
npm run dev:advanced
```

- [ ] New settings load correctly
- [ ] No need to re-authenticate
- [ ] Changes take effect immediately

### Shutdown
```bash
# Press Ctrl+C during sync
```

- [ ] Stops immediately (no hang)
- [ ] Prompts to turn off lights
- [ ] Deactivates entertainment area
- [ ] Cleans up resources
- [ ] No zombie processes

---

## Platform-Specific Tests

### Windows 10
- [ ] Screenshot capture works
- [ ] Paths with spaces handled
- [ ] SIGINT (Ctrl+C) works

### Windows 11
- [ ] Screenshot capture works
- [ ] All features functional
- [ ] No permission issues

---

## Documentation Tests

### README Files
- [ ] README.md accurate for basic mode
- [ ] README_ADVANCED.md accurate for advanced features
- [ ] Code examples work
- [ ] Troubleshooting section helpful

### Code Comments
- [ ] All public methods documented
- [ ] Complex algorithms explained
- [ ] TypeScript types informative

---

## Sign-Off Checklist

Before marking as "tested and working":

- [ ] All component tests pass
- [ ] All integration scenarios work
- [ ] Error handling robust
- [ ] Performance acceptable
- [ ] Documentation complete
- [ ] No critical bugs
- [ ] User experience smooth

---

## Known Limitations

Document any issues found:

1. **Entertainment API DTLS**: Simplified implementation (uses fast regular API instead)
   - Full DTLS requires clientKey and PSK-TLS handshake
   - Current implementation: Fire-and-forget with transitionInstant()
   - Future: Implement proper UDP DTLS streaming

2. **Single Display**: Only captures primary monitor
   - Multi-monitor support planned

3. **Windows Only**: Uses Windows-specific screenshot library
   - Linux/macOS support planned

---

## Test Results Log

Date: _________
Tester: _________

### Quick Summary:
- Build: ✅ / ❌
- Basic Hue: ✅ / ❌
- Entertainment API: ✅ / ❌
- Nanoleaf Mapping: ✅ / ❌
- Full System: ✅ / ❌
- Performance: ✅ / ❌

### Notes:
_________________________________________________________________
_________________________________________________________________
_________________________________________________________________

**Overall Status: PASS / FAIL / NEEDS WORK**
