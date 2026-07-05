// Node smoke test. Connects to the running server with a WebTransport client,
// opens the control stream, says hello, sends one input datagram, and prints
// what comes back. Run the server first, then: node scripts/smoke-client.mjs
import { readFileSync } from "node:fs";
import { WebTransport, quicheLoaded } from "@fails-components/webtransport";
import { CONFIG } from "../src/config.js";
import { frame, StreamParser, encodeInput, dgType, DG, decodeSnapshot } from "../../shared/protocol.js";

// node client loads the http3 transport lazily; wait for it before constructing
await quicheLoaded;

const hash = JSON.parse(readFileSync(new URL("../certs/cert-hash.json", import.meta.url)));
const value = Buffer.from(hash.valueBase64, "base64");

const url = `https://127.0.0.1:${CONFIG.port}${CONFIG.path}`;
const wt = new WebTransport(url, {
  requireUnreliable: true,
  serverCertificateHashes: [{ algorithm: "sha-256", value }],
});
await wt.ready;
console.log("[smoke] connected to", url);

const ctrl = await wt.createBidirectionalStream();
const writer = ctrl.writable.getWriter();
await writer.write(frame({ t: "hello", name: "smoke-bot" }));

// read control replies
(async () => {
  const parser = new StreamParser((m) => console.log("[smoke] ctrl:", m));
  const r = ctrl.readable.getReader();
  for (;;) {
    const { done, value } = await r.read();
    if (done) break;
    parser.push(value instanceof Uint8Array ? value : new Uint8Array(value));
  }
})();

// read datagram snapshots
(async () => {
  const r = wt.datagrams.readable.getReader();
  let count = 0;
  for (;;) {
    const { done, value } = await r.read();
    if (done) break;
    const bytes = value instanceof Uint8Array ? value : new Uint8Array(value);
    if (dgType(bytes) === DG.SNAPSHOT) {
      console.log("[smoke] snapshot:", decodeSnapshot(bytes));
      if (++count >= 3) process.exit(0);
    }
  }
})();

// send one input datagram
const dgw = wt.datagrams.writable.getWriter();
await dgw.write(encodeInput(500, 350, 1));
console.log("[smoke] sent input");

setTimeout(() => { console.log("[smoke] timeout, exiting"); process.exit(1); }, 8000);
