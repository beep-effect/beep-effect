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
value. It stays a reference on disk; the CLI passes only the cache quad to
`op run` when the lane spawns. The read-only token itself lives in the SSM
parameter the `CiTurboCache` stack is configured with
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

A remote-read plan whose values are still `op://` references probes the cache
credential references once per CLI process and runs the lane under `op run`
only when the quad resolves. The resolver receives an explicit environment
where unresolved references survive only for `TURBO_API`, `TURBO_TOKEN`, and
`TURBO_TEAM`; an unrelated stale reference cannot disable remote reads. A
missing, expired, or denied cache reference degrades to `--cache=local:rw` and
keeps going — a cache credential never blocks quality work. The same
fail-closed rule applies in the environment: on a *direct* turbo spawn,
scrubbing an unresolved credential also pins `TURBO_CACHE` to local-only, so
turbo is never asked to read a remote cache it cannot authenticate to.

### Separate environment health

The CLI also probes all `op://` references in the checkout `.env` with output
suppressed. When that independent health check fails, it retries references one
at a time and prints only each failing variable name as a plan warning. It never
prints a reference or resolved value, and its result never changes the cache
plan; repair the named variable separately while a healthy Turbo quad continues
to read the remote cache.

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

### Reading coverage task hashes

Coverage remains `cache: false`: its V8 output and ratchet result must be
recomputed for the hosted-CI identity. Turbo still computes a task hash from
the declared package inputs, root Vitest configuration, task definition,
dependency graph, lockfile-derived dependency state, and declared environment.

Run the lane with `--summarize`. Turbo writes one JSON document per invocation
under `.turbo/runs/<run-id>.json`; the weighted coverage executor therefore
writes a prebuild summary and one summary for each non-empty coverage shard.
Read every summary created by that lane, select `tasks[]` entries whose
`taskId` is `<package-name>#coverage`, and take that entry's `hash`. The run
filename is an execution identifier, not an input digest. A later proof ledger
can key each package fact by this `tasks[].hash` without enabling Turbo output
caching. Hosted Coverage Regression already supplies `--summarize` through the
shared `beep ci lane coverage` builder, and its workflow summary step reads all
of the shard summaries with `beep ci append-turbo-summary --all`.

### Reading tsgo tests task hashes

The repo-wide `quality test-tsgo` lane is an aggregate over the package-owned
`package-test-typecheck` Turbo task. That task remains `cache: false`: test
diagnostics must run for the current checkout, while Turbo still computes a
hash from the package manifest, the package `test/**` tree and `tsconfig*.json`
files, package source directories, transitive dependency `transit` hashes, the
root `tsconfig.base.json`, and the CLI worker plus its synthetic tsconfig template.
Package documentation is deliberately outside the owning package's direct
input set, so a README-only edit does not change that package task hash.
Every discovered package must expose the matching package script. The aggregate
checks this before invoking Turbo and fails with the package name plus the exact
`"package-test-typecheck": "beep-cli quality test-tsgo-package"` entry to add;
it never treats a missing task as a successful package result.

The aggregate discovers package ownership exactly as the pre-Turbo lane did,
then invokes Turbo with `--concurrency=1`, `--continue=always`, suppressed task
logs, and `--summarize`. Each package worker writes its versioned result to
`.turbo/package-test-typecheck-result.json`. The worker records tsgo's output
and exit code without turning a diagnostic into an early Turbo stop; after all
packages finish, the aggregate consumes the artifacts in its original sorted
package order and retains the existing diagnostic rendering and exit semantics.

`--summarize` is how the lane surfaces the input digest. Turbo writes
`.turbo/runs/<run-id>.json`; select the `tasks[]` entry whose `taskId` is
`<package-name>#package-test-typecheck` and read its non-empty `hash`. The
ProofLedger records that value with input source `turbo-task-hash`. The result
artifact is execution evidence, not an alternate digest, and the run id is not
an input digest.

## Pre-push wave ordering

Yeet's full pre-push proof orders the current lane set from the schema-backed
`DEFAULT_GATE_ORDER_SEED` in
`packages/tooling/tool/cli/src/commands/Yeet/internal/WaveOrder.ts`. The seed is
versioned as `gate-order/v1`; each row carries a P50 cost estimate, first-red
probability, precision class, and JSON pointers plus explanatory basis text
for its source in `goals/time-to-certainty/research/economics.json`. Aggregate
or related-lane proxies are named explicitly where A1 predates A5's durable
inner-lane timing report.

Seeded lanes sort by P50 cost ascending, first-red probability descending,
precision (`precise` before `imprecise`), then declaration order. That puts the
short, policy-bearing gates ahead of heavy lanes and leaves Coverage Regression
at the expensive tail. A lane absent from the seed is never guessed: all
unseeded lanes append after the seeded plan in their original declaration
order. Contiguous wave labels are retained for reporting without regrouping
the plan into the former fixed wave order.

The default policy stops launching lanes after the first failed `precise` gate.
Every unlaunched lane is persisted to the A5 inner-lane report as
`not-run-early-stop`; the GitHub-check and Yeet summaries name the first red and
the skipped count. An `imprecise` red is recorded but does not stop scheduling.
Already-running work is allowed to finish and is recorded normally; the
current local executor is sequential and performs no cancellation.

Pass `--no-fail-fast` to `beep yeet` or `beep quality github-checks pre-push`
when a complete diagnostic picture is worth the extra runner time. The flag is
off by default and selects the same collect-all scheduling policy as the
existing `--collect-all` compatibility spelling.

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
