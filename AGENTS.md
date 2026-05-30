# AIOS — OpenCode Project Instructions
## Auto-read by OpenCode on every session start (AGENTS.md)
### TEST AIOS — Cloud-only on AWS EC2

> **CURRENT TEST DEPLOYMENT: 2 AWS EC2 instances. No on-prem servers.**
> Office only has IP phones + IP cameras connecting over internet.
> See PROJECT.md for full architecture. This file provides quick-reference
> instructions for AIOS during this session.

## OPENCODE CONFIGURATION

Point OpenCode to your Bifrost gateway (on EC2 #1):
```json
{
  "$schema": "https://opencode.ai/config.json",
  "model": "openai/qwen-2.5-72b",
  "instructions": ["AGENTS.md"],
  "providers": {
    "openai": {
      "baseURL": "http://[ec2-1-public-dns]:4000",
      "apiKey": "your-bifrost-key"
    }
  }
}
```
Config file: ~/.config/opencode/opencode.json
This routes ALL OpenCode LLM calls through your Bifrost gateway on EC2 #1.
Bifrost routes to OpenRouter (primary) / Claude API (fallback).

---
## WHO YOU ARE WORKING WITH

Senior IT infrastructure specialist (20+ years). Building a production-grade
AI agency platform in Lahore, Pakistan. This is NOT a hobby project.
Every decision must be production-quality, state-of-the-art, and scalable.

---

## WHAT THIS PROJECT IS

AIOS (AI Operating System) — a self-hosted hybrid AI platform that:
1. Runs in a physical lab (2 machines in Lahore)
2. Serves as template for client deployments
3. Powers an AI agency selling AI Digital Employees to SMBs
4. Scales to UAE and USA markets

Read /aios/docs/PROJECT.md for complete architecture.
Every architectural decision is documented there. Read it before making changes.

---

## CLOUD MACHINES — TEST AIOS

```
EC2 #1 (AI Stack)
  OS: Ubuntu 24.04 LTS
  Type: t3.xlarge (4 vCPU / 16GB RAM)
  Runs: Docker — Bifrost, n8n, Asterisk, Dograh, Frigate,
        Qdrant, Supabase, Redis, Mem0, Langfuse, Grafana stack
  Public: YES — port 443 via Cloudflare + AWS SG + Traefik
          Port 5060 (SIP) restricted to office IP
          Port 8554 (RTSP) restricted to office IP

EC2 #2 (FOSS Apps)
  OS: Ubuntu 24.04 LTS
  Type: t3.large (2 vCPU / 8GB RAM)
  Runs: Docker — Odoo, ERPNext, Twenty CRM, Metabase,
        Keycloak, Vault, Paperclip, Issabel, Central MCP Server
  Public: NO — internal to VPC, accessed via EC2 #1 reverse proxy
```

---

## DIRECTORY STRUCTURE (REPOSITORY)

```
/aios/
├── CLAUDE.md                        # This file
├── docker-compose-aios.yml          # AI core services
├── docker-compose-apps.yml          # FOSS business apps
├── .env.aios                        # AI core secrets (from Vault)
├── .env.apps                        # Apps secrets (from Vault)
├── /ansible/                        # Server setup playbooks
│   ├── inventory.yml
│   ├── setup-ec2-1.yml
│   ├── setup-ec2-2.yml
│   └── /roles/
├── /configs/
│   ├── /traefik/
│   ├── /crowdsec/
│   ├── /keycloak/
│   ├── /bifrost/
│   └── /grafana/
├── /n8n/
│   ├── /workflow-templates/
│   │   ├── /capabilities/           # 20 cap-*.json sub-workflows
│   │   └── /use-case-templates/     # 12 template-*-main.json
│   ├── /clients/                    # Deployed per-client workflows
│   └── /internal/                   # Internal lab workflows
├── /langfuse/
│   └── /prompts/
├── /clients/
│   └── /[client-id]/
├── /scripts/
│   ├── new-client.py
│   ├── backup.py
│   ├── health-check.py
│   └── disaster-recovery.py
└── /docs/
    ├── PROJECT.md
    ├── AGENTS.md
    ├── AIOS_USECASES.md
    └── /capabilities/
```

---

## DOCKER NETWORK ZONES — NEVER BREAK THESE

```
10.10.0.0/24  DMZ Zone         Traefik only — public-facing
10.20.0.0/24  Application Zone n8n, Flowise, Keycloak, Vault
10.30.0.0/24  Data Zone        Supabase, Qdrant, Redis, MinIO
                                internal:true — NO internet access EVER
10.40.0.0/24  AI Zone          Bifrost, Ollama(dev), LiteLLM(dev)
10.50.0.0/24  Voice Zone       Asterisk, MQTT
10.60.0.0/24  Monitoring Zone  Langfuse, Prometheus, Grafana, Loki
10.70.0.0/24  Cross-machine    WireGuard: office ↔ EC2 #1 (SIP + RTSP tunnel)
```

---

## SERVICE PORTS — QUICK REFERENCE

```
Bifrost:    http://10.40.0.10:4000  (AI Gateway — ALL LLM calls go here)
n8n:        http://10.20.0.10:5678
Qdrant:     http://10.30.0.20:6333
Supabase:   http://10.30.0.10:8000
Redis:      redis://10.30.0.30:6379
MinIO:      http://10.30.0.40:9000
Langfuse:   http://10.60.0.10:3000
Grafana:    http://10.60.0.30:3000
Portainer:  http://10.60.0.50:9000
Dashy:      http://10.60.0.70:80
Prometheus: http://10.60.0.20:9090
Keycloak:   http://10.20.0.40:8080
Vault:      http://10.20.0.50:8200
Traefik:    http://10.10.0.10:80 / 443 (public)
Asterisk:   http://10.50.0.10 (SIP)
MQTT:       http://10.50.0.20:1883
Ollama:     http://10.40.0.20:11434 (dev only)
```

---

## ABSOLUTE RULES — NEVER VIOLATE

### Rule 1: ALL LLM calls go through Bifrost
```python
# WRONG — never do this
import anthropic
client = anthropic.Anthropic(api_key="sk-...")

# CORRECT — always do this
import requests
response = requests.post(
    "http://10.40.0.10:4000/v1/chat/completions",
    headers={"Authorization": f"Bearer {client_virtual_key}"},
    json={"model": "qwen-2.5-72b", "messages": [...]}
)
```

### Rule 2: NO hardcoded secrets
```bash
# WRONG
ANTHROPIC_API_KEY=sk-ant-xxxxx

# CORRECT — always from Vault or .env
ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}  # injected from Vault
```

### Rule 3: Data Zone has internal:true — never remove this
```yaml
# In docker-compose-aios.yml — DO NOT CHANGE
networks:
  data-zone:
    internal: true  # Databases CANNOT reach internet
```

### Rule 4: All client resources via new-client.py only
```bash
# CORRECT
python3 /aios/scripts/new-client.py --client-id clinic-abc --industry clinic

# NEVER create Keycloak/Qdrant/Supabase/Bifrost resources manually
```

### Rule 5: Git before production
```bash
# ALWAYS commit before any production change
git add . && git commit -m "description" && git push
# ArgoCD deploys automatically after push
```

### Rule 6: n8n workflows — ALL client data as variables
```json
// WRONG — hardcoded client
{"collection_id": "clinic-abc-knowledge"}

// CORRECT — variable from Node 2
{"collection_id": "{{$node.SetVariables.json.collection_id}}"}
```

### Rule 7: Always enforce Supabase RLS
```sql
-- Every table must have this
ALTER TABLE [table_name] ENABLE ROW LEVEL SECURITY;
ALTER TABLE [table_name] FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON [table_name]
  USING (schema_name = current_setting('app.tenant_id'));
```

---

## MULTI-TENANT ISOLATION — HOW IT WORKS

Each SMB client is completely isolated across all layers:

```
Keycloak:  One Organization per client (Keycloak 26 Organizations feature)
Qdrant:    One collection per client — named {client_id}-knowledge
Supabase:  One schema per client — named {client_id} with RLS enforced
Bifrost:   One virtual key per client — with monthly budget limit
n8n:       One main workflow per client — tagged with client_id
Langfuse:  One project per client — for cost tracking + prompts
Paperclip: One company per client — agents, budgets, org chart
```

---

## CAPABILITY ARCHITECTURE — CRITICAL UNDERSTANDING

```
CAPABILITY  = Reusable n8n sub-workflow (no client hardcoding)
              Location: /aios/n8n/workflow-templates/capabilities/
              Named: cap-[name].json
              All client data = variables passed from main workflow

MAIN WORKFLOW = Client-specific orchestrator
              Location: /aios/n8n/workflow-templates/use-case-templates/
              Named: template-[industry]-main.json
              Cloned per client to: /aios/n8n/clients/[client-id]/

AGENT       = Paperclip company entry + Langfuse prompt + n8n workflow
              Paperclip manages goals, budget, heartbeat
              Langfuse stores versioned system prompt
              n8n executes the actual workflow logic
```

---

## DEVOPS STACK — WHAT DOES WHAT

```
Claude Code Desktop SSH  → Primary dev tool. SSH to EC2. Writes + executes everything.
Git + GitHub             → Version control. Source of truth for all configs.
GitHub Actions           → CI. Validates every push before ArgoCD deploys.
ArgoCD (on EC2 #1)       → CD. Auto-deploys GitHub changes to Docker stack.
Ansible (/aios/ansible/) → Server setup + disaster recovery. Run once per machine.
```

---

## HOW TO USE THIS PROJECT

### Start AIOS stack
```bash
cd /aios
docker-compose -f docker-compose-aios.yml up -d
docker-compose -f docker-compose-apps.yml up -d
```

### Deploy changes
```bash
git add . && git commit -m "your change" && git push
# ArgoCD detects and deploys automatically
```

### Onboard new client
```bash
python3 /aios/scripts/new-client.py \
  --client-id clinic-abc \
  --industry clinic \
  --language urdu \
  --model qwen-2.5-72b \
  --budget 50 \
  --agent-name Sarah \
  --whatsapp +923001234567
```

### Run Ansible setup (new server)
```bash
cd /aios/ansible
ansible-playbook -i inventory.yml setup-ec2.yml
```

### Check system health
```bash
python3 /aios/scripts/health-check.py
# Or visit the Dashy dashboard on EC2 #1
```

---

## BIFROST ROUTING REFERENCE

```
Task                          Model                  Reason
──────────────────────────────────────────────────────────────────
Simple FAQ, classification    Mistral 7B (OpenRouter) Fast + cheapest
Arabic/Urdu conversation      Qwen 2.5 72B (OpenRouter) Best multilingual
General reasoning, HR tasks   Llama 3.1 70B (OpenRouter) High quality, low cost
Complex docs, legal, long ctx Claude 4 Sonnet (Anthropic API) Frontier quality needed
Invoice/image reading         GPT-4o (OpenAI API)      Best vision model
Repeated/cached queries       Bifrost cache           No LLM call at all  
OpenRouter down/busy          Claude API (failover)   Auto-fallback via Bifrost
```

---

## IMPORTANT CONTEXT

- Founder has 20+ years IT infra experience — do not over-explain basics
- Target market: Pakistan SMBs → UAE → USA/Canada
- Phase 1: 45-day lab setup + 5 prototype use cases
- Phase 2: First clients Month 3, break-even Month 7
- Phase 3: 60 clients, PKR 940K MRR by Month 12
- This is production from Day 1 — not a prototype that gets rebuilt
- The lab IS the product template — clients get same stack minus dev tools

---

## WHEN IN DOUBT

1. Read PROJECT.md — every decision is documented there
2. Check the Docker network zone before opening any port
3. Check Langfuse before changing any prompt
4. Check Bifrost before adding any LLM call
5. Run new-client.py before creating any client resources manually
6. Commit to Git before touching production

*CLAUDE.md — AIOS Project Instructions*
*Version: Final · May 2026 · Lahore AI Lab*

---

## SESSION CHECKPOINT

Auto-resume context. Updated every session by the AI.

### Current Status
```
Phase: B — Use Cases (writing n8n workflows)
Last file completed: System 2 — AI Call Centre (7 n8n workflows)
Currently working on: System 3 — AI CX
Next after: System 4 — AI Finance
Progress: Phase A (13/13) ✅ | Phase B (2/5)
```

### Deliverables Completed
- [x] docker-compose-aios.yml — EC2 #1 AI stack (~30 services)
- [x] docker-compose-apps.yml — EC2 #2 FOSS apps
- [x] configs/traefik/
- [x] configs/crowdsec/
- [x] configs/keycloak/
- [x] configs/bifrost/
- [x] configs/asterisk/
- [x] configs/dograh/
- [x] configs/frigate/ + go2rtc/ + mosquitto/
- [x] configs/prometheus/ + loki/ + grafana/
- [x] configs/dashy/
- [x] .env.aios + .env.apps
- [x] ansible/inventory.yml + setup-ec2.yml
---
- [x] Phase B: System 1 — AI HRMS
- [x] Phase B: System 2 — AI Call Centre
- [ ] Phase B: System 3 — AI CX
- [ ] Phase B: System 4 — AI Finance
- [ ] Phase B: System 5 — AI Marketing
```
