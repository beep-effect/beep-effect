---
"@beep/repo-cli": patch
---

Honor a configured Turbo remote-read posture instead of forcing local-only cache.

Root quality commands injected `--cache=local:rw` on every non-CI invocation, so a
workstation configured for remote reads could never use them — the AWS cache warmed by
every merge was unreachable from any local lane. The decision now lives in a schema-first
resolver (`internal/cli/TurboCache.ts`): a complete quad (`TURBO_API`, `TURBO_TOKEN`,
`TURBO_TEAM`, `TURBO_CACHE=local:rw,remote:r`) is honored and everything else fails closed
to `--cache=local:rw`, including a quad that asks for remote *writes*, which no workstation
is credentialed for.

Turbo steps whose credentials are still 1Password references now spawn under
`op run --env-file=.env`, and `turboEnvOverrides` recognizes that wrapped form so the
mouse-capture guard still applies to it. The unresolved-reference scrub is scoped to
*direct* turbo spawns: `op run` resolves `op://` references out of the environment it is
handed, not only out of its `--env-file`, so scrubbing them from a wrapped spawn would
delete the references the wrapper exists to resolve. Any spawn that is *not* wrapped — because the
1Password session is missing, expired, or denied, or because the step carries its own
environment — has its remote posture rewritten to local-only rather than failing the lane,
in the arguments and in the environment both, since a `--cache` flag outranks
`TURBO_CACHE`. Steps carrying their own environment (the hosted coverage identity,
testcontainer connection URIs) stay unwrapped so `op run`'s dotenv overlay cannot clobber a
lane-critical value; those tasks are `cache: false` anyway. The `op run` wrapper also stops
dropping a step's `env` and `flakeQuarantine` fields on the way through.

Per-checkout enablement is `bash scripts/enable-turbo-remote-reads.sh`, documented in
`standards/turbo-remote-cache.md`, with the four names added to `.env.example`.
