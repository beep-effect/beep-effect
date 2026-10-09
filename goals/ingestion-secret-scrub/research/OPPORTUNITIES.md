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
