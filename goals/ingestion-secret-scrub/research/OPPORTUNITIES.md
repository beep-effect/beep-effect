# Friction receipts — ingestion-secret-scrub

## 2026-10-09 — heavy admission user bus

- Work: P0 fixture integrity proof through `beep-heavy --detach`.
- Evidence: `Failed to connect to user scope bus`; user runtime and bus variables were absent.
- Attribution: environment-only; no test or source ran.
- Repair: use the existing user-manager runtime and bus environment for heavy launches.
- Prevention: launcher should supply the user-session bus environment.

## 2026-10-09 — P0 canonical test gate

- Work: first-wave Yeet publication.
- Evidence: `lint:effect-vitest` reported one new `EV010` filesystem candidate in the fixture integrity test.
- Attribution: introduced; direct filesystem read used despite an existing platform layer dependency.
- Repair: `it.layer(BunFileSystem.layer)` and the Effect `FileSystem` service; no baseline refresh.
- Prevention: use the package's existing platform test pattern for source-integrity checks.

The platform-layer attempt still triggered a new informational inventory candidate.
Final disposition: remove filesystem acquisition from the integrity test; retain pure
schema/scanner tests and prove persisted source absence through the scanner CLI.
The full detector reports `introduced=0` without an inventory refresh. A documented
judgment route for new canonical platform tests would have prevented this detour.

## 2026-10-09 — inherited knowledge-reference gate

- Work: inspect the first-wave hosted Heavy / Lint Policy failure before proceeding.
- Evidence: the exact job log identifies one live gated `external-mirror-reference`
  observation in `goals/repository-simplification-confidence/SPEC.md:374`.
- Attribution: inherited; that line is present on `origin/main` and this lane does not edit it.
- Disposition: acknowledge the row with the scope/evidence receipt; the program orchestrator
  owns the consolidated repair. No other packet or shared policy is changed here.
- Prevention: classify policy examples as examples in the reference checker, or repair
  the owning packet once on main so every lane inherits the same fix.

## 2026-10-09 — consolidation overlap and compiler proof

- Work: default consumer package audits after shared-slot admission.
- Evidence: metrics' existing bearer property exposed header-colon normalization
  before the header rule; new test encoders also triggered `effect(schemaSync)`.
- Attribution: introduced. Fix the renderer's header precedence in the canonical
  bank and compose test encoders through Effect. The prompt brand additionally
  requires a single literal key and an explicit export-safe schema type.
- Prevention: include header/assignment overlap in the P0 old/new renderer matrix,
  and run the default compiler policy before interpreting runtime tests as proof.
- Repair verification: the existing metrics property and focused gate/scrub tests
  pass. Affected default package proofs are being rerun; no pass is inferred.

## 2026-10-09 — shared heavy-slot queue fairness

- Work: required schema/file-processing default package proofs and hosted parity.
- Evidence: the owned unit remained in the slot wrapper's five-second polling loop
  for 30 minutes, with no first command log or result file; no proof command ran.
- Attribution: environment-only admission delay, not a proof failure.
- Decision: requeue that unstarted job once with the same 32G cap and two-owned-job
  maximum. Reason: change the polling timing without bypassing the shared budget.
  Reversal: stop the replacement queued unit and restore the original submission.
- Prevention: use a FIFO queue for heavy admission rather than independent polling
  that allows newly submitted work to claim every released slot first.

## 2026-10-09 — package audit typing and parser complexity

- Work: default file-processing audit and hosted fallow parity.
- Evidence: `SecretScrub.test.ts` passed a constructor directly to Array.map,
  which passed its numeric index as MakeOptions; an array index was possibly
  undefined. Signed repair supplies an explicit constructor callback and builds
  the forged-input canary from a nonempty builder collection.
- Fallow attributed one introduced cognitive-complexity finding to privateMatches.
  Flattened delimiter transitions with early continues preserve nested and orphan
  behavior without a suppression.
- Prevention: run compiler policy and fallow before interpreting focused runtime
  results as full package proof. Updated default proofs remain pending.

## 2026-10-09 — synthetic model mock compiler policy

- Work: documents-server default package audit.
- Evidence: `SecretScrubGate.test.ts` raised `effect(effectFnOpportunity)` on the
  generateText mock. Named Effect.fn preserves its prompt capture and call count.
- Attribution: introduced; repair and retry the default audit.
- Prevention: use Effect.fn for effectful test service implementations from the
  first draft, even when focused runtime tests accept Effect.gen callbacks.

## 2026-10-09 — lane brief conflicts with new release policy

- Work: required main merge before publication and final proof.
- Evidence: main PR #1566 introduced a private-workspace changeset prohibition.
  `bun run beep quality changeset-graph` rejects the six lane-required notes with
  `private workspace changesets are forbidden`. `changeset-status` skips all six
  private packages, but the graph guard still rejects their notes.
