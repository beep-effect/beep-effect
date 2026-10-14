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

## 2026-10-09 and 2026-10-14 — the Codex usage limit killed every lane in flight, twice

- **What:** running review rounds 2 and 3. Each module's fix, merge, repair and bookkeeping lanes were
  `codex exec --model gpt-6.1-sol` processes under transient user units, fed by Python drivers.
- **Evidence:** every lane alive at the moment exited 1 with `fixed=0`, and its log read
  `ERROR: You've hit your usage limit. ... try again at Oct 16th, 2026` (2026-10-09 21:07 CDT), and
  `... Oct 20th, 2026` (2026-10-14 00:30Z, after a weekly reset that lasted about 2.5 hours). The
  drivers marked the modules `INCOMPLETE`, and the repair watcher spent both attempts on the dead lanes
  and wrote `GAVE UP`. Nothing noticed until the next session resumed three days later. On resume, a
  probe `codex exec` looped on the repository's Stop hook, because one stale P0 inbox row was
  unacknowledged.
- **Cost:** about three idle days for four modules, a manual census of which lanes had died, and a
  second relaunch on another route.
- **Prevention:** lane runners should match the usage-limit message, stop launching, and write one
  `blocked: codex quota` row instead of burning repair attempts. Check the account's remaining quota
  (`bun run beep accounts`) before a fan-out. The runner should also ship a route-agnostic lane
  command. This port improvised one only as an uncommitted, session-local shell helper, which is gone
  with the session. Its core was `claude -p --model claude-opus-5-5 --permission-mode acceptEdits
  --add-dir <scratch> --allowedTools <tools> --output-format text < brief.md > report.md`, with a read-only
  tool set for review seats. The drivers selected it by an environment variable (`LLM_ROUTE=claude`).
  Nothing in the repository provides it yet.

## 2026-10-13 — continuing a lab branch after its progress PR was squash-merged

- **What:** publishing progress PR 2 from `@lab/effected-2` after progress PR 1 (#1628) had been
  squash-merged into `main`.
- **Evidence:** `git merge-tree --write-tree --name-only HEAD origin/main` listed about 30 conflicting
  `scratchpad/effected/**` files. Round 3 had edited content that the squash commit already held, and a
  squash carries no ancestry, so git could not see it. A blanket `git merge -s ours <squash>` would have
  silently dropped three unrelated `main` commits (#1627, #1619 and a goals feature) between the earlier
  main merge and the squash. The safe sequence: merge the pre-squash PR head (tagged first so it could
  not be collected), merge `main` up to the squash's parent, `-s ours` on the squash alone (checked:
  zero differences outside `scratchpad/`), then merge `main`.
- **Cost:** one dry run, a planning pass, and a tag to keep the pre-squash head alive.
- **Prevention:** merge progress PRs from long-running branches with a merge commit, or restart the lab
  branch from `main` after each squash (done after #1592). Or ship a squash-aware re-integration helper
  that verifies "content already held" before recording an `ours` merge.

## 2026-10-13 — the runner's check gate followed the editor's newest tsgo

- **What:** integrating round 3. The runner's `check` gate also runs the newest tsgo found in the
  WebStorm cache (`~/.cache/JetBrains/*/effect-tsgo/<version>`).
- **Evidence:** editor tsgo 0.52.0 appeared mid-run and exits 1 when it prints only suggestion-level
  diagnostics (369 `TS377141` in github-actions). The gate read the exit code, so `check` went red for
  most modules, and repair lanes started chasing false reds. Concurrent gates also copied the 26 MB
  binary into the same staging directory, so one could execute a half-copied `tsc`. After merging
  `main`, the same tsgo raised real errors that only the editor build enforced: `unnecessaryTypeofType`
  on #1621's new aliases, and `preferSchemaTypeProperty`.
- **Cost:** nine false reds cleared by hand, one repair lane stopped, and a fix pass on the progress PR
  head.
- **Prevention:** classify the captured diagnostics, not the exit code; stage through a private
  directory and an atomic rename (both shipped in the runner). Pin the editor tsgo the gate uses, or
  record its version with the verdict, so a desktop update cannot change the gate mid-run.

## 2026-10-13 — `ts.preProcessFile` lost its place and the parity gate read JSDoc as code

- **What:** the parity gate's foreign-specifier scan (`foreignSpecifierLines`), which must ignore
  JSDoc example imports of `@beep/scratchpad/effected/...`.
- **Evidence:** a regex literal holding a quote inside a template (yaml: `` `'${s.replace(/'/g, "''")}'` ``)
  and regex literals holding a backtick (markdown: `` /^[#`~*+_=<>0-9-]/ ``, the code-fence pattern)
  desynchronized the lightweight scanner. Every later JSDoc example import then counted as a real one
  (`@effected specifier at .../blockParser.ts:702`). A bisect probe found the culprit lines. The first
  case was worked around by rewriting the source line; the second showed the class of bug.
- **Cost:** two false parity reds, a give-up on one module's repair lanes, and two bisects.
- **Prevention:** never rely on `preProcessFile` for anything that gates. The scan now walks the
  TypeScript syntax tree, with a regression test covering backtick and quote regexes before a JSDoc
  example.
