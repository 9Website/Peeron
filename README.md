# <img src="https://img.shields.io/badge/GitHub-9Website-black?style=for-the-badge&logo=github" height="45">

---
<small>TL;DR (Too Long Didn't Read) at the bottom.</small>

<span style="font-size: 75%;">This text is 75% of normal size!</span>
<span style="font-size: 60%;">This text is 60% of normal size!</span>

# P2P Video Chat & Workspace App

A secure, cross-platform, peer-to-peer (P2P) video chat and collaborative workspace application. Built with WebRTC, this platform allows users to connect instantly via 6-digit alphanumeric room codes, share files, edit text in real-time, and manage rooms with advanced host controls.

---

## 👤 Credits & Distribution

This software is developed, maintained, and distributed by **[9Website](https://github.com/9Website)**. 

If you use, deploy, or reference this project, appropriate credit to **9Website** must be maintained in accordance with the project's licensing terms.

---

## ⚖️ License Clarifications (GNU AGPL v3.0)

This project is licensed under the **GNU Affero General Public License v3.0 (AGPL-3.0)**. Because this is a web-based application, it is vital that you understand the strict rules regarding modification and hosting:

1. **Personal Use:** You are absolutely allowed to download this code, modify it, and use it privately for yourself or your friends. 
2. **Commercial Use:** You may use this code for commercial purposes, provided you abide by the copyleft rules.
3. **The "Hosting & Modification" Rule (CRITICAL):** Under the AGPL v3.0, if you modify this code and host it on a public server or domain for others to use over a network, **YOU MUST make your modified source code 100% publicly available** under the exact same AGPL v3.0 license. You cannot secretly modify this app and run it as a closed-source service, or a paid service.

> ⚠️ **Notice:** If you do not wish to make your modified source code public, you do not have permission to host a modified version of this application on a public domain.

---

## ✨ Features

* **Instant P2P Connections:** Low-latency video and audio streaming directly between peers using WebRTC.
* **6-Digit Room Codes:** Secure, easy-to-share alphanumeric room codes for quick access.
* **Shared Workspace:** Real-time text chat, shared document editing, and seamless file transfers.
* **Host Controls:** Advanced room moderation tools, including peer kicking and device/hardware-based banning.
* **Cross-Platform:** Works seamlessly across modern desktop and mobile web browsers.

---

### ⚠️ Troubleshooting

If the PeerJS public cloud servers are down or are experiencing issues, you can make your own server by downloading Node.js and then running your own private signaling backend to make it work as it would with the public cloud servers up and running.

---

## ⏱️ TL;DR (Too Long; Didn't Read)

> [!NOTE]
> This is a **browser-to-browser** workspace. No accounts, no data logging, and no permanent media servers holding your data.

> [!WARNING]
> If you modify this code and host it publicly, the AGPL v3.0 license requires you to keep your code open-source and free for all. 

| Feature | Description |
| :--- | :--- |
| 🔒 **P2P Encryption** | Video and data streams go directly between peers via `WebRTC`. Signaling/STUN servers are only used for the initial handshake—your actual media never passes through a middleman. |
| 💬 **Live Workspace** | Real-time text chat, seamless file transfers, and a rich, fully collaborative text editor built for active team workflows. |
| 🚫 **Host Controls** | Full admin powers directly from your browser: transfer ownership, kick/ban users, change their names/emojis, mute their chat privileges, or force-stop their mic, camera, and screenshare. |

---

---
![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-blue.svg)
![Tech: WebRTC](https://img.shields.io/badge/Tech-WebRTC-orange.svg)
