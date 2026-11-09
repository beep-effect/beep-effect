# Text-Knowledge Stack Rebuild — Opportunities and Friction

Receipts recorded at the moment the friction happened. Redact secrets, replace
home paths with `~`, drop session and machine ids.

## 2026-11-08 — packet bootstrap

- **Doing:** scaffolding this packet with `bun run beep goals bootstrap`.
  **Evidence:** both archetypes (`standard-delivery`, `report-first`) emit a
  five-phase table (`Read-only report`, `FP eyeball`, `Gated mutation`, Yeet,
  Close) that does not fit a design-first, multi-layer program; `PLAN.md` and
  `ops/manifest.json` `phases[]` were rewritten by hand immediately after the
  seed. **Would have prevented it:** a `design-program` archetype (design and
  grill, N delivery phases, census, yeet, close) or a `--phases` input the
  compiler accepts.
- **Doing:** carrying seven research reports and three figures from the
  OpenResearch artifacts directory into `research/`. **Evidence:** manual
  copy, `sed` to replace absolute home paths, a hand edit to abridge a
  3,700-line schema index, and a rewrite of the report's sibling links to the
  dated file names. **Would have prevented it:** a `goals research import
  <path>` that dates, sanitizes and re-links a report in one step.
- **Doing:** rebuilding the cross-package picture of the stack before the
  design. **Evidence:** about twenty targeted greps across six packages to
  recover which anchor encodings exist, which codecs are missing and where
  defaults are invented; `standards/ARCHITECTURE.md` has no chapter on text,
  knowledge or meaning. **Would have prevented it:** the knowledge-stack
  chapter this packet's P0 drafts.
