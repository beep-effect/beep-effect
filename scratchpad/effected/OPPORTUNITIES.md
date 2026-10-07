# effected-port friction receipts

Receipts are appended at the moment friction happens (goal section 0.4).
Paths use `~`; no secrets, no machine ids.

## 2026-10-07 — a parse error hid every Effect diagnostic

- **What:** the first runner check showed only seven TS1xxx parse errors and no
  Effect rule at all, while the IDE showed `missingPipeableSignature`.
- **Evidence:** `tsgo -p effected/runner/tsconfig.json` → `Knowledge.ts(203,69):
  error TS1109`. A JSDoc Example contained the glob `../../test/yaml/**/*.ts`;
  its `*/` closed the comment. With a syntax error tsgo stops before semantic
  and plugin diagnostics, so 99 real diagnostics were invisible.
- **Prevention:** the `check` gate now runs tsgo over
  `scratchpad/effected/.canary/EffectDiagnosticsCanary.ts` first and fails
  unless `missingPipeableSignature` (upstream default `off`) and
  `strictBooleanExpressions` are reported. Never write `*/` inside a JSDoc
  fence; ported upstream examples with globs need the same care.

## 2026-10-07 — `beep laws effect-imports` scans nothing in the lab (or anywhere)

- **What:** `bun run beep laws effect-imports --check --include <lab files>`
  exits 0 with `scanned_files=0`.
- **Evidence:** `packages/tooling/tool/cli/src/commands/Laws/EffectImports.ts`
  lists `scratchpad/` in `NON_SHIPPING_PREFIXES` (excluded even with
  `--candidate`), and `EFFECT_IMPORT_PROMOTED_FAMILY_PREFIXES` is empty, so in
  code mode without `--candidate` the law returns `scannedFiles: 0` for every
  path in the repo; `--write` is a no-op for the same reason.
- **Prevention:** the `lint` gate runs `effect-imports --check --candidate` on
  a git-ignored mirror under `coverage/effected-laws/<target>/` and requires
  the law canary `scratchpad/effected/.canary/LawsCanary.ts` to be reported.
  Upstream code imports from root `"effect"` heavily, so S1 needs a root-import
  codemod that the law cannot supply here (candidate mode is dry-run only).
  Repo follow-up candidate: an explicit opt-in for non-shipping paths, and a
  `scanned_files=0` hard failure whenever `--include` names files.

## 2026-10-07 — the laws skip test files by scope

- **What:** with 14 runner files given (one test), `effect-fn` and
  `native-runtime` report `scanned_files=13`.
- **Evidence:** standards/effect-laws-v1.md "Excludes by default: tests".
- **Prevention:** tsgo covers tests with the same Effect rule set at `error`;
  the gate states this instead of implying law coverage of tests.

## 2026-10-07 — `docgen doctest verify` selects no scratchpad files

- **What:** `bun run beep docgen doctest verify --include
  'scratchpad/effected/runner/**/*.ts'` prints `doctest: 0 file(s)` and exits 0.
- **Evidence:** discovery admits `packages/**/src` and `apps/**/src` only (also
  recorded in `scratchpad/effected/jsonl/README.md`).
- **Prevention:** the `docgen` gate prints the limitation; runnable fences run
  through the `@effect/doctest` vitest plugin in the test gate, and a docgen
  canary with an ill-typed Example proves example typechecking is live.

## 2026-10-07 — vitest treats a doc mention of the doctest marker as a test file

- **What:** after a JSDoc sentence named the runnable-fence marker literally,
  vitest reported `No test suite found in file .../runner/Gates.ts`.
- **Evidence:** `includeSource` matches any file containing the marker text.
- **Prevention:** never spell the marker in prose inside `scratchpad/effected/**`.

## 2026-10-07 — the Grok seat returned an empty review in plan mode

- **What:** jsonc round 1's grok.md held only the seat's opening sentence (325
  bytes, exit 0, no REQUIRED/BACKLOG line).
- **Evidence:** `grok ... --permission-mode plan` headless stops at its first
  plan hand-off; `--sandbox read-only` refuses to start on this host
  ("could not resolve runtime-socket deny path /run/podman/podman.sock").
- **Prevention:** the seat now runs with `--tools "read_file,grep,list_dir"`,
  `--deny "Write(**)" --deny "Edit(**)"` and `--always-approve`; the runner's
  post-seat `git status` scope check stays the backstop. A seat report without a
  `REQUIRED:` line counts as unavailable, never as zero findings.
