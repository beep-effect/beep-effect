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
