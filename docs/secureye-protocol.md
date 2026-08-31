# Secureye S-FB3K / FKWeb Biometric Protocol Specification

## 1. Specification Scope & Distinction

### 1.1 Official Secureye Capabilities vs. Reverse-Engineered Behavior
- **Official Secureye Capabilities**:
  - Hardware: S-FB3K Standalone Biometric Access & Attendance Device.
  - Identification: Fingerprint (3,000 capacity), Face, RFID Card, PIN.
  - Storage: Up to 100,000+ Attendance Logs in non-volatile flash.
  - Connectivity: TCP/IP LAN, USB Drive Host, Relay Door Access.
- **Reverse-Engineered Communication Layer**:
  - Wire dialect: Realand / EBKN FKWeb family (`fk_bin_data_lib: M50 / FKDataHS101`).
  - Transport: HTTP/1.0 or HTTP/1.1 POST over standard TCP port (e.g. 80, 5005, or custom port).
  - Push/Pull Architecture: Bi-directional polling (`receive_cmd`) and real-time push (`realtime_glog`).

### 1.2 Verification Status Classification
- `[CONFIRMED]`: Verified through live network packet captures and tested implementations on S-FB3K / Realand BIOFACE hardware.
- `[INFERRED]`: Strongly indicated by FK-family SDK specifications and firmware pattern analysis.
- `[UNKNOWN]`: Vendor-proprietary or dependent on specific minor firmware revisions.

---

## 2. Packet Wire Format & Encoding `[CONFIRMED]`

### 2.1 HTTP Request Framing
Every request from the terminal is an HTTP POST request.
```http
POST /api/device/secureye HTTP/1.1
Host: 192.168.1.50:3000
Content-Type: application/octet-stream
User-Agent: Realand-FK/1.0
request_code: realtime_glog
dev_id: 123456
trans_id: 1082
Content-Length: 124

<Binary Prefix: 4 Bytes LE (e.g. \x74\x00\x00\x00)><JSON Payload>[\x00][Optional Binary Data]
```

### 2.2 Header Definitions `[CONFIRMED]`
| Header Name | Type | Description |
| :--- | :--- | :--- |
| `request_code` | String | Message intent: `realtime_glog`, `realtime_enroll_data`, `receive_cmd`, `send_cmd_result`. |
| `dev_id` | String / Integer | Unique device serial number / machine ID configured in device menu. |
| `trans_id` | Integer | Monotonically increasing sequence number per transaction. |
| `cmd_id` | String | (Present in `send_cmd_result`) Name of command executed. |
| `response_code` | String | (Server response header) Status acknowledgement (`OK` / `ERROR`). |

### 2.3 Binary Payload Framing `[CONFIRMED]`
1. **Header (4 bytes)**: Little-Endian `uint32` representing length of the UTF-8 JSON text in bytes.
2. **Body**: UTF-8 encoded JSON string.
3. **Null Terminator (1 byte)**: `0x00` (optional in some firmware).
4. **Binary Blob (Optional)**: Biometric template stream (if `realtime_enroll_data` or user template export).

---

## 3. Request Codes & Flows

### 3.1 Real-Time Punch Event: `realtime_glog` `[CONFIRMED]`
Generated immediately whenever a user verifies their identity at the device.

**Request Payload:**
```json
{
  "user_id": "1024",
  "verify_mode": 1,
  "io_mode": 16777216,
  "io_time": "2026-08-28 09:32:14",
  "fk_bin_data_lib": "M50",
  "log_image": null
}
```

**Field Specifications:**
- `user_id` (`string`): The device-level employee ID.
- `verify_mode` (`number`):
  - `1`: Fingerprint (FP)
  - `2`: Password / PIN
  - `3`: Card (RFID)
  - `4`: Face Recognition
  - `5`: Palm / Iris
  - `0`: Default
- `io_mode` (`number`): Bitmask integer:
  - `0` / `16777216` (0x01000000): Check-In (F1)
  - `1` / `33554432` (0x02000000): Check-Out (F2)
  - `2` / `50331648` (0x03000000): Break-In (F3)
  - `3` / `67108864` (0x04000000): Break-Out (F4)
  - `4` / `83886080`: Overtime-In
  - `5` / `100663296`: Overtime-Out
