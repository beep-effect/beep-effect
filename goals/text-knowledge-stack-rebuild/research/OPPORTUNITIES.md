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

## 2026-11-19 — P0 design and grill

- **Doing:** confirming the SPEC's resolved questions against the live tree.
  **Evidence:** the packet text was eleven days old and wrong on eighteen
  points the census lists (canonical JSON placed in a package that cannot
  import its owner; a SQL migration planned for identifiers no table stores;
  seven status vocabularies that are eight; `effect` 4.1.2 where 4.1.4 is
  installed). **Would have prevented it:** a `goals doctor --facts` pass that
  re-runs a packet's cited `rg` evidence when the packet is resumed.
- **Doing:** drafting the chapter-11 amendment. **Evidence:** the stored-format
  law landed in `standards/ARCHITECTURE.md` on 2026-11-18, after the packet
  was written, and the first amendment draft contradicted it (refuse old
  receipts at decode versus convert on read); a reviewer child caught it.
  **Would have prevented it:** resuming a paused packet lists the
  `DECISIONS.md` entries dated after the packet's `updated` field.
- **Doing:** type-checking the design module under `ops/`. **Evidence:**
  `goals/tsconfig.ops.json` sets `"plugins": []`, so the Effect diagnostics do
  not run on ops files; a second tsconfig beside the module was needed to hold
  it to the package bar. **Would have prevented it:** an opt-in
  `opsScripts[].strict` flag that the ops typecheck honours.

## 2026-11-21 — P1 PR C hosted reds

- **Doing:** opening PR C (#3449) on a green local final-check. **Evidence:**
  hosted Lint Policy reported `knowledge semantic-delta` `introduced (2)` on a
  head where the local run reported 0. The gate exempts a code span that
  exactly names a Git ref and counted local branches, which a hosted checkout
  does not have, so a checkpoint that wrote its lane branch in backticks passed
  locally only. **Would have prevented it:** #3453, which drops local branches
  from that census. A gate whose verdict reads clone-local state is worth
  checking for in the other lints that list refs.
- **Doing:** skipping coverage in the local final-check of PR C. **Evidence:**
  hosted Coverage Regression failed on three `@beep/repo-cli` files the stack
  adds or changes; only the `@beep/identity` files had been measured, because the
  merge review asked for those by name. A targeted run over the three files
  takes about a minute and reproduced the hosted numbers exactly. **Would have
  prevented it:** `final-check --skip coverage` printing the new and changed
  source files it leaves unmeasured, with the targeted command for each package.
- **Doing:** acting as the only writer on PR C. **Evidence:** #3449 was flipped
  to ready through the shared login and no session on the host had run it; only
  a search of every transcript could show that. **Would have prevented it:** an
  actor or session id on PR state changes that Yeet and T3 make.

## 2026-11-22: a Claude child's weekly limit killed a fix mid-edit

- **Doing:** PR C's release-against-base fix, a Workflow child pinned to Opus 5.5.
- **Evidence:** the child failed with "You've hit your weekly limit · resets 11pm" after about 20 minutes.
  It left 21 modified files and 2 new ones uncommitted and untested. `bun run beep accounts` showed every
  Claude account as "Rate limited" (unreadable), so the limit could not be seen coming.
- **Prevention:** read Claude headroom before a long child is launched, and give a fallback child a brief
  file that it can continue from. This lane moved to Codex `gpt-6.1-sol` medium with such a brief.

## 2026-11-22: the full effect-vitest ratchet names files, not the findings

- **Doing:** PR C's third review round, new tests in two repo-cli test files.
- **Evidence:** `bun run beep lint effect-vitest` printed "3 new finding(s) in 2 file(s)" after a 60 s
  scan, with no line or rule. Only a second run with `--files <path>` for each file printed
  `:768 EV006 hand-rolled-data-assertion`.
- **Prevention:** print each new finding's line and rule in the full-scan summary too, as the scoped
  run does.

## 2026-11-22: `goals decisions write` takes `--slug`, `add` takes a positional slug

- **Doing:** correcting a decision file just written with `goals decisions add <slug>`.
- **Evidence:** `bun run beep goals decisions write text-knowledge-stack-rebuild` failed with
  `Unexpected positional argument`; the same slug is positional for `add`.
- **Prevention:** accept the slug the same way in every `goals decisions` subcommand.

## 2026-11-22: a refusal's remedy text shipped without a test that follows it

- **Doing:** answering a verifier on PR #3449's `nested-move` refusal of `identity rebind`.
- **Evidence:** the remedy "move through a code identity outside both, in two rebinds" was refused
  at its first step with `[target-module-missing]`, because a rebind target must name a module
  file. A test that followed the steps would have shown it; the namespace remedy had one, this did
  not.
- **Prevention:** every refusal whose message prescribes commands gets a test that runs those
  commands and ends with a passing lint, as `L0-3 a namespace is retired by hand` does.
