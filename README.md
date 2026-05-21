# Discovery to Delivery Mapper

> Map customer discovery into deployment readiness — requirements, risks, pilots, and engineering handoffs.

**Live demo:** [discovery-to-delivery-mapper.vercel.app](https://discovery-to-delivery-mapper.vercel.app)

---

## Why This Project Exists

Early-stage B2B AI startups hire forward-deployed engineers, solutions engineers, and deployment strategists to sit between customers and engineering. These roles require turning messy discovery into structured plans — requirements, risks, engineering handoffs, pilot KPIs, and customer communications.

This tool maps that process end-to-end. It demonstrates how to go from a real enterprise customer scenario to a complete deployment pack that engineering can act on and customers can sign off.

---

## Target Roles

- Forward-Deployed Engineer / Forward-Deployed AI Engineer
- Solutions Engineer / AI Solutions Engineer
- Deployment Strategist
- Technical Customer Success Manager
- Client Success and AI Deployment Lead
- Technical Operator / GTM Engineer

---

## Key Features

- **Scenario selector** — 4 pre-built enterprise customer scenarios (fintech, legaltech, hardware, insurance)
- **Discovery capture** — customer context, business problem, constraints, urgency, regulatory context
- **Workflow builder** — map current and future-state steps with automation potential and future-state role
- **Systems and data mapper** — track systems, APIs, data sources, quality, and open questions
- **Requirements engine** — auto-generate categorised requirements from project state
- **Risk register** — 9-category risk register auto-generated from workflow and systems data
- **Pilot success plan** — define KPIs, baselines, targets, launch criteria, and rollback criteria
- **AI artifact generation** — structured outputs via OpenAI (falls back to templates if no key)
- **Markdown export** — full downloadable deployment pack

---

## Architecture

```
/app           Next.js App Router pages
/components    UI components (shadcn/ui base)
/lib           Types, engines, prompts, export logic
/data          Seed scenario JSON files
/docs          Role research, product requirements, demo script, evaluation
/tests         Vitest unit tests
```

---

## Tests

```bash
npm test        # run all 41 tests
npm run test:watch   # watch mode
```

Test coverage: scenarios loading, requirements engine (fintech/legaltech rules), risk engine (9 categories), markdown export (15-section structure).

---

## Tech Stack

- **Next.js 16** (App Router, TypeScript)
- **Tailwind CSS v4** + **shadcn/ui**
- **OpenAI** via Vercel AI SDK (structured outputs)
- **Browser sessionStorage** (local-first, no backend required for MVP)
- **Vitest** for unit tests
- **Vercel** for deployment

---

## Setup

```bash
git clone https://github.com/georget-j/discovery-to-delivery-mapper
cd discovery-to-delivery-mapper
npm install
cp .env.local.example .env.local
# Add OPENAI_API_KEY to .env.local (optional — app runs without it)
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Environment Variables

| Variable         | Required | Description                                                                   |
| ---------------- | -------- | ----------------------------------------------------------------------------- |
| `OPENAI_API_KEY` | Optional | Enables AI-generated artifacts. Without it, deterministic templates are used. |

---

## Demo Flow (3–5 min)

1. Open home page
2. Select **Fintech AML Onboarding** (Meridian Bank)
3. Review pre-filled customer discovery
4. Step through workflow map and systems mapper
5. View auto-generated requirements and risk register
6. Build pilot success plan
7. Generate AI artifacts (or view template-filled versions)
8. Export Markdown deployment pack

See [`/docs/demo-script.md`](./docs/demo-script.md) for the full script.

---

## Scenarios

| Scenario           | Customer              | Use Case                      | Industry          |
| ------------------ | --------------------- | ----------------------------- | ----------------- |
| Fintech AML        | Meridian Bank         | AI-assisted AML case triage   | Fintech           |
| Legaltech Contract | Harrington Shaw LLP   | AI first-pass contract review | Legaltech         |
| Hardware Ops       | Atlas Robotics        | Remote incident triage        | Hardware/Robotics |
| Enterprise Support | Northbridge Insurance | Internal AI support agent     | Insurance         |

---

## What This Demonstrates

This tool demonstrates how a forward-deployed AI or solutions engineering team can map customer discovery into delivery-ready artifacts — requirements, risks, pilot plans, engineering handoffs, and customer communications.

Skills shown:

- Customer workflow analysis and requirements classification
- Integration planning and data readiness assessment
- Deployment risk identification and management
- Pilot success criteria definition
- Engineering handoff documentation
- Customer-facing and internal communication drafting
- AI-accelerated document generation

---

## Known Limitations

- No persistent backend — state lives in sessionStorage per session
- AI generation requires an OpenAI API key
- PDF export is a future improvement
- No multi-user collaboration

---

## Future Improvements

- Supabase persistence
- User authentication
- PDF export
- Drag-and-drop workflow visualiser
- Live API integration mock
- RFP integration with Project 1 (AI RFP / Enterprise Knowledge Agent)
- Jira/Linear ticket export
- Customer email thread ingestion
- Implementation health score
- CRM integration

---

## Role Research

See [`/docs/role-research.md`](./docs/role-research.md) for the job description research that drove product requirements.

---

## License

MIT
