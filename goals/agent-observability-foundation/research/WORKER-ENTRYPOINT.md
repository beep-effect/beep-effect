# Private worker entrypoint proof

The actual dedicated Bun entrypoint now composes the existing metadata journal,
native delivery scheduler and scoped runtime. It is implemented in the existing
CLI package and deliberately does not load the entire command tree. It has not
been installed or enrolled as a production service.

## Boundary

The process requires a canonical owned 0700 state directory, a bounded regular
0600 `worker.json`, and a matching secret namespace from the environment. Salt
and optional Phoenix query credentials are not embedded in the JSON. The launch
schema derives the export/query target identity and has no auto-resume setting.
Configuration symlinks, hardlinks, malformed UTF-8, oversized input and wrong
ownership/modes are refused with content-free errors.

Before database or listener startup it checks an inherited exclusive flock owned
by its PID, finite cgroup RAM/swap/CPU/task limits, finite descriptor/file limits,
zero core dumps, a verified 0077 creation mask and no-new-privileges. Existing journal and auxiliary files must
be owned private regular single-link files. An existing active Unix socket is
preserved and refused. Cleanup only removes a socket whose device/inode matches
the successfully created listener. These checks protect cooperating owned
processes; they do not claim protection against a malicious same-UID attacker.

The fixed private Unix socket exposes `/v1/traces`, GET `/health`, GET `/metrics`,
and POST `/control/pause` and `/control/resume`. No fixture route or TCP listener
is added. Startup and restart both keep intake paused. Health HTTP 200 means the
runtime is running; phase, control and freshness must still be interpreted.
Backend visibility and fleet coverage are separate. Missing read-back is degraded
and never authorizes a blind resend. Unexpected failures exit the process;
normal interruption pauses/drains accepted work and closes the listener.

A managed frontend must expose only the intake route and apply the already
qualified transport limits. This private listener is not a claim that raw Bun
alone bounds incomplete TCP headers. Production frontend installation, external
scrape/alert delivery and discovery cadence are still open.

## Synthetic verification

`ops/verify-worker-entrypoint.py` launches this actual entrypoint against a bounded
loopback fake backend. The backend accepts one projected span but returns no
query match. Actual workers run in agent-runs.slice with 512 MiB RAM, zero extra
swap, 50% CPU, 64 tasks, 256 descriptors, 2 MiB file size, zero core dumps and a
60-second lifetime. No deliberate memory exhaustion is performed.

The proof checks default pause/refusal, explicit resume, autonomous send,
degraded missing read-back, content-free metrics, one exclusive lock owner,
controlled shutdown/socket cleanup, journal integrity and exact receipt replay
after restart without an additional backend POST. It separately proves refusal
without inherited ownership or with an exposed file-creation mask, preservation of a symlink's target and preservation
of an active socket. A private text canary is absent from the normalized wire,
database dump and health/metrics responses. All owned processes are stopped;
expected failure units are cleared after evidence capture.

Four launch-configuration tests pass. The actual metrics response also passes
`promtool check metrics` (3.15.1). Current process evidence is recorded in
`ops/worker-entrypoint-verification.json`; package/typecheck outcomes are recorded
there separately and must not be inferred from the process proof.

## Remaining acceptance

This is a native process boundary, not full host enrollment. Managed frontend and
service installation, declared source discovery cadence, reconstructed delivery,
source/event lag, independent coverage denominators, backup lifecycle,
CLI/desktop/live canary and full repository/review/closeout remain required.
Historical stores and masked legacy units are untouched. Reversal before
enrollment is to leave this new entrypoint uninstalled and retain the hold.

## Subsequent source integration

The optional source-cadence integration is now proven against the same actual
entrypoint. See `research/SOURCE-CADENCE.md` and
`ops/source-cadence-verification.json` for the newer source fingerprints and
expanded proof. The earlier entrypoint receipt remains historical evidence.
Reconstructed backend delivery and live enrollment remain open.