- Attribution: lane-added references now fail a newly inherited shared policy.
  The brief explicitly requires one note per edited package and a major note for
  the changed standalone layer contract; it has not been updated for this policy.
- Decision: stop under the named policy-approval condition, preserve the six notes
  and request an orchestrator ruling through the handoff. The lane changes no
  shared policy. Reversal: resume after the brief reconciles the note requirement.
- Prevention: invalidate or refresh active lane briefs when a shared release
  policy changes their required deliverables.

## 2026-10-09 — PR text scan hit GraphQL rate limit

- Work: support-evidence exact-canary scan before P1 publication.
- Evidence: `gh pr view --json title,body` returned `API rate limit already exceeded`.
- Attribution: environment-only shared GraphQL quota; file/log scans had zero counts,
  but the failed PR read supplied no scan proof.
- Repair: REST `repos/beep-effect/beep-effect/pulls/1570` returned the title/body and
  current head; the resulting PR-text surface has exact-canary count 0.
- Prevention: use the existing REST-first PR discovery route for text/head reads,
  and preserve unknown review-window/thread state when GraphQL cannot read it.

The GraphQL read succeeded after its quota window reset; its current PR-text
exact-canary count is 0 as well. No credentials or approval were required.

## 2026-10-09 — run 2 admission retry

- Work: final schema/file-processing package proofs, test-tsgo and coverage.
- Evidence: 30 minutes in the shared slot wrapper, no schema command log/result;
  all four shared slot locks belong to live commands.
- Attribution: environment-only admission delay; no package command ran.
- Decision: replace the unstarted submission once, retaining the same commands,
  32 GiB cap and owned-job limit. Reason: the existing polling queue can starve
  an older submission. Reversal: stop the replacement and restore the original
  submission; never claim a canceled job as passing.
- Prevention: FIFO admission with durable queue position and source-bound receipts.

## 2026-10-09 — new export requires generated root aliases

- Work: P1 Yeet publication after green package proofs.
- Evidence: `repo-sanity:tsconfig-sync` reports two root generated alias files
  drifting by one added bank export; no push occurred.
- Attribution: introduced by the new schema subpath export, not matching behavior.
- Repair: consume `CredentialPatternBank` through the existing schema namespace
  barrel and remove the new subpath export. This stays inside owned files and
  avoids editing shared root alias projections. Affected package proofs rerun.
- Prevention: include export-projection consequences in the P0 module-layout audit.

## 2026-10-09 — hosted security image acquisition

- Work: read completed red jobs immediately for the P1 PR head.
- Evidence: Secret Scanning exits 125 on Docker unauthenticated pull rate limit;
  SAST exits 125 on Docker Hub auth-endpoint timeout fetching its scanner image.
- Attribution: environment-only; neither scanner reached source analysis.
- Disposition: exact logs read and inbox rows acknowledged with the distinct
  acquisition failures. Local commit-range gitleaks passes; hosted success is
  not inferred. The next required publication starts a fresh head's checks.
- Prevention: centrally provision scanner images or retry transient acquisition
  in the owning CI packet. This lane changes no CI policy, credentials or plan.

## 2026-10-09 — repeated P2 scanner image acquisition

- Work: read both completed security job logs for the P2 publication immediately.
- Evidence: SAST exits 125 on Docker unauthenticated pull rate limit; Secret
  Scanning exits 125 on Docker Hub auth-endpoint timeout for its pinned image.
- Attribution: environment-only; analysis never began. Both inbox rows are
  acknowledged with their exact acquisition failure. Local proofs do not imply
  hosted scanner success. The final main sync carries upstream CI changes, and
  the content-final publication starts fresh exact-head checks.
- Prevention: central scanner-image provisioning belongs to the CI owner; this
  lane does not alter credentials, registry endpoints, CI policy or billing.

## 2026-10-09 — inherited gate blocks closing publication

- Work: publish the P3 closing wave after the mandatory final merge from main.
- Evidence: `bun run beep yeet publish` completes fifteen cheap gates but
  `lint:effect-vitest` reports one new finding in
  `packages/epistemic/use-cases/test/ContradictionDetection.golden.test.ts`.
- Attribution: the file exactly matches origin/main and was added by #1572;
  no scrub test is flagged. The local P0 row is acknowledged as out-of-scope.
- Disposition: no suppression, baseline refresh or unowned edit. No P3 content
  was pushed. Restore active/P3 in-progress, retain the reflection and stop the
  owned monitor before returning the blocked handoff.
- Prevention: run cheap gates against the exact main candidate before merge;
  fix this finding once on main, then dependent lanes merge the repair once.
