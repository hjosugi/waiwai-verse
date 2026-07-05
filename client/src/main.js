import { connect } from "./net/transport.js";
import { World } from "./world.js";
import { encodeInput, dgType, DG, decodeSnapshot } from "../../shared/protocol.js";

const canvas = document.getElementById("world");
const chatLog = document.getElementById("chatlog");
const chatInput = document.getElementById("chatinput");
const status = document.getElementById("status");

const world = new World(canvas);
world.start();

// throttle input datagrams to ~20/s
let lastSent = 0;
let conn = null;

async function loadConfig() {
  if (window.WAIVERSE_CONFIG) return window.WAIVERSE_CONFIG; // injected by Electron
  const r = await fetch("/config.json");
  return r.json();
}

function logChat(name, text, color) {
  const div = document.createElement("div");
  div.className = "msg";
  div.innerHTML = `<span class="who" style="color:${color || "#9ad"}"></span><span class="txt"></span>`;
  div.querySelector(".who").textContent = name + ": ";
  div.querySelector(".txt").textContent = text;
  chatLog.appendChild(div);
  chatLog.scrollTop = chatLog.scrollHeight;
  while (chatLog.children.length > 120) chatLog.removeChild(chatLog.firstChild);
}

async function main() {
  let cfg;
  try {
    cfg = await loadConfig();
  } catch {
    status.textContent = "config.json が読めません。npm run sync-config を実行してください。";
    return;
  }

  const name = (localStorage.getItem("waiwai-name") || `guest`).slice(0, 24);
  try {
    conn = await connect({ url: cfg.url, certHashB64: cfg.certHashB64 });
  } catch (e) {
    status.textContent = "接続失敗: " + e.message;
    return;
  }
  status.textContent = "接続中…";

  conn.sendReliable({ t: "hello", name });

  world.onInput = (x, y, facing) => {
    const now = performance.now();
    if (now - lastSent < 50) return; // 20 Hz
    lastSent = now;
    conn.sendDatagram(encodeInput(x, y, facing));
  };

  conn.onDatagram((bytes) => {
    if (dgType(bytes) === DG.SNAPSHOT) world.applySnapshot(decodeSnapshot(bytes));
  });

  conn.onMessage((m) => {
    switch (m.t) {
      case "welcome":
        status.textContent = `接続OK  id=${m.id}  みんな ${m.roster.length} 人`;
        world.setSelf(m.id, m.name, m.color, m.x, m.y);
        for (const r of m.roster) world.addAvatar(r.id, r.name, r.color, r.x, r.y);
        break;
      case "join":
        world.addAvatar(m.id, m.name, m.color, m.x, m.y);
        logChat("system", `${m.name} が入室`, "#7d8");
        break;
      case "leave":
        world.removeAvatar(m.id);
        break;
      case "rename":
        world.rename(m.id, m.name);
        break;
      case "chat":
        world.showBubble(m.id, m.text);
        logChat(m.name, m.text, m.color);
        break;
      case "yt":
        world.addComment(m.author, m.text, m.color);
        logChat("YT " + m.author, m.text, "#ff7676");
        break;
    }
  });

  conn.closed().then(() => { status.textContent = "切断されました"; }).catch(() => {
    status.textContent = "切断されました";
  });
}

// chat input: Enter to send
chatInput.addEventListener("keydown", (e) => {
  if (e.key !== "Enter") return;
  const text = chatInput.value.trim();
  chatInput.value = "";
  if (!text || !conn) return;
  if (text.startsWith("/name ")) {
    const n = text.slice(6).trim().slice(0, 24);
    if (n) { localStorage.setItem("waiwai-name", n); conn.sendReliable({ t: "rename", name: n }); }
    return;
  }
  conn.sendReliable({ t: "chat", text });
});

main();
