import { encodeSnapshot } from "../../shared/protocol.js";

// One Room holds every connected member and ticks the world snapshot.
export class Room {
  constructor(tickHz = 20) {
    this.members = new Map(); // id -> member
    this.tickMs = 1000 / tickHz;
    this.timer = null;
  }

  add(m) {
    this.members.set(m.id, m);
    // tell the newcomer who is already here
    const roster = [...this.members.values()].map((x) => ({
      id: x.id, name: x.name, color: x.color, x: x.x, y: x.y,
    }));
    m.sendReliable({ t: "welcome", id: m.id, name: m.name, color: m.color, x: m.x, y: m.y, roster });
    // tell everyone else about the newcomer
    this.broadcastExcept(m.id, { t: "join", id: m.id, name: m.name, color: m.color, x: m.x, y: m.y });
    if (!this.timer) this.timer = setInterval(() => this.tick(), this.tickMs);
  }

  remove(id) {
    if (!this.members.has(id)) return;
    this.members.delete(id);
    this.broadcastAll({ t: "leave", id });
    if (this.members.size === 0 && this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  setName(id, name) {
    const m = this.members.get(id);
    if (!m) return;
    const clean = String(name).slice(0, 24).trim();
    if (!clean) return;
    m.name = clean;
    this.broadcastAll({ t: "rename", id, name: m.name });
  }

  chat(id, text) {
    const m = this.members.get(id);
    if (!m) return;
    const clean = String(text).slice(0, 200);
    if (!clean.trim()) return;
    this.broadcastAll({ t: "chat", id, name: m.name, color: m.color, text: clean });
  }

  // YouTube live comment relayed to everyone in the room
  broadcastComment(c) {
    this.broadcastAll({ t: "yt", author: c.author || "?", text: c.text, color: c.color || "#ff5a5a" });
  }

  updateInput(id, x, y, facing) {
    const m = this.members.get(id);
    if (!m) return;
    // basic clamp so nobody flies off the map
    m.x = Math.max(0, Math.min(960, x));
    m.y = Math.max(0, Math.min(640, y));
    m.facing = facing;
  }

  tick() {
    const list = [];
    for (const m of this.members.values()) list.push({ id: m.id, x: m.x, y: m.y, facing: m.facing });
    const bytes = encodeSnapshot(list);
    for (const m of this.members.values()) m.sendDatagram(bytes);
  }

  broadcastAll(obj) {
    for (const m of this.members.values()) m.sendReliable(obj);
  }
  broadcastExcept(id, obj) {
    for (const m of this.members.values()) if (m.id !== id) m.sendReliable(obj);
  }
}
