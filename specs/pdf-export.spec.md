# Spec: PDF / DOCX Export

**Status:** Draft (P1 candidate)
**Owner:** —
**Last updated:** 2026-05-20

## 1. Overview & user value

The tool currently exports the deployment pack as **Markdown** (single file) and individual artifacts as `.md`. The competitive review flagged this as a P1 gap: real customer deliverables are **PDF** (for legal / executive signoff) and **DOCX** (so the customer can edit before forwarding internally).

A markdown file is not a deliverable. A polished PDF is.

### User value

- **Real handoff.** A forward-deployed engineer can hand the customer a "Deployment Pack — Meridian Bank.pdf" that looks like consultancy-grade work, not a developer scratchpad.
- **Editable handoff.** A DOCX equivalent lets the customer's procurement / compliance / legal team make changes in their own tooling.
- **Audience-tailored exports.** The same project produces different deliverables for different audiences (customer C-suite gets exec summary + future-state diagram; engineering gets the integration plan + handoff doc).

### Out of scope (v1)

- Custom logo / brand kit upload (use the app's default header for now).
- Inline diagram editing in PDF (current state / future state workflow diagrams export as **PNG** images via React Flow's `toPng`; user can swap images post-export).
- Multi-language exports.
- Server-side rendering — all generation is client-side to avoid latency and infra cost. (May change for a hosted "shareable link" feature later.)
- DOCX **import** — export only.

## 2. Functional requirements (EARS format)

### FR-1 — Output formats

The system **shall** support three export formats from the Outputs page:
- **PDF** (default — multi-page, paginated, table-of-contents)
- **DOCX** (editable Word document)
- **Markdown** (existing — kept for power users)

The user **shall** be able to pick the format from the existing "Export full pack" button via a dropdown.

### FR-2 — Per-artifact export

Each individual artifact tab **shall** also offer PDF / DOCX / .md export (replacing or extending the current "Download .md" button). A user viewing the Executive Summary alone can export only that artifact, in any of the three formats.

### FR-3 — Audience-scoped export

The system **shall** support audience-scoped pack exports:
- **Customer pack** — includes only the 5 Customer-Facing artifacts (Executive Summary, Future State Workflow, Pilot Success Plan, Comms Plan, Next Actions Checklist)
- **Internal pack** — Internal + Technical + Product (10 artifacts)
- **Full pack** — all 15 (existing default)

Scope **shall** be selectable from the export dropdown next to the format picker.

### FR-4 — PDF structure

The PDF **shall**:
- Open with a **cover page**: customer logo placeholder (text-only "[Customer Name]" if no logo) + project name + generation date + audience tag ("CUSTOMER" / "INTERNAL")
- Include a **table of contents** on page 2 with clickable anchors to each section
- Render each artifact as a **chapter** starting on a new page, with the artifact title at the top
- Include a **footer** on every page: project name (left) · page N of M (right)
- Render markdown content with sensible defaults: headings, lists, tables, blockquotes, fenced code blocks (treated as preformatted text)
- Preserve `[N]` citation chips as **superscript numbers** linked to a "Sources" footnote at the end of each chapter

### FR-5 — DOCX structure

The DOCX **shall**:
- Open with the same cover page content as the PDF, but in editable text (no rasterised image)
- Use **Word heading styles** (Heading 1 / 2 / 3) so the customer can re-style with their corporate template if they have one
- Render tables as native Word tables (editable cells), not as preformatted text
- Include a TOC field at the top that updates when the user opens it in Word (using the `<w:fldSimple w:instr="TOC ..."/>` field)
- Preserve `[N]` citations as plain text (no hyperlink — keeps the doc clean for editing)

### FR-6 — Diagram inclusion

When a Current State or Future State workflow map exists, the PDF and DOCX **shall** embed it as a **PNG** image at the top of the relevant chapter, sized to fit the page width and the swimlane label heights.

The PNG **shall** be generated client-side via the existing React Flow `toPng` API (or an equivalent for the Mermaid fallback), at 2× display DPI for print quality.

### FR-7 — Source attribution appendix

The PDF and DOCX **shall** include a final appendix titled "Sources used" containing the full list of project inputs that fed the pack (a flat list pulled from `computeArtifactSources` across all 15 artifacts), so the customer can audit what evidence drove which artifact.

### FR-8 — Stale-input warning

When the user clicks export while the project's `hashGenerationInputs()` differs from `outputs.derivedFromHash` (i.e., inputs have changed since last generation), the system **shall** show a confirmation modal: "Inputs have changed since the last generation. Export will use the **older** generated content. Regenerate first?" with `Regenerate first` / `Export anyway` / `Cancel`.

### FR-9 — Format-stamp the filename

The system **shall** generate filenames of the form `{customerSlug}-deployment-pack[-{audience}].{ext}`, where `{audience}` is omitted for the full pack and is `customer` / `internal` for the scoped packs. Per-artifact exports follow the existing pattern `{customerSlug}-{artifact-key-kebab}.{ext}`.

## 3. Non-functional requirements

| Category | Requirement |
|---|---|
| **Performance** | Full-pack PDF (15 artifacts, 2 diagrams) **shall** generate in <8 seconds on a 2020 MacBook Air. Show a progress indicator if generation exceeds 1 second. |
| **Bundle size** | PDF library **shall not** add more than 200KB gzipped to the client bundle (this is the upper bound for a portfolio app on Vercel free tier). |
| **Library choice** | Prefer **`pdfmake`** for PDF (~80KB gzipped, declarative API, no Chromium / headless browser needed) and **`docx`** for Word (~120KB gzipped, fluent builder API). Cumulative ~200KB on a cold load of the Outputs page — acceptable. |
| **Lazy-load** | PDF and DOCX libraries **shall** be dynamically imported (`await import(...)`) inside the export handler, not bundled into the initial page load. The Outputs page already loads `react-markdown` synchronously; do not add to that critical path. |
| **Fonts** | PDF and DOCX **shall** use a single font family (system serif for body, system sans for headings) to keep file size small and avoid font-embedding licensing. |
| **A11y** | DOCX **shall** include proper heading hierarchy so a screen reader can navigate the document. PDF **shall** include the `/Title`, `/Author`, `/Subject` metadata. |
| **Resilience** | If PDF / DOCX generation fails (e.g. an embedded image fails to encode), the system **shall** show an error toast and offer "Export as Markdown" as a fallback. The user is never stuck with no export. |

## 4. Acceptance criteria (Given / When / Then)

### AC-1 Full-pack PDF export

Given a project with all 15 artifacts generated and both workflow maps populated,
When the user clicks "Export full pack → PDF",
Then a `meridian-bank-deployment-pack.pdf` file downloads within 8 seconds, opens cleanly in Preview / Adobe Reader, has a TOC on page 2, and contains all 15 artifacts + 2 diagrams + Sources appendix.

### AC-2 Audience-scoped customer pack

Given the same project as AC-1,
When the user clicks "Export → Customer pack → PDF",
Then a `meridian-bank-deployment-pack-customer.pdf` downloads containing only the 5 customer-facing artifacts (Exec Summary, Future State Workflow, Pilot Success Plan, Comms Plan, Next Actions Checklist).

### AC-3 Per-artifact DOCX export

Given the user is viewing the Risk Register Summary tab,
When the user clicks "Download → DOCX",
Then `meridian-bank-risk-register-summary.docx` downloads, opens in Word, renders the artifact's tables as native Word tables (editable), and shows the customer name in the document header.

### AC-4 Stale-input warning

Given the project's inputs have changed since generation (`stale === true`),
When the user clicks "Export full pack → PDF",
Then a modal warns "Inputs have changed…" and the export only proceeds after the user picks `Regenerate first` (which triggers generation then export) or `Export anyway`.

### AC-5 Diagram embedding

Given a project with a Future State Workflow map,
When the user exports to PDF,
Then the Future State Workflow chapter starts with a 2× DPI PNG of the React Flow canvas (or Mermaid fallback), correctly showing all 6 lanes including guardrails.

### AC-6 Citations as superscript

Given an artifact body containing "Meridian operates under FCA, FATF [1] and is in fintech [2].",
When the artifact is rendered in PDF,
Then "[1]" and "[2]" appear as superscript numbers; the bottom of the chapter has a "Sources" footer numbering each cited input.

### AC-7 Lazy load — initial bundle

Given the user opens the Outputs page but never clicks Export,
When the page finishes hydrating,
Then the PDF and DOCX libraries are **not** in the loaded JS (verifiable via the Network tab — only the existing markdown bundle is loaded).

### AC-8 DOCX TOC updates on open

Given a generated DOCX,
When the user opens it in Word and right-clicks the TOC field → "Update field",
Then the TOC populates correctly with all chapter titles and page numbers.

## 5. Error handling

| Scenario | Behaviour |
|---|---|
| `outputs` is null (nothing generated yet) | Disable the Export button. Tooltip: "Generate the pack first." |
| `pdfmake` import fails (network failure on lazy chunk) | Toast: "Could not load PDF library. Try again or export as Markdown." Offer the .md fallback. |
| React Flow PNG capture fails (e.g. the canvas isn't mounted because the user never opened the workflow tab) | Substitute a text placeholder: "[Workflow diagram available in the Workflow tab — re-export after opening it once]". Do not block the rest of the export. |
| Customer name contains non-Latin characters | Render as-is (system fonts handle this). Filename uses `customerSlug` (already ascii-only via `replace(/[^a-z0-9]/g, "-")` in the existing export logic). |
| Browser blocks the download (popup-blocker style) | Show a toast: "Download blocked by browser. Click here to retry." with a manual retry link. |
| User has the page open in a tab that's been idle for hours and the session has stale state | The export uses the project as currently held in `WorkspaceProvider`; sessionStorage is the source of truth. No special handling needed — the user sees what they expect. |
| Total PDF size exceeds 10MB (e.g. very long pack + diagrams) | Show a non-blocking warning toast: "Export is X MB — large files may be slow to email." Do not block. |

## 6. Implementation TODO checklist

### Data layer
- [ ] `lib/export/pdf-export.ts` — top-level `exportPackToPdf(project, scope: "full"|"customer"|"internal"): Promise<Blob>` and `exportArtifactToPdf(project, key: ArtifactKey): Promise<Blob>`
- [ ] `lib/export/docx-export.ts` — symmetrical API for Word
- [ ] `lib/export/diagram-capture.ts` — `captureWorkflowDiagram(map): Promise<string>` returning a base64 PNG (uses React Flow `toPng` or a Mermaid SVG → canvas fallback)
- [ ] `lib/export/scopes.ts` — defines the customer / internal / full artifact-key groupings (lifts the existing `GROUPS` from outputs/page.tsx into a shared module so PDF + DOCX + UI all agree)

### UI
- [ ] `components/outputs/ExportDropdown.tsx` — replaces the current "Export full pack" button. Multi-level menu: Scope (Customer/Internal/Full) × Format (PDF/DOCX/Markdown)
- [ ] `app/workspace/[id]/outputs/page.tsx` — per-artifact toolbar gains the same dropdown
- [ ] `components/outputs/StaleExportWarningModal.tsx`
- [ ] Disabled state + tooltip on Export when `!project.outputs`

### Dependencies
- [ ] `pnpm add pdfmake docx` (or `npm install` — pick to match existing `package-lock.json`)
- [ ] Verify gzipped bundle delta against the 200KB cap (use `npx next build` + check the `.next/analyze` report if available)
- [ ] Add `"pdfmake": "^0.x"` and `"docx": "^9.x"` to `package.json`

### Tests
- [ ] `tests/export/pdf-export.test.ts` — assertions on the generated `pdfmake` doc-definition object (not the binary): TOC entries match scope, page count for full pack matches 15 chapters + cover + TOC + appendix, citations rendered as superscript marker
- [ ] `tests/export/docx-export.test.ts` — same shape via `docx`'s declarative API
- [ ] `tests/export/diagram-capture.test.ts` — mock React Flow; verify diagram capture handles missing canvas gracefully
- [ ] Integration: open the dev server, generate a pack, export each scope+format combination by hand (manual smoke list goes in PR description)

### Polish
- [ ] Add a print-stylesheet `@media print` to the markdown rendered on the Outputs page so users who hit Ctrl+P get something half-decent without the dedicated export
- [ ] Add export-time analytics dot (`console.info` is fine for v1 — proper analytics is out of scope)

## 7. Open questions

1. **DOCX TOC**: pdfmake handles TOC natively; the `docx` library requires a `<TableOfContents>` field that only updates when Word renders it. Acceptable for v1. (Some users won't right-click → Update field — accept this UX cost; cheaper than server-side generation.)
2. **Diagram fidelity in DOCX**: PNG embed is universal but loses interactivity. SVG would be sharper but Word's SVG support has been spotty across versions. Stick with 2× PNG.
3. **PDF/A or PDF/UA**: not in scope for v1 — these are accessibility-conformant variants. Revisit if any customer pushes back.
4. **Page size**: A4 by default. Letter as a toggle (US customers). Save the choice in `localStorage` so the user picks once.
5. **Editable cover page**: should the customer name on the cover use `companyName` or a user-editable "deliverable title"? Stick with `companyName` in v1; add a "Deliverable title" override field on the project if a user complains.
6. **PDF for individual artifact vs full pack** — do per-artifact PDFs get a cover page? Recommendation: no (just the artifact + a one-line header). Saves pages.

## 8. Risk + mitigation

| Risk | Mitigation |
|---|---|
| pdfmake + docx + diagram capture pushes the JS bundle over the "snappy initial load" budget | Strictly lazy-load. The Outputs page is reached only after the user has generated a pack — they've already accepted some delay there. |
| PNG diagram capture breaks if React Flow API changes in a major version upgrade | Pin React Flow at known-good version; isolate the capture call behind `diagram-capture.ts` so a future swap to another diagram library is localised. |
| DOCX output looks ugly in Google Docs (which is many users' default Word viewer) | Pre-flight: open one exported DOCX in Google Docs as part of the PR test plan. If broken, fall back to simpler styling. |
| Customer name has a leading / trailing space and the filename slug starts with "-" | The existing slug code already does `replace(/[^a-z0-9]/g, "-")` then would benefit from a `.replace(/^-+|-+$/g, "")` trim — fix as part of this work, low effort. |
| Large diagrams blow past the page width and render as a postage stamp | Set a max-width on the PNG embed; if the diagram aspect ratio is extreme, rotate to landscape page for that one chapter. |
