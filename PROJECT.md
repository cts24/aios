# AIOS — AI Operating System
## Complete Project Reference for Claude Code
### Lahore AI Lab · May 2026 · TEST ARCHITECTURE

---

> **CURRENT STATE: TEST AIOS DEPLOYMENT ON AWS**
> This document has been updated for the test AIOS — a cloud-only deployment
> on 2 AWS EC2 instances. The only on-premises devices are IP phones and
> IP cameras in the office. All servers run in AWS. This tests integration
> of all architecture layers + 5 use-cases end-to-end.
>
> Sections marked with **[TEST]** reflect the current architecture.
> Original physical-lab architecture is preserved in git history and will
> be restored/references in production phase.

---

## 1. PROJECT OVERVIEW

### What This Is
AIOS (AI Operating System) is a production-grade AI platform — an AgentOS —
running on 2 AWS EC2 instances, tested with real IP phones and IP cameras
from a Lahore office.

1. AI integration testbed — validate all layers + 5 use-cases
2. Production template — same architecture deployed per client on AWS
3. Commercial AI agency — selling AI Digital Employees to SMBs

### Business Context
```
Founder:        20+ years IT infrastructure, 38,000-school SED deployment
Business model: Sell AI Digital Employees to SMBs
Target markets: Pakistan (Lahore) → UAE (Dubai) → USA/Canada (white-label)
Revenue model:  PKR 35-120K setup + PKR 12-40K MRR per system
Target:         60 clients Month 12, PKR 940K MRR
AIOS is:        An AgentOS — the same concept Fiserv/Infobip built
                for their markets. You built it for Pakistan/UAE SMBs.
```

### Core Principle
The test deployment validates all layers before scaling. Architecture is
cloud-native with AWS EC2 as primary compute. On-prem edge (for voice
latency) is evaluated post-test if needed.

### AIOS v1 vs v2
```
v1 (test):  Cloud-only on 2 EC2 — validate all layers + 5 use-cases
            Langfuse + Grafana for observability
            Dashy for navigation
v2 (later): Central unified dashboard after real usage reveals what matters
            On-prem edge node for voice/camera if latency requires
            Full LLM Wiki implementation
            K3s auto-scaling when 100+ clients
```

---

## 2. CLOUD INFRASTRUCTURE — TEST AIOS [TEST]

### 2 AWS EC2 Instances — No On-Prem Servers

The test AIOS runs entirely on AWS. The only on-prem hardware are
IP phones (SIP) and IP cameras (RTSP) in the office connecting over internet.

---

### EC2 Instance #1 — AI Stack
```
Name:     aios-ec2-ai
OS:       Ubuntu 24.04 LTS
Role:     All AI services — gateway, orchestration, voice, vision, data
Type:     t3.xlarge (4 vCPU / 16GB RAM) — scale up as needed
Storage:  200GB gp3
Public:   YES — ports 443 (HTTPS), 5060 (SIP) via Security Groups
          SIP restricted to office public IP
```

Docker Compose (`docker-compose-aios.yml`):
```
Traefik, CrowdSec,
Bifrost AI Gateway (routes to OpenRouter — NO local LLM),
n8n + workers ×1, LangGraph, CrewAI,
Asterisk PBX, Dograh (voice agent), Whisper STT, Kokoro TTS,
MQTT Broker, Frigate NVR + go2rtc,
Qdrant (vector DB), Redis (session + queue), Mem0,
Langfuse (observability + prompt registry),
Supabase (Postgres), MinIO (S3-compatible storage),
Grafana, Prometheus, Loki, Portainer, Dashy,
Uptime Kuma, Dozzle, ArgoCD, Watchtower, Trivy,
Central MCP Server, Open WebUI
```

---

### EC2 Instance #2 — FOSS Business Apps
```
Name:     aios-ec2-apps
OS:       Ubuntu 24.04 LTS
Role:     All FOSS business applications + identity
Type:     t3.large (2 vCPU / 8GB RAM)
Storage:  100GB gp3
Public:   NO — internal to VPC, accessed via EC2 #1 reverse proxy
```

Docker Compose (`docker-compose-apps.yml`):
```
Odoo, ERPNext/Frappe, Twenty CRM, SuiteCRM, Calcom,
Paperless-ngx, Docuseal, Planka, Rocket.Chat,
Frappe LMS, GnuCash, Metabase,
Keycloak (SSO), HashiCorp Vault (secrets),
Paperclip (agent governance), Issabel (UC GUI — containerized)
```

---

### Resource Budget
```
EC2 #1 — AI Stack:  4 vCPU / 16GB RAM / 200GB gp3
EC2 #2 — Apps:      2 vCPU / 8GB RAM / 100GB gp3
Total:              6 vCPU / 24GB RAM / 300GB storage
GPU:                NONE — all inference via Bifrost → OpenRouter
```

---

## 3. NETWORK ARCHITECTURE [TEST]

### Network Topology
```
Office IP phones + IP cams → internet (SIP/RTP/RTSP) → AWS VPC
  EC2 #1 (AI):     10.0.1.10 (VPC private IP) + Elastic IP
  EC2 #2 (Apps):   10.0.2.10 (VPC private IP) — no public IP
  Office public IP: [office static IP] — allowed in Security Groups
```

### Security — 5 Layers in Sequence
```
1. Cloudflare          — cloud edge: DDoS, SSL, CDN
2. AWS Security Groups — network firewall (replaces OPNsense)
                         Port 443 open to all
                         Port 5060 (SIP) open to office IP only
                         Port 8554 (RTSP) open to office IP only
                         All other ports closed
3. Traefik             — reverse proxy: HTTPS termination, container routing
4. CrowdSec            — WAF: IP reputation, rate limiting, brute force
5. Keycloak            — identity: tenant auth, RBAC, OAuth2/OIDC
```

### API Gateways
```
Gateway 1 — Traefik (HTTP/HTTPS)
  Controls: ALL web traffic entering AIOS
  Routes requests to correct Docker container on either EC2

Gateway 2 — Bifrost (AI/LLM)
  Controls: ALL LLM API calls
  Routes to OpenRouter (primary) / Claude / GPT-4o (fallback)
  Caches, tracks cost, enforces budget

Note: Internal container-to-container calls go DIRECT via Docker networks.
      Cross-EC2 traffic goes via VPC private IPs (no internet).
```

### VPC Network Zones (simplified — Docker networks on each EC2)
```
EC2 #1 Docker networks (internal to instance):
  dmz-net:      Traefik, CrowdSec
  ai-net:       Bifrost, n8n, LangGraph, CrewAI
  voice-net:    Asterisk, Dograh, MQTT
  data-net:     Qdrant, Redis, Mem0, MinIO, Supabase
                internal:true — no internet access
  vision-net:   Frigate, go2rtc
  monitoring:   Langfuse, Grafana, Prometheus, Loki, Uptime Kuma

EC2 #2 Docker networks (internal to instance):
  app-net:      Odoo, ERPNext, Twenty CRM, Metabase, Issabel, etc.
  identity-net: Keycloak, Vault, Paperclip

Cross-EC2: VPC private IPs (10.0.1.10 ↔ 10.0.2.10) via AWS internal network
```

