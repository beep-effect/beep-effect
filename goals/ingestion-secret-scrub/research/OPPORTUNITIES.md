# Friction receipts — ingestion-secret-scrub

## 2026-10-09 — heavy admission user bus

- Work: P0 fixture integrity proof through `beep-heavy --detach`.
- Evidence: `Failed to connect to user scope bus`; user runtime and bus variables were absent.
- Attribution: environment-only; no test or source ran.
- Repair: use the existing user-manager runtime and bus environment for heavy launches.
- Prevention: launcher should supply the user-session bus environment.
