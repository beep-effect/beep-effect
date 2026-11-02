# Bounded deployment checkpoint

Progress: new observation-plan command under existing ai-metrics install; actual
bundled worker and restricted frontend installed as owned user units in a synthetic
rehearsal. Final proof passed with spaces in artifact/environment paths, real
systemd/Caddy validation, exact frontend PID/listener correlation, private route
404s, paused intake 503, declared oversized 413, header timeout, finite cgroups,
no archive credentials in worker environment, dependent shutdown, and tampered
bundle refusal before journal changes. Both units stopped and only their exact
owned files removed. No source/backend/provider was enrolled.

Corrected real systemd WorkingDirectory/EnvironmentFile quoting failures. Caddy
initially saved its proof config in shared ~/.config/caddy/autosave.json; preserved
and removed only that exact generated output. No prior preimage was available.
Autosave now disabled and XDG paths isolated. Final proof verifies shared state
unchanged. See deployment-autosave-repair.json and installed verification receipt.

Both scoped compilers + 28 tests pass; Biome passed. Broad CLI gate remains open.
No new AI-metrics library changes this turn; prior full library gate is historical
and should not be represented as a full CLI gate. No commit/push/PR yet.

NEXT: use this qualified installation path for a tightly bounded actual-target
canary, with explicit project/route IDs and rollback. Preserve historical held
forwarder and current native traffic. Existing collector config drops normalized
agent.* on its old route: use qualified replacement/shadow route, not blind send
into the legacy endpoint. The pinned disposable collector/Phoenix route proof is
already available in verify-native-collector-route.py and research/MIXED-COLLECTOR-ROUTE.md.
Do not count synthetic CLI/desktop labels as actual harness coverage. Production
backup/storage ownership, external alert delivery, final review panel and full
repository delivery/closeout remain required.