### Multi-Tenant Client Isolation
```
Note: Test AIOS is single-tenant. Multi-tenant isolation documented for
      production reference.

Keycloak:   One Organization per client (Keycloak 26 Organizations)
Qdrant:     One collection — {client_id}-knowledge
Supabase:   One schema — {client_id} with RLS enforced
Bifrost:    One virtual key with monthly budget limit
n8n:        One main workflow tagged client_id
Langfuse:   One project per client
Paperclip:  One company per client (full isolation)
```

---

## 4. AIOS ARCHITECTURE — ALL TIERS

### TIER 1 — INPUT CHANNELS
```
Channel           Tool                        What It Carries
────────────────────────────────────────────────────────────
Voice calls       Asterisk SIP + Dograh       Audio calls (self-hosted)
WhatsApp          Meta WhatsApp Business API  Text, images, voice notes, docs
Web chat          React widget + n8n webhook  Text conversations
REST API          n8n webhook nodes           External triggers, forms
IP Cameras        RTSP → go2rtc → Frigate     Live video feeds
Document upload   Supabase Storage + n8n      PDFs, invoices, images
Email inbound     IMAP/SMTP via n8n           Email triggers, attachments
SMS               Twilio                      Alerts, reminders, OTPs
```

---

### TIER 2 — SECURITY, WAF & IDENTITY [TEST]
```
Tool              Where            Role
──────────────────────────────────────────────────────────────
Cloudflare        Cloud            Edge DDoS, DNS, SSL, CDN
AWS Security Grp  AWS VPC          Network firewall (replaces OPNsense)
Traefik           EC2 #1 Docker    Reverse proxy, HTTPS, load balancing
CrowdSec          EC2 #1 Docker    WAF, IP reputation, rate limiting
Keycloak          EC2 #2 Docker    SSO, RBAC, OAuth2/OIDC
HashiCorp Vault   EC2 #2 Docker    All secrets encrypted, injected at runtime
Docker networks   EC2 #1 + #2     Internal networks, internal:true on data zone
```

---

### TIER 3 — AI GATEWAY & LLM INTELLIGENCE [TEST]

#### Production AI Gateway
```
Bifrost    EC2 #1 Docker
  Role: PRODUCTION gateway — ALL LLM calls go here ONLY
  Features: 11μs overhead, 5000+ RPS, semantic caching (40-60% saving),
            per-client virtual keys, budget controls, MCP support,
            automatic failover, prompt injection detection, PII sanitisation,
            OpenAI-compatible API endpoint, HashiCorp Vault integration

LiteLLM    NOT USED in test — OpenRouter handles multi-provider routing
```

#### LLM Inference — OpenRouter (NO local LLM)
```
NO local vLLM in test AIOS. All inference via Bifrost → OpenRouter.

OpenRouter provides access to 300+ models with pay-per-token pricing.
No GPU required on EC2. No local model management.
```

#### Cloud LLMs — via Bifrost → OpenRouter
```
Primary (80-90% of calls):
  OpenRouter free/cheap models: Mistral 7B, Llama 3.1 70B, Qwen 2.5 72B
  Zero infrastructure cost. Pay per token (~$0.10-0.50/1M tokens).

Premium (5-10% of calls):
  Claude 4 Sonnet  Anthropic via OpenRouter  Complex reasoning, long docs
  GPT-4o           OpenAI via OpenRouter      Vision, structured extraction

Optional direct (bypass OpenRouter for latency):
  Deepgram         Cloud API                  STT — best Urdu accuracy
  ElevenLabs       Cloud API                  TTS — natural voice
```

#### Bifrost Routing Logic (test)
```
Task                          Routes To                 Reason
─────────────────────────────────────────────────────────────────────
Simple FAQ, intent detection  Mistral 7B (OpenRouter)   Fastest, cheapest
Arabic/Urdu conversation      Qwen 2.5 72B (OpenRouter) Best multilingual
General reasoning, HR         Llama 3.1 70B (OpenRouter) High quality, cheap
Complex docs, legal, long ctx Claude 4 Sonnet (API)     Frontier quality
Invoice/image reading         GPT-4o (API)              Best vision
Content generation (blogs)    Claude 4 Sonnet (API)     Best writing quality
Cached/repeated queries       Bifrost semantic cache    No LLM call at all
OpenRouter down/busy          Claude API (auto-failover) Zero downtime
```

#### Memory Architecture — 4 Layers
```
Layer 1 — Static Knowledge (Qdrant RAG):
  Storage: Qdrant vector database
  What: Documents, FAQs, SOPs, pricing, schedules
  Learns: Never — read-only static knowledge
  Best for: Information retrieval

Layer 2 — User Memory (Mem0):
  Storage: Mem0 Docker + Supabase backend
  What: Per-user preferences, history, context across sessions
  Learns: Yes — from every interaction per user
  Best for: Personalisation ("Ahmed always books Dr Ahmed mornings")

Layer 3 — Session Memory (Redis):
  Storage: Redis
  What: Current conversation context only
  Learns: Forgotten after session ends
  Best for: Multi-turn conversation context

Layer 4 — LLM Wiki (Phase 2):
  Storage: Qdrant write-back (tagged wiki-entry)
  What: Agent-synthesised patterns from real interactions
  Learns: Yes — agent builds knowledge autonomously
  Best for: Deep domain expertise that grows over time
  Implementation: cap-wiki-write.json + cap-wiki-consolidate.json
```

#### Central Prompt Registry
```
Langfuse: ALL agent system prompts — stored, versioned, managed
          Agents pull prompts at runtime
          Change once → all agents update instantly
nomic-embed-text (Ollama): embedding model for RAG
LlamaIndex: document chunking + RAG pipeline
```

---

### TIER 4 — VISUAL AI (Frigate Pipeline) [TEST]
```
Frigate 0.17  EC2 #1 Docker    Object detection on IP cameras (CPU mode)
                                Face recognition (attendance use case)
YOLOv8 CPU    EC2 #1 Docker    CPU-optimized detection model (no GPU)
go2rtc        EC2 #1 Docker    IP camera RTSP stream management
MQTT Broker   EC2 #1 Docker    Frigate event → n8n workflow trigger
Vision LLM    Via Bifrost →    Image analysis via GPT-4o / Claude vision
              OpenRouter       (no local LLaVA)

Pipeline:
Office IP Camera → RTSP over internet → go2rtc → Frigate → YOLOv8 CPU (detect)
→ MQTT → n8n → Bifrost → GPT-4o (describe event) → action/alert

Note: CPU mode limits concurrent streams. For production, GPU (NVIDIA T4
      or similar) would be added. Test handles 1-2 cameras fine on CPU.
```

