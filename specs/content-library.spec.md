# Spec: Content Library

**Status:** Draft (P1 candidate)
**Owner:** —
**Last updated:** 2026-05-20

## 1. Overview & user value

A **content library** of reusable snippets and answers that survive across projects, so the user (a forward-deployed AI engineer or CSM) writes a piece of content once and reuses it across many customer engagements.

The competitive review (Dock, Loopio, Responsive, RFPIO) identified this as the single biggest **time-saver** in customer-facing deployment tools — without it, every new project re-types the same security posture, the same data-handling boilerplate, the same standard mitigations.

### User value

- **Author once, reuse everywhere.** "Our SOC 2 stance," "our DPA template," "our standard pilot success metrics" → captured one time, dropped into any artifact in any project.
- **Reduces drift.** When the security stance changes, it changes in one place — not 15 artifacts across 12 projects.
- **Onboards new engineers faster.** A junior FDE inherits the library and immediately writes at the same quality bar as the team's most experienced engineer.

### Out of scope (v1)

- Multi-user / org-level sharing (this app is single-user sessionStorage).
- Versioned snippet history (snippets are mutable; the latest wins).
- AI-suggested snippet insertion (the user picks manually).
- Snippet usage analytics ("which snippets get used most").
- Cross-project snippet diffing.

These can come in v2 once the v1 surface stabilises.

## 2. Functional requirements (EARS format)

### FR-1 — Storage model

The system **shall** persist a single **content library** keyed `onboarding_content_library` in `localStorage` (not sessionStorage — the library must survive across sessions and projects, which is the only persistence in this app that does).

The library **shall** contain an array of **snippets**, each with:

| Field | Type | Notes |
|---|---|---|
| `id` | string | `generateId()` |
| `title` | string | Short label, e.g. "Standard SOC 2 stance" |
| `body` | string (markdown) | Reusable content. Supports placeholders like `{{customer.companyName}}` (see FR-5) |
| `tags` | string[] | Free-form, e.g. `["security", "compliance", "fintech"]` |
| `appliesTo` | `ArtifactKey[]` \| `null` | Which of the 15 artifacts this snippet is relevant to; `null` means "any" |
| `createdAt` | ISO string | |
| `updatedAt` | ISO string | |
| `lastUsedAt` | ISO string \| `null` | Stamped when inserted into any project artifact |

### FR-2 — Library page

The system **shall** expose a dedicated `/library` route (outside any project workspace) listing all snippets, with:
- A primary "**+ New snippet**" action
- Per-row: title, tag chips, applies-to chips, last-used timestamp, edit/delete buttons
- Empty state: a "Why a library?" explainer + "Add your first snippet" CTA
- Search input filtering by title/body/tag (client-side, case-insensitive substring)
- Tag filter chips at the top — selecting any chip narrows the list

### FR-3 — Snippet editor

When the user opens a snippet (new or existing), the system **shall** present:
- Title input
- Body textarea (markdown-aware monospace, ~20 rows)
- Tag chip input (suggestions: tags already in the library)
- `appliesTo` multi-select using the existing 15 ARTIFACT_LABELS, plus an "Any" toggle
- Live preview pane rendering the body via `react-markdown` with placeholders highlighted
- Auto-save 600ms after last edit (matches SessionEditor's existing pattern)
- Cancel / Delete buttons

### FR-4 — In-artifact insertion

When the user is viewing an artifact on the **Outputs** page, the system **shall** show a **"Insert from library"** button in the artifact toolbar (next to Copy / Download .md).

When pressed, the system **shall** open a slide-over panel listing snippets where `appliesTo` includes the current artifact key (or is `null`), with search and tag filters.

When the user picks a snippet, the system **shall** insert its rendered body at the **end of the current artifact's content** (and update the project's `outputs[key]`), stamping `lastUsedAt` on the snippet.

### FR-5 — Placeholders

The system **shall** support placeholders in snippet bodies matching the regex `\{\{([a-zA-Z0-9._]+)\}\}` and, on insertion, **shall** substitute them from the active project using the following key paths (any unmatched placeholder is replaced with the literal `[—]`):

