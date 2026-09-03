# Turbo Remote Cache — Operator Guide

The repo runs its own Turbo remote cache: S3 behind API Gateway with three
Lambdas (`infra/src/CiTurboCache.ts`). The deployment is deliberately
asymmetric — either token may **read**, only the trusted token may **write**,
and the writer is a separate function behind a signed invocation.

Workstations, agent checkouts, and same-repository pull-request jobs are
**readers only**. Fork pull requests stay local-only. No local checkout ever
holds the trusted write token; remote writes belong to main-push CI and the
protected cache-warm workflow.

## The per-checkout contract

Remote reads require the whole quad, in one checkout's `.env`:

```dotenv
TURBO_API=https://<id>.execute-api.<region>.amazonaws.com
TURBO_TOKEN=op://<vault>/<item>/<field>
TURBO_TEAM=<team-slug>
TURBO_CACHE=local:rw,remote:r
```

`TURBO_TOKEN` is a **1Password secret reference to the read-only token**, not a
value. It stays a reference on disk; `op run --env-file=.env` resolves it when
the lane spawns. The read-only token itself lives in the SSM parameter the
`CiTurboCache` stack is configured with
(`readOnlyTokenSsmParameterArn` in `infra/ci-runners/Pulumi.production.yaml`);
mirror it into 1Password once and reference it from every checkout. `TURBO_API`
and `TURBO_TEAM` are the same values CI uses (`gh variable list`).

## Enabling one checkout

```sh
TURBO_API=<endpoint> TURBO_TEAM=<team-slug> TURBO_TOKEN_REF=op://<vault>/<item>/<field> \
  bash scripts/enable-turbo-remote-reads.sh
```

Run it from the checkout you want to enable, or pass the checkout path as the
first argument. It is idempotent: nonblank names already present in `.env` are
reported and left alone, while blank placeholders are repaired. Duplicate
assignments fail before the file is modified because their effective value may
differ across dotenv consumers. It refuses a `TURBO_TOKEN_REF` that is not an
`op://` reference, so a resolved secret cannot be written to disk by accident.

### Rotating or correcting the token reference

A resolving secret reference proves only that 1Password can supply a value; it
does not prove that the cache service authorizes that value. The canonical
workstation credential is the infra-vault read-only item that is the SSM source.
Correct an older reference by opting into replacement explicitly:

```sh
TURBO_TOKEN_REPLACE=1 \
TURBO_API=<endpoint> TURBO_TEAM=<team-slug> TURBO_TOKEN_REF=op://<vault>/<item>/<field> \
  bash scripts/enable-turbo-remote-reads.sh
```

Replacement rewrites `TURBO_TOKEN` only when its current value differs from the
supplied reference. The helper reports an existing reference by vault and item,
or reports `raw value (not shown)` for a resolved value; it never prints the
value. The default mode continues to leave every nonblank assignment alone.

Verify without executing a lane:

```sh
bun run check --filter=@beep/types --dry=json
```

The CLI prints the exact turbo command before spawning it. A configured checkout with an
authorized 1Password session shows `--cache=local:rw,remote:r`; an unavailable or unauthorized
session fails closed and shows `--cache=local:rw`.

Exported shell variables work too — the CLI reads the ambient environment, not
only `.env` — but the per-checkout `.env` is the sanctioned path because it
keeps the token a 1Password reference instead of a live value in every shell.

## How the CLI decides (fail closed)

The decision is one pure resolver, `resolveTurboCachePlan`
(`packages/tooling/tool/cli/src/internal/cli/TurboCache.ts`), with the matrix
covered by `packages/tooling/tool/cli/test/turbo-cache.test.ts`:

| Situation | Injected flag |
| --- | --- |
| `CI=true` | none — the workflow owns the posture |
| Caller passed `--cache=…`, `--force`, `--no-cache`, `--remote-only`, `--remote-cache-read-only` | none — the caller owns it |
| Complete quad, `TURBO_CACHE=local:rw,remote:r` | `--cache=local:rw,remote:r` |
| Any quad member missing or blank | `--cache=local:rw` |
| Quad complete, any other posture (including `remote:rw`) | `--cache=local:rw` |

A remote-read plan whose values are still `op://` references probes each
reference once per CLI process and runs the lane under `op run` only when every
reference resolves. A missing, expired, or denied 1Password session degrades to
`--cache=local:rw` and keeps going — a cache credential never blocks quality
work. The same fail-closed rule applies in the environment: on a *direct* turbo
spawn, scrubbing an unresolved credential also pins `TURBO_CACHE` to local-only,
so turbo is never asked to read a remote cache it cannot authenticate to.

That scrub deliberately does **not** apply to an `op run`-wrapped spawn.
`op run` resolves `op://` references out of the environment it is handed, not
only out of its `--env-file`, so scrubbing them there would delete the very
references the wrapper exists to resolve and leave the wrapped turbo with no
credential at all.

Steps that carry their own environment (the hosted coverage identity, a
testcontainer connection URI) are never wrapped in `op run`, because
`--env-file=.env` would overlay the checkout's dotenv on top of them and clobber
those values. Those lanes are `cache: false` in `turbo.json`, so they lose no
remote hits — and because the degradation rule applies to *every* unwrapped
spawn, they never receive a remote posture they could not use anyway.

## Rules

- Never put the trusted write token on a workstation. A read token that leaks
  permits downloads, not cache poisoning; a write token permits poisoning every
  checkout and every CI job.
- Never commit a resolved secret. `op://` references are references — keep them
  that way in `.env`, scripts, and docs.
- `TURBO_CACHE=local:rw,remote:rw` is refused locally by design, not by
  accident. If you think a workstation needs to write, that is the `beep cache
  warm` conversation (ship-velocity C3), not a `.env` edit.
- Yeet still forces dependency-sensitive proof steps with `TURBO_FORCE=true`
  when `bun.lock` differs from base. Those runs cannot read from any cache;
  that is a deliberate false-green control, not a misconfiguration.

## Warm and inspect the cache

`bun run beep cache warm` is the write-capable operation. It requires a clean
exact `origin/main` checkout, the repository's pinned Bun version, and ephemeral
`TURBO_API`, `TURBO_TOKEN`, and `TURBO_TEAM` values. It refuses unresolved
`op://` write-token references. `.github/workflows/cache-warm.yml` supplies
those values only through its protected environment and runs twice monthly or
on manual dispatch.

`bun run beep cache probe` runs a cold remote-read pass followed by a warm
local-only pass. `bun run beep cache dashboard` decodes Turbo summaries,
reports first-touch remote-eligible hit rate plus p50/p95 by cache mode, excludes
forced or disabled runs, and fails its correctness tripwires when a changed
source task is incorrectly reused.

## Related

- `goals/ship-velocity/research/c4-turbo-cache.md` — the audit this implements.
- `infra/lambda/turbo-cache/README.md` — token/method matrix on the server.
- `.github/workflows/check.yml` — push jobs write, same-repository PR jobs read,
  and fork PR jobs stay local-only.
- `.github/workflows/cache-warm.yml` — protected scheduled/manual warm path.
