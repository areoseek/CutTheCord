<p align="center">
  <img src="logo.jpg" alt="CutTheCord Logo" width="200">
  <h1 align="center">CutTheCord (Standalone)</h1>
  <p align="center">Self-hosted Discord alternative with voice, video, and text chat.</p>
</p>

---

## Looking for the Matrix version?

There is a newer version of CutTheCord built on the Matrix protocol: **[CutTheCord-Matrix](https://github.com/areoseek/CutTheCord-Matrix)**

The Matrix version uses Synapse, Element, and LiveKit instead of the custom backend in this repo. Here is the short version of why you might want it instead:

- **Encryption.** This standalone version stores all messages as plaintext in the database. The Matrix version supports end-to-end encryption through the Matrix protocol, so messages are encrypted before they ever leave your device.
- **More clients.** This version only has its own web client, Electron desktop app, and Capacitor Android app. The Matrix version works with any Matrix client out there, like Element on iOS, Android, desktop, and web, plus third-party clients like FluffyChat, Nheko, and SchildiChat. You can pick whatever works best for you on whatever device you have.
- **Better voice and video.** Both versions use LiveKit, but the Matrix version also includes a TURN server out of the box so calls work even when people are behind firewalls or on different networks. The standalone version needs you to handle that yourself.
- **Federation.** The Matrix version can optionally talk to other Matrix servers. The standalone version is a closed system.

If you are starting fresh, the Matrix version is the better choice. This standalone version still works and is not going anywhere, but new development is focused on the Matrix version.

---

> **Warning: Messages are not encrypted.** All text chat messages are stored as plaintext in PostgreSQL. There is no end-to-end encryption or at-rest encryption for message content. Anyone with database access can read all messages. If this is a concern, restrict database access and consider placing the stack behind a VPN.

---

## Features

- [x] Real-time text chat with message editing and cursor-based pagination
- [x] Voice and video calls powered by LiveKit (WebRTC SFU)
- [x] Server and channel management (text + voice channels)
- [x] Invite system with expiring/limited-use invite links
- [x] User avatars with upload support
- [x] Admin dashboard for user and server management
- [x] Desktop apps (Linux AppImage, Windows exe)
- [x] Android app via Capacitor
- [x] Mobile-responsive web interface
- [x] Noise gate and per-user volume controls

## Prerequisites

- Docker and Docker Compose v2
- 2GB+ RAM, 10GB+ disk
- Linux recommended (works on macOS/Windows with Docker Desktop)

## Debian / WSL Quick Start

```bash
git clone https://github.com/areoseek/CutTheCord-Standalone.git
cd CutTheCord-Standalone
chmod +x setup.sh
./setup.sh
```

## ArchLinux Quick Start

```bash
git clone https://github.com/areoseek/CutTheCord-Standalone.git
cd CutTheCord-Standalone
chmod +x ArchLinuxSetup.sh
./ArchLinuxSetup.sh
```

The setup script will walk you through configuration and start all containers automatically.

## Architecture

| Container | Purpose | Internal Port |
|-----------|---------|---------------|
| ctc-postgres | PostgreSQL 16 database | 5432 |
| ctc-redis | Redis cache & pub/sub | 6379 |
| ctc-api | Fastify API + Socket.IO | 4000 |
| ctc-admin-api | Admin management API | 4001 |
| ctc-nginx | Reverse proxy + web client | 3000, 3001 |
| ctc-livekit | LiveKit WebRTC SFU | 7880, 7881, 50000-50200/udp |

## Tech Stack

Node.js, TypeScript, Fastify, Socket.IO, React, Vite, LiveKit, PostgreSQL, Redis, Nginx, Docker, Electron, Capacitor

## Manual Setup

If you prefer not to use `setup.sh`:

1. Copy `.env.example` to `docker/.env`
2. Edit the values in `docker/.env` to match your environment
3. Generate `docker/livekit/livekit.yaml` from the template with your keys
4. Run `docker compose up -d --build` from the `docker/` directory
5. Create an admin user via the admin API:
   ```bash
   curl -X POST http://localhost:3001/admin/users \
     -H "Content-Type: application/json" \
     -d '{"username": "admin", "password": "yourpassword", "is_global_admin": true}'
   ```

## Building Desktop & Mobile Apps

**Linux:**
```bash
cd packages/desktop && pnpm install && pnpm run build:linux
```
The AppImage will be in the `out/` directory.

**Windows:**
```bash
cd packages/desktop && pnpm install && pnpm run build:win
```
Requires wine if building on Linux.

**Android:**
1. Update `packages/android/capacitor.config.ts` with your server URL
2. Build with Android Studio or the Capacitor CLI

## External Access

- **Port forwarding:** Forward `WEB_PORT` and LiveKit ports (7880, 7881, 50000-50200/udp) on your router
- **Reverse proxy:** Use nginx or Caddy with TLS termination
- **Cloudflare Tunnel:** Works for web traffic, but voice requires direct UDP connectivity
- If using TLS, update `LIVEKIT_URL` to `wss://` with your domain

## Security Notes

- The admin API (port 3001) has **NO authentication**. Restrict access to LAN or VPN only.
- Change all default passwords before exposing to the internet.
- Consider putting the entire stack behind a VPN for remote access.

## Troubleshooting

- **Containers not starting:** Check logs with `docker compose logs`
- **Voice not working:** Ensure LiveKit ports (7880, 7881, 50000-50200/udp) are accessible; verify `node_ip` in `livekit.yaml`
- **Can't login:** Verify the admin user was created; check API logs with `docker compose logs ctc-api`
- **Database issues:** Run `docker compose down -v` to reset (this destroys all data)

## License

[MIT](LICENSE)
