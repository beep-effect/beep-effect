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
