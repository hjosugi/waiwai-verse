// Server configuration. Override with environment variables.
export const CONFIG = {
  host: process.env.HOST || "0.0.0.0",
  port: Number(process.env.PORT || 4433),
  path: process.env.WT_PATH || "/room",
  secret: process.env.WT_SECRET || "change-me-secret",
  certPath: new URL("../certs/cert.pem", import.meta.url),
  keyPath: new URL("../certs/key.pem", import.meta.url),
  tickHz: Number(process.env.TICK_HZ || 20),
  youtube: {
    apiKey: process.env.YT_API_KEY || "",
    videoId: process.env.YT_VIDEO_ID || "",
  },
};