| Placeholder | Resolves to |
|---|---|
| `{{customer.companyName}}` | `project.customer.companyName` |
| `{{customer.industry}}` | `project.customer.industry` |
| `{{customer.regulatory}}` | `project.customer.regulatoryContext.join(", ")` |
| `{{pilot.duration}}` | `project.pilotPlan?.durationWeeks + "w"` |
| `{{today}}` | Today's date, ISO `YYYY-MM-DD` |

Where a snippet contains a placeholder, the **editor preview pane** **shall** render placeholders in monospace amber so the user can spot them. On insertion the substitution is materialised — the inserted text is fully resolved, not templated.

### FR-6 — Export / import

The system **shall** offer a **"Export library"** action that downloads the entire library as a single `library.json` file.

The system **shall** offer an **"Import library"** action that reads a `library.json` and **merges** it with the existing library (snippets with matching `id` are skipped; the user is shown a count of "X added, Y skipped").

This is the only multi-device sync the library supports in v1.

### FR-7 — Library link from Workspace sidebar

The system **shall** expose a "Library" link in the Workspace sidebar (below the project name, above the journey phases), so the library is reachable from any project page without a route guess.

## 3. Non-functional requirements

| Category | Requirement |
|---|---|
| **Performance** | Search **shall** filter ≤200 snippets in <50ms (client-side substring on title/body/tag). |
| **Persistence** | Library **shall** survive browser refresh, project deletion, and tab close (localStorage, not sessionStorage). |
| **Resilience** | If `localStorage` is unavailable or the stored JSON is malformed, the system **shall** fall back to an empty library and surface a one-time toast: "Library reset — could not read stored data." Do not delete the malformed entry automatically. |
| **A11y** | Snippet picker slide-over **shall** be keyboard-navigable (`/` to focus search, arrows to move, Enter to insert, Esc to dismiss). |
| **Privacy** | The library is local-only. No content is sent to any server (including the OpenAI proxy). |
| **Data loss** | Delete snippet **shall** confirm via a native `confirm()` (matches the existing pattern for stakeholder/risk delete). |

## 4. Acceptance criteria (Given / When / Then)

### AC-1 Create a snippet

Given the library is empty,
When the user clicks "+ New snippet", enters title "SOC 2" + body "We are SOC 2 Type II certified", and tags it `["security"]`,
Then the snippet appears in the list with that title and tag chip, persists across browser refresh, and is searchable by typing "SOC".

### AC-2 Insert a snippet into an artifact

Given a project with generated `executiveSummary` and a library snippet tagged `appliesTo: ["executiveSummary"]`,
When the user opens the executive summary, clicks "Insert from library", picks the snippet, and confirms,
Then the snippet body is appended to the artifact content, the artifact updates in the editor, and the snippet's `lastUsedAt` is stamped to now.

### AC-3 Placeholder substitution

Given a snippet body "We will deploy at {{customer.companyName}} by {{today}}",
When the snippet is inserted into a project whose customer is "Meridian Bank",
Then the inserted text reads literally "We will deploy at Meridian Bank by 2026-05-20".

### AC-4 Resilient load on corrupt storage

Given the library JSON in localStorage is invalid (truncated mid-write),
When the user opens `/library`,
Then the page renders the empty-state UI, a toast says "Library reset — could not read stored data", and the corrupt entry is **not** overwritten without user action.

### AC-5 Export → import round-trip

Given a library with 3 snippets,
When the user clicks "Export library" then immediately "Import library" on the downloaded file,
Then the import dialog reports "0 added, 3 skipped" and no duplicates appear in the list.

### AC-6 Tag filter

Given 5 snippets — 3 tagged `security`, 2 tagged `pilot`,
When the user clicks the `security` filter chip,
Then exactly 3 snippets render and the URL updates with a `?tag=security` query param (deep-linkable).

### AC-7 Per-artifact filter in the picker

