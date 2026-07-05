import { readFileSync } from "node:fs";
import { Http3Server } from "@fails-components/webtransport";
import { CONFIG } from "./config.js";
import { Room } from "./room.js";
import { handleSession } from "./session.js";
import { startYouTube } from "./youtube.js";

let cert, key;
try {
  cert = readFileSync(CONFIG.certPath);
  key = readFileSync(CONFIG.keyPath);
} catch {
  console.error("Missing certs. Run:  npm run gen-cert  (in the server workspace)");
  process.exit(1);
}

const room = new Room(CONFIG.tickHz);

const server = new Http3Server({
  port: CONFIG.port,
  host: CONFIG.host,
  secret: CONFIG.secret,
  cert,
  privKey: key,
});

server.startServer();
await server.ready;
console.log(`waiwai-verse server up: https://localhost:${CONFIG.port}${CONFIG.path}`);

// optional: pull YouTube live comments into the room
if (CONFIG.youtube.apiKey && CONFIG.youtube.videoId) {
  console.log("[youtube] enabled for video:", CONFIG.youtube.videoId);
  startYouTube(CONFIG.youtube, (c) => room.broadcastComment(c));
} else {
  console.log("[youtube] disabled (set YT_API_KEY and YT_VIDEO_ID to enable)");
}

// accept WebTransport sessions on our path
const sessionStream = server.sessionStream(CONFIG.path);
const reader = sessionStream.getReader();
for (;;) {
  const { done, value: session } = await reader.read();
  if (done) break;
  handleSession(session, room).catch((e) => console.error("session error:", e));
}