- `io_time` (`string`): Formatted as `YYYY-MM-DD HH:MM:SS` or `YYYYMMDDHHmmss`.

**Required Server Response `[CONFIRMED]`:**
- Status: `200 OK`
- Header: `response_code: OK`
- Header: `Connection: close`
- Body: `empty` (0 bytes)

---

### 3.2 Polling Channel: `receive_cmd` `[CONFIRMED]`
The device periodically checks for queued server commands (~every 3-5 seconds).

**Case A: No Commands Queued**
```http
HTTP/1.1 200 OK
response_code: OK
Connection: close
Content-Length: 0
```

**Case B: Injecting Command to Device**
```http
HTTP/1.1 200 OK
response_code: OK
cmd_id: GET_DEVICE_STATUS
trans_id: 1083
Connection: close
Content-Type: application/octet-stream
Content-Length: 20

<4-byte LE length><JSON parameters (e.g. {})><0x00>
```

---

### 3.3 Command Result: `send_cmd_result` `[CONFIRMED]`
Device executes the injected command and posts the result back to the server.

**Sample GET_DEVICE_STATUS Result Payload:**
```json
{
  "result": 1,
  "cmd_id": "GET_DEVICE_STATUS",
  "trans_id": 1083,
  "data": {
    "user_count": 248,
    "fp_count": 412,
    "face_count": 94,
    "card_count": 200,
    "log_count": 12894,
    "firmware": "M60 v3.16.1286s",
    "device_time": "2026-08-28 10:35:00",
    "mac_address": "00:1A:6B:4F:92:10"
  }
}
```

---

### 3.4 Supported Commands Reference `[CONFIRMED]`

| Command Name | Description | Parameters | Safety Level |
| :--- | :--- | :--- | :--- |
| `GET_DEVICE_STATUS` | Queries counts, firmware, time | `{}` | Safe / Read-Only |
| `GET_USER_ID_LIST` | Retrieves list of all user IDs | `{}` | Safe / Read-Only |
| `GET_USER_INFO` | Retrieves details for specific user ID | `{"user_id": "1024"}` | Safe / Read-Only |
| `GET_LOG_DATA` | Retrieves attendance log entries | `{"begin_time": "...", "end_time": "..."}` | Safe / Read-Only |
| `SET_TIME` | Synchronizes device internal clock | `{"time": "2026-08-28 10:35:00"}` | Safe / System Setting |
| `CLEAR_LOG_DATA` | **WIPES ALL ATTENDANCE LOGS** | `{}` | **DANGEROUS (Blocked)** |
| `CLEAR_ENROLL_DATA`| **WIPES ALL USER TEMPLATES** | `{}` | **DANGEROUS (Blocked)** |
| `CLEAR_ALL_ADMIN` | **REMOVES ALL ADMIN ROLES** | `{}` | **DANGEROUS (Blocked)** |

---

## 4. Reverse Proxy & Network Architecture Requirements

### 4.1 Nginx Configuration Example
```nginx
server {
    listen 80;
    server_name attendance.local;

    # CRITICAL: Do NOT drop headers with underscores
    underscores_in_headers on;
    ignore_invalid_headers off;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        
        # Pass raw binary payload without buffering delays
        proxy_buffering off;
        proxy_request_buffering off;
    }
}
```

### 4.2 Caddy Configuration Example
```caddy
http://attendance.local:80 {
    reverse_proxy 127.0.0.1:3000 {
        header_up Host {host}
        header_up X-Real-IP {remote_host}
    }
}
```

---

## 5. Summary of Protocol Rules for Developers
1. **Never send a verbose JSON acknowledgment for `realtime_glog`**: Return an empty body with `response_code: OK` in the HTTP header.
2. **Always include `Connection: close`**: Legacy microcontroller IP stacks may hang open connections indefinitely.
3. **Parse JSON using brace-depth matching**: Ignore binary template data at the tail of the payload.
4. **Enforce compound deduplication**: Store raw timestamps and verify against `(deviceId, deviceUserId, timestamp, eventType)`.
