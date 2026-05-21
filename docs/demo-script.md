# Demo Script — Discovery to Delivery Mapper

> Target duration: 3–5 minutes. Primary scenario: Fintech AML (Meridian Bank).

---

## Setup

- App running at http://localhost:3000 (or Vercel URL)
- Browser open to the home page
- OPENAI_API_KEY set in .env.local (optional — templates work without it)

---

## Step 1 — Home Page (30 sec)

**Show:** The home page.

**Say:**

> "This tool maps the discovery-to-delivery work a forward-deployed engineer or solutions engineer does when they take on a new enterprise customer. It's not a checklist app — it mirrors the actual artifacts a startup deployment team needs to produce."

**Point to:**

- The list of 14 generated outputs
- The two CTAs: Browse Scenarios and Start Custom Project

---

## Step 2 — Scenario Selector (30 sec)

**Click:** Browse Scenarios

**Show:** The scenario card grid with 4 scenarios.

**Say:**

> "Each scenario is a pre-built fictional customer — a regulated bank, a law firm, a robotics company, and an insurance group. They're seeded with realistic discovery data, systems, risks, and stakeholders."

**Click:** Fintech AML — Meridian Bank

---

## Step 3 — Workspace Dashboard (30 sec)

**Show:** The workspace dashboard.

**Say:**

> "This is the deployment workspace. It shows where we are in the onboarding, what's already captured, the top risks, and the next action. It's designed to work like an internal operator tool — not a pretty demo, but something you'd actually use."

**Point to:**

- Completion checklist
- Key risk badges
- Next recommended action

---

## Step 4 — Customer Discovery (45 sec)

**Navigate to:** Discovery

**Show:** Pre-filled discovery form.

**Say:**

> "Meridian Bank wants to automate AML case triage. Their review teams are overwhelmed. The environment has regulated data, model explainability requirements, and a compliance team that needs audit trail documentation."

**Edit one field** (e.g. change urgency from High to Critical).

**Say:**

> "Everything is editable. If a customer call surfaces new information, you update it here. The engines pick it up automatically."

---

## Step 5 — Workflow Map (30 sec)

**Navigate to:** Workflow

**Show:** Pre-seeded workflow steps with future-state badges.

**Say:**

> "We've mapped the current AML triage process — alert intake, case prioritisation, document review, analyst decision, and escalation. Each step has its owner, system, automation potential, and how it changes in the future state."

**Point to:** A step marked `ai_assisted` vs one marked `requires_approval`.

---

## Step 6 — Systems and Data (30 sec)

**Navigate to:** Systems

**Show:** Systems table and data sources table.

**Say:**

> "This captures every system the customer uses and every data source we need access to. Notice this one has API availability marked unknown — that automatically creates an integration risk and a missing information flag."

---

## Step 7 — Requirements Matrix (30 sec)

**Navigate to:** Requirements

**Show:** Auto-generated requirements grouped by category.

**Say:**

> "Requirements are auto-generated from the discovery and systems data. Security and compliance requirements came from the regulated data sensitivity. Integration requirements came from the unknown API. These aren't invented — they're derived from what we captured."

---

## Step 8 — Risk Register (30 sec)

**Navigate to:** Risks

**Show:** Risk register with severity/likelihood colour coding.

**Say:**

> "The risk register is also auto-generated. For a fintech scenario we automatically add model explainability and audit trail risks. For legaltech we'd add hallucination and privilege risks. Every risk has a mitigation and an escalation trigger."

---

## Step 9 — Pilot Success Plan (30 sec)

**Navigate to:** Pilot

**Show:** Pilot plan with metrics, launch criteria, rollback criteria.

**Say:**

> "The pilot plan defines exactly what success looks like before we start. Metrics have baselines and targets. Launch criteria are the gates to go live. Rollback criteria are the conditions that stop the pilot."

---

## Step 10 — Output Artifacts (45 sec)

**Navigate to:** Outputs

**Show:** Tabbed artifact view.

**Say:**

> "Everything feeds into these artifacts. The engineering handoff tells the eng team exactly what to build — integrations, config needs, edge cases, open questions, and recommended prototype scope. The executive summary gives the customer's leadership a single-page view. The product feedback memo identifies capability gaps we can feed back to product."

**Click through:** Engineering Handoff tab, then Executive Summary tab.

---

## Step 11 — Markdown Export (30 sec)

**Click:** Export Onboarding Pack

**Show:** The downloaded .md file (or copy it to clipboard).

**Say:**

> "This is the full onboarding pack — all 15 sections, ready to share with the customer or drop into Notion, Linear, or a Google Doc. It's the playbook you'd hand off to the next person on the account."

---

## Step 12 — Closing (30 sec)

**Say:**

> "This tool demonstrates the core skill loop of mapping discovery to delivery: capture context → map workflows → scope systems → identify risks → plan pilots → handoff to engineering → communicate with customers. All structured, traceable, and exportable. Built in Next.js with TypeScript, with deterministic engines for instant output and OpenAI for richer AI-generated versions."

---

## Interview Talking Points

- "The requirements engine is deterministic — it derives from project state rather than hallucinating. AI adds depth, not correctness."
- "The risk register covers 9 categories because that's what I found in actual deployment job descriptions."
- "The engineering handoff section exists because the handoff from customer-facing to engineering is one of the highest-risk moments in any deployment."
- "The scenario data is fictional but structurally realistic — it mirrors what you'd find in an actual AML or legal AI deployment."
