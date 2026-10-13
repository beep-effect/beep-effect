# Inherited-red burn-down — 2026-10-09

Lane: `rsc-burndown`; branch: `fix/rsc-burndown-2026-10-09`.
Base integrated: `0684c57f99` (#1583), retaining #1580. The orchestrator owns
merge and lane retention.

- Admitted exactly the EV015 occurrence at
  `packages/epistemic/use-cases/test/ContradictionDetection.golden.test.ts:126`.
  Its reason records the owner, serial fork-free clock-independence witness,
  and reconsideration when the canon provides a serial-clock helper.
- Knowledge refs wording was already fixed on main; its gate passed.
- Markdown import scanning skips NotFound reads after directory disappearance
  and counts only files read. TS discovery already prunes directories and loads
  source files only when present. The deletion regression passed, along with
  the recovered `9096773a34` Markdown ordering patch (31 focused tests).
- Packet SPEC and friction ledgers use union merges; new receipts must use
  lane-specific names. Existing receipts remain in place.
- The roadmap reflects domain-kernel resumption, P0 in #1577, and P1 in progress.
- Secret Scanning and SAST optionally authenticate Docker Hub. Both steps were
  checked with absent, partial, and complete fixture credentials; only a full
  pair logs in. The operator can configure the repository secrets later.
- Full docgen passed all 140 tasks, including infra's 106 examples and the
  docs aggregate. The reported Pulumi SDK compiler errors did not reproduce.

Before #1583 integration, qualification passed full repo-cli audit/docgen, the focused suite,
Effect/Vitest (zero introduced findings), both import lanes, test-tsgo,
knowledge refs, and Fallow audit. The final worker report records proof scope and the held publication state. Heavy commands use the shared admission
wrapper with the required concurrency and memory settings. Revert this PR to
reverse the scoped source, workflow, inventory, and documentation changes.

Publication is blocked by #1583's two schema-first and twelve Effect/Vitest
judgments, owned by the admission lane. Yeet created the local repair commit
but withheld the push; no PR or S13 final signal exists. Both P0 inbox rows were
acknowledged with attribution. No merge or retirement occurred.

A second package audit overlapped base integration and is quarantined. A fresh
stable-source replay passed all 106 tests in five files, including the formerly
failing operational adapters, Knowledge import family, and deletion regression.
A complete stable-head package proof remains unclaimed. Resume publication
only after the owned admissions land; keep the checkout fixed during proofs.

## Run 2 — authorized occurrence-specific C admission

Resume ruling dated 2026-10-09T22:52Z assigns this lane the fourteen reviewed
C occurrences and authorizes direct commit/push/PR creation if Yeet still
refuses. The two Accounts StructWithRest exceptions preserve lossless external
wire metadata. The twelve test exceptions retain invocation-specific fixture
layers, shorter helper scopes, real platform boundaries, and the relocated
installed-Graft regression. Every exception records program ownership, lane C,
its source-bound reason and reconsideration when B's census lands. Existing
inventory rows and counters remain untouched.

Integrated main `cb64e0484f` (#1588) before source freeze and qualification.
The seven original fixes and full-docgen pass remain recorded above; Run 2
qualification will provide fresh terminal gate and full-package results.
No merge or retirement is authorized. Revert the burn-down PR to reverse the
repair and these admissions; B's census is the follow-up review boundary.

Run 2 schema-first attribution: both approved Accounts candidates are resolved,
but `SFV4-arbitrary-tests` at `ci-runner-security.test.ts:79` remains inherited.
C's terminal publication attribution table describes that golden workflow
advisory, beyond the explicit two-plus-twelve admission ruling. No fifteenth
inventory row is added. The unchanged-main source proves attribution; the gate
is reported red, and the resume ruling's authorized fallback applies if Yeet
still refuses. B's census owns reconsideration. The friction receipt is in
`research/OPPORTUNITIES.md`.

## Desktop continuation — publication resume

Permissions verified: disabled filesystem sandbox / unrestricted access, with
approval policy never. No managed/workspace-write/on-request mismatch occurred.
Run 2's full repo-cli proof passed audit 928.8s and docgen 31.2s; its source base
was the retained pre-integration tree. Current main was integrated before the
new source freeze. The same fourteen C admissions are retained; the global
Effect/Vitest inventory was regenerated to reconcile main's changed anchors.
No additional exception is admitted for the inherited ci-runner-security
SFV4-arbitrary-tests advisory; the program admission owner must disposition it.

Items 10 and 11: deleted the two changesets naming private packages and excluded
unshipped scratchpad lab fixtures via .semgrepignore. Semgrep is not installed
locally; the relevant rules are beep-hardcoded-private-key and
unknown-value-with-script-tag. Main's hosted Secret Scanning passed; no new
.gitleaksignore rows were added. The merge hook flagged an existing documentation
PEM header; only that hook was excluded for the main merge, preserving hosted
secret-scanning authority and avoiding a broader scanner allowance.

Item 12 remains a follow-up: the pinned dependency-review-action v5.0.0 does
not expose a manifest-path exclusion input. Adding an unsupported input would
not implement the requested fixture boundary; no whole-check or advisory-wide
bypass is introduced. Item 13 remains with its owning scratchpad port lane;
its es2024 and metadata-scope repairs are now on main.

Item 14: the canonical script generator added missing doctest task and
implementation keys to law-practice/server and epistemic/domain,use-cases.
The main hosted Lint Policy log identifies exactly these three drifting
manifests. Fresh full policy results are retained in the ignored proof logs.

Item 15 remains a follow-up: the main coverage job for 45f334e3c2 printed
regressions for RDF, repo-cli and CredentialPatternBank, but no complete
baseline rows with uncovered-unit counts. The later hosted log ends before
coverage completes. No coverage floor is guessed or lowered from percentages.
Attribute RDF MdSections to #1588, CredentialPatternBank to #1570, the ported
CLI commands to #1583, and DirectoryHandle to #1580. Retain hosted-verbatim
complete rows or add focused tests in the owning follow-up.

Canonical publish created the repair commit, then refused its cheap proof on
three inherited schema advisories and cache baseline drift from the generated
scripts. The cache recorder now reports zero blocking findings after reviewing
exactly the three manifest subjects; no cache qualification was granted.
The authorized direct push/PR fallback is used with the inherited schema reds
reported. Full policy also identifies inherited scratchpad disabled diagnostic
directives and the root language-service profile mismatch. These remain with
the porting/policy owners; they are not suppressed in this repair.

## Terminal publication result

PR #1605 is published and ready for review. Source proof head:
`01f5f2cd8d5fb29dadd4a534cdad5cf11e253336`. Fresh full repo-cli verification
passed audit 837.8s and docgen 24.4s. The three generated-script packages passed
quick lint/check after their upstream build closure passed all 39 tasks; the
first missing-dist TS6305 runs were environment-only and acknowledged.
Effect/Vitest, both import lanes, test-tsgo, knowledge refs, Fallow audit/health,
workflow lint and the reviewed cache-policy audit pass. Full policy remains
red on inherited test advisories, scratchpad diagnostics/inline schemas and
JSDoc/deprecation surfaces; package-scripts itself is repaired and passes.

Hosted SAST, Secret Scanning, Security, Build, Check, Docgen, Doctest and Test
Integration passed on the source proof head. Repo Sanity's changeset graph and
status pass; its remaining red is inherited minimatch/smol-toml syncpack drift.
JSDoc Ratchet again reports the inherited opaque inventory-generation failure.
Vercel failures explicitly link to build-rate-limit and are environment-only.
All observed inbox rows were attributed and acknowledged; no review threads
were present at the successful thread read. No merge-ready claim is made.

The bounded readiness monitor remains registered for the orchestrator. The
S13 final signal records the current published head; the external worker report
records its job id and exact status. This terminal documentation update changes
no package source, generated scripts, inventory or policy baseline after proof.
Permission state remained unrestricted / Never ask. No merge or retirement was
performed. The original retained stash and ignored patch remain recoverable.

Two P2 human review comments identify the deliberate whole-SPEC union and
whole-scratchpad scanner boundaries requested by the brief. Their tracked
follow-ups are RSC-BD-REVIEW-01 and RSC-BD-REVIEW-02 in
`history/receipts/stage-6-rsc-burndown-review-followups.md`; replies explain the
current mandate, risk, reversible setting and acceptance for the follow-up.
No source or policy boundary is silently changed during this review wave.


## Run 3 — 2026-10-13 inherited-main repair wave

Lane `rsc-burndown`, branch `fix/rsc-burndown-2026-10-13`, base
`6e390049cae8ece9b6c694dd6f672825401b157f`. Prior runs and #1605 remain retained.
The worker never merges or retires this lane. All heavy proof uses beep-heavy
and TURBO_CONCURRENCY=2; the lane unit retains MemoryHigh 36G / MemoryMax 40G.

- Item 12 remains open: dependency-review v5.0.0 supports no manifest-path
  exclusion. Its pinned action.yml and src/schemas.ts expose neither a path
  filter nor a dependency-comparison input. Preserve the action until a
  manifest-aware comparison integration is qualified.
- Item 15: repaired the Node test shim's missing Bun.spawn output streams,
  which caused two practice-kg startup tests to read empty stderr. The stream
  witness passes; both startup cases pass; app coverage passes 31/31 tests.
  The full pre-repair coverage run and the current ratchet result are recorded
  separately in the worker report. No coverage floor is lowered.
- Item 16 is already fixed on main: the full effect-vitest scan is green after
  re-anchoring the hoisted CLI fixture occurrence; the inherited PracticeKg
  occurrence does not recur. Inventory refresh preserves admissions and changes
  only identities/line anchors, including stale main anchors in Host and Corpus.
- Item 17 is already correct on main: renaming shared-domain's deletedAt column
  in a disposable dirty probe changes law-practice-tables test dry-run hash
  adb33a6bd107efa3 to 03713802b97245f8. Original bytes restored. No Turbo edit.
- Item 18: hoist the 16 non-lab codec-schema call sites reported by main's
  Oxlint log; exclude unshipped scratchpad from Oxlint and diagnostic-directive
  scanning per the brief; inherit the canonical root compiler plugin profile;
  admit the three fixed-contract test advisories with exact reasons; include
  the two office-action fixture files in ESLint's default project.
- Item 19: local inventory generation succeeds and reproduces eight real
  source metric increases. Emit the nested typed cause at the generation
  boundary so a hosted-only failure is diagnosable. Source documentation
  remediation remains open; the totals baseline is preserved.
- Item 2: knowledge refs passes with zero live gated observations. Repo Sanity
  failed Syncpack at base `6e390049ca` before the root minimatch override and
  scratchpad smol-toml range alignment. Syncpack passes at head `b85d072730`
  after those repairs and lockfile generation. Image staleness is a separate advisory:
  preserve the baked receipt until a real image/canary refresh.

Attribution: main job 115443989798 names the current lint failures. #1592 owns
the scratchpad/profile drift; #1595 owns both M365 test advisories; #1583 owns
the CI golden advisory; #1572 owns the epistemic inline schemas; #1573 owns
the office-action inline schemas and fixture project gap; #1598 owns the
ontology inline schemas. The remaining CLI codec sites belong to #1583 and
the retained residue/Yeet source. The Bun spawn shim was last changed in #1435;
#1604 exposed its incomplete stream contract in startup tests.

JSDoc attribution matches domain-kernel D24: scratchpad (#1592) accounts for
canary tags, schema companions/annotations and whitespace/example findings.
The three CLI Corpus examples, four infra examples and one Freshbooks example
are retained source gaps. No baseline is regenerated to hide these findings.
Coverage job 114072726532 on 45f334e3c2 reached the ratchet; its RDF new-file
row belongs to #1588, CredentialPatternBank new-file rows to #1570, and the
operational CLI changes principally to #1583 plus the retained source owners.
The newer job 114132486598 stops on the two startup tests before the ratchet,
so its failure is not evidence of measured baseline rows.

Qualification and final publication state are in the worker report at
`~/.cache/beep/orchestrator/gates/rsc-burndown.codex.last.md`. Full lint's first
repair retry was killed at the 32G cap; the 40G retry completes its medium tier
with 167/168 tasks passing and only the eight inherited JSDoc metrics red.
The generic generation failure does not reproduce locally. All commands and
raw local logs are retained under `.beep/rsc-burndown/` (ignored).

Reverse this wave by reverting its PR. No packet lifecycle state, image pin,
coverage/JSDoc baseline, paid service, merge or retirement changes.

## Run 4 review wave (2026-10-13)

PR #1612 round 1 had three Minor threads. The effected lint gate now passes
`.oxlintrc.effected.json` explicitly. It extends the root rules and plugin and
admits scratchpad paths. Before this change, `lint:effected jsonl` reported no
files and failed its missing-canary check; afterward its Oxlint step reports
`oxlint clean (canary flagged)`. The Syncpack receipt now names failing base
`6e390049ca` and passing head `b85d072730`. The Bun.spawn decision row remains
inside its table after removing the intervening blank line.

The hosted JSDoc job 115466055746 exposes a broken YAML fixture symlink during
`FileSystem.stat`. Run 4 retains that inherited red under S11; the shared CI
repair lane owns the traversal repair. Its P0 inbox row is acknowledged with
that attribution; the interrupted proof job result is acknowledged as observed.
No JSDoc or coverage baseline changed. Qualification and publication results
are in the worker report; raw run-4 logs are under `.beep/rsc-burndown/run4/`.
Reverse this review wave by reverting its commit. No merge or retirement.

Run-4 local proof: `bun run --cwd scratchpad lint:effected jsonl` exits 0,
including Oxlint and all four law checks. `package-verify @beep/scratchpad
--quick` exits 0 but skips both standard steps because this lab package has no
`beep:lint` or `beep:check` script. The explicit runner check and collected
cheap-gate outcomes are recorded separately in the final worker report.
The explicit `check:effected runner` also exits 0, including live Effect
canary diagnostics, editor tsgo 0.51.1 and the workspace tsgo check.
