# AIOS — Use Cases & Full System Testing Guide
## For Claude Code Reference — Lab Testing Phase
### Read PROJECT.md and CLAUDE.md first before this file

---

## CONTEXT — READ THIS FIRST

This file defines the 5 full AI business systems to build and test on top
of the AIOS infrastructure. Everything here reflects final decisions made
after full research and discussion. Do not deviate from this.

**Purpose of this phase:**
- AIOS v1 infrastructure is deployed on 2 AWS EC2 instances
- These 5 systems are the functional layer ON TOP of the infrastructure
- This is CLOUD TESTING — IP phones + cameras from office connect over internet
- One real test client per system
- Goal: Prove each system works end-to-end before scaling

**What AIOS v1 includes (infrastructure already built):**
- All Docker services running on EC2 #1 (AI Stack) + EC2 #2 (FOSS Apps)
- No local LLM — all inference via Bifrost → OpenRouter (300+ models)
- Bifrost AI gateway routing all LLM calls
- Dograh voice agent platform (replaces Retell AI — FOSS, self-hosted)
- Asterisk PBX (SIP core) + Issabel (UC management GUI on EC2 #2)
- n8n queue mode + worker
- Qdrant RAG + Mem0 persistent memory + Redis session
- Supabase + MinIO + Langfuse + Grafana + all monitoring
- Paperclip (agent management)
- Central MCP Server (all tools defined once — used by all agents)

**Critical rules for ALL systems:**
- Build full systems directly — DO NOT build capabilities separately first
- Import prebuilt templates → AIOS-ify them → test → ship
- ALL LLM calls → Bifrost ONLY — never direct to OpenRouter/Anthropic/OpenAI
- ALL voice → Dograh (self-hosted) → Asterisk → NOT Retell AI
- ALL client data as variables — NEVER hardcoded
- ADD Qdrant RAG + Mem0 + Langfuse logging to EVERY system
- ADD input/output guardrail nodes to EVERY n8n workflow
- ADD golden dataset QA tests before deploying any system
- COMMIT to Git after every working workflow — ArgoCD deploys

---

## VOICE PIPELINE — TEST AIOS [CLOUD ONLY]

All 5 systems that use voice go through this pipeline:

```
OPTION A — Cloud LLM + local STT/TTS (cheapest):
  Office IP phone → SIP → Asterisk (EC2 #1) → Dograh
  → Whisper STT (CPU, free) → Bifrost → OpenRouter (LLM)
  → Kokoro TTS (CPU, free) → Audio back to phone
  Cost: LLM tokens only (~$0.001-0.003/call)

OPTION B — Cloud everything (best quality):
  Office IP phone → SIP → Asterisk (EC2 #1) → Dograh
  → Deepgram STT (cloud, $0.0077/min) → Bifrost → OpenRouter
  → ElevenLabs TTS (cloud, premium voice)
  Cost: ~$0.01/min

DOGRAH REPLACES: Retell AI and Vapi completely
DOGRAH IS: FOSS, self-hosted on EC2 #1, MCP-native
ASTERISK: SIP core on EC2 #1 — office IP phones register remotely
ISSABEL: UC management GUI on EC2 #2 — SIP trunked to Asterisk over VPC
```

---

## AGENT BUILDING METHOD — OVERPOWERED APPROACH

Every agent in all 5 systems is built using this method:

```
Step 1: You describe the agent to Claude Code in plain English
        Include: trigger, steps, tools, output, file location

Step 2: Claude Code reads CLAUDE.md + PROJECT.md
        Knows your full architecture automatically
        Picks correct tool: n8n / LangGraph / CrewAI

Step 3: Claude Code builds it on dev PC
        Writes n8n workflow JSON or Python script
        Deploys to EC2 via Git push → ArgoCD
        Tests and fixes errors

Step 4: You test with real interactions
        Check Langfuse for cost and quality
        Tell Claude Code what broke
        It fixes it

TOOL SELECTION RULES (Claude Code follows these):
  n8n        → trigger + steps + integrations (80% of workflows)
  LangGraph  → complex reasoning with loops and retries
  CrewAI     → multiple specialist agents on one task
  LangChain  → custom Python logic only when nothing else works
```

---

## QA FRAMEWORK — APPLIED TO ALL 5 SYSTEMS

```
LAYER 1 — Golden dataset (before deploying):
  50 test conversations per system
  Expected input → expected output
  Run via pytest against n8n webhook
  Must pass 90%+ before any client sees it
  Store in /aios/tests/[system-name]-golden.json

LAYER 2 — CI gate (every code change):
  GitHub Actions (GitHub-hosted runner) runs golden dataset automatically
  Latency assertions (WhatsApp < 4s, Voice < 3s)
  Trivy security scan
  BLOCKS deployment if any test fails

LAYER 3 — Production monitoring (after live):
  Langfuse: every LLM call scored for quality
  Alert to your WhatsApp if:
    Error rate > 5%
    Latency > 3 seconds
    Cost spike detected
    Agent wrong answer 3 times in a row

LAYER 4 — Regression testing (every prompt change):
  Langfuse compares old vs new prompt on golden dataset
  Blocks if quality drops
  Prevents "I changed the prompt and broke everything"
```

---

## LATENCY TARGETS — ALL SYSTEMS [TEST]

```
WhatsApp reply:        < 4 seconds    (Bifrost → OpenRouter + cache)
Voice response:        < 3 seconds    (RTP over internet + OpenRouter)
FAQ cached answer:     < 1.5 seconds  (Bifrost semantic cache)
Appointment booking:   < 6 seconds    (OpenRouter + ERPNext API)
Invoice processing:    < 12 seconds   (GPT-4o vision + ERPNext)
Lead qualification:    < 7 seconds    (OpenRouter + CRM)
Dashboard load:        < 2 seconds    (CloudFront CDN)
Note: Higher targets due to cloud LLM. Acceptable for test.
      Edge node added in production for lower latency.
```

---

## THE 5 FULL SYSTEMS — BUILD ORDER

```
0. SUPERVISOR AGENT           ← Build after System 1 (needs real data to query)
   Channels: WhatsApp, Telegram, Web UI chat, Voice ext. 9000
   Role: Human interface to ALL systems — FAQ, reports, analysis, actions

1. AI HRMS + Attendance       ← Start here (ZKTeco everywhere in Pakistan)
2. AI Call Centre             ← Most visible demo, Dograh showcase
3. AI Customer Experience     ← Most versatile, any industry
4. AI Finance & Accounting    ← Sticky, invoice processing
5. AI Marketing & Sales       ← Most complex, build last
```

---

## SYSTEM 1 — AI HRMS + ATTENDANCE
### Full Human Resource Management System

**Test client:** Any business with 10+ employees (ZKTeco device preferred)
**Build time:** 5-7 days
**Revenue model:** PKR 90K setup + PKR 30K/mo
**Replaces:** HR manager + timekeeper (saves PKR 80-120K/mo)

---

### What This System Does

```
ATTENDANCE:
  ZKTeco biometric → n8n polls every 15 min → ERPNext attendance
  OR Frigate camera face recognition → MQTT → n8n → ERPNext
  Late/absent alerts to manager WhatsApp in real-time
  Daily attendance report at 6pm to manager

LEAVE MANAGEMENT:
  Employee WhatsApp: "I need leave tomorrow"
  AI checks balance in ERPNext → routes to manager WhatsApp
  Manager replies YES/NO → ERPNext auto-updated → employee notified

PAYROLL AUTOMATION:
  Attendance feeds into ERPNext payroll automatically
  Deductions + overtime calculated automatically
  Payslips generated and sent to employee WhatsApp
  Bank transfer file generated for owner

HR SELF-SERVICE (WhatsApp):
  Leave balance, payslip, overtime, policy queries
  All answered instantly from ERPNext + Qdrant HR policies

RECRUITMENT:
  Job posting → LinkedIn/Indeed automated
  CV screening via AI → Calcom interview scheduling
  Candidate WhatsApp communication automated
  Offer letter auto-generation

REPORTING (Metabase dashboard):
  Attendance rate, late trends, absenteeism, payroll cost
  All visible to owner in real-time
```

---

### Technical Stack

```
ATTENDANCE PIPELINE (ZKTeco):
  ZKTeco device → n8n polls ZKTeco API (every 15 min)
  → ERPNext HR attendance → calculate late/absent
  → WhatsApp alert if late/absent

ATTENDANCE PIPELINE (Camera):
  IP Camera → go2rtc → Frigate face recognition
  → MQTT → n8n → ERPNext HR → WhatsApp alert

HR SELF-SERVICE PIPELINE:
  Employee WhatsApp → n8n webhook
  → Mistral 7B via Bifrost (intent detection — fast)
  → Qdrant RAG (HR policies collection)
  → ERPNext HR API (data query/update)
  → Mem0 (remember employee history)
  → WhatsApp reply

TOOL SELECTION:
  n8n: all attendance + leave + payroll workflows
  No LangGraph or CrewAI needed — straightforward flows

FOSS APPS:
  ERPNext HR Module (primary)
  Calcom (interview scheduling)
  Paperless-ngx (employee documents)
  Metabase (HR dashboard)
```

---

### n8n Workflows to Build

```
workflow-01: zkteco-attendance-sync.json
  Cron every 15 min → pull ZKTeco → post ERPNext

workflow-02: attendance-alerts.json
  ERPNext webhook → if late/absent → WhatsApp manager

workflow-03: leave-request-handler.json
  WhatsApp → detect leave request → check balance → route manager

workflow-04: leave-approval-handler.json
  Manager reply → update ERPNext → notify employee

workflow-05: payroll-automation.json
  Cron monthly last day → attendance → calculate → payslips

workflow-06: hr-selfservice-agent.json
  WhatsApp → Bifrost Mistral → Qdrant + ERPNext → reply

workflow-07: hr-daily-report.json
  Cron 6pm → pull stats → WhatsApp to manager
```

---

### Claude Code Build Prompt

```
"Build complete AI HRMS system on AIOS.

Workflow 1: Poll ZKTeco API at {{zkteco_url}} every 15 min.
Extract attendance logs. Post to ERPNext HR at {{erp_url}}.
If employee marked late → WhatsApp alert to manager at {{manager_phone}}.

Workflow 2: WhatsApp HR self-service agent.
Trigger: n8n webhook from WhatsApp.
Detect intent: leave request / balance query / payslip / policy.
Search Qdrant collection {{collection_id}} for HR policies.
Query ERPNext HR API for employee data using employee_id from Mem0.
Read/write Mem0 for employee memory.
Reply via WhatsApp.
Log to Langfuse project {{langfuse_project}}.
All client data as variables — zero hardcoding.
Save to /aios/n8n/workflow-templates/use-case-templates/template-hr-main.json"
```

---

### Where to Get Templates

```
n8n.io/workflows → search "HR" "attendance" "leave"
Flowise marketplace → "HR policy chatbot"
ERPNext + n8n integration: n8n.io/integrations/erpnext
ZKTeco integration: discuss.frappe.io (ZKTeco ERPNext docs)
```

---

### QA Golden Dataset (50 tests minimum)

```
Test category 1 — Leave queries (15 tests):
  "What is my leave balance?" → correct number from ERPNext
  "How many sick days do I have?" → correct from ERPNext
  "Can I take leave this Friday?" → check balance + respond

Test category 2 — Leave requests (10 tests):
  "I want leave tomorrow" → creates request + notifies manager
  "Apply for 3 days next week" → correct flow end-to-end
  "Cancel my leave request" → cancels in ERPNext

Test category 3 — Payroll queries (10 tests):
  "Show me my payslip" → correct payslip from ERPNext
  "How much overtime this month?" → correct calculation
  "When is salary day?" → answers from Qdrant policy

Test category 4 — Attendance queries (10 tests):
  "How many days absent this month?" → correct from ERPNext
  "What time did I arrive today?" → correct from ZKTeco

Test category 5 — Policy queries (5 tests):
  "What is the late penalty?" → correct from Qdrant
  "How many days annual leave?" → correct from Qdrant
```

---

### Testing Checklist

```
□ ZKTeco API connecting and pulling data correctly
□ ERPNext attendance auto-updating from ZKTeco
□ Late alert fires within 5 min of late arrival
□ Employee queries leave balance correctly
□ Leave request flows employee → manager → back
□ Payslip generated with correct deductions
□ Mem0 remembers employee name from previous messages
□ Metabase showing real HR data
□ Langfuse logging all LLM calls with costs
□ Voice: employee can query by calling (Dograh + Asterisk)
□ Golden dataset 90%+ pass rate before live
□ Latency: WhatsApp reply under 3 seconds
```

---

## SYSTEM 2 — AI CALL CENTRE (Full)
### Inbound + Outbound + Analytics

**Test client:** Any business receiving 20+ calls/day
**Build time:** 5-7 days
**Revenue model:** PKR 100K setup + PKR 35K/mo
**Replaces:** 3-5 human call agents (saves PKR 150-250K/mo)

---

### What This System Does

```
INBOUND (24/7):
  All calls answered instantly via Dograh (self-hosted)
  IVR: "Press 1 appointments, 2 support, 3 complaints"
  FAQ handling via Qdrant RAG
  Appointment booking live on call
  Order/service status queries
  Complaint logging + ticket creation in ERPNext
  Intelligent escalation to human with full context
  Call recording + transcript (Issabel + Dograh)
  Post-call summary → owner WhatsApp

OUTBOUND:
  Lead follow-up within 60 seconds of form submission
  Appointment reminders 24hrs before
  Payment reminder calls for overdue invoices
  Post-service satisfaction calls
  All via Dograh outbound calling

ANALYTICS (Metabase):
  Total calls, AI resolution rate, handle time
  Peak hours, cost per call, customer satisfaction
  Daily report → owner WhatsApp 7pm
```

---

### Technical Stack

```
INBOUND PIPELINE:
  Office IP phone → SIP over internet → Asterisk (EC2 #1)
  → Issabel (logs + recording, EC2 #2)
  → Dograh (voice agent orchestration — EC2 #1)
  → Whisper STT (CPU) OR Deepgram (cloud — Urdu premium)
  → n8n webhook → Bifrost → OpenRouter (LLM)
  → Qdrant RAG + Mem0 (caller history)
  → response text → Dograh TTS (Kokoro CPU or ElevenLabs cloud)
  → Audio back to office phone via RTP over internet

OUTBOUND PIPELINE:
  n8n trigger (webhook or cron)
  → Dograh outbound call API
  → same voice pipeline as inbound
  → ERPNext/CRM update after call

DOGRAH MCP BUILD METHOD:
  Claude Code → Dograh MCP server
  → builds voice agent directly
  → no manual configuration needed

TOOL SELECTION:
  n8n: all workflow logic + integrations
  Dograh: all voice orchestration (replaces Retell AI)
  LangGraph: complex complaint routing with multiple decision branches

FOSS APPS:
  Asterisk (SIP core — EC2 #1 Docker)
  Issabel (UC GUI — EC2 #2 Docker, containerized)
  Dograh (voice agent — EC2 #1 Docker)
  ERPNext (customer records + ticketing — EC2 #2)
  Twenty CRM (lead tracking — EC2 #2)
  Metabase (call analytics — EC2 #2)
```

---

### n8n Workflows to Build

```
workflow-01: inbound-call-handler.json
  Trigger: Dograh webhook (call received)
  Route to: FAQ / booking / complaint sub-workflows

workflow-02: call-faq-agent.json
  Sub-workflow: Qdrant search → Bifrost → Qwen → response

workflow-03: call-appointment-booking.json
  Sub-workflow: ERPNext availability → book → confirm

workflow-04: call-complaint-handler.json
  Sub-workflow: Log ticket → ERPNext → escalate if needed
  Use LangGraph for complex multi-step complaint resolution

workflow-05: outbound-lead-followup.json
  Trigger: New lead webhook (fires within 60 sec)
  Action: Dograh outbound call

workflow-06: outbound-appointment-reminder.json
  Trigger: Cron daily (24hrs before appointments)
  Action: Dograh reminder call

workflow-07: call-daily-report.json
  Cron 7pm → pull Issabel + Langfuse stats → WhatsApp owner
```

---

### Claude Code Build Prompt

```
"Build complete AI Call Centre system on AIOS.

Voice pipeline: Dograh at {{dograh_url}} connected to Asterisk on EC2 #1.
Office IP phones register via SIP over internet.
Use Whisper STT (CPU) and Kokoro TTS (CPU) for zero-cost voice.
Fallback to Deepgram + ElevenLabs for premium clients.
All LLM calls via Bifrost → OpenRouter (no local LLM).

Inbound workflow: Dograh webhook → n8n → intent detection via Mistral 7B (OpenRouter)
→ route to correct sub-workflow (FAQ/booking/complaint).
FAQ: search Qdrant {{collection_id}}.
Booking: check ERPNext availability at {{erp_url}} → book → confirm.
Complaint: create ERPNext ticket → escalate if needed using LangGraph.

Outbound workflow: n8n cron trigger → Dograh outbound API
→ appointment reminder calls 24hrs before.

Read caller history from Mem0. Write back after every call.
Log every call to Langfuse project {{langfuse_project}}.
Add input/output guardrail nodes to every workflow.
Save to /aios/n8n/workflow-templates/use-case-templates/template-callcentre-main.json"
```

---

### Where to Get Templates

```
Dograh templates: docs.dograh.com/templates
  Healthcare receptionist, sales agent, support agent

n8n.io/workflows → search "call center" "voice agent" "inbound"
Gumroad voice kit ($5): delowarworkflow.gumroad.com
  5 ready n8n workflows + voice prompts
```

---

### Testing Checklist

```
□ Inbound call answered within 2 rings
□ Urdu conversation natural end-to-end
□ Dograh + Asterisk SIP trunk working
□ FAQ answers 20 test questions correctly
□ Appointment booking confirmed in ERPNext
□ Complex query escalates to human with context
□ Outbound call fires within 60 sec of new lead
□ Reminder calls going out 24hrs before appointments
□ Call recordings accessible in Issabel dashboard
□ Mem0 recognising returning callers by number
□ Response latency under 1.5 seconds (local voice pipeline)
□ Daily report delivered to WhatsApp 7pm
□ Golden dataset 90%+ pass rate
□ Langfuse showing cost per call
```

---

## SYSTEM 3 — AI CUSTOMER EXPERIENCE (Full)
### Complete Customer Journey Automation

**Test client:** Any service business — clinic, salon, hotel, retail
**Build time:** 4-5 days
**Revenue model:** PKR 85K setup + PKR 28K/mo
**Replaces:** Customer service team (saves PKR 100-200K/mo)

---

### What This System Does

```
ACQUISITION:
  WhatsApp/voice inquiry 24/7
  Product info, quotes, proposals automated

SUPPORT (multi-channel):
  WhatsApp + voice + web chat unified
  FAQ via Qdrant RAG
  Complaint logging + ticket → ERPNext
  Escalation to human with full context

RETENTION:
  Silence detection → re-engagement after 30 days
  Birthday/anniversary messages
  Post-service review requests (24hrs after)
  Loyalty notifications

ANALYTICS (Metabase):
  CSAT scores, NPS, churn risk, customer LTV
  All reported to owner daily
```

---

### Technical Stack

```
PIPELINE:
  WhatsApp/Voice/Web → n8n webhook
  → Mistral 7B via Bifrost (intent detection — fast, cheap)
  → Route to correct sub-workflow
  → Qdrant RAG (business knowledge base)
  → Mem0 (full customer history)
  → Reply via same channel

VOICE CHANNEL:
  Dograh (self-hosted) → Asterisk
  Same voice pipeline as System 2

TOOL SELECTION:
  n8n: all customer interaction workflows
  No LangGraph/CrewAI needed for this system

FOSS APPS:
  Twenty CRM (customer records)
  ERPNext (order/service records)
  Paperless-ngx (customer documents)
  Metabase (CX dashboard)
```

---

### n8n Workflows to Build

```
workflow-01: cx-main-router.json
  Trigger: WhatsApp/voice/web webhook
  Route by intent → correct sub-workflow

workflow-02: cx-inquiry-handler.json
  Product info + quote generation via Bifrost

workflow-03: cx-support-agent.json
  FAQ + ticket creation + escalation

workflow-04: cx-retention-engine.json
  Cron daily → check silent customers → re-engagement

workflow-05: cx-review-collector.json
  ERPNext service completion → wait 24hrs → WhatsApp review request

workflow-06: cx-satisfaction-survey.json
  Cron monthly → NPS survey via WhatsApp
```

---

### Claude Code Build Prompt

```
"Build complete AI Customer Experience system on AIOS.

Main router: WhatsApp webhook → Mistral 7B via Bifrost
→ detect intent (inquiry/support/complaint/booking)
→ route to correct sub-workflow.

Support agent: search Qdrant {{collection_id}} → reply
→ if cannot resolve → create ERPNext ticket → escalate.

Retention engine: daily cron → check Supabase for customers
silent > 30 days → send re-engagement WhatsApp sequence.

Review collector: ERPNext webhook on service completion
→ wait 24 hours → send WhatsApp review request.

Read/write Mem0 for every customer interaction.
Log all LLM calls to Langfuse {{langfuse_project}}.
Save to /aios/n8n/workflow-templates/use-case-templates/template-cx-main.json"
```

---

### Where to Get Templates

```
Flowise marketplace → "customer support chatbot" "RAG customer service"
n8n.io/workflows → search "customer support" "WhatsApp chatbot" "retention"
Hurricane.AI $11 pack → customer support + retention templates
```

---

### Testing Checklist

```
□ WhatsApp inquiry response within 10 seconds
□ 20 FAQ test questions answered correctly
□ Complaint creates ticket in ERPNext correctly
□ Escalation gives human full context
□ Re-engagement fires for silent customers at 30 days
□ Review request sent 24hrs after service
□ Mem0 remembers customer history on return
□ CSAT collected and visible in Metabase
□ Voice channel works via Dograh + Asterisk
□ Golden dataset 90%+ pass rate
```

---

## SYSTEM 4 — AI FINANCE & ACCOUNTING (Full)
### Complete Financial Automation

**Test client:** Any business with 10+ invoices/month
**Build time:** 5-6 days
**Revenue model:** PKR 80K setup + PKR 28K/mo
**Replaces:** Accountant + bookkeeper (saves PKR 80-150K/mo)

---

### What This System Does

```
INVOICE PROCESSING:
  WhatsApp photo → LLaVA reads → ERPNext posts automatically
  Duplicate detection, exception alerts
  Paperless-ngx archives all invoices

ACCOUNTS RECEIVABLE:
  Outstanding tracking in ERPNext
  Auto reminder: 7 → 14 → 30 days escalating tone
  Payment reconciliation when received

EXPENSE MANAGEMENT:
  Employee WhatsApps receipt photo
  LLaVA extracts → manager approves via WhatsApp
  Posts to ERPNext on approval

FINANCIAL REPORTING:
  Daily P&L → owner WhatsApp 8pm
  Weekly cash flow summary
  Monthly financial statements (Metabase)
  Pakistan FBR tax summary

VENDOR MANAGEMENT:
  Payment scheduling automatic
  Due alerts 3 days before
```

---

### Technical Stack

```
INVOICE PIPELINE:
  WhatsApp photo → n8n webhook
  → LLaVA 7B via Bifrost (extract invoice data)
  → GPT-4o via Bifrost (fallback for complex/unclear)
  → Duplicate check in Supabase
  → ERPNext accounts payable API
  → Paperless-ngx archive
  → WhatsApp confirmation

REPORTING PIPELINE:
  n8n cron 8pm → ERPNext financial API
  → Claude 4 Sonnet via Bifrost (narrate insights)
  → WhatsApp to owner

TOOL SELECTION:
  n8n: all financial workflows
  CrewAI: complex invoice validation
    Agent 1: reads invoice (LLaVA)
    Agent 2: validates numbers + tax
    Agent 3: checks vendor history
    Agent 4: posts to ERPNext

FOSS APPS:
  ERPNext (accounting module)
  GnuCash (lightweight alternative for small firms)
  Paperless-ngx (invoice archiving + OCR)
  Metabase (financial dashboard)
```

---

### n8n Workflows to Build

```
workflow-01: invoice-processor.json
  WhatsApp photo → LLaVA → validate → ERPNext post

workflow-02: ar-reminder-sequence.json
  Cron daily → check outstanding → send reminders by age

workflow-03: expense-approval-flow.json
  Employee photo → extract → manager → post on approval

workflow-04: daily-pl-report.json
  Cron 8pm → ERPNext P&L → Claude narrative → WhatsApp

workflow-05: vendor-payment-scheduler.json
  Cron weekly → check due → alert owner 3 days early

workflow-06: bank-reconciliation.json
  Cron weekly → bank statement → match ERPNext → flag gaps
```

---

### Claude Code Build Prompt

```
"Build complete AI Finance system on AIOS.

Invoice processor: WhatsApp webhook receives photo
→ LLaVA 7B via Bifrost extracts: vendor, amount, date, tax, line items
→ check duplicate in Supabase
→ post to ERPNext accounts payable at {{erp_url}}
→ archive in Paperless-ngx
→ WhatsApp confirmation to sender.

Use CrewAI for complex invoice validation:
  Agent 1: LLaVA reads invoice
  Agent 2: validates totals and tax
  Agent 3: checks vendor history in Supabase
  Agent 4: posts to ERPNext if valid.

Daily P&L: cron 8pm → ERPNext financial data
→ Claude 4 Sonnet via Bifrost narrates key insights
→ WhatsApp to owner at {{owner_phone}}.

Log all calls to Langfuse {{langfuse_project}}.
Save to /aios/n8n/workflow-templates/use-case-templates/template-finance-main.json"
```

---

### Testing Checklist

```
□ Invoice photo → ERPNext correct (test 10 different invoices)
□ Pakistani invoice formats work (Urdu text, handwritten)
□ Duplicate invoice rejected correctly
□ AR reminders fire at 7/14/30 day intervals
□ Expense approval flow end-to-end correct
□ Daily P&L accurate vs ERPNext source data
□ CrewAI multi-agent validation working
□ Paperless-ngx archiving all invoices
□ Metabase financial dashboard showing real data
□ Golden dataset 90%+ pass rate
□ Langfuse tracking LLaVA vision costs separately
```

---

## SYSTEM 5 — AI MARKETING & SALES ENGINE (Full)
### Social + Ads + SEO + Leads + CRM

**Test client:** Any business with active marketing or social media
**Build time:** 7-10 days (most complex — build last)
**Revenue model:** PKR 120K setup + PKR 40K/mo
**Replaces:** Marketing + social media manager (saves PKR 120-200K/mo)

---

### What This System Does

```
SOCIAL MEDIA:
  AI writes + schedules Facebook/Instagram posts (3x/week)
  Responds to comments within 1 hour
  Handles DMs — qualifies leads from social
  Monitors brand mentions

PAID ADS:
  Facebook/Instagram ad copy AI-generated
  A/B testing variations automatically
  Underperforming ads auto-paused
  ROI reporting per campaign daily

CONTENT:
  Weekly blog posts (Claude 4 Sonnet — SEO optimised)
  Google My Business management
  Review monitoring and responses

LEAD MANAGEMENT (Full CRM):
  Captures: Facebook ads, Instagram DMs,
    website forms, WhatsApp click-to-chat
  Instant response within 60 seconds
  WhatsApp qualification conversation
  Voice qualification call (Dograh outbound)
  Lead scoring: hot/warm/cold
  Follow-up sequence: 10 touchpoints over 30 days
  Hot lead instant alert to sales team
  Pipeline in Twenty CRM

ANALYTICS:
  Daily lead count + source breakdown
  Conversion rate per channel
  Cost per lead per campaign
  Monthly marketing ROI report
  All to owner WhatsApp daily
```

---

### Technical Stack

```
LEAD PIPELINE:
  Facebook/Instagram/WhatsApp → n8n webhook (60 sec trigger)
  → Qwen 72B via Bifrost (qualify intent)
  → Mem0 (remember this lead across all touchpoints)
  → Twenty CRM (create/update lead)
  → If high intent: Dograh outbound call immediately
  → If medium: WhatsApp follow-up sequence
  → If low: email nurture sequence via SES

SOCIAL PIPELINE:
  n8n cron (3x weekly) → Claude 4 Sonnet via Bifrost
  → generate post → Meta API → publish
  → monitor comments → AI respond within 1 hour

CONTENT PIPELINE:
  n8n cron (weekly) → Claude 4 Sonnet via Bifrost
  → write SEO blog post → client website API → publish
  → social post promoting article

TOOL SELECTION:
  n8n: all triggers + integrations + sequences
  CrewAI: deep lead research + enrichment
    Agent 1: researches lead company (web search via MCP)
    Agent 2: identifies pain points
    Agent 3: drafts personalised outreach
    Agent 4: updates Twenty CRM with enriched data

FOSS APPS:
  Twenty CRM (primary lead management)
  SuiteCRM (complex sales pipelines)
  Metabase (marketing analytics)
```

---

### n8n Workflows to Build

```
workflow-01: social-post-scheduler.json
  Cron 3x weekly → Claude generates → Meta API publishes

workflow-02: social-comment-responder.json
  Meta webhook → AI reads → generates reply → posts

workflow-03: lead-capture-router.json
  All lead sources → create in CRM → route to qualification

workflow-04: lead-instant-response.json
  New lead webhook (60 sec) → WhatsApp + Dograh call if hot

workflow-05: lead-followup-sequence.json
  Lead created → 30-day 10-touchpoint follow-up

workflow-06: lead-enrichment-crew.json
  CrewAI: research + qualify + draft outreach + update CRM

workflow-07: content-generator.json
  Cron weekly → Claude blog post → publish → share

workflow-08: marketing-daily-report.json
  Cron 7pm → all metrics → WhatsApp to owner
```

---

### Claude Code Build Prompt

```
"Build complete AI Marketing & Sales system on AIOS.

Lead capture: webhooks from Facebook Lead Forms, Instagram DMs,
WhatsApp click-to-chat → n8n fires within 60 seconds.
Qualify using Qwen 72B via Bifrost.
Update Twenty CRM at {{crm_url}}.
If high intent → Dograh outbound call immediately.
If medium → 10-touchpoint WhatsApp sequence over 30 days.

Lead enrichment using CrewAI:
  Agent 1: web search via MCP central server for company info
  Agent 2: identify business pain points
  Agent 3: draft personalised outreach in Urdu/English
  Agent 4: update Twenty CRM with enriched data.

Social media: n8n cron 3x weekly → Claude 4 Sonnet via Bifrost
→ generate post for Facebook + Instagram → Meta API publishes.
Monitor comments → AI responds within 1 hour.

Read/write Mem0 for all leads across touchpoints.
Log all LLM calls to Langfuse {{langfuse_project}}.
Save to /aios/n8n/workflow-templates/use-case-templates/template-marketing-main.json"
```

---

### Where to Get Templates

```
n8n.io/workflows → search "lead generation" "CRM automation" "social media"
n8nlab.io → "Sales intelligence multi-agent" template
Gumroad Hurricane.AI $11 → 650 templates including lead gen
Meta Business API: developers.facebook.com/docs
```

---

### Testing Checklist

```
□ Facebook lead gets WhatsApp within 60 seconds
□ Lead qualification conversation works correctly
□ Hot lead alert fires to sales team instantly
□ Follow-up sequence runs all 10 touchpoints
□ Lead score updates as conversation progresses
□ CrewAI enrichment updates CRM with real company data
□ Social posts published 3x weekly automatically
□ Comment responses post within 1 hour
□ Blog posts SEO-quality and natural language
□ Twenty CRM showing all leads with pipeline stages
□ Dograh outbound call fires for hot leads
□ Daily report delivered with accurate metrics
□ Golden dataset 90%+ pass rate
□ Langfuse tracking content costs separately
```

---

## SHARED INFRASTRUCTURE — ALL SYSTEMS USE THIS

```
LLM ROUTING via Bifrost (EC2 #1 Docker):
  Simple intent detection:  Mistral 7B (OpenRouter — fastest, cheapest)
  Urdu/Arabic:              Qwen 2.5 72B (OpenRouter — best multilingual)
  General reasoning:        Llama 3.1 70B (OpenRouter — high quality, cheap)
  Vision (invoices/photos): GPT-4o (API — best vision)
  Complex reasoning:        Claude 4 Sonnet (API — 5-10% of calls only)
  Cached/repeated queries:  Bifrost semantic cache (zero LLM call)

MEMORY (all systems):
  Qdrant:   Knowledge base per client ({client_id}-knowledge collection)
  Mem0:     Persistent user/customer memory across all sessions
  Redis:    Session context (current conversation only)
  Supabase: All operational data + audit trail

VOICE (all systems with voice):
  Dograh → Asterisk (EC2 #1) → Issabel (EC2 #2)
  Local STT: Whisper (CPU, free) or Deepgram (cloud — Urdu premium)
  Local TTS: Kokoro (CPU, free) or ElevenLabs (cloud — natural)

OBSERVABILITY (all systems):
  Langfuse: every LLM call logged (cost + quality + latency)
  Prometheus + Grafana: infrastructure metrics

MCP TOOLS (available to all agents):
  Central MCP server on EC2 #2
  Tools: ERPNext, Twenty CRM, Calcom, WhatsApp, Gmail,
         Google Calendar, Qdrant search, Supabase query,
         Paperless-ngx, web search

SUPERVISOR AGENT (shared across all systems):
  See PROJECT.md TIER 7 for full architecture.
  Access: WhatsApp / Telegram / Web UI Chat / Voice ext. 9000
  Role: Business ops assistant — FAQ, summaries, reports, analysis, actions
  Applies to: ALL 5 use-cases (routes based on intent)

INTERNAL AGENT TEAM (your access only — not for clients):
  Hermes Agent:  DevOps / infra assistant — Telegram + WhatsApp alerts
                 Monitors Docker, EC2, services. Restarts, logs, health.
                 "Is everything running?" "Restart n8n" "Show me errors"
  OpenClaw:      Your personal assistant — WhatsApp / Telegram
                 Research, content, personal tasks. Multi-agent (Inky, Pinky).
                 Does NOT touch AIOS infra or client data.
```
```

---

## CAPABILITIES — WHEN TO EXTRACT

```
DO NOT build capabilities upfront.
Extract them AFTER systems 1 and 2 are built.

Natural extraction points:
  After System 1 + 2:
    Both use appointment booking logic → extract cap-appointment-booking.json
    Both use multilingual detection → extract cap-multilingual.json
    Both use RAG search → extract cap-rag-search.json
    Both use Mem0 read/write → extract cap-memory.json

  After System 3:
    Customer notification pattern → extract cap-proactive-notifications.json
    Escalation logic → extract cap-agent-escalation.json

  After System 4:
    Invoice processing → extract cap-document-processing.json

  By System 5:
    Lead qualification pattern → extract cap-lead-qualification.json

Save all extracted capabilities to:
  /aios/n8n/workflow-templates/capabilities/cap-[name].json
These become reusable in all future client deployments.
```

---

## CLIENT ONBOARDING FOR TESTING

```bash
# Before testing any system — create isolated environment
python3 /aios/scripts/new-client.py \
  --client-id test-hr-01 \
  --industry hr \
  --language urdu \
  --model qwen-2.5-72b \
  --budget 10 \
  --agent-name TestAgent \
  --whatsapp +923001234567

# Creates:
# Keycloak tenant, Qdrant collection, Supabase schema
# Bifrost virtual key ($10 test budget)
# Langfuse project, n8n workflow placeholder
# Paperclip company (client company isolated)
```

---

## SUCCESS CRITERIA — SYSTEM IS READY WHEN

```
Technical:
  □ End-to-end works without manual intervention
  □ WhatsApp response < 3 seconds
  □ Voice response < 1.5 seconds (Dograh local pipeline)
  □ Error rate < 5% on 100 test interactions
  □ Golden dataset 90%+ pass rate
  □ All LLM calls logged in Langfuse
  □ Mem0 remembering users across sessions
  □ No cross-client data leakage (isolation test)
  □ Cost per interaction within budget estimates

Business:
  □ Test client gives positive feedback
  □ Can demonstrate clear PKR ROI to client
  □ Can onboard second client in under 2 hours
  □ All failures documented and fixed
  □ Case study written for sales use

Quality:
  □ Urdu conversation feels natural to native speaker
  □ Agent does not hallucinate wrong information
  □ Escalation to human works with full context
  □ Reports accurate vs source data verified
```

---

## BUNDLE PRICING (after testing phase)

```
STARTER BUNDLE:
  System 3 (CX) + System 2 (Call Centre)
  Setup: PKR 150K | Monthly: PKR 55K
  Best for: Any service business

BUSINESS BUNDLE:
  System 2 (Call) + System 1 (HR) + System 4 (Finance)
  Setup: PKR 220K | Monthly: PKR 85K
  Best for: Medium businesses 20-100 staff

FULL TRANSFORMATION:
  All 5 systems
  Setup: PKR 350K (discounted from 475K)
  Monthly: PKR 130K
  Best for: Growing businesses wanting complete AI ops
  UAE pricing: 3-4x Pakistan rates
```

---

## NOTES FOR CLAUDE CODE

```
Read PROJECT.md + CLAUDE.md before starting any work.

Key reminders:
1. ALL LLM calls through Bifrost — never direct API
2. ALL voice through Dograh + Asterisk — never Retell AI or Vapi
3. ALL client data as variables — client_id, collection_id, erp_url etc.
4. ADD Mem0 read at start + write at end of every agent flow
5. ADD Langfuse logging node at end of every workflow
6. ADD input guardrail node at start (validate input not empty, no injection)
7. ADD output guardrail node (check response makes sense before sending)
8. COMMIT to Git after every working workflow

Common Pakistan-specific issues to handle:
  Urdu text in invoices: LLaVA handles but test with real samples
  ZKTeco API varies by model: check SDK version before coding
  WhatsApp 24-hour session window: handle session expiry in workflows
  ERPNext Frappe API: uses frappe.client format not standard REST
  Pakistan mobile numbers: handle both +92 and 0 formats
  Urdu voice: Deepgram Nova 3 has best Urdu accuracy — use for premium
```

---

*AIOS_USECASES.md — Complete Lab Testing Guide*
*Version: v1.2 — May 2026 — Lahore AI Lab*
*Build systems 1→5 in order. Extract capabilities naturally. Test with real clients.*
*New: Dograh replaces Retell AI. LLM Wiki + Mem0 in memory stack. Mission Control added.*
