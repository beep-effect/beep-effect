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
