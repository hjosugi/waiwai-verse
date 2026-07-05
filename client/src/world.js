// The 2D space. Renders avatars, handles local movement, shows chat bubbles,
// and floats YouTube comments across the room. Pure canvas, no framework.

const W = 960;
const H = 640;
const SPEED = 220; // px per second
const RADIUS = 18;

export class World {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.canvas.width = W;
    this.canvas.height = H;

    this.selfId = null;
    this.me = { x: W / 2, y: H / 2, facing: 0 };
    this.avatars = new Map(); // id -> { name, color, x, y, facing, bubble, bubbleUntil }
    this.comments = []; // floating youtube comments

    this.keys = new Set();
    this.target = null; // click-to-move target
    this._bindInput();

    this.lastTs = performance.now();
    this.onInput = null; // callback(x, y, facing) set by main
  }

  setSelf(id, name, color, x, y) {
    this.selfId = id;
    this.me.x = x;
    this.me.y = y;
    this.avatars.set(id, { name, color, x, y, facing: 0, bubble: "", bubbleUntil: 0 });
  }

  addAvatar(id, name, color, x, y) {
    if (id === this.selfId) return;
    this.avatars.set(id, { name, color, x, y, facing: 0, bubble: "", bubbleUntil: 0 });
  }

  removeAvatar(id) {
    this.avatars.delete(id);
  }

  rename(id, name) {
    const a = this.avatars.get(id);
    if (a) a.name = name;
  }

  // apply a server snapshot to remote avatars (skip self, it is locally driven)
  applySnapshot(list) {
    for (const e of list) {
      if (e.id === this.selfId) continue;
      const a = this.avatars.get(e.id);
      if (a) {
        a.tx = e.x; // target for smoothing
        a.ty = e.y;
        a.facing = e.facing;
      }
    }
  }

  showBubble(id, text) {
    const a = this.avatars.get(id);
    if (!a) return;
    a.bubble = text;
    a.bubbleUntil = performance.now() + 5000;
  }

  addComment(author, text, color) {
    this.comments.push({
      author, text, color,
      x: W + 20,
      y: 60 + Math.random() * (H - 160),
      speed: 70 + Math.random() * 50,
    });
    if (this.comments.length > 40) this.comments.shift();
  }

  _bindInput() {
    window.addEventListener("keydown", (e) => {
      // do not steal typing in the chat box
      if (e.target && e.target.tagName === "INPUT") return;
      this.keys.add(e.key.toLowerCase());
    });
    window.addEventListener("keyup", (e) => this.keys.delete(e.key.toLowerCase()));
    this.canvas.addEventListener("click", (e) => {
      const r = this.canvas.getBoundingClientRect();
      const sx = W / r.width;
      const sy = H / r.height;
      this.target = { x: (e.clientX - r.left) * sx, y: (e.clientY - r.top) * sy };
    });
  }

  start() {
    const loop = (ts) => {
      const dt = Math.min(0.05, (ts - this.lastTs) / 1000);
      this.lastTs = ts;
      this._update(dt);
      this._render();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  _update(dt) {
    let dx = 0, dy = 0;
    if (this.keys.has("w") || this.keys.has("arrowup")) dy -= 1;
    if (this.keys.has("s") || this.keys.has("arrowdown")) dy += 1;
    if (this.keys.has("a") || this.keys.has("arrowleft")) dx -= 1;
    if (this.keys.has("d") || this.keys.has("arrowright")) dx += 1;

    if (dx || dy) {
      this.target = null; // keyboard cancels click-move
      const len = Math.hypot(dx, dy) || 1;
      this.me.x += (dx / len) * SPEED * dt;
      this.me.y += (dy / len) * SPEED * dt;
      this.me.facing = dx < 0 ? 2 : dx > 0 ? 1 : this.me.facing;
    } else if (this.target) {
      const tx = this.target.x - this.me.x;
      const ty = this.target.y - this.me.y;
      const dist = Math.hypot(tx, ty);
      if (dist < 4) {
        this.target = null;
      } else {
        const step = Math.min(dist, SPEED * dt);
        this.me.x += (tx / dist) * step;
        this.me.y += (ty / dist) * step;
        this.me.facing = tx < 0 ? 2 : 1;
      }
    }

    this.me.x = Math.max(RADIUS, Math.min(W - RADIUS, this.me.x));
    this.me.y = Math.max(RADIUS, Math.min(H - RADIUS, this.me.y));

    // keep our own avatar in sync and report input
    const self = this.avatars.get(this.selfId);
    if (self) { self.x = this.me.x; self.y = this.me.y; self.facing = this.me.facing; }
    if (this.onInput) this.onInput(this.me.x, this.me.y, this.me.facing);

    // smooth remote avatars toward their snapshot target
    for (const [id, a] of this.avatars) {
      if (id === this.selfId) continue;
      if (a.tx != null) {
        a.x += (a.tx - a.x) * Math.min(1, dt * 12);
        a.y += (a.ty - a.y) * Math.min(1, dt * 12);
      }
    }

    // move floating comments
    for (const c of this.comments) c.x -= c.speed * dt;
    this.comments = this.comments.filter((c) => c.x > -300);
  }

  _render() {
    const ctx = this.ctx;
    // floor
    ctx.fillStyle = "#0f1226";
    ctx.fillRect(0, 0, W, H);
    this._grid(ctx);

    // floating youtube comments (behind avatars)
    ctx.font = "16px system-ui, sans-serif";
    for (const c of this.comments) {
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = c.color;
      ctx.fillText(`${c.author}: ${c.text}`, c.x, c.y);
      ctx.globalAlpha = 1;
    }

    // avatars sorted by y for a little depth
    const order = [...this.avatars.entries()].sort((a, b) => a[1].y - b[1].y);
    const now = performance.now();
    for (const [id, a] of order) {
      this._avatar(ctx, a, id === this.selfId);
      if (a.bubble && now < a.bubbleUntil) this._bubble(ctx, a);
    }
  }

  _grid(ctx) {
    ctx.strokeStyle = "rgba(255,255,255,0.04)";
    ctx.lineWidth = 1;
    for (let x = 0; x <= W; x += 48) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    for (let y = 0; y <= H; y += 48) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }
  }

  _avatar(ctx, a, isSelf) {
    // shadow
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.beginPath();
    ctx.ellipse(a.x, a.y + RADIUS - 2, RADIUS * 0.9, RADIUS * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();
    // body
    ctx.fillStyle = a.color;
    ctx.beginPath();
    ctx.arc(a.x, a.y, RADIUS, 0, Math.PI * 2);
    ctx.fill();
    if (isSelf) {
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 3;
      ctx.stroke();
    }
    // eyes hint facing
    ctx.fillStyle = "#101010";
    const ex = a.facing === 2 ? -5 : 5;
    ctx.beginPath(); ctx.arc(a.x + ex - 3, a.y - 3, 2.2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(a.x + ex + 4, a.y - 3, 2.2, 0, Math.PI * 2); ctx.fill();
    // name
    ctx.fillStyle = "#dfe6ff";
    ctx.font = "12px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(a.name, a.x, a.y + RADIUS + 14);
    ctx.textAlign = "left";
  }

  _bubble(ctx, a) {
    ctx.font = "13px system-ui, sans-serif";
    const text = a.bubble.length > 40 ? a.bubble.slice(0, 40) + "…" : a.bubble;
    const w = Math.min(220, ctx.measureText(text).width + 16);
    const bx = a.x - w / 2;
    const by = a.y - RADIUS - 34;
    ctx.fillStyle = "rgba(255,255,255,0.95)";
    roundRect(ctx, bx, by, w, 24, 8);
    ctx.fill();
    ctx.fillStyle = "#1a1a1a";
    ctx.textAlign = "center";
    ctx.fillText(text, a.x, by + 16);
    ctx.textAlign = "left";
  }
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
