// Copy the server cert hash into a config the client can fetch.
// Run after gen-cert. Re-run whenever you regenerate the cert.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const port = process.env.PORT || 4433;
const path = process.env.WT_PATH || "/room";

const hash = JSON.parse(
  readFileSync(new URL("../server/certs/cert-hash.json", import.meta.url)),
);

const config = {
  url: `https://localhost:${port}${path}`,
  certHashB64: hash.valueBase64,
  expiresAt: hash.expiresAt,
};

mkdirSync(new URL("../client/public/", import.meta.url), { recursive: true });
writeFileSync(
  new URL("../client/public/config.json", import.meta.url),
  JSON.stringify(config, null, 2),
);

console.log("wrote client/public/config.json ->", config.url);
console.log("cert expires:", config.expiresAt);
