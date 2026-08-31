# Protocol Feasibility Investigation: Secureye S-FB3K / FKWeb Protocol

## 1. Executive Summary
This document presents the reverse-engineering analysis and feasibility evaluation of the **Secureye S-FB3K** biometric attendance terminal. The investigation reveals that the S-FB3K belongs to the **Realand / EBKN FKWeb family** (firmware dialect `fk_bin_data_lib: M50 / FKDataHS101 / M60`). 

Unlike conventional modern REST APIs (e.g. `GET /api/attendance`), the device communicates via **HTTP/1.0 or HTTP/1.1 POST requests** carrying proprietary binary-prefixed JSON payloads and custom HTTP header fields.

The terminal operates primarily in a **Device-Initiated (Push / Polling) Model**, making periodic HTTP requests toward a configured central server URL, while also responding to queued commands during its regular heartbeat polling (`receive_cmd`). Direct LAN HTTP socket communication is also supported for explicit commands when the terminal's built-in HTTP server port is open.

---

## 2. Device Communication Architecture

### 2.1 Network & Role Model
```
+--------------------------+                         +----------------------------------+
|                          |    1. realtime_glog     |                                  |
|   Secureye S-FB3K        |------------------------>|  Secureye Integration Platform   |
|   Biometric Terminal     |    (Punch Event)        |  (Next.js / Node.js Core)        |
|                          |<------------------------|                                  |
|   (IP: 192.168.1.100)    |    response_code: OK    |  (IP: 192.168.1.50:3000)         |
|                          |                         |                                  |
|                          |    2. receive_cmd       |                                  |
|                          |------------------------>|                                  |
|                          |    (Polls every ~3s)    |                                  |
|                          |<------------------------|                                  |
|                          |    cmd_id: GET_LOG_DATA |  Injects pending command         |
|                          |                         |                                  |
|                          |    3. send_cmd_result   |                                  |
|                          |------------------------>|                                  |
|                          |    (Returns log data)   |  Persists logs to PostgreSQL     |
|                          |<------------------------|  Streams update to Dashboard     |
|                          |    response_code: OK    |                                  |
+--------------------------+                         +----------------------------------+
```

### 2.2 Transport & Request Structure
- **Target URL:** Configurable in device menu (e.g., `http://<server-ip>:<port>/api/device/secureye` or absolute URI `POST http://<server-ip>:<port>`).
- **HTTP Method:** `POST`
- **HTTP Version:** `HTTP/1.0` or `HTTP/1.1`
- **Content-Type:** `application/octet-stream` or `text/plain`
- **Crucial HTTP Headers:**
  - `request_code`: Specifies the intent (`realtime_glog`, `realtime_enroll_data`, `receive_cmd`, `send_cmd_result`).
  - `dev_id`: Device serial number / terminal ID (e.g., `123456` or string serial).
  - `trans_id`: Transaction sequence number (monotonically increasing integer).
  - `cmd_id`: Present when responding to a command executed from `receive_cmd`.

---

## 3. Payload Wire Format & Parsing Strategy

### 3.1 Packet Layout
FKWeb payloads are constructed with a **4-byte Little-Endian unsigned integer** indicating the byte length of the JSON segment, followed by UTF-8 JSON data, optional null byte, and optional binary biometric template chunks:
```
+----------------------------+--------------------------------+---------------------------+
| 4-Byte LE Length (Uint32)  | UTF-8 JSON Data                | Null / Binary Blobs (opt) |
+----------------------------+--------------------------------+---------------------------+
```

### 3.2 The "Brace Depth" Extraction Rule
> [!WARNING]
> Simple string searches (such as anchoring on the last `}`) will fail on biometric enrollment packets (`realtime_enroll_data`) because binary template data can contain random ASCII byte `}` (0x7D).
> **Solution:** The parser scans characters starting from the first `{`, tracking nested curly brace depth while ignoring escaped quotes inside strings (`\"`). Once depth reaches 0, the JSON boundary is cleanly isolated.

---

## 4. Key Request Codes & Payloads

### 4.1 Real-Time Punch Event (`realtime_glog`)
Sent by the device within milliseconds after an employee punches:
```json
{
  "user_id": "1024",
  "verify_mode": 1,
  "io_mode": 16777216,
  "io_time": "2026-08-28 09:32:14",
  "fk_bin_data_lib": "M50"
}
```
**Verification Mode Mapping (`verify_mode`):**
- `1`: Fingerprint (FP)
- `2`: Password / PIN
- `3`: Card (RFID)
- `4`: Face Recognition
- `5`: Palm / Other
- `0`: Default / General

**IO Mode / Punch Type Mapping (`io_mode` Bitmask):**
- `0` / `16777216` (0x01000000): Check-In (F1)
- `1` / `33554432` (0x02000000): Check-Out (F2)
- `2` / `50331648` (0x03000000): Break-In (F3)
- `3` / `67108864` (0x04000000): Break-Out (F4)
- `4` / `83886080` (0x05000000): Overtime-In
- `5` / `100663296` (0x06000000): Overtime-Out

### 4.2 Polling Channel (`receive_cmd`)
Sent every 3 seconds by the device to query for pending tasks.
- If no commands are queued: Server returns HTTP 200 with header `response_code: OK` and an empty body.
- If a command is pending: Server returns HTTP 200 with header `cmd_id: <COMMAND_NAME>`, `trans_id: <number>`, and length-prefixed JSON parameters.

### 4.3 Command Execution Result (`send_cmd_result`)
Sent by the device carrying the output of the executed command:
```json
{
  "result": 1,
  "cmd_id": "GET_DEVICE_STATUS",
  "trans_id": 42,
  "data": {
    "user_count": 248,
    "log_count": 12894,
    "firmware": "M60 v3.16.1286s",
    "device_time": "2026-08-28 10:35:00"
  }
}
```

---

## 5. Critical Engineering Pitfalls & Mitigations

| Pitfall | Root Cause | Engineering Solution |
| :--- | :--- | :--- |
| **Reverse Proxy Stripping Headers** | Nginx, Caddy, AWS ALB drop headers with underscores by default (`request_code`, `dev_id`, `trans_id`). | Configure `underscores_in_headers on;` in Nginx or terminate directly in Node.js connector. |
| **Infinite Retransmission Loop** | Device expects header `response_code: OK` and strict `Connection: close`. If given arbitrary JSON/HTML, it assumes failure and floods packets. | Strict ACK formatter returning empty body with header `response_code: OK` and `Connection: close`. |
| **Multi-Device User ID Collision** | Multiple machines may have User `100` referring to different staff. | Compound key `deviceId + deviceUserId` mapped to unified `Employee` entity. |
| **Dangerous Wipe Commands** | Commands like `CLEAR_LOG_DATA` or `CLEAR_ENROLL_DATA` wipe non-volatile flash memory immediately. | Strictly whitelist safe commands (`GET_USER_ID_LIST`, `GET_USER_INFO`, `GET_DEVICE_STATUS`, `GET_LOG_DATA`, `SET_TIME`). Block destructive commands. |

---

## 6. Feasibility Conclusion
The reverse-engineered protocol is **100% viable** for standalone operation without Secureye Ontime. Both local direct LAN and remote cloud agent deployment modes are fully supported.