---

### TIER 5 — VOICE AI (FINAL LOCKED) [TEST]

**Dograh replaces Retell AI and Vapi completely.**
**Dograh is FOSS, self-hosted, MCP-native, zero per-minute cost.**

```
Asterisk PBX  EC2 #1 Docker
              Core SIP engine — call routing, IVR, recording
              SIP port 5060 open to office public IP only (via SG)
              Office IP phones register remotely over internet

Dograh        EC2 #1 Docker
              FOSS voice agent platform — replaces Retell AI + Vapi
              MCP-native — Claude Code builds agents directly
              Self-hosted — data never leaves your servers
              URL: dograh.com | GitHub: github.com/dograh-hq/dograh
              License: BSD-2 (forever free)

Issabel       EC2 #2 Docker (containerized — no longer KVM VM)
              UC platform + call centre GUI
              SIP trunked to Asterisk over VPC internal network

Deepgram      Cloud API  STT — best Urdu accuracy — optional premium
ElevenLabs    Cloud API  TTS — most natural voice — optional premium
Whisper STT   EC2 #1 Docker  CPU-based STT (fallback/local option)
Kokoro TTS    EC2 #1 Docker  CPU-based TTS (free, lightweight)
```

Voice pipeline options (test):
```
OPTION A — Cloud LLM + local STT/TTS (cheapest):
  Office IP phone → SIP → Asterisk → Dograh
  → Whisper STT (CPU, free) → Bifrost → OpenRouter (LLM)
  → Kokoro TTS (CPU, free) → Audio back to phone
  Cost: LLM tokens only (~$0.001-0.003/call)

OPTION B — Cloud everything (best quality):
  Office IP phone → SIP → Asterisk → Dograh
  → Deepgram STT (cloud, $0.0077/min) → Bifrost → OpenRouter
  → ElevenLabs TTS (cloud, premium voice)
  Cost: ~$0.01/min
```

Dograh MCP — overpowered method:
```
Claude Code → Dograh MCP server
→ builds complete voice agent without leaving IDE
→ creates agent, wires STT+LLM+TTS, connects Asterisk
→ deploys ready in minutes
```

---

### TIER 6 — AUTONOMOUS AGENT & WORKFLOW ORCHESTRATION [TEST]

#### Master Orchestration
```
n8n (queue mode)  EC2 #1 Docker
                  Master orchestrator — ALL client workflows
                  1,400+ integrations, Redis queue mode
n8n workers ×1    EC2 #1 Docker — stateless, add more as needed
Flowise           NOT USED in test — keep stack lean
Dify              NOT USED in test — keep stack lean
```

#### Multi-Agent Framework
```
CrewAI      EC2 #1 Docker  Multi-agent teams for complex tasks
                          Use for: invoice validation, lead enrichment,
                          legal document review (specialist agents)
LangGraph   EC2 #1 Docker  Stateful graph-based reasoning with loops
                          Use for: complex complaint routing, legal review,
                          multi-step decisions with retries
A2A         Agent-to-agent protocol (Google standard)
MCP         Model Context Protocol (Anthropic standard)
```

#### Tool Selection Rules
```
n8n        → trigger + steps + integrations (80% of all workflows)
LangGraph  → complex reasoning with loops, branches, retries
CrewAI     → multiple specialist agents on one complex task
LangChain  → custom Python AI logic (use rarely — last resort)
```

#### Central MCP Server
```
Location:  EC2 #2 Docker
Purpose:   All tools defined ONCE — available to ALL agents
Tools exposed:
  erp_tool         → ERPNext REST API
  crm_tool         → Twenty CRM API
  calendar_tool    → Google Calendar
  email_tool       → Gmail/SES
  whatsapp_tool    → Meta WhatsApp API
  qdrant_tool      → Qdrant semantic search
  supabase_tool    → Supabase queries
  paperless_tool   → Paperless-ngx document management
  web_search       → web search for agents
  file_tool        → file read/write operations
  payment_tool     → JazzCash/Stripe

Add one tool → available to ALL agents instantly
```

#### Agent Governance
```
Paperclip  EC2 #2 Docker
  Purpose: AI company OS — manages ALL agents across ALL companies
  Connects to Bifrost via OpenAI-compatible API
  Per-client LLM budget enforced via virtual keys

  3 internal companies:
    "AIOS Infrastructure" — backup + alert agents
    "AIOS Product"        — QA + research agents
    "Founder Productivity" — personal + content agents

  Per-client company (one per SMB client):
    Their business agents only — NO dev/infra agents
    Completely isolated from your internal companies

Langfuse   EC2 #1 Docker
  Prompt registry: all prompts versioned, pulled at runtime
  LLM observability: every call logged, scored, cost tracked
  Evaluation: automated quality scoring per agent response
```

#### Agent Patterns
```
ReAct            → dynamic tasks, unpredictable path
Plan-and-Execute → predictable workflows (invoice, attendance)
Multi-agent      → complex multi-domain (HR onboarding, finance)
Human-in-loop    → high-stakes decisions requiring approval
```

#### Harness Architecture
```
HARNESS = what wraps around the AI model to make it reliable

Layer 1 — Global rules:
  AGENTS.md — AIOS reads automatically
  Architecture rules, security rules, naming conventions

Layer 2 — Skills:
  n8n capability sub-workflows — reusable business logic
  MCP central server — all tool connections

Layer 3 — Hooks (guardrails):
  Pre-call: Bifrost prompt injection scan + PII check
  Pre-call: n8n input validation (empty check, injection pattern)
  Post-call: n8n output validation (quality, PII strip, escalate)
  Action limits: agent cannot delete records, max messages/hour

Layer 4 — Memory:
  Qdrant RAG (static) + Mem0 (dynamic) + Redis (session)

Layer 5 — Observability:
  Langfuse traces every LLM call
  OpenTelemetry distributed tracing
  Grafana monitoring dashboard
```

---

### TIER 7 — BUSINESS SUPERVISOR AGENT [TEST]

The business supervisor is the **human interface to AIOS business operations**
— accessible via WhatsApp, Telegram, Web UI, and Voice (ext. 9000).
It answers questions and runs actions across all 5 use-cases.

**It does NOT manage infrastructure.** That's Hermes's job (see Internal Agent Team).
**It does NOT handle your personal tasks.** That's OpenClaw's job.
This agent is purely for business operations — HR, sales, support, finance, marketing.

#### Architecture
```
Channels:
├── WhatsApp    Meta API → n8n webhook
├── Telegram    Bot API → n8n webhook
├── Web UI      Chat widget → n8n webhook
└── Voice       Office phone → Asterisk ext.9000 → Dograh → n8n webhook
                    │
                    ▼
              n8n Supervisor Workflow
                    │
                    ▼
              Intent Detection (Mistral 7B via OpenRouter)
              ├── Which use-case? (HRMS / Call Centre / CX / Finance / Marketing)
              ├── Which type? (FAQ / Summary / Report / Analysis / Action)
              └── Agent escalation? (transfer to human)
                    │
                    ▼
              Route to:
              ├── Qdrant RAG (use-case knowledge base)
              ├── Supabase (real-time metrics query)
              ├── n8n report generator (on-demand report)
              └── Mem0 (caller context + preferences)
                    │
                    ▼
              Bifrost → OpenRouter (response generation)
                    │
                    ▼
              Format → channel (text for chat, TTS for voice)
```

