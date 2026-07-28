<!-- i18n: language-switcher -->
[English](README.en.md) | [日本語](README.md)

# Waiwai-verse

A temporary real-time 2D space where you can have fun linked to YouTube Live.
It has a look similar to Ameba Pigg, where avatars move around and chat and YouTube comments flow.
Real-time capability is crucial, so coordinate synchronization is built using **WebTransport (HTTP/3)**.

## Structure

```
shared/protocol.js   Common wire protocol for server/client
server/              WebTransport server (Node + @fails-components/webtransport)
client/              Canvas client (Vite, Vanilla JS)
desktop/             Electron wrapper (desktop application)
scripts/             Synchronize certificate hashes with client configuration
```

### Channel Design

Two channels are used.

- Datagram (unreliable, 20Hz): Input for avatar coordinates and world snapshots. If it drops, it will be overwritten in the next frame, prioritizing speed.
- Control stream (reliable): Room entry handshake, chat, YouTube comments, entry and exit. Only for things that require order and delivery.

Coordinates are client-authoritative in this MVP (suitable for casual chat spaces).
If anti-cheat measures are needed, please switch to validating movement amounts on the server side.

### About Certificates

Using `serverCertificateHashes` for WebTransport allows you to connect from Chrome/Electron without registering self-signed certificates in the trust store.
According to the specification, the certificate must be ECDSA (P-256) and have a validity period of less than 14 days.
The generation script in this repository creates certificates valid for 10 days. Please regenerate when it expires.

## Setup

Prerequisites: Node 20-22 (there are bug reports for `@fails-components/webtransport` on Node 24. Version 22 is recommended).

```bash
# 1. Install dependencies
npm install

# 2. Generate certificates and synchronize with client configuration
npm run setup
#   = npm run gen-cert && npm run sync-config

# 3. Start the server (in a separate terminal)
npm run server

# 4. Start the client (in a separate terminal)
npm run client
```

Open `http://localhost:5173` in a browser (Chrome/Edge) to connect.
Thanks to `serverCertificateHashes`, there will be no certificate errors even with self-signed certificates.

### Running as a Desktop Application

```bash
# While the server and client (vite) are running
npm run dev -w desktop      # Development: Electron window loading vite

# Production build
npm run build -w client
npm run desktop             # Load client/dist
```

## YouTube Live Integration

Pass the YouTube Data API v3 key and the ID of the live video as environment variables.

```bash
export YT_API_KEY=xxxxxxxx
export YT_VIDEO_ID=live_video_id
npm run server
```

The server resolves `activeLiveChatId` with `videos.list` and polls `liveChat/messages` according to `pollingIntervalMillis`.
The retrieved comments are distributed to everyone over the control stream and flow gently within the space.
If you want even lower latency, you can switch to `liveChatMessages.streamList`.

## Operations

- Move using WASD / arrow keys / click
- Send messages in the chat box below (speech bubble + log)
- Change your name with `/name your_name`

## Functionality Check (Transport Layer)

You can check communication between Node instances without a browser.

```bash
npm run server          # Keep this running in a separate terminal
npm run smoke -w server # Displays hello → welcome, input → snapshot
```

## Known Limitations / Next Steps

- Coordinates are client-authoritative. For competitive use cases, switch to server authority.
- The room is fixed to one. You can extend it to support multiple rooms by making `CONFIG.path` dynamic.
- If you want to add a WebSocket fallback for environments where UDP is blocked, switch to `@fails-components/webtransport`'s `HttpServer` (http/3 + ws) + client-side ponyfill.
- Certificates expire in 10 days. Re-run `npm run setup`.

## License

0BSD. You can use, copy, modify, and distribute this project for almost any purpose.