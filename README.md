# <img src="https://img.shields.io/badge/GitHub-9Website-black?style=for-the-badge&logo=github" height="45">
> [!NOTE]
> This app runs 100% in the browser. You don't need any servers!

> [!WARNING]
> If you modify this code and host it publicly, the AGPL v3.0 license requires you to keep your code open-source.

---

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

<details>
<summary><h2>🛠️ Step-by-Step Self-Hosting Guide</h2></summary>

### 1. Download & Install Node.js
You need to install Node.js so your computer can run the server commands.

| Operating System | How to Download |
| :--- | :--- |
| 🪟 **Windows** | Download and run the **Windows Installer (.msi)** from the official [Node.js Website](https://nodejs.org/). |
| 🍏 **macOS** | Download and run the **macOS Installer (.pkg)** from the [Node.js Website](https://nodejs.org/). |
| 🐧 **Linux** | Run `sudo apt install nodejs npm` in your terminal. |

---

### 2. How to Run the Mini-Server
Once Node.js is installed, open your **Command Prompt** (Windows) or **Terminal** (Mac/Linux) and run these two commands:

1. **Install the server tool:**
   ```bash
   npm install peer -g

2. **Launch the server:**

```text
peerjs --port 9000 --key peerjs

⚠️ Important Warnings & Precautions
[!WARNING]
Don't Close the Window: The server only runs as long as that Command Prompt or Terminal window is open. If you close it, your friends will be disconnected instantly.

[!CAUTION]
Firewall Blocks: If your friends try to connect to your local server and it fails, your computer's firewall or antivirus might be blocking port 9000. You may need to allow Node.js through your firewall settings.

[!NOTE]
Local vs Public: Running this on your computer means it works perfectly for devices on your own home Wi-Fi network. If you want friends from outside your house to connect to your private server, you would need to look into advanced "Port Forwarding" on your internet router.

 </details>

## **TL;DR**

| Feature | Description |
| :--- | :--- |
| 🔒 **P2P Encryption** | Video streams go directly between peers, never touching a server. |
| 💬 **Workspace** | Real-time text chat, file sharing, and collaborative text editing. |
| 🚫 **Host Controls** | Kick annoying users and issue hardware-based bans instantly. |

![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-blue.svg)
![Tech: WebRTC](https://img.shields.io/badge/Tech-WebRTC-orange.svg)