#### What the supervisor can do per use-case

| Use-case | FAQ | Summary | Report | Analysis | Action |
|---|---|---|---|---|---|
| HRMS | Leave policy? | Today's attendance | Monthly absenteeism | Attrition prediction | Run payroll, approve leave |
| Call Centre | Return policy? | Today's calls | Weekly resolution rate | Peak hours trend | Retry failed outbound |
| CX | Store hours? | Open tickets | Customer satisfaction | Common complaint patterns | Escalate urgent ticket |
| Finance | Tax rate? | Pending invoices | Monthly P&L | Cash flow forecast | Send invoice reminders |
| Marketing | Lead status? | Campaign results | ROI analysis | Best channel analysis | Launch follow-up campaign |

#### Channels for test phase

```
1. WEB UI (simplest — build first):
   Simple chat page served from Dashy or n8n webhook trigger
   No auth needed for internal test — accessible via LAN/Dashy link
   Just a text input → sends to n8n → shows response

2. TELEGRAM:
   Create @aios_supervisor_bot via BotFather
   Bot webhook → n8n Telegram trigger node
   Test with your personal Telegram

3. WHATSAPP:
   Already have Meta WhatsApp API in the stack
   Same number but supervisor-specific keyword detection
   Or dedicated test number

4. VOICE (ext. 9000):
   Dograh voice agent connected to Asterisk extension 9000
   Same voice pipeline as TIER 5
   Routes questions to supervisor n8n workflow instead of client workflows
```

#### n8n workflow
```
workflow-supervisor: supervisor-agent.json
  Trigger: Multi-channel webhook (WhatsApp / Telegram / Web / Voice)
  Node 1: Channel parser (extract message + channel + user_id)
  Node 2: Intent detection (use-case + query type via Mistral 7B)
  Node 3: Route to correct sub-workflow
    → FAQ: Qdrant RAG search → LLM → respond
    → Summary: Supabase query (last 24h data) → LLM summarize → respond
    → Report: Trigger n8n report workflow → wait → respond
    → Analysis: Supabase query + LLM insight → respond
    → Action: n8n action workflow → confirm → respond
  Node 4: Mem0 write (log this interaction)
  Node 5: Langfuse log (cost + latency + quality)
  Node 6: Channel formatter (markdown for WhatsApp, TTS for voice)
```

#### Dashy link for supervisor
```
Dashy → SUPERVISOR → AIOS Supervisor
  ├── Web Chat    → /supervisor (simple HTML page)
  ├── Telegram    → t.me/aios_supervisor_bot
  ├── Grafana     → Supervisor dashboard (metrics, usage, costs)
  └── Langfuse    → Supervisor project logs
```

---

### INTERNAL AIOS AGENT TEAM [TEST]

Three agents form your internal team — they help YOU run both the business
and the platform itself. Only YOU have access to these.

```
TEAM                          Role                     Access
─────────────────────────────────────────────────────────────
Business Supervisor (TIER 7)  Business ops assistant   WhatsApp / Telegram / Web UI / Voice ext.9000
Hermes Agent                  DevOps / infra agent     WhatsApp / Telegram
OpenClaw                      Your personal assistant  WhatsApp / Telegram / Web UI
```

#### Hermes Agent — DevOps & Infrastructure
```
Purpose:  Autonomous 24/7 server ops — monitors, restarts, alerts
Location: EC2 #1 Docker (container)
Access:   Telegram commands + WhatsApp alerts
What it does:
  - Monitors all Docker containers (health, restarts, logs)
  - Watches EC2 metrics (CPU, RAM, disk) via Prometheus
  - Tracks Bifrost + n8n + Langfuse service health
  - Alerts WhatsApp on: service down, error spike, disk full
  - Responds to: "status", "restart n8n", "logs asterisk", "errors today"
  - Daily 8am health summary to your WhatsApp
Relationship: Hermes is YOUR infra agent. It manages the platform.
              Business Supervisor is your business agent. It manages the clients.
```

#### OpenClaw — Your Personal AI Assistant
```
Purpose:  Your personal AI assistant — research, content, tasks
Location: EC2 #1 Docker OR your laptop
Access:   WhatsApp / Telegram — you chat with it directly
What it does:
  - Research topics and summarize
  - Draft content (emails, proposals, marketing)
  - Manage your personal tasks and calendar
  - Multi-agent: Inky (research), Pinky (content creation)
  - Shared memory between agents
Relationship: OpenClaw is YOUR personal assistant.
              It does NOT touch AIOS infrastructure or client data.
              It helps YOU as a founder/operator.
```

#### How the 3 agents divide work
```
YOU (Founder)
  │
  ├── OpenClaw → "Research UAE AI market" / "Draft client proposal"
  │              Your personal productivity. No infra access.
  │
  ├── Hermes → "Is everything running?" / "Restart Frigate"
  │             AIOS infrastructure. No client business data.
  │
  └── Business Supervisor → "How many calls today?" / "Run payroll"
                            Client business operations. No infra access.
```

---

### TIER 7 — DATA & MEMORY [TEST]
```
Qdrant      EC2 #1 Docker
            Vector DB — RAG knowledge bases, SOPs, FAQs
            internal:true — no internet access

Supabase    EC2 #1 Docker
            Operational DB — agent memory, conversation history, reports

Mem0        EC2 #1 Docker
            Persistent user/customer memory across all sessions
            Connects to Supabase as backend

Redis       EC2 #1 Docker
            n8n queue + session context + short-term memory

MinIO       EC2 #1 Docker
            Self-hosted S3 — documents, recordings, snapshots

NAS         NOT USED in test — all storage on EBS gp3 volumes

AWS S3      Cloud storage
            Nightly backup — Postgres + Qdrant + n8n exports
            Backup target only (not primary storage)
```

---

### TIER 8 — INTEGRATIONS & FOSS APPS

#### Docker Layer A — FOSS Business Apps (EC2 #2)
```
Odoo              Full ERP — inventory, accounting, HR, CRM
ERPNext / Frappe  Full ERP + Hospital, Hotel, Restaurant, Manufacturing,
                  LMS, Education, HR modules
Twenty CRM        Modern open-source Salesforce alternative
SuiteCRM          Full enterprise CRM
Calcom            Open-source booking + appointment scheduling
Paperless-ngx     Document management — OCR, tagging, archiving
Docuseal          FOSS e-signing — contracts
Planka            Project management
Rocket.Chat       Team communication (Slack alternative)
Frappe LMS        Learning management — courses, certificates
GnuCash           Lightweight accounting (small firms)
Metabase          Client-facing business dashboards (primary)
```

