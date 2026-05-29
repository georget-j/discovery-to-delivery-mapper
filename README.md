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

### Capture

- **Document intake + knowledge base** — drop in PDFs, Word, Excel/CSV, text, Markdown, or JSON. Files are parsed in a Web Worker, chunked, embedded (`text-embedding-3-small`), and stored locally in IndexedDB to build a per-project knowledge base.
- **Interview or form discovery** — capture customer context conversationally (one question at a time, auto-populating the structured form) or via the classic form.
- **Voice dictation** — speak notes via the browser's speech recognition, with a Whisper fallback.
- **Inline KB hints** — as you fill fields, matching snippets from your uploaded docs surface for one-click insert.
- **Industry starter packs + smart defaults** — one-click typical systems/workflows/stakeholders, and new rows pre-filled from discovery.

### Structure

- **Generate from Discovery / Knowledge Base** — draft workflows, systems, stakeholders, and risks, reviewed in a cherry-pick diff panel before merging (with source citations when grounded in the KB).
- **Workflow builder** — current and future-state steps with automation potential and future-state role.
- **Systems & data mapper** — systems, APIs, data sources, quality, sensitivity, and open questions.
- **Requirements engine** — auto-categorised requirements derived from project state.
- **Risk register** — 9-category risk register auto-generated from workflow and systems data.
- **Pilot success plan** — KPIs, baselines, targets, launch criteria, and rollback criteria.

### Visualise (workflow canvases)

- **Current-State & Future-State AI workflow maps** — interactive swimlane canvases (React Flow) with auto-layout, undo/redo, multi-select, and Mermaid/JSON export.
- **In-canvas proposals** — a ✨ node toolbar and a docked Suggestions rail offer "layer in a validator / monitoring / approval" moves, grounded in a catalogue of real market AI-automation patterns (orchestrator–workers, evaluator–optimizer, RAG, routing, guardrails+HITL, …) that drop in as connected blueprints.
- **Map-aware "Ask AI for ideas"** — AI proposals are anchored to real stages and wired into the graph with labeled data-flow edges, never floating.
- **Guided stage walkthrough** — step through the workflow stage by stage; each stage centers on the canvas, asks clarifying questions, and offers connected agent proposals.
- **Review & tidy** — finds orphan / duplicate / redundant nodes (deterministic rules + an AI semantic pass) and applies confirmed merges/removes as a single undo step.
- **Innovation recommendations** — pattern-based future-state recommendations per workflow step, KB-grounded when documents are present.

### Deliver

- **AI artifact generation** — 15 structured deliverables via OpenAI, with deterministic template fallbacks when no API key is set.
- **Inline artifact editing** — tweak any generated artifact in place; regeneration warns before overwriting edited ones.
- **Export** — full deployment pack as **Markdown**, **PDF** (print view), or **DOCX**, scoped to customer / internal / technical / full.

---

## Architecture

```
/app           Next.js App Router pages + API routes
/components    UI components (shadcn/ui base) incl. intake, outputs, visualisations
/lib           Types, engines, prompts, KB pipeline, pattern library, export logic
/workers       Web Worker for document parsing (pdf/docx/xlsx/text)
/data          Seed scenario JSON files
/specs         EARS-format feature specifications
/docs          Role research, product requirements, demo script, evaluation
/types         Shared ambient types
/tests         Vitest unit tests
```

Notable `lib/` areas: `lib/kb/` (chunker, IndexedDB storage, embed client, retrieval), `lib/patterns/` (automation pattern catalogue + market solution library), `lib/visualisations/` (workflow types, auto-layout, node proposals, workflow review, stage ordering).

**Persistence:** project state lives in `localStorage` (migrated from `sessionStorage`); knowledge-base chunks + embeddings live in `IndexedDB` (`dtdm-knowledge-base`). No backend required.

---

## Tests

```bash
npm test             # run the full suite (316 tests across 19 files)
npm run test:watch   # watch mode
```

Coverage includes: scenario loading, requirements & risk & missing-info engines, markdown/mermaid export, prompt + artifact templates, API route guards, the KB chunker + IndexedDB storage, workflow auto-layout, node proposals (incl. map-aware moves + data-flow labels), workflow review (orphan/duplicate/redundant detection + merge/remove), and stage ordering.

---

## Tech Stack

- **Next.js 16** (App Router, TypeScript, strict)
- **Tailwind CSS v4** + **shadcn/ui**
- **React Flow** (`@xyflow/react`) + **dagre** for the workflow canvases and auto-layout
- **OpenAI** — `gpt-4o-mini` (generation, recommendations, chat), `text-embedding-3-small` (knowledge base), `whisper-1` (voice). Runs without a key via deterministic templates.
- **Document pipeline** — `pdfjs-dist`, `mammoth`, `xlsx`, `tesseract.js` (OCR), `gpt-tokenizer`, in a Web Worker
- **Export** — `docx` + `marked` for Word; print-to-PDF for PDF
- **Storage** — `localStorage` (projects) + `IndexedDB` (knowledge base)
- **Vitest** for unit tests; **Vercel** for deployment

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

| Variable         | Required | Description                                                                                                                                                |
| ---------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `OPENAI_API_KEY` | Optional | Enables AI generation, recommendations, embeddings, and voice transcription. Without it, deterministic templates are used and KB/voice features are inert. |

---

## Demo Flow (3–5 min)

1. Open the home page and start a blank project, or select a seeded scenario (e.g. **Fintech AML Onboarding** — Meridian Bank).
2. **Intake** — drop a few customer docs to build the knowledge base, or paste raw notes.
3. **Discovery** — capture context via the interview or form; use voice and KB hints.
4. Generate workflows, systems, stakeholders, and risks from discovery/KB and review them in the diff panel.
5. **Visualise** — open the Future-State AI workflow map; apply in-canvas proposals or market-solution blueprints, run the **stage walkthrough**, and use **Review & tidy** to de-clutter.
6. View auto-generated requirements and the risk register; build the pilot success plan.
7. Generate AI artifacts (or view template-filled versions); edit any in place.
8. Export the deployment pack as **Markdown**, **PDF**, or **DOCX**.

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
- Retrieval-grounded extraction from real customer documents
- Future-state architecture design against a catalogue of market AI patterns
- Integration planning and data readiness assessment
- Deployment risk identification and management
- Pilot success criteria definition
- Engineering handoff documentation
- Customer-facing and internal communication drafting
- AI-accelerated document generation

---

## Known Limitations

- No persistent backend — project state lives in `localStorage`, knowledge-base data in `IndexedDB`, per browser.
- AI generation, embeddings, and transcription require an `OPENAI_API_KEY` (the app degrades gracefully without one).
- Knowledge base is per-project; documents are not shared across projects.
- Scanned/image-only PDFs rely on best-effort OCR.
- No multi-user collaboration.

---

## Future Improvements

- Supabase persistence + user authentication
- Cross-project reusable knowledge / answer library
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
