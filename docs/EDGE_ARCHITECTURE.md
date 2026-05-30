# AIOS Edge Architecture — WS1 as Edge Server (Phase 2)
## On-Premise Edge Node in Lahore Office

---

## 1. WHY EDGE

Phase 1 (test) runs everything on AWS. Phase 2 adds WS1 (RTX 4090, 64GB RAM)
as an on-premise edge node in the Lahore office. This solves three problems:

| Problem | Cloud-only (Phase 1) | With Edge (Phase 2) |
|---|---|---|
| **Voice latency** | RTP over internet: ~60-100ms each way. Total voice pipeline ~3s | Local Asterisk + Dograh: <0.5ms audio path. Total voice ~1.5s |
| **Camera bandwidth** | All video streams to AWS: 2-4 Mbps per camera | Frigate on edge: only events/alerts go to cloud (<1 KB per event) |
| **Internet dependency** | SIP/RTSP breaks if internet down | Voice + cameras keep working locally. Queues forward when online |

---

## 2. EDGE HARDWARE

```
WS1 (existing machine in Lahore)
├── CPU: (check spec — likely modern Intel/AMD)
├── GPU: RTX 4090 24GB — used for Whisper STT, Frigate detection, embeddings
├── RAM: 64GB DDR5
├── Storage: 2TB NVMe + 4TB HDD
├── OS: Ubuntu 24.04 LTS
├── Internet: 100 Mbps fiber (office connection)
└── Network: Local LAN for IP phones + IP cameras
```

---

## 3. SERVICE SPLIT — EDGE VS AWS

### On Edge (WS1, Lahore)

| Service | Why Edge | Notes |
|---|---|---|
| **Asterisk PBX** | Voice must be local — sub-ms audio path | SIP core. Office IP phones register locally |
| **Dograh** | Voice orchestration local — zero audio over WAN | Connects to local Asterisk |
| **Whisper STT** | GPU-accelerated on RTX 4090 (fast, free) | Only text goes to cloud |
| **Kokoro TTS** | Lightweight, CPU fine | Free, no cloud dependency |
| **Frigate + go2rtc** | Camera feeds stay local | Only detection events → cloud |
| **YOLO detection** | GPU on RTX 4090 | Real-time object detection |
| **Qdrant (read replica)** | Local RAG reads — no latency | Syncs from AWS Qdrant primary |
| **Bifrost cache replica** | Cache hits in <10ms locally | Syncs from AWS Bifrost |
| **Redis (local cache)** | Low-latency session cache | Separate from AWS Redis |
| **n8n edge worker** | Executes workflows with local data | Pulls from n8n main queue on AWS |
| **MQTT Broker** | Local event bus for Frigate + IoT | Low latency, no cloud hop |

### On AWS (Phase 2 — same EC2s)

| Service | Why AWS | Notes |
|---|---|---|
| **Bifrost (main)** | LLM gateway — routes to OpenRouter | Single source of truth |
| **Qdrant (primary)** | Write master for RAG | Replicates to edge read replica |
| **Mem0** | Entity memory — needs central store | Edge syncs via API |
| **Supabase** | Operational database | Edge reads via API when needed |
| **Langfuse** | Central observability | All LLM calls logged here |
| **All FOSS apps** | Odoo, ERPNext, Twenty CRM, etc. | No need for local copies |
| **n8n (main queue)** | Workflow orchestrator | Distributes work to edge workers |
| **Grafana/Prometheus** | Central monitoring | Edge metrics pushed here |

---

## 4. CONNECTIVITY — WIREGUARD TUNNEL

```
Office (Lahore)                              AWS (Singapore/Mumbai)
┌─────────────────────────┐                 ┌──────────────────────┐
│ WS1 (Edge)              │                 │ EC2 #1 (AI Stack)    │
│ ├── WireGuard client    │◄───Tunnel──────►│ ├── WireGuard server │
│ │  10.70.0.1            │   encrypted     │ │  10.70.0.1 → VPC   │
│ └───────────────────────┘                 │ └────────────────────┘
│                                           │ EC2 #2 (FOSS Apps)   │
│ Office LAN: 192.168.1.0/24               │ via VPC routing      │
│ IP phones: 192.168.1.50-60               └──────────────────────┘
│ IP cameras: 192.168.1.70-80
└─────────────────────────┘

Bandwidth usage over tunnel:
  - Voice: ~100 Kbps per active call (text to Bifrost only)
  - Camera events: ~1 KB per detection event
  - Qdrant sync: ~10-50 MB per sync (configurable interval)
  - Bifrost cache sync: ~5-10 MB per sync
  Total: Under 1 Mbps average. 100 Mbps fiber is plenty.
```