#### Industry-Specific Deployments
```
Clinic / Healthcare   ERPNext Hospital
Real Estate           Twenty CRM + Calcom + Docuseal
Retail / Pharmacy     ERPNext POS + Inventory
Restaurant            ERPNext POS + Frappe Restaurant
Hotel                 ERPNext Hotel
Academy               Frappe LMS + ERPNext Education
Legal / Accounting    Paperless-ngx + Docuseal + GnuCash
Manufacturing         ERPNext Manufacturing
NGO / Government      ERPNext + Paperless-ngx
HR & Payroll          ERPNext HR Module
```

#### External Integrations (via n8n + Central MCP)
```
WhatsApp Business API  Meta webhook → n8n
Twilio                 SMS alerts, voice backup, OTPs
Google Calendar        OAuth → n8n (appointment booking)
Microsoft 365          OAuth → n8n (enterprise clients)
JazzCash / EasyPaisa   REST API (Pakistan payments)
Stripe                 REST API (UAE / US payments)
Facebook / Instagram   Meta API (social media + lead ads)
ZKTeco                 SDK/API (biometric attendance)
Apollo.io              REST API (B2B lead enrichment)
```

---

### TIER 9 — DASHBOARDS & ANALYTICS [TEST]

#### SysOps Dashboard (your team — Grafana as primary)
```
Dashy           Navigation homepage — single URL, all tools + agents + use-cases
Grafana         Single pane of glass — infra + LLM + business metrics
Prometheus      Raw metrics — CPU, RAM, disk, network
Loki            Centralised logs — all containers searchable from Grafana
Dozzle          Real-time Docker log viewer
Uptime Kuma     Service uptime — WhatsApp alerts on failure
Portainer       Docker container management UI
Langfuse        LLM observability — cost, latency, quality
Bifrost dash    LLM costs, cache rate, routing decisions
n8n dashboard   All workflows, execution history, error logs
Paperclip admin All agent companies, budgets, heartbeats, audit
CrowdSec        Threat intelligence, blocked IPs, attack patterns
Keycloak admin  All users, login attempts, access audit
Issabel         Call recordings, duration, queue stats, IVR
MinIO console   Storage objects, buckets, usage
```

#### Functional Dashboard (clients — Metabase as primary)
```
Metabase              PRIMARY — business KPIs, ROI data, per-client isolated
React + Supabase      Custom white-label client portal
n8n reporting agents  Auto daily/weekly reports → WhatsApp/email
Grafana (client org)  For tech-savvy clients — their own organisation
Paperclip console     Optional advanced clients — agents, budgets, tasks
```

---

### TIER 10 — SYSOPS, CI/CD & OBSERVABILITY [TEST]
```
ArgoCD          EC2 #1 Docker    GitOps CD — push → auto-deploy
Watchtower      EC2 #1 Docker    Auto-updates containers on new images
Trivy           EC2 #1 Docker    Container security scanning
GitHub Actions  GitHub-hosted    CI — validates every push (quality gates)
                                 No self-hosted runner needed for test
Ansible         Local dev PC     Server setup + disaster recovery playbooks
Automated backup EC2 #1          Nightly: pg_dump + Qdrant + n8n → S3
```

---

## 5. CLOUD ARCHITECTURE — ALL ON AWS [TEST]

### Zone 1 — AWS Primary (all workloads on EC2)
```
All services run on 2 EC2 instances in a single AWS region.
No on-prem servers. Office IP phones + cameras connect over internet.

EC2 #1 (AI Stack):  Bifrost, n8n, Qdrant, Supabase, Redis, Mem0, MinIO,
                    Langfuse, Asterisk, Dograh, Frigate, Grafana stack
EC2 #2 (FOSS Apps): Odoo, ERPNext, Twenty CRM, Keycloak, Vault, Metabase,
                    Paperclip, Issabel, Central MCP Server
```

### AWS Services Used
```
S3              Nightly backup — Postgres, Qdrant, n8n exports
CloudFront      CDN for Dashy, Metabase portals
SES             Transactional emails — reports, alerts
EC2             Primary compute (2 instances)
Security Groups Network firewall (replaces OPNsense)
EBS gp3         Block storage for both EC2s
```

### External Cloud APIs (via Bifrost → OpenRouter)
```
OpenRouter (primary)   Pay-per-token  300+ models, Mistral/Llama/Qwen/Claude/GPT
Deepgram Nova 3        $0.0077/min    STT — best Urdu/Arabic accuracy
ElevenLabs             $22/mo         TTS — natural voice (optional premium)
Meta WhatsApp          $0.015/conv    WhatsApp Business API
Twilio                 Per msg/min    SMS + voice backup
```

### What Runs Where
```
IN AWS (EC2):
  ALL services — data, AI, voice, vision, apps, monitoring
  All client data (Supabase, Qdrant, MinIO)
  All agent orchestration (n8n, Paperclip)
  Voice AI (Asterisk, Dograh, Issabel)
  Visual AI (Frigate, go2rtc)
  FOSS business apps

ON PREM (office):
  IP phones — SIP registration to Asterisk on EC2 #1
  IP cameras — RTSP streams to Frigate on EC2 #1
  That's it. No servers at the office.

GOES TO EXTERNAL APIS:
  LLM inference requests (via Bifrost → OpenRouter)
  STT audio (Deepgram — optional premium)
  Encrypted backups (S3)
  Email delivery (SES)
```

---

## 6. CAPABILITIES LAYER

Capabilities are reusable n8n sub-workflow templates.
Built AFTER Systems 1 and 2 are working — NOT before.
Location: `/aios/n8n/workflow-templates/capabilities/cap-[name].json`
Rule: Zero client hardcoding — all client data passed as variables.

```
Extract these naturally after building System 1 + 2:
  cap-multilingual.json         → language detection + translation
  cap-intent-detection.json     → what does user want
  cap-appointment-booking.json  → check availability + book
  cap-rag-search.json           → Qdrant semantic search
  cap-memory-rw.json            → Mem0 read + write
  cap-proactive-notifications.json → WhatsApp/SMS alerts
  cap-agent-escalation.json     → seamless human handoff
  cap-document-processing.json  → LLaVA invoice/doc reading
  cap-wiki-write.json           → Phase 2: agent learns from interaction
  cap-wiki-consolidate.json     → Phase 2: weekly knowledge synthesis
```

---

## 7. USE CASES — TOP LAYER

5 full AI business systems. Build in this order.
Each = n8n main workflow + Qdrant + Keycloak + Bifrost key + Langfuse + Paperclip company.
New client onboarding = 1-2 hours via new-client.py.

See AIOS_USECASES.md for full technical specs per system.

