# Bounded observation deployment plan and installed-unit proof

## Existing ownership path

The existing `ai-metrics install` command now includes `observation-plan`.
It renders the dedicated replacement worker and a restricted loopback intake
frontend; it does not invoke the old stack installer, unmask the historical
forwarder, install files, enable boot startup or resume intake. Plans contain
private filesystem paths and belong with private deployment material.

```text
bun run beep ai-metrics install observation-plan --input <private-deployment-request.json>
```

The typed request requires a distinct new `beep-observation-*` unit name, canonical
absolute state/artifact/credential/Bun paths, a non-privileged loopback port and
an explicit 30–3600 second lifetime. State paths obey the existing worker's 80-byte
ASCII boundary. Unit interpolation characters, surrounding whitespace, overlapping
state/artifact directories and executable/secret files inside those directories
are refused. Input is strict UTF-8, at most 16 KiB, with unknown fields rejected.
The command renders JSON through the existing CLI error boundary with content-free
errors; no secrets are read to construct the plan.

## Runtime artifacts and limits

The installation must provide a bundled `worker.mjs`, an exact Bun binary,
checksum-pinned Caddy, `intake.json`, private credential files, the worker configuration, and trusted
checksum manifests. The worker manifest binds bundle, Bun binary and worker
configuration; the frontend manifest binds Caddy and its configuration. Each unit
verifies its manifest before launch. A valid checksum is provenance for selected
bytes, not protection from a malicious owner who can rewrite both manifest and
artifacts. Install only into an explicitly owned new artifact location.

| Boundary | Worker | Frontend |
| --- | --- | --- |
| RAM ceiling | 512 MiB | 128 MiB |
| Extra swap | 0 | 0 |
| CPU | 50% of one CPU | 25% of one CPU |
| Tasks | 64 | 64 |
| File descriptors | 256 | 128 |
| Per-file write size | Twice the configured journal page budget: default 2 MiB, maximum 64 MiB | 2 MiB |
| Core dumps | disabled | disabled |
| Restart | no automatic restart | no automatic restart |
| Lifetime | explicit finite request | same finite request |

The worker uses inherited exclusive flock ownership and starts paused. The
frontend is bound to the worker's service lifetime. Stopping the worker also stops
the intake service. Neither unit has an Install section, so rendering or writing
it does not enable boot startup. Systemd loads the hash salt and optional Phoenix
query credential from the named private files. The worker starts with
`env --ignore-environment` and a positive environment allowlist; it does not inherit
the historical raw archive key or data-root variables. Once a credential directory
is present, missing/invalid credentials refuse startup instead of falling back.
The installed proof checks positive credential behavior and environment isolation
without printing unrelated secret values.

These limits do not establish aggregate backup retention, off-device durability,
source enrollment or permanently operating service policy. Those deployment
responsibilities remain explicit. The finite installation is intended for the
bounded canary/qualification stage.

## Intake boundary

Only POST `/v1/traces` is forwarded. All other paths/methods, including health,
metrics, launch metadata and pause/resume, return 404 on the loopback listener.
Control and health stay on the private Unix socket. The frontend has a 256 KiB
body ceiling, 16 KiB header ceiling, finite header/read/write/idle/upstream
timeouts and HTTP/1 only. Oversized declared bodies receive 413 before forwarding.
Access logs are absent and the default frontend logger discards output; worker
refusal diagnostics remain content-free and journal-rate-limited.

Caddy admin and configuration autosave are disabled. XDG config/data paths are
also isolated under the owned state directory. This avoids a test or canary
silently replacing a shared user's Caddy autosave configuration.

## Actual installed proof

`ops/verify-observation-deployment.py` bundles the real worker, renders its plan
through the registered CLI, validates Caddy JSON and systemd units, then installs
two uniquely named real user-unit files. It uses a synthetic private environment
and a destination with no backend listener. No provider, real source or historical
store is enrolled. Artifact and environment paths include spaces to exercise the
real systemd parser.

The proof verifies paused startup, route denial, 413 for declared oversized bodies,
bounded incomplete-header handling, actual cgroup limits and exact frontend PID
ownership of the listening socket. A response from an unrelated process cannot
satisfy readiness. It checks shared Caddy autosave bytes remain unchanged and no
private autosave is produced. Stopping the worker stops both processes. Deliberately
changing the bundle then makes startup fail its checksum before changing the
journal. Cleanup stops both processes and removes only unchanged owned unit files;
private synthetic artifacts and receipts remain available for inspection.

The first real systemd checks revealed that WorkingDirectory and EnvironmentFile
must not use the executable-argument quoting form. Both were corrected. The first
successful frontend run also revealed Caddy's default shared autosave behavior.
That exact proof-generated file was preserved and removed after matching its
owned socket path and bytes; no earlier preimage was available and none was
invented. The renderer now disables persistence and isolates configuration paths.
See `ops/deployment-autosave-repair.json`. Failed checks are retained and are not
counted as passing proof.

## Remaining production proof

Qualify a bounded native/reconstructed route through the actual deployment target,
retaining a precise canary identity and rollback. Install source and backup
ownership, external freshness/absence alert delivery and conservative recovery
before enrolling real sources. The historical hold is still active. Broad CLI
quality, final review panel, repository publication and full SPEC remain open.

## Page budget and canonical-path diagnostics

Set `journalMaxDatabasePages` in the deployment request to the same value as
`intake.maxDatabasePages` in the launch configuration (256–8192 pages). Rendering
is a pure plan operation and does not read the private launch file. Before opening
SQLite, the installed worker independently compares its actual per-file limit with
the configured budget and requires twice the database ceiling for rollback-journal
overhead. An insufficient actual file ceiling refuses startup with a content-free message. Diagnose it by
comparing those two non-secret budgets and the rendered limit; do not increase the
limit blindly or modify an existing journal's immutable policy.

Discovery roots must be canonical paths with no symlinked parent. The directory
helper deliberately returns `changed` when canonical-path or same-source identity
checks fail. That status includes a symlinked-root configuration; it does not by
itself prove that transcript contents changed. Resolve and qualify the intended
physical root before enrollment, and preserve the old identity/evidence while
correcting the declaration. Do not follow the symlink to silently widen discovery.
