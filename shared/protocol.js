// Shared wire protocol for waiwai-verse.
// Used by both the Node server and the browser client, so keep it dependency free.
//
// Two channels:
//   - datagrams  : unreliable, high frequency. Position input and world snapshots.
//   - ctrl stream: reliable. Join handshake, chat, YouTube comments, join/leave.

export const DG = { INPUT: 1, SNAPSHOT: 2 };

const enc = new TextEncoder();
const dec = new TextDecoder();

// ---- datagram: client input ----
// layout: [type u8][x f32][y f32][facing u8]  (little endian)
export function encodeInput(x, y, facing) {
  const buf = new ArrayBuffer(10);
  const v = new DataView(buf);
  v.setUint8(0, DG.INPUT);
  v.setFloat32(1, x, true);
  v.setFloat32(5, y, true);
  v.setUint8(9, facing & 0xff);
  return new Uint8Array(buf);
}

export function decodeInput(bytes) {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { x: v.getFloat32(1, true), y: v.getFloat32(5, true), facing: v.getUint8(9) };
}

// ---- datagram: server snapshot ----
// layout: [type u8][count u16][ id u32, x f32, y f32, facing u8 ] * count
export function encodeSnapshot(list) {
  const n = list.length;
  const buf = new ArrayBuffer(3 + n * 13);
  const v = new DataView(buf);
  v.setUint8(0, DG.SNAPSHOT);
  v.setUint16(1, n, true);
  let o = 3;
  for (const e of list) {
    v.setUint32(o, e.id, true); o += 4;
    v.setFloat32(o, e.x, true); o += 4;
    v.setFloat32(o, e.y, true); o += 4;
    v.setUint8(o, e.facing & 0xff); o += 1;
  }
  return new Uint8Array(buf);
}

export function decodeSnapshot(bytes) {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const n = v.getUint16(1, true);
  const out = [];
  let o = 3;
  for (let i = 0; i < n; i++) {
    out.push({
      id: v.getUint32(o, true),
      x: v.getFloat32(o + 4, true),
      y: v.getFloat32(o + 8, true),
      facing: v.getUint8(o + 12),
    });
    o += 13;
  }
  return out;
}

export function dgType(bytes) {
  return bytes[0];
}

// ---- reliable stream framing ----
// layout: [len u32 big-endian][utf8 json body]
export function frame(obj) {
  const body = enc.encode(JSON.stringify(obj));
  const out = new Uint8Array(4 + body.length);
  new DataView(out.buffer).setUint32(0, body.length, false);
  out.set(body, 4);
  return out;
}

// Incremental parser. Feed raw chunks, get whole JSON messages back.
export class StreamParser {
  constructor(onMessage) {
    this.onMessage = onMessage;
    this.buf = new Uint8Array(0);
  }
  push(chunk) {
    // append chunk to the pending buffer
    const merged = new Uint8Array(this.buf.length + chunk.length);
    merged.set(this.buf, 0);
    merged.set(chunk, this.buf.length);
    this.buf = merged;
    // pull out every complete frame
    for (;;) {
      if (this.buf.length < 4) return;
      const len = new DataView(this.buf.buffer, this.buf.byteOffset, 4).getUint32(0, false);
      if (this.buf.length < 4 + len) return;
      const body = this.buf.subarray(4, 4 + len);
      let obj = null;
      try { obj = JSON.parse(dec.decode(body)); } catch { obj = null; }
      this.buf = this.buf.slice(4 + len); // slice copies, so old buffer can be freed
      if (obj) this.onMessage(obj);
    }
  }
}
