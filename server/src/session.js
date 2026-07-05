import { dgType, DG, decodeInput, frame, StreamParser } from "../../shared/protocol.js";

let NEXT_ID = 1;
const COLORS = ["#ff6b6b", "#feca57", "#1dd1a1", "#54a0ff", "#5f27cd", "#ff9ff3", "#00d2d3", "#ffa502"];
const pick = (a) => a[Math.floor(Math.random() * a.length)];

// Handle one WebTransport session for its whole life.
export async function handleSession(session, room) {
  await session.ready;
  const id = NEXT_ID++;

  const dgWriter = session.datagrams.writable.getWriter();
  const member = {
    id,
    name: `guest-${id}`,
    color: pick(COLORS),
    x: 420 + Math.random() * 120,
    y: 300 + Math.random() * 120,
    facing: 0,
    ctrlWriter: null,
    sendDatagram: (bytes) => dgWriter.write(bytes).catch(() => {}),
    sendReliable: (obj) => {
      if (member.ctrlWriter) member.ctrlWriter.write(frame(obj)).catch(() => {});
    },
  };

  let joined = false;
  const cleanup = () => {
    if (joined) room.remove(id);
    joined = false;
  };
  session.closed.then(cleanup).catch(cleanup);

  // pump 1: client input datagrams
  (async () => {
    const reader = session.datagrams.readable.getReader();
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        const bytes = value instanceof Uint8Array ? value : new Uint8Array(value);
        if (dgType(bytes) === DG.INPUT) {
          const { x, y, facing } = decodeInput(bytes);
          room.updateInput(id, x, y, facing);
        }
      }
    } catch { /* session gone */ }
  })();

  // pump 2: the single control stream the client opens
  (async () => {
    const sreader = session.incomingBidirectionalStreams.getReader();
    const { value: stream } = await sreader.read();
    if (!stream) return;
    member.ctrlWriter = stream.writable.getWriter();

    const parser = new StreamParser((msg) => {
      switch (msg.t) {
        case "hello":
          if (msg.name) member.name = String(msg.name).slice(0, 24);
          room.add(member); // sends welcome to this member, join to others
          joined = true;
          break;
        case "chat":
          room.chat(id, msg.text);
          break;
        case "rename":
          room.setName(id, msg.name);
          break;
      }
    });

    const rreader = stream.readable.getReader();
    try {
      for (;;) {
        const { done, value } = await rreader.read();
        if (done) break;
        parser.push(value instanceof Uint8Array ? value : new Uint8Array(value));
      }
    } catch { /* stream gone */ }
    cleanup();
  })();
}
