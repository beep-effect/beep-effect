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

## 2026-10-07 — concurrent review rounds trip each other's scope guard

- **What:** jsonc round 2 reported "OUT-OF-SCOPE CHANGE scratchpad/effected/jsonl/.review/"
  and exited red, because jsonl round 1 started while jsonc's seats ran.
- **Evidence:** `bun run --cwd scratchpad audit:effected -- review jsonc 2 --seats` output.
- **Prevention:** the guard should exempt every `scratchpad/effected/*/.review/` path, not
  only the current round's directory. Same run: the Grok seat exited 1 with an 823-byte
  report and no REQUIRED line; rerun once, else record it unavailable (section 12.2).
- **Follow-up (jsonl round 1):** the Grok seat exited 1 again (509-byte report, no REQUIRED
  line), so it is failing systematically with the allowlist launch; diagnose its exit
  (stderr is redirected into grok.md only partly) before the next round. The same run flagged
  "cratchpad/effected/OPPORTUNITIES.md": `capture` trims the whole `git status --porcelain`
  output, so the first line loses its leading status space and `Str.slice(3)` eats the path's
  first letter; parse porcelain lines with a regex instead of a fixed slice.

## 2026-10-08 — the Grok seat's exit 1 was its turn budget, not quota

- **What:** two rounds stalled on a seat that exited 1 with a few lines of narration and no
  findings; the round could not close without it.
- **Evidence:** `grok usage <session>` showed `modelCalls: 80` for both failed sessions, exactly
  the launch's `--max-turns 80`; the round that succeeded used 47. `grok export <session>` showed
  the seat still reading files when it stopped (about 190 tool calls).
- **Recovery:** `grok --resume <session> --prompt-file <"write the report now">` with the same
  model, effort and read-only tool flags returned both reports without redoing the reading.
- **Prevention:** the launch now allows 200 turns; a seat exit 1 means "read `grok usage`" before
  it means "unavailable". The scope guard now matches porcelain status letters instead of slicing
  by column and exempts every module's `.review/` directory; the lint, parity, canon and brief
  surfaces include `scratchpad/test/jsonl.test.ts`; the JSDoc law rejects a second lead paragraph.

## 2026-10-08 — the upstream checkout moved past the ledger's pinned commit

- **What:** the jsonl parity gate went red mid-round ("31 expected, 37 actual") although nothing in
  the lab had lost an export, and a fix lane had to rebuild the oracle by hand before it could
  compare behaviour.
- **Evidence:** the ledger pins upstream `af7566a9`; `git -C ~/YeeBois/references/effect/effected
  reflog` shows `pull --ff-only origin main` on 2026-10-07 13:51 and 2026-10-08 20:57 (the scheduled
  references refresh), leaving HEAD at `6893a055`. 171 package files differ, including a redesigned
  jsonl 0.11.0; jsonc and memfs differ only in `package.json`. Reviews run before the first pull read
  the pinned code; anything reading the live checkout afterwards did not.
- **Prevention:** the runner now resolves the oracle on every run: while the checkout stands on the
  pin it reads the checkout, and once it has moved it reads a `git archive` export of the pinned
  commit under `~/.cache/beep/effected-port/upstream/<commit>` (built once, with `node_modules` links
  for `effect`, `@effect` and each `@effected` package so probes can import upstream source). The
  reviewer brief names that path. Porting newer upstream is a separate refresh, not a drift.
- **Same run:** `EFFECTED_UPSTREAM` silently switched off the editor-tsgo half of the check gate,
  because the gate derived the home directory from the upstream path; the config now carries it.

## 2026-10-08 — escapes typed through a tool call arrive as the literal character

- **What:** a fix that wrote U+2028, U+2029 and U+FEFF as backslash-u escapes landed as the raw
  characters, which is the very defect one finding asked to remove.
- **Evidence:** fix lanes for jsonc round 2 (fable-2-6) and jsonl round 1; two raw BOM characters
  that predate the round remain at `scratchpad/test/jsonl/JournalDeviations.test.ts:47` and `:66`.
- **Prevention:** write such characters from code points (`String.fromCodePoint`) or patch the file
  with a script, then check the bytes (`od -c`). Related: the repo's biome config excludes
  `scratchpad/`, so formatting a lab file means piping it through `biome format --stdin-file-path`.