### WireGuard Setup

```bash
# On EC2 #1 (server):
docker run -d --name wireguard \
  --cap-add NET_ADMIN --cap-add SYS_MODULE \
  -v /aios/configs/wireguard:/config \
  -p 51820:51820/udp \
  linuxserver/wireguard

# On WS1 (client):
# Install WireGuard, create config pointing to EC2 #1 public IP:51820
# PersistentKeepalive = 25 (keeps NAT/firewall hole open)
```

---

## 5. SYNC PATTERNS

### Qdrant (RAG knowledge)
```
Primary (AWS) ──push─→ Edge (read replica)
  Sync trigger: On write to Qdrant primary
  Method: Qdrant snapshot → S3 → edge pulls → restore
  Interval: Every 15 minutes (or on-demand via n8n webhook)
```

### Bifrost Cache
```
Primary (AWS) ──sync──→ Edge (cache replica)
  Sync: Bifrost native replication (Redis-based)
  Latency: ~1 second behind primary
  Hit rate improvement: ~30% on edge for frequent queries
```

### n8n Workers
```
Main queue (AWS) ←──pull──→ Edge worker
  Main n8n on EC2 #1 uses Redis queue
  Edge n8n worker connects to same Redis (over WireGuard)
  Picks up jobs tagged for edge execution
```

### Voice Data
```
Recordings stay on edge (Asterisk records locally)
Summaries sent to AWS (via n8n webhook after call ends)
Attachments (voicemail) synced to MinIO on AWS nightly
```

### Camera Data
```
Video stays on edge (Frigate local storage)
Event snapshots → AWS S3 (only detected objects)
Alert → n8n on AWS → WhatsApp notification
```

---

## 6. DOCKER STACK ON EDGE (WS1)

```yaml
# docker-compose-edge.yml — runs alongside cloud docker-compose files
# Only services that need local execution

services:
  wireguard:
    image: linuxserver/wireguard
    cap_add: [NET_ADMIN, SYS_MODULE]
    volumes: [./configs/wireguard:/config]
    restart: unless-stopped

  asterisk:
    image: asterisk:latest  # or custom build
    network_mode: host
    volumes:
      - ./configs/asterisk:/etc/asterisk
      - /var/spool/asterisk:/var/spool/asterisk
    restart: unless-stopped
    ports: ["5060:5060/udp", "10000-10100:10000-10100/udp"]

  dograh:
    image: dograh/dograh:latest
    ports: ["3010:3010"]
    environment:
      - ASTERISK_HOST=host.docker.internal
    restart: unless-stopped

  whisper-stt:
    image: onerahmet/openai-whisper-asr-websocket:latest-gpu
    runtime: nvidia
    environment:
      - WHISPER_MODEL=large-v3
      - DEVICE=cuda
    ports: ["9000:9000"]
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: 1
              capabilities: [gpu]
    restart: unless-stopped

  kokoro-tts:
    image: kokoro-tts:latest
    ports: ["9020:9020"]
    restart: unless-stopped

  frigate:
    image: ghcr.io/blakeblackshear/frigate:stable
    runtime: nvidia
    volumes:
      - ./configs/frigate:/config
      - /dev/bus/usb:/dev/bus/usb
    ports: ["5000:5000", "8554:8554"]
    restart: unless-stopped

  qdrant-replica:
    image: qdrant/qdrant:latest
    volumes: [./data/qdrant-replica:/qdrant/storage]
    ports: ["6333:6333"]
    restart: unless-stopped

  bifrost-cache:
    image: redis:7-alpine
    ports: ["6379:6379"]
    restart: unless-stopped

  redis-edge:
    image: redis:7-alpine
    ports: ["6380:6379"]
    restart: unless-stopped

  mqtt:
    image: eclipse-mosquitto
    ports: ["1883:1883"]
    restart: unless-stopped

  n8n-edge-worker:
    image: n8nio/n8n:latest
    command: worker --concurrency=5
    environment:
      - N8N_ENCRYPTION_KEY=${N8N_ENCRYPTION_KEY}
      - QUEUE_BULL_REDIS_HOST=10.70.0.1  # Redis on AWS EC2 #1
      - QUEUE_BULL_REDIS_PORT=6379
    restart: unless-stopped
```

