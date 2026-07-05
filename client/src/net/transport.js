import { frame, StreamParser } from "../../../shared/protocol.js";

function b64ToBytes(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// Open a WebTransport session and the single control stream.
export async function connect({ url, certHashB64 }) {
  if (typeof WebTransport === "undefined") {
    throw new Error("WebTransport is not supported in this browser. Use Chrome/Edge or the Electron app.");
  }
  const opts = {};
  if (certHashB64) {
    opts.serverCertificateHashes = [{ algorithm: "sha-256", value: b64ToBytes(certHashB64) }];
  }
  const wt = new WebTransport(url, opts);
  await wt.ready;
  const ctrl = await wt.createBidirectionalStream();
  return new Conn(wt, ctrl);
}

class Conn {
  constructor(wt, ctrl) {
    this.wt = wt;
    this.ctrlWriter = ctrl.writable.getWriter();
    this._ctrlReadable = ctrl.readable;
    this.dgWriter = wt.datagrams.writable.getWriter();
    this._dgReadable = wt.datagrams.readable;
  }

  sendReliable(obj) {
    this.ctrlWriter.write(frame(obj)).catch(() => {});
  }

  sendDatagram(bytes) {
    this.dgWriter.write(bytes).catch(() => {});
  }

  onMessage(cb) {
    const parser = new StreamParser(cb);
    (async () => {
      const r = this._ctrlReadable.getReader();
      try {
        for (;;) {
          const { done, value } = await r.read();
          if (done) break;
          parser.push(value instanceof Uint8Array ? value : new Uint8Array(value));
        }
      } catch { /* closed */ }
    })();
  }

  onDatagram(cb) {
    (async () => {
      const r = this._dgReadable.getReader();
      try {
        for (;;) {
          const { done, value } = await r.read();
          if (done) break;
          cb(value instanceof Uint8Array ? value : new Uint8Array(value));
        }
      } catch { /* closed */ }
    })();
  }

  closed() {
    return this.wt.closed;
  }
}
