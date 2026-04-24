<div align="center">

# sendrop

**Zero-setup LAN file & text sharing with a QR-code pairing step.**

[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-18+-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Socket.IO](https://img.shields.io/badge/Socket.IO-4.8-010101?logo=socket.io&logoColor=white)](https://socket.io/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

</div>

---

## Overview

`sendrop` is a lightweight Node.js + Socket.IO server that lets two or more
devices on the same Wi-Fi network send text snippets or files to each other
through a browser. One device runs the server, every other device connects
to the printed LAN URL (a QR code is shown on the server's localhost page to
make that one-tap-easy), and devices become visible to each other as soon as
they open the page.

## Features

- **QR-pairing at `/` on localhost** — the server prints a QR code pointing
  at its own LAN URL, so a phone can join instantly.
- **Device discovery** — every connected browser shows up in a live list
  with OS / browser / form-factor labels.
- **Text transfers** — select a device, type or paste a message, the
  recipient gets an **Accept / Reject** prompt, then a pop-up with a
  one-click **Copy** button.
- **File transfers** — chunked transfers with a live progress bar on both
  sides; completed files are auto-downloaded on the receiver.
- **No install on the clients** — they only need a browser and the URL.
- **Configurable** — `PORT` and `SENDROP_MAX_BUFFER` environment variables.

## How it works

```
┌────────────┐       Socket.IO        ┌────────────┐
│  Device A  │ ────────────────────► │            │
│ (browser)  │ ◄──── relays ──────── │   Server   │
└────────────┘                        │  (sendrop) │
┌────────────┐                        │            │
│  Device B  │ ◄─────────────────── ► │            │
└────────────┘                        └────────────┘
```

All traffic is **relayed through the server**; there is no WebRTC P2P step.
Files are split into chunks (default 4 KB) and streamed over the same
Socket.IO channel. The server only forwards events — it never persists
any text or file content to disk.

## Getting started

### Prerequisites

- [Node.js](https://nodejs.org/) 18 or newer and `npm`
- Two or more devices on the **same LAN**

### Install

```bash
git clone https://github.com/eunhhu/sendrop.git
cd sendrop
npm install
```

### Run

```bash
npm start
```

On startup the server prints every reachable LAN URL, e.g.:

```
[*] Sendrop listening on :3000
[*] Reachable at:
      http://192.168.1.42:3000
      http://10.0.0.7:3000
```

Open any of those URLs on the host PC in a browser — the root page shows a
QR code pointing at the same URL so your phone can join with one scan. On
the phone / other devices, open the printed LAN URL directly.

### Configuration

| Variable | Default | Meaning |
|---|---|---|
| `PORT` | `3000` | TCP port for HTTP and Socket.IO. |
| `SENDROP_MAX_BUFFER` | `67108864` (64 MB) | `maxHttpBufferSize` passed to Socket.IO. Raise this if your per-chunk size grows, or you see `Message too large` errors on big files. |

```bash
PORT=5000 SENDROP_MAX_BUFFER=134217728 npm start
```

### Develop

```bash
npm run dev         # ts-node + nodemon
npm run typecheck   # no-emit type check
npm run build       # compile TS into ./dist
```

## Using the UI

1. Open the LAN URL on two devices. Each one will see the other appear in
   the device list.
2. Tap the target device card. A **send** dialog opens.
3. Switch between the **Text** and **File** tabs.
4. Enter text or pick a file, then press **Send**. The receiver sees an
   **Accept / Reject** prompt.
5. On accept, text appears in a pop-up with a **Copy** button; files are
   assembled and automatically downloaded.

Close an alert with its **Close** button, or let informational toasts
auto-dismiss after 3 seconds.

## Security notes

- sendrop is designed for trusted LANs only. Anyone who can reach the port
  can see connected devices and send them request prompts.
- The server does not persist or log transferred content. User-Agent and
  remote-IP strings are kept in memory only for the duration of a
  connection.
- There is no end-to-end encryption — rely on TLS in front of sendrop (e.g.
  an nginx reverse proxy with a LAN cert) if you need confidentiality on an
  untrusted network.

## Project layout

```
sendrop/
├─ src/
│  └─ index.ts         # Express + Socket.IO server
├─ public/
│  ├─ main.html        # Device list + send/receive UI
│  ├─ app.js           # Client-side logic
│  ├─ style.css        # Page-specific styles
│  ├─ global.css       # Shared resets
│  └─ local.css        # Styles for the /-on-localhost QR page
├─ package.json
└─ tsconfig.json
```

## Contributing

Issues and pull requests welcome. Before opening a PR please run:

```bash
npm run typecheck
```

and test a transfer in two browser tabs (or one tab + one phone) locally.

## License

`sendrop` is released under the [ISC License](LICENSE).
