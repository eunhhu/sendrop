<div align="center">

# sendrop

**Zero-setup LAN file & text sharing between browsers, with QR-code pairing.**

[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-18+-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Socket.IO](https://img.shields.io/badge/Socket.IO-4.8-010101?logo=socket.io&logoColor=white)](https://socket.io/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

</div>

sendrop is a small Node.js + Socket.IO server that lets devices on the same Wi-Fi network send text snippets or files to each other through a browser — one device runs the server, the others open the printed LAN URL. It is meant for people who want an AirDrop-like hand-off across phones and laptops without installing anything on the clients.

**Status:** Maintained — the text/file relay works end to end; there is no test suite, no authentication and no encryption, so use it on trusted networks only.

## Features

- **QR pairing** — opening `/` on the host (`localhost`) renders a QR code and link pointing at the server's LAN address.
- **Device discovery** — every connected browser appears in a live device list labelled by OS / browser / form factor.
- **Text transfers** — pick a device, paste text, the recipient gets an Accept / Reject prompt and then a pop-up with a Copy button.
- **File transfers** — files are sent in 4 KB chunks with a progress bar on both ends; the receiver reassembles and auto-downloads the file.
- **Nothing stored** — the server only forwards events; no text or file content is written to disk or logged.
- **Graceful shutdown** on `SIGINT` / `SIGTERM`.

## How it works

```
┌────────────┐       Socket.IO        ┌────────────┐
│  Device A  │ ────────────────────►  │            │
│ (browser)  │ ◄──── relays ────────  │   Server   │
└────────────┘                        │  (sendrop) │
┌────────────┐                        │            │
│  Device B  │ ◄──────────────────►   │            │
└────────────┘                        └────────────┘
```

- `src/index.ts` starts an Express app that serves `public/` and a Socket.IO server on the same port. On `GET /` from `localhost` it picks the first non-internal IPv4 interface and renders `http://<lan-ip>:<port>` as a QR code; any other host is redirected to `main.html`.
- On `connection` the server stores the socket's IP and User-Agent in an in-memory `connectedDevices` map and broadcasts `updateDevices` to everyone.
- Transfers are a request/accept handshake: `requestText` / `requestFile` → `receiveTextRequest` / `receiveFileRequest` on the target → `acceptText` / `acceptFile` (or `reject*`) → `sendText` / `sendFile` relayed as `receiveText` / `receiveFile`.
- `public/app.js` slices files into 4 KB chunks, emits one `sendFile` per chunk and shows progress; the receiver collects chunks by index and triggers a download when all have arrived.
- All traffic is relayed through the server; there is no WebRTC peer-to-peer path.

## Tech stack

- Runtime/Language: Node.js 18+, TypeScript 5.7 (run directly with `ts-node`)
- Framework: Express 4, Socket.IO 4.8, `qrcode`
- Frontend: vanilla HTML/CSS/JS in `public/`
- Storage: none (in-memory device list only)
- Infra/Tooling: `nodemon` for dev, GitHub Actions CI (`.github/workflows/ci.yml`: typecheck + compile)

## Getting started

### Requirements

- Node.js 18 or newer and `npm`
- Two or more devices on the same LAN

### Install

```bash
git clone https://github.com/eunhhu/sendrop.git
cd sendrop
npm install
```

### Run

```bash
npm start            # ts-node src/index.ts
```

The server prints its reachable LAN URLs, for example:

```
[*] Sendrop listening on :3000
[*] Reachable at:
      http://192.168.1.42:3000
```

Open `http://localhost:3000/` on the host to see the QR code; scan it or open the LAN URL directly on the other devices. Each device then shows up in the others' device list — tap a card, choose the Text or File tab, and send. The receiver gets an Accept / Reject prompt; accepted text opens in a pop-up with a Copy button, accepted files are downloaded automatically.

### Develop

```bash
npm run dev          # nodemon + ts-node
npm run typecheck    # tsc --noEmit
npm run build        # compile to ./dist
```

`npm test` is not implemented.

## Project structure

```
sendrop/
├─ src/
│  └─ index.ts        # Express + Socket.IO relay server
├─ public/
│  ├─ main.html       # device list + send/receive UI
│  ├─ app.js          # client logic: discovery, handshake, chunked transfer
│  ├─ style.css       # page styles
│  ├─ global.css      # shared resets
│  └─ local.css       # styles for the localhost QR page
├─ .github/workflows/ci.yml
├─ package.json
└─ tsconfig.json
```

## Configuration

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `3000` | TCP port for HTTP and Socket.IO |
| `SENDROP_MAX_BUFFER` | `67108864` (64 MB) | `maxHttpBufferSize` passed to Socket.IO; raise it if you see `Message too large` |

```bash
PORT=5000 SENDROP_MAX_BUFFER=134217728 npm start
```

## Security notes

- Anyone who can reach the port can see connected devices and send them prompts. Run it on trusted LANs only.
- User-Agent and remote-IP strings are kept in memory only for the lifetime of a connection.
- There is no end-to-end encryption; put TLS (e.g. a reverse proxy) in front of it if you need confidentiality.

## License

Released under the [ISC License](LICENSE).
