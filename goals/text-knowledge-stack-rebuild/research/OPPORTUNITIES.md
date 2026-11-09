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

## 2026-11-09 — round-1 review of PR #2993

- **Doing:** running the cross-provider reviewer panel through orx delegates.
  **Evidence:** every Codex (`gpt-6.1-sol`) delegate finished its report and then
  looped on a Stop-hook error (`codex/1.0.6/scripts/stop-review-gate-hook.mjs`
  not found) until cancelled; every Grok (`grok-4.7`) delegate blocked on
  per-command approvals until relaunched headless with
  `grok --always-approve --permission-mode bypassPermissions`. **Would have
  prevented it:** a permission-mode input on delegation, and a stop hook that
  degrades to a no-op when its script is absent.
- **Doing:** adding Graphviz SVG figures under `research/figures/`.
  **Evidence:** `bunx biome check` fails on Graphviz output (`<?xml ...?>` and
  `<!DOCTYPE svg ...>` are parse errors for Biome's HTML parser, and
  `lint/a11y/noSvgWithoutTitle` wants a `<title>`), which the `yeet
  final-check` lint gate and the pre-commit hook both run. **Would have
  prevented it:** a documented `dot` post-processing step (or a `biome.jsonc`
  exclusion for generator-owned figures) in the docs guidance.
- **Doing:** writing the SPEC verification matrix. **Evidence:**
  `bun run beep lint laws --package @beep/<pkg>` accepts the alias, scans zero
  files and exits 0; only a workspace directory path scans anything. **Would
  have prevented it:** the command refusing an alias or resolving it to the
  workspace directory.
- **Doing:** describing `@beep/nlp-processing` as a package to create.
  **Evidence:** it already exists at `packages/foundation/capability/nlp-processing`
  with 69 tracked files and an instrumentation shard; the rebuild report and the
  first SPEC draft missed it because the inventory of foundation packages was
  rebuilt by hand. **Would have prevented it:** a `bun run beep architecture`
  listing of packages by family and kind cited in the knowledge-stack chapter.
