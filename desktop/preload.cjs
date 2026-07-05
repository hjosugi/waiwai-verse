// Preload runs before the page scripts. It exposes the server config
// (set in main.js via process.env) on window.WAIVERSE_CONFIG.
const { contextBridge } = require("electron");

let cfg = {};
try {
  cfg = JSON.parse(process.env.WAIVERSE_CONFIG || "{}");
} catch {
  cfg = {};
}

contextBridge.exposeInMainWorld("WAIVERSE_CONFIG", cfg);