---

## 7. VOICE PIPELINE WITH EDGE (Phase 2)

```
Office IP phone ──SIP──→ Asterisk (edge, local)
                           │
                        Dograh (edge, local)
                           │
                    ┌──────┴──────┐
                    │              │
              Whisper STT    Deepgram STT (cloud, premium)
              (RTX 4090 GPU)  (over WireGuard)
                    │              │
                    └──────┬──────┘
                           │
                    Bifrost (AWS, over WireGuard)
                           │
                     OpenRouter / Claude API
                           │
                    └──────┬──────┘
                           │
                    Kokoro TTS (edge, local)
                           │
                  Audio back to phone

Key change from Phase 1: Audio never leaves the office.
Only ~1KB of text crosses the WireGuard tunnel per query.
```

---

## 8. CAMERA PIPELINE WITH EDGE (Phase 2)

```
Office IP camera ──RTSP──→ Frigate (edge, local)
                              │
                         YOLO detection (RTX 4090 GPU)
                              │
                    ┌─────────┴─────────┐
                    │                   │
              Event snapshot      Video stored locally
              (~50 KB image)      (never leaves office)
                    │
                    ▼
              n8n edge worker
                    │
                    ▼
              Bifrost → OpenRouter/GPT-4o (describe)
                    │
                    ▼
              WhatApp alert (via AWS n8n)

Key change from Phase 1: Video stays local. Only images + alerts go to cloud.
```

---

## 9. MIGRATION PATH — PHASE 1 → PHASE 2

### Phase 1 (test) — Current
```
All services on AWS EC2
IP phones → SIP over internet → Asterisk on EC2 #1
IP cameras → RTSP over internet → Frigate on EC2 #1
Voice latency: ~3s
No on-prem dependency
```

### Migration steps to Phase 2:
```
Step 1: Set up WireGuard tunnel (adds 0 extra cost, runs on EC2 #1)
Step 2: Install Docker + NVIDIA drivers on WS1
Step 3: docker-compose -f docker-compose-edge.yml up -d
Step 4: Move Asterisk + Dograh from EC2 #1 to WS1 edge
         - Update SIP phone registration to WS1 IP
         - Stop Asterisk/Dograh containers on EC2 #1
Step 5: Move Frigate from EC2 #1 to WS1 edge
         - Update camera RTSP targets to WS1 IP
         - Stop Frigate container on EC2 #1
Step 6: Deploy Qdrant replica + Bifrost cache on edge
         - Configure sync from AWS primaries
Step 7: Deploy n8n edge worker
         - Connect to main n8n Redis queue over WireGuard
```

### Rollback plan:
```
If edge fails → re-enable AWS services + update DNS
WireGuard downtime → phones fail over to direct SIP (if configured)
Data loss risk: None — Qdrant primary + Supabase are on AWS
```

---

## 10. COST ANALYSIS

| Item | Phase 1 (cloud only) | Phase 2 (with edge) |
|---|---|---|
| AWS compute | 2 EC2 instances (~$140/mo) | 2 EC2 instances (~$140/mo) |
| Edge hardware | None (already owned) | WS1 (already owned) |
| Edge power/cooling | — | ~$30-50/mo (estimate) |
| Edge internet usage | 100 Mbps (already have) | 100 Mbps (already have) |
| WireGuard infra | — | $0 (runs on existing EC2) |
| **Total** | **~$140/mo** | **~$170-190/mo** |

---

*AIOS EDGE_ARCHITECTURE.md — Phase 2 Reference*
*Version: v1.0 · May 2026 · Lahore AI Lab*
*WS1 edge node with RTX 4090 + WireGuard to AWS*
