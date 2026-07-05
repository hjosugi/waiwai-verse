// Electron wrapper so the space runs as a desktop app (VRChat-style window).
// The renderer is Chromium, so native WebTransport works.
import { app, BrowserWindow } from "electron";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEV = process.env.DEV === "1";
const PORT = process.env.PORT || 4433;
const WT_PATH = process.env.WT_PATH || "/room";

function loadCertHash() {
  try {
    const p = path.join(__dirname, "..", "server", "certs", "cert-hash.json");
    return JSON.parse(readFileSync(p, "utf8")).valueBase64;
  } catch {
    return "";
  }
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    backgroundColor: "#07091a",
    title: "わいわいバース",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
    },
  });

  // pass server url + cert hash to the renderer before it loads
  const cfg = JSON.stringify({
    url: `https://localhost:${PORT}${WT_PATH}`,
    certHashB64: loadCertHash(),
  });
  process.env.WAIVERSE_CONFIG = cfg;

  if (DEV) {
    win.loadURL("http://localhost:5173");
  } else {
    win.loadFile(path.join(__dirname, "..", "client", "dist", "index.html"));
  }
}

app.whenReady().then(createWindow);
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