```
#   System                    Setup      Monthly   Build Time  Start
────────────────────────────────────────────────────────────────────
1   AI HRMS + Attendance      PKR 90K    PKR 30K   5-7 days    First
2   AI Call Centre (In+Out)   PKR 100K   PKR 35K   5-7 days    Second
3   AI Customer Experience    PKR 85K    PKR 28K   4-5 days    Third
4   AI Finance & Accounting   PKR 80K    PKR 28K   5-6 days    Fourth
5   AI Marketing & Sales      PKR 120K   PKR 40K   7-10 days   Last
```

Bundle offers:
```
Starter:          System 3+2          PKR 150K setup / PKR 55K/mo
Business:         System 2+1+4        PKR 220K setup / PKR 85K/mo
Full Transform:   All 5 systems       PKR 350K setup / PKR 130K/mo
UAE pricing:      3-4× Pakistan rates
```

---

## 8. QA FRAMEWORK — PRODUCTION GRADE

```
Layer 1 — Golden datasets (before deploying any system):
  50 test conversations per system
  Expected input → expected output
  Run via pytest against n8n webhook endpoint
  Must pass 90%+ before any real client interaction
  Store in /aios/tests/[system]-golden.json

Layer 2 — CI gate (every git push):
  GitHub Actions (GitHub-hosted runner)
  Runs golden dataset + latency assertions + Trivy scan
  BLOCKS ArgoCD deployment if any test fails

Layer 3 — Production monitoring (after live):
  Langfuse: every LLM call quality scored
  Alert to your WhatsApp if:
    Error rate > 5%
    Latency > 3 seconds (WhatsApp) or > 1.5 sec (voice)
    Cost spike detected
    Agent wrong 3 times in a row

Layer 4 — Regression testing (every prompt change):
  Langfuse compares old vs new prompt on golden dataset
  Blocks deployment if quality drops
  Prevents silent regressions from prompt changes
```

Latency targets (test — cloud LLM adds network overhead):
```
WhatsApp reply:      < 4 seconds   (Bifrost → OpenRouter + Bifrost cache)
Voice response:      < 3 seconds   (RTP over internet + OpenRouter LLM)
FAQ cached:          < 1.5 seconds (Bifrost semantic cache — closest to 1s)
Appointment booking: < 6 seconds   (OpenRouter LLM + ERPNext API)
Invoice processing:  < 12 seconds  (GPT-4o vision + ERPNext post)
Lead qualification:  < 7 seconds   (OpenRouter LLM + CRM)
Dashboard load:      < 2 seconds   (CloudFront CDN)
Note: Latency higher than original on-prem targets due to cloud LLM.
      Acceptable for test. Edge node added in production if needed.
```

---

## 9. DATA FLOWS

### WhatsApp Agent — Complete Lifecycle [TEST]
```
Client sends WhatsApp
→ Meta webhook → Cloudflare → AWS SG → Traefik → CrowdSec
→ Keycloak (tenant validated)
→ n8n main workflow (client-specific)
→ Bifrost guardrails (prompt injection + PII scan)
→ Mem0 (fetch user memory)
→ Qdrant RAG (semantic search client knowledge)
→ Langfuse (pull versioned system prompt)
→ Bifrost semantic cache check (hit → return immediately)
→ Bifrost routes → OpenRouter (Mistral/Llama/Qwen) OR Claude API
→ Mem0 write (update user memory)
→ Langfuse logs (cost + latency + quality score)
→ n8n formats reply → WhatsApp API → client
Total: under 4 seconds
```

### Voice Call — Complete Lifecycle [TEST]
```
Office IP phone → SIP over internet → Asterisk (EC2 #1)
→ Dograh (voice agent orchestration)
→ Whisper STT (CPU) OR Deepgram (cloud — Urdu premium)
→ n8n webhook → same pipeline as WhatsApp above
→ Bifrost → OpenRouter / Claude → response text
→ Dograh TTS (Kokoro CPU OR ElevenLabs cloud)
→ Audio back to office IP phone via RTP over internet
Voice total: under 3 seconds (RTP latency + cloud LLM)
```

### Visual AI — Camera Event [TEST]
```
Office IP Camera → RTSP over internet → go2rtc → Frigate → YOLOv8 CPU (detect)
→ MQTT → n8n → Bifrost → GPT-4o (describe event)
→ WhatsApp alert + Supabase log
```

### Knowledge Ingestion
```
Admin uploads .md / PDF / SOP
→ Supabase Storage → n8n ingestion workflow
→ LlamaIndex chunks → nomic-embed-text vectors
→ Qdrant stores in {client_id}-knowledge collection
Agent has access immediately. Zero restart.
```

### Nightly Backup [TEST]
```
Cron 2:00 AM → n8n workflow on EC2 #1
→ pg_dump Supabase → compressed → encrypted → S3
→ Qdrant snapshot → S3
→ n8n workflow export → S3
→ MinIO sync → S3
→ Success notification → WhatsApp
```

---

## 10. PROTOCOLS & STANDARDS [TEST]
```
MCP           Anthropic    Standardised tool connections (all agents)
A2A           Google       Agent-to-agent communication
OpenTelemetry CNCF         Distributed tracing
OAuth2/OIDC   Standard     All auth via Keycloak
OpenAI API    De facto     Bifrost + OpenRouter expose this — any client works
MQTT          IoT          Frigate event bus to n8n
SIP           Telecoms     Office IP phones ↔ Asterisk (over internet)
RTSP          Camera       Office IP cameras → go2rtc (over internet)
AX            Design       Agent Experience — all FOSS apps have REST APIs,
                           Claude computer-use for legacy software without API
```

---

## 11. DEVELOPMENT LAYER — COMPLETE STACK

### Architecture Type
AIOS is infrastructure development:
Building Docker Compose, n8n workflows (JSON), YAML configs,
Python scripts, Ansible playbooks, shell scripts.
NOT building: React apps, Express APIs, mobile apps.

### The 7 Non-Negotiable Dev Tools [TEST]
```
1. Claude Code
   Role: Primary AI dev tool — reads AGENTS.md + PROJECT.md,
         writes + executes everything. Runs locally or SSH to EC2.
   Cannot replace with: Nothing

2. Git + GitHub
   Role: Version control for ALL configs, workflows, scripts
         Every change tracked. Full history. Rollback anytime.
   Cannot replace with: Nothing

3. Hermes Agent (EC2 #1 Docker)
   Role: Autonomous 24/7 DevOps — monitors, restarts, alerts
         Talks to you via Telegram/WhatsApp
   Cannot replace with: Nothing

4. OpenClaw (EC2 #1 Docker or laptop)
   Role: Your personal AI assistant — research, content, tasks
         WhatsApp/Telegram interface. Multi-agent (Inky, Pinky)
   Cannot replace with: Nothing

5. ArgoCD (EC2 #1 Docker)
   Role: GitOps CD — watches GitHub, auto-deploys to Docker
         Push to GitHub → deployed automatically
   Cannot replace with: Nothing

6. Ansible (your dev PC)
   Role: Server setup + disaster recovery — runs UNATTENDED
   Cannot replace with: Claude Code (needs you present)

7. GitHub Actions (GitHub-hosted)
   Role: CI on every push — golden dataset + Trivy
   Cannot replace with: Nothing
```

