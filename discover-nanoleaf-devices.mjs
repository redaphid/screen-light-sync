import { execSync } from "child_process"
import { existsSync, readFileSync } from "fs"
import { homedir } from "os"
import { join } from "path"

const OUI_PREFIXES = {
  "00:55:DA": "Nanoleaf",
  "80:8A:F7": "Nanoleaf (Shapes/Elements)",
  "00:17:88": "Philips Hue",
}

const getNanoleafAppDataPath = () => {
  const appData = process.env.APPDATA || join(homedir(), "AppData", "Roaming")
  return join(appData, "Nanoleaf Desktop", "appData.json")
}

const parseArpTable = () => {
  const entries = new Map()

  try {
    const output = execSync("arp -a", { encoding: "utf8" })
    for (const line of output.split("\n")) {
      const match = line.match(/^\s*([\d.]+)\s+([0-9a-f-]{17})\s+/i)
      if (!match) continue
      const [, ip, rawMac] = match
      entries.set(rawMac.replace(/-/g, ":").toUpperCase(), ip)
    }
  } catch (err) {
    console.error(`Warning: Could not read ARP table: ${err.message}`)
  }

  return entries
}

const findDevicesInObject = (obj, devices = []) => {
  if (typeof obj !== "object" || obj === null) return devices

  if (obj.mac_address) {
    const mac = obj.mac_address.toUpperCase()
    if (!devices.find(d => d.mac === mac)) {
      devices.push({
        name: obj.name || "Unknown",
        mac,
        serial: obj.serialNo || null,
      })
    }
  }

  if (Array.isArray(obj)) {
    for (const item of obj) findDevicesInObject(item, devices)
    return devices
  }

  for (const key of Object.keys(obj)) findDevicesInObject(obj[key], devices)
  return devices
}

const getDeviceType = (mac) => OUI_PREFIXES[mac.substring(0, 8)] || "Unknown"

export const discoverDevices = () => {
  const results = { nanoleaf: [], hue: [], timestamp: new Date().toISOString() }
  const arpTable = parseArpTable()
  const configPath = getNanoleafAppDataPath()

  if (!existsSync(configPath)) {
    console.error(`Warning: Nanoleaf Desktop config not found at: ${configPath}`)
    return results
  }

  try {
    const data = JSON.parse(readFileSync(configPath, "utf8"))
    const devices = findDevicesInObject(data)

    for (const device of devices) {
      const ip = arpTable.get(device.mac) || null
      results.nanoleaf.push({
        name: device.name,
        mac: device.mac,
        ip,
        serial: device.serial,
        type: getDeviceType(device.mac),
        online: ip !== null,
      })
    }
  } catch (err) {
    console.error(`Warning: Could not parse Nanoleaf config: ${err.message}`)
  }

  for (const [mac, ip] of arpTable) {
    if (!mac.startsWith("00:17:88")) continue
    results.hue.push({
      name: "Philips Hue Bridge",
      mac,
      ip,
      type: "Philips Hue",
      online: true,
    })
  }

  return results
}

const printTable = (devices) => {
  if (devices.length === 0) {
    console.log("  (none found)")
    return
  }

  const cols = {
    name: Math.max(4, ...devices.map(d => d.name.length)),
    mac: 17,
    ip: Math.max(2, ...devices.map(d => (d.ip || "offline").length)),
    type: Math.max(4, ...devices.map(d => d.type.length)),
  }

  console.log(
    `  ${"Name".padEnd(cols.name)}  ${"MAC Address".padEnd(cols.mac)}  ${"IP".padEnd(cols.ip)}  Type`
  )
  console.log(
    `  ${"-".repeat(cols.name)}  ${"-".repeat(cols.mac)}  ${"-".repeat(cols.ip)}  ${"-".repeat(cols.type)}`
  )

  for (const d of devices) {
    const status = d.online ? d.ip : "(offline)"
    console.log(
      `  ${d.name.padEnd(cols.name)}  ${d.mac.padEnd(cols.mac)}  ${status.padEnd(cols.ip)}  ${d.type}`
    )
  }
}

const args = process.argv.slice(2)
const jsonOutput = args.includes("--json")
const results = discoverDevices()

if (jsonOutput) {
  console.log(JSON.stringify(results, null, 2))
} else {
  console.log("\nNanoleaf Devices:")
  printTable(results.nanoleaf)
  console.log("\nHue Devices:")
  printTable(results.hue)
  console.log()
}