Given 10 snippets total — 4 with `appliesTo: ["executiveSummary"]`, 3 with `["riskRegisterSummary"]`, 3 with `appliesTo: null`,
When the user opens the picker while viewing the executive summary,
Then 7 snippets are visible (4 specific + 3 universal); riskRegisterSummary-only snippets are hidden.

## 5. Error handling

| Scenario | Behaviour |
|---|---|
| localStorage full (5MB quota exceeded) | Toast: "Library storage full. Export and delete unused snippets." Do not silently drop the save. |
| Import file is not valid JSON | Toast: "Could not read file — must be a `.json` export from this app." Reject the import. |
| Import file is valid JSON but wrong shape | Toast: "File does not look like a library export. No snippets imported." |
| User inserts a snippet then immediately regenerates the artifact | The regeneration **overwrites** the inserted content (this is the existing stale/regenerate behaviour; the user is responsible for re-inserting after regen). Documented behaviour, not a bug. |
| User deletes a snippet that's used in 6 active projects | No-op for the projects (snippet bodies are materialised into artifacts on insert, not linked). Delete confirmation copy mentions this: "Deleting only removes from the library — already-inserted content stays in your projects." |

## 6. Implementation TODO checklist

### Data layer
- [ ] `lib/content-library.ts` — `loadLibrary()`, `saveLibrary()`, `createSnippet()`, `updateSnippet()`, `deleteSnippet()`, `applyPlaceholders(body, project)`
- [ ] Schema in `lib/schemas.ts` — `LibrarySnippetSchema`, `ContentLibrarySchema`
- [ ] Type in `lib/types.ts` — `LibrarySnippet`

### Routing
- [ ] `app/library/page.tsx` — main library page
- [ ] `app/library/[id]/page.tsx` — snippet editor

### Components
- [ ] `components/library/SnippetList.tsx` — list + search + tag filters
- [ ] `components/library/SnippetEditor.tsx` — title/body/tags/appliesTo + live preview
- [ ] `components/library/SnippetPicker.tsx` — slide-over inserted into the Outputs page toolbar
- [ ] `components/library/ImportExportButtons.tsx`

### Outputs integration
- [ ] `app/workspace/[id]/outputs/page.tsx` — add "Insert from library" button to the artifact toolbar
- [ ] Wire `SnippetPicker` modal + `updateProject({outputs: ...})` on insert

### Navigation
- [ ] `components/WorkspaceSidebar.tsx` — add Library link
- [ ] `components/AppHeader.tsx` — same link at the global level

### Tests
- [ ] `tests/content-library.test.ts` — placeholder substitution, schema validation, export/import round-trip, corrupt-load fallback
- [ ] `tests/snippet-picker.test.tsx` (if we add React Testing Library) — appliesTo filtering logic

### Polish
- [ ] Seed 3 example snippets so the empty state isn't the first thing users see
- [ ] Add to the existing app-wide `Cmd+K` palette (if one exists; spec out separately if not)

## 7. Open questions

1. **Snippet ordering** — Most-recently-used? Alphabetical? Manually pinned? Default to MRU, allow toggle.
2. **Insertion target** — Spec says "append to end of artifact". Alternative: insert at cursor position in a future inline editor. Defer until inline editing exists.
3. **Markdown vs plain text snippets** — Spec assumes markdown. If users paste plain text it still works (markdown is a superset). No special-case.
4. **Should `appliesTo` enforce or just filter?** — Spec is "filter only" (no hard block) so a user can override and insert anywhere. Confirms the principle of letting humans break rules.

## 8. Risk + mitigation

| Risk | Mitigation |
|---|---|
| Users mistake the library for a pinned/synced cloud feature and lose snippets when clearing browser data | Empty-state copy explicitly says "Stored on this device only. Export regularly." |
| Placeholder syntax conflicts with markdown features users want to write literally | Document that `\{\{...\}\}` is reserved; offer `\{{` escape. |
| Library grows to 1000+ snippets and search lags | Defer indexing until measured; localStorage hits a 5MB ceiling well before this becomes a problem. |