### Your Dev PC — What to Install
```
VS Code                    → edit files locally or via Remote SSH
Claude Code                → primary AI dev tool
Git + GitHub CLI           → version control
Python 3                   → run scripts locally
Bruno (API testing)        → test webhooks, Bifrost, n8n endpoints
Browser                    → all dashboards via EC2 public DNS / Cloudflare
```

### Ansible Playbooks Structure [TEST]
```
/aios/ansible/
├── inventory.yml           EC2 #1 + EC2 #2 IPs
├── setup-ec2.yml           Full EC2 setup (Ubuntu → Docker → AIOS stack)
├── deploy-stack.yml        Deploy/update docker-compose services
├── disaster-recovery.yml   Restore from S3 backups
└── /roles/
    ├── docker/             Install Docker + Docker Compose
    ├── aios-directories/   Create /aios/ folder structure
    └── ec2-setup/          EC2-specific config (Security Groups, EBS)
```

### Git Branching Strategy
```
main      → production (ArgoCD deploys from here)
dev       → staging (test before promoting)
feature/* → new capabilities, new configs

Push feature → GitHub Actions CI validates
PR to dev → team reviews → test
PR dev to main → ArgoCD deploys to production
Issue → ArgoCD one-click rollback
```

### Agent Building Method — Overpowered
```
Step 1: Describe agent to Claude Code in plain English
        Include: trigger, steps, tools, output, file path

Step 2: Claude Code reads CLAUDE.md + PROJECT.md
        Knows full architecture automatically
        Picks correct tool: n8n / LangGraph / CrewAI

Step 3: Claude Code builds on dev PC
        Writes workflow, deploys to EC2 via SSH or Git push, tests, fixes errors

Step 4: You test with real interactions
        Check Langfuse. Tell Claude Code what broke. It fixes.

TOOL SELECTION (Claude Code follows this):
  n8n        → trigger + steps + integrations (80% of workflows)
  LangGraph  → complex reasoning with loops + retries
  CrewAI     → multiple specialist agents on one task
  LangChain  → custom Python logic (last resort only)
```

### Directory Structure [TEST]
```
/aios/
├── AGENTS.md                        ← AIOS reads automatically
├── docker-compose-aios.yml          ← AI core services (EC2 #1)
├── docker-compose-apps.yml          ← FOSS business apps (EC2 #2)
├── .env.aios                        ← AI core env vars (from Vault)
├── .env.apps                        ← Apps env vars (from Vault)
├── /ansible/
│   ├── inventory.yml
│   ├── setup-ec2.yml
│   ├── deploy-stack.yml
│   └── /roles/
├── /configs/
│   ├── /traefik/
│   ├── /crowdsec/
│   ├── /keycloak/
│   ├── /bifrost/
│   ├── /dograh/
│   └── /grafana/
├── /n8n/
│   ├── /workflow-templates/
│   │   ├── /capabilities/           ← cap-*.json (extracted after System 1+2)
│   │   └── /use-case-templates/     ← template-*-main.json (12 use cases)
│   └── /clients/                    ← deployed client workflows
├── /langfuse/
│   └── /prompts/                    ← versioned agent prompts
├── /clients/
│   └── /[client-id]/                ← per-client configs + knowledge docs
├── /tests/
│   └── /[system]-golden.json        ← QA golden datasets per system
├── /scripts/
│   ├── new-client.py
│   ├── backup.py
│   ├── health-check.py
│   └── disaster-recovery.py
└── /docs/
    ├── PROJECT.md                   ← this file
    ├── AGENTS.md                    ← AIOS instructions
    ├── AIOS_USECASES.md             ← 5 systems testing guide
    └── /capabilities/               ← one .md per capability
```

---

## 12. CRITICAL DEVELOPMENT RULES

```
1. ALL LLM calls → Bifrost ONLY
   Never call Anthropic, OpenAI, or any LLM API directly.
   Bifrost = cost tracking, caching, failover, client billing.

2. ALL voice → Dograh + Asterisk ONLY
   Never use Retell AI or Vapi. Dograh is self-hosted FOSS.
   Dograh MCP → Claude Code builds voice agents directly.

3. NO hardcoded secrets ANYWHERE
   All secrets in HashiCorp Vault. Injected via .env at runtime.

4. ALL n8n workflows tagged with client_id
   Cross-client data leakage is a critical security failure.

5. ALL capability sub-workflows — ZERO client hardcoding
   All client data passed as variables from main workflow.

6. ALWAYS enforce Supabase RLS on every table
   Schema per client + Row Level Security = double isolation.

7. ALWAYS log every LLM call to Langfuse
   This is how per-client billing is calculated.

8. Data Zone has internal:true — NEVER change this
   Databases cannot reach internet regardless of misconfiguration.

9. ALL new client resources via new-client.py ONLY
   Never create Keycloak/Qdrant/Supabase/Bifrost manually.
   Manual = inconsistent = mess at 60 clients.

10. ALWAYS commit to Git before any production change
    No direct edits on EC2 without Git commit first.

11. ADD input + output guardrail nodes to EVERY workflow
    Before Bifrost: validate input, check injection patterns.
    After LLM: validate output quality, strip PII, handle empty.
```

---

## 13. CLIENT DEPLOYMENT — WHAT CHANGES

### What Stays in Your Dev Environment (never goes to client)
```
Claude Code (your instance),
Paperclip internal companies (Infrastructure/Product/Founder),
ArgoCD (your management view)
```

### What Goes to Client Deployment
```
All Tiers 1-10, all FOSS apps relevant to their industry,
Paperclip (their company only — business agents only),
Metabase dashboards, all monitoring, Dograh voice stack
```

### 10-Step Client Onboarding (1-2 hours total)
```
1. python3 /aios/scripts/new-client.py [args]  ← automated (10-12 min)
   Creates: Keycloak tenant, Qdrant collection, Supabase schema,
            Bifrost virtual key + budget, Paperclip company,
            Langfuse project, n8n workflow from template,
            Dograh voice agent (via MCP), Asterisk SIP extension,
            WhatsApp webhook, AWS S3 bucket

2. Fill system prompt in Langfuse              (15-20 min manual)
3. Upload client knowledge docs → Qdrant       (20-30 min manual)
4. Test end-to-end + sign off                  (15 min manual)
Total: ~1 hour
```

### New Client Form Fields
```
client_id, client_name, industry, contact_name, contact_phone
primary_language (urdu/arabic/english), region, timezone
preferred_model, monthly_budget, agent_name, agent_personality
capabilities selected (checkboxes for all 20 capabilities)
whatsapp_number, voice_number, web_chat (true/false)
erp_type, erp_url, erp_api_key
calendar_type, calendar_id
crm_type, payment_gateway
create_s3_backup, create_cloudfront
```

