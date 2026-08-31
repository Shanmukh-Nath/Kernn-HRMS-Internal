# Secureye S-FB3K Attendance Integration Platform

A complete, production-grade biometric attendance management platform engineered to interface directly with **Secureye S-FB3K** (and compatible Realand / EBKN / FKWeb family biometric terminals) over TCP/IP LAN.

This platform operates **100% independently of Secureye Ontime desktop software**, communicating natively via the reverse-engineered binary-prefixed JSON HTTP protocol.

---

## 🌟 Key Capabilities
- **Direct LAN Communication**: Bi-directional polling (`receive_cmd`) and real-time biometric event push (`realtime_glog`).
- **Real-Time Live Punch Streaming**: Live animated punch events stream to the dashboard and `/live` monitor via Server-Sent Events (SSE) with sub-second latency.
- **Roster & Log Synchronization**: Pull user identities (`GET_USER_ID_LIST`, `GET_USER_INFO`) and attendance records (`GET_LOG_DATA`) with compound deduplication.
- **Hardware RTC Calibration**: Align the physical terminal clock with server time (`SET_TIME`).
- **Hardware Protocol Simulator (`npm run simulator`)**: Fully test the entire platform without requiring physical hardware present.
- **Physical Device Diagnostic CLI (`npm run device:test`)**: Rapidly verify TCP reachability, HTTP handshake, and firmware responses.
- **Standalone Connector Agent (`npm run connector`)**: Bridge local LAN terminals across branches to a central cloud server.
- **Protocol Capture & Diagnostics (`/debug`)**: Live packet inspector recording custom headers, transaction IDs, and sanitized payloads.

---

## 🏗️ Architecture & Network Flow

```
+----------------------------------------------------------------------------------------------------+
|                                           LOCAL LAN / WAN                                          |
|                                                                                                    |
|   +-----------------------+              1. realtime_glog (Punch)             +----------------+   |
|   |                       |-------------------------------------------------->|                |   |
|   |    Secureye S-FB3K    |              2. receive_cmd (Poll every ~3s)      |  Next.js / Node|   |
|   |    Biometric Terminal |<--------------------------------------------------|  Server Engine |   |
|   |    (192.168.1.100)    |              3. Inject Command (e.g. GET_LOGS)    |  (Port 3000)   |   |
|   |                       |-------------------------------------------------->|                |   |
|   +-----------------------+              4. send_cmd_result (Payloads)        +----------------+   |
|                                                                                       |            |
|                                                                                       v            |
|                                                                           +---------------------+  |
|                                                                           | PostgreSQL / SQLite |  |
|                                                                           | Database Storage    |  |
|                                                                           +---------------------+  |
+----------------------------------------------------------------------------------------------------+
```

---

## 🚀 Quick Start Guide

### 1. Prerequisites
- Node.js 18+ (Tested on Node.js v22.x)
- npm 9+

### 2. Installation
```bash
# Clone and enter directory
cd secureye-attendance

# Install dependencies
npm install

# Initialize database schema & seed demo data
npx prisma db push
npm run db:seed
```

### 3. Launch Development Server
```bash
npm run dev
```
Open your browser at `http://localhost:3000`.

---

## 🧪 Testing with the Hardware Simulator
When developing without access to the physical S-FB3K terminal, start the built-in simulator:

```bash
# Terminal 1: Start web application
npm run dev

# Terminal 2: Start S-FB3K Simulator
npm run simulator
```

The simulator will:
1. Register itself as device `SFB3K_SIM_987654`.
2. Connect to `http://127.0.0.1:3000/api/device/secureye`.
3. Send realistic biometric punches (`realtime_glog`) for fingerprints, RFID cards, and facial recognition.
4. Respond to user roster queries (`GET_USER_ID_LIST`) and status requests (`GET_DEVICE_STATUS`).

---

## 🔍 Testing a Physical S-FB3K Device
To diagnose a physical terminal connected to your local network:

```bash
npm run device:test -- --ip 192.168.1.100 --port 80
```

Sample output:
```
================================================================
🔍 Secureye S-FB3K Physical Device Diagnostic Tool
🎯 Target Device : 192.168.1.100:80
================================================================

[1/5] Testing TCP socket connectivity... ✅ OK (18ms)
[2/5] Probing FKWeb protocol handshake... ✅ OK (Latency: 22ms)
[3/5] Querying device status (GET_DEVICE_STATUS)... ✅ OK
   • Model    : Secureye S-FB3K / FKWeb
   • Serial   : 123456
   • Firmware : M60 v3.16.1286s
   • Users    : 248
   • Logs     : 12894
[4/5] Testing user list retrieval (GET_USER_ID_LIST)... ✅ OK (Found 248 enrolled users)
[5/5] Testing log retrieval (GET_LOG_DATA)... ✅ OK (Retrieved 50 log records)
```

---

## ⚙️ Configuring the Physical S-FB3K Terminal

1. Power on the Secureye S-FB3K device and press **`M/OK`** to enter the device menu.
2. Navigate to **`Comm.` / `Network`**:
   - **IP Address**: Assign a static IP (e.g. `192.168.1.100`).
   - **Subnet Mask**: `255.255.255.0`
   - **Gateway**: `192.168.1.1`
3. Navigate to **`Server Settings` / `Web Settings` / `Cloud Server`**:
   - **Server IP**: Set to your server IP (e.g. `192.168.1.50`).
   - **Server Port**: `3000` (or `5005` if running standalone connector).
   - **Push Mode**: `Enabled` / `Real-time`.
4. Save and exit the menu. The terminal will immediately begin sending `receive_cmd` heartbeats and real-time punch events.

---

## 🛡️ Reverse Proxy Configuration (Nginx / Caddy)
> [!IMPORTANT]
> The FKWeb protocol uses HTTP headers with underscores (`request_code`, `dev_id`, `trans_id`, `cmd_id`, `response_code`). Standard reverse proxies strip these by default unless explicitly permitted.

### Nginx Setup
```nginx
server {
    listen 80;
    server_name attendance.yourcompany.local;

    # CRITICAL: Preserve custom headers with underscores
    underscores_in_headers on;
    ignore_invalid_headers off;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_buffering off;
    }
}
```

---

## 📦 Deployment via Docker

```bash
# Build and spin up Next.js app + PostgreSQL container
docker-compose up -d --build
```

---

## 🛠️ REST API Reference

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/device/secureye` | Device-initiated ingestion endpoint (FKWeb protocol). |
| `GET` | `/api/devices` | Lists all configured biometric terminals. |
| `POST` | `/api/devices` | Creates a new biometric terminal configuration. |
| `POST` | `/api/devices/:id/test` | Runs TCP socket & protocol handshake diagnostic test. |
| `POST` | `/api/devices/:id/sync/users` | Triggers user roster synchronization (`GET_USER_ID_LIST`). |
| `POST` | `/api/devices/:id/sync/attendance` | Triggers attendance log synchronization (`GET_LOG_DATA`). |
| `POST` | `/api/devices/:id/sync/time` | Synchronizes device hardware clock (`SET_TIME`). |
| `GET` | `/api/attendance` | Returns filtered attendance logs (supports `?format=csv`). |
| `GET` | `/api/attendance/live` | Server-Sent Events (SSE) live punch stream. |
| `GET` | `/api/debug/capture` | Returns recent packet captures (supports `?format=export`). |

---

## 📜 Protocol Documentation
- Complete protocol feasibility evaluation: [`docs/protocol-feasibility.md`](docs/protocol-feasibility.md)
- Complete protocol specification & dialect rules: [`docs/secureye-protocol.md`](docs/secureye-protocol.md)
