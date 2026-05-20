# Specs

EARS-format feature specifications for the AI Onboarding Simulator.

Format: each spec includes overview + user value, functional requirements
(EARS), non-functional requirements, acceptance criteria (Given/When/Then),
error handling, implementation checklist, open questions, and risks.

## Active P1 specs

- [Content Library](content-library.spec.md) — reusable snippets across projects
- [PDF / DOCX Export](pdf-export.spec.md) — real customer deliverables, audience-scoped

## Conventions

- EARS triggers: `When X, the system shall Y.` / `Where Y is true, the system shall Z.` / `The system shall A within B.`
- Acceptance criteria use Given/When/Then with concrete values (real customer names from the seeded scenarios where possible).
- Open questions are explicit — better to call out the unknowns than pretend the spec is closed.