---

## 14. PHASES & SCALE

### Phase 1 — Test (45 days)
```
Infrastructure:  2 EC2 instances set up, all Docker stacks running
5 Systems:       Build + test with office phones + cameras
Kubernetes:      NO — Docker Compose only
Team:            Senior AI Engineer + Voice Dev + Full-Stack Dev + QA/DevOps
```

### Phase 2 — First Clients (Month 3-6)
```
Clients:         3 → 18 → 40
Revenue:         PKR 197K → 582K/month
UAE prep:        Arabic/English bilingual agents
Add:             Postgres replica, feature flags, Arize Phoenix
```

### Phase 3 — Scale (Month 7+)
```
Break-even:      Month 7 (25 clients)
Month 12:        60 clients, PKR 940K MRR
UAE entry:       Month 9-12 (government mandate = forced demand)
US/Canada:       Month 12-18 (white-label partnerships)
Kubernetes:      Add K3s when 100+ clients need auto-scaling
HA:              3rd physical machine for true failover
LLM Wiki:        Full implementation with real client data
Central Dashboard: Unified React portal (v2)
```

### Honest — What Is NOT There Yet
```
True HA:              Not yet → Phase 3 (3rd machine)
Auto-scaling:         Not yet → Phase 3 (K3s)
LLM Wiki:             Not yet → Phase 2 after real usage data
Central dashboard:    Not yet → Phase 2 after testing reveals needs
Full SOC2:            Partial → audit logs present
Multi-region:         Not yet → Phase 3 (UAE data centre)
```

---

## 15. MARKET CONTEXT
```
Pakistan (now):  Direct sales. Clinics, HR, real estate, pharmacies.
                 27-point gap: 7% SMBs with AI vs 34% enterprises.
                 93 out of 100 SMBs have NO AI agents.

UAE (Month 9-12): Government mandate: 50% federal services to agentic AI.
                  April 23, 2026. Forced demand. 3-4× Pakistan pricing.

US/Canada:       Month 12-18. White-label partnerships.
                 Supply US/Canada agencies with vertical SMB products.
                 No direct sales team needed initially.

Key stat:        $52.62B AI agent market by 2030 at 46.3% CAGR
                 SMBs pay $1,500/mo for basic chatbots today.
                 You deliver 10× value at same price with full systems.
```

---

## 16. CAPABILITIES — TECHNICAL REFERENCE

See Section 6 above for full list.
Capabilities are n8n sub-workflow templates — extracted AFTER
building System 1 + 2, not built upfront.

Capability template structure:
```
INPUT:  variables from main workflow (client_id, collection_id, model, etc.)
NODES:  business logic using Tier 3-8 tools
OUTPUT: result JSON returned to main workflow
RULE:   ZERO client hardcoding — everything as variables
```

---

## 17. NEW CLIENT ONBOARDING — AUTOMATION

Script: `/aios/scripts/new-client.py`

Automated (10-12 min):
```
✅ Keycloak Organization created
✅ Qdrant collection created ({client_id}-knowledge)
✅ Supabase schema + RLS policies
✅ Bifrost virtual key + budget limit
✅ Paperclip company + agents
✅ Langfuse project (empty prompt template)
✅ n8n workflow cloned from industry template
✅ All variables filled from form fields
✅ Selected capabilities enabled/disabled
✅ Dograh voice agent created via MCP
✅ Asterisk SIP extension created
✅ WhatsApp webhook registered
✅ AWS S3 bucket (if selected)
✅ CloudFront distribution (if selected)
```

Manual (45 min):
```
❌ System prompt content in Langfuse (needs real client info)
❌ Knowledge base documents uploaded to Qdrant
❌ End-to-end test call + WhatsApp test
```

---

## 18. QUICK REFERENCE — ALL TOOLS [TEST]

### By Machine
```
EC2 #1 (AI):       Traefik, CrowdSec, Bifrost, n8n+worker,
                   Asterisk, Dograh, MQTT, Frigate, go2rtc,
                   Mem0, Langfuse, Qdrant, Supabase, Redis, MinIO,
                   Whisper STT, Kokoro TTS, Grafana, Prometheus,
                   Loki, Portainer, Dashy, Uptime Kuma, Dozzle,
                   ArgoCD, Watchtower, Trivy, Open WebUI,
                   LangGraph, CrewAI

EC2 #2 (Apps):     Odoo, ERPNext/Frappe, Twenty CRM, SuiteCRM,
                   Calcom, Paperless-ngx, Docuseal, Planka,
                   Rocket.Chat, Frappe LMS, GnuCash, Metabase,
                   Keycloak, Vault, Paperclip, Issabel,
                   Central MCP Server

Dev PC:            VS Code, Claude Code, Git, Python 3, Bruno,
                   Ansible

Cloud APIs:        OpenRouter (primary), Deepgram, ElevenLabs,
                   Meta WhatsApp, Twilio, AWS (S3, SES, CloudFront)
```

### Service Ports Quick Reference
```
Service         Port          EC2         Notes
────────────────────────────────────────────────────────────
Traefik         443 (HTTPS)   EC2 #1      Public — via Cloudflare
Bifrost         :4000         EC2 #1      Internal Docker network
n8n             :5678         EC2 #1      Internal — via Traefik
Qdrant          :6333         EC2 #1      Internal data-net only
Supabase        :8000         EC2 #1      Internal data-net only
Redis           :6379         EC2 #1      Internal data-net only
MinIO           :9000         EC2 #1      Internal data-net only
Langfuse        :3000         EC2 #1      Internal — via Traefik
Grafana         :3000         EC2 #1      Internal — via Traefik
Portainer       :9000         EC2 #1      Internal — via Traefik
Dashy           :80           EC2 #1      Public — via Traefik
Prometheus      :9090         EC2 #1      Internal monitoring
Keycloak        :8080         EC2 #2      Internal — via Traefik on EC2 #1
Vault           :8200         EC2 #2      Internal app-net only
Asterisk        5060 (SIP)    EC2 #1      Public — office IP only via SG
Dograh          :3010         EC2 #1      Internal voice-net only
MQTT            :1883         EC2 #1      Internal voice-net only
Frigate         :5000         EC2 #1      Internal vision-net only
go2rtc          :8554 (RTSP)  EC2 #1      Public — office IP only via SG
OpenRouter      API           Cloud       Bifrost → OpenRouter API
Deepgram        API           Cloud       STT — optional premium
ElevenLabs      API           Cloud       TTS — optional premium
```

---

*AIOS PROJECT.md — Test Deployment Reference*
*Version: v2.0-test · May 2026 · Lahore AI Lab*
*Updated for cloud-only test on 2 AWS EC2 instances.*
*On-prem only: IP phones + IP cameras. All servers in AWS.*
*Original physical-lab architecture preserved in git history.*
