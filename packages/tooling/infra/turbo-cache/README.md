# @beep/infra-turbo-cache

The repository's Turborepo remote cache: a Cloudflare Worker serving the
`/v8/artifacts` protocol over an R2 bucket, deployed by the Alchemy stack
`TurboCache` (`alchemy.run.ts`). It replaces the AWS Lambda cache
(`infra/src/CiTurboCache.ts`) and the R2 pilot (`infra/r2-cache`) as the
repo's only cache (goals/infra-alchemy-rebuild, D7). Deploying, issuing and
rotating tokens, and enrolling a client: `docs/runbooks/alchemy-infra.md`,
section "Turbo cache".

## Layout

| File | Role |
| --- | --- |
| `alchemy.run.ts` | Stack `TurboCache`: shared S3 state, `CI` guard on `prod`, the Worker, the error alert |
| `src/Worker.ts` | The repository policy (`cachePolicy`) and the Worker module Alchemy bundles |
| `src/CachePolicy.ts` | Schemas for teams, principals and access classes; `permits` |
| `src/Protocol.ts` | The `/v8/artifacts` handler with the policy applied before storage |
| `src/TurboCache.ts` | Resources: R2 bucket with lifecycle expiry, one `Random` token per principal, the Worker |
| `src/Bucket.ts` | The R2 read-write binding |
| `src/TokenHandoff.ts` | Send one token from state to a receiver's stdin |
| `token.ts` | CLI over the handoff (`bun token.ts --stage prod --principal ci-pr -- <receiver>`) |

## Policy

One team, `beep`. Every principal holds its own token (`Random`, 32 bytes,
kept in state) of one access class:

| Principal | Access | Where the token lives |
| --- | --- | --- |
| `ci-main` | write | `turbo-cache-write` GitHub environment (protected `main` pushes) |
| `ci-pr` | read | repository secret (same-repository pull requests) |
| `dankstation` | write | the workstation's 1Password item |
| `beep-worker` | write | the worker's 1Password item |

A `read` token restores artifacts, queries hashes, reads status and reports
events; an upload with it is `403 read_only` and never reaches the bucket.
Forks get no token (GitHub does not pass secrets to fork pull requests), so
they stay local-only. Artifacts live under `<team>/<hash>`; a token of one team
is `403 forbidden` on another. R2 expires artifacts after 30 days, as the AWS
cache did.

The signed-policy semantics of the AWS cache and the pilot (a writer
authorized per request by an authorizer and an HMAC between authorizer and
writer) collapse into this: the Worker is the only thing with bucket access,
so the token class it checks is the whole write boundary.

## Cache-input baseline review

Carried from `infra/r2-cache/cache-input-review.md` (D7), unchanged in
substance. Reviewed subject: `//#lint:effect-imports`.

The Effect import source scanner already excludes `**/dist` and everything below
it through `CODE_EXCLUSION_GLOBS` in `commands/Laws/EffectImports.ts`. Turbo's
input list included those generated JavaScript and declaration files. A built
workstation therefore hashed files that the source check never examines, while
a clean CI checkout omitted them.

Add `!**/dist/**` to this task's inputs so its cache key follows the existing
scanner boundary. No task becomes cacheable, no source files leave the scan,
and the cache qualification scope, profile and epoch stay unchanged.

The regression check used the actual Turbo dry-run hasher: adding a generated
file under a foundation package's `dist` directory preserved the task hash;
adding a source file under that package's `src` directory changed it. Both probe
files were removed afterward. Generated Next.js and Storybook inputs remain
unchanged because the scanner currently examines those paths; this correction
does not widen its exclusion policy.

Only the named subject's configuration changed. The baseline source digest changes
because `turbo.json` changed; it grants no new qualification.

The standing rule for every later input change is `docs/runbooks/turbo-cache-inputs.md`.

## Alerting

The AWS cache alarmed on Lambda throttles, each one a silent cache miss. A
Worker has no reserved concurrency to exhaust; its failure mode is erroring.
The stack enables Workers Logs and, when `TURBO_CACHE_ALERT_EMAIL` is set,
adds a `workers_observability_real_time_issue` notification policy (an alert
type this account's plan lists). Unset, there is no policy, the same opt-in the
AWS alarm had.

## Tests

Hermetic, no credentials. `bun run test`: the protocol, policy and handoff
unit tests. `bun run test:integration` (`test/integration/`, Bun only, because
Alchemy's local workerd runtime uses Bun's process APIs): the runtime and stack
tests deploy through Alchemy's local providers (workerd and a local R2 bucket)
into in-memory state, and drive the pinned `turbo` binary through a remote
miss, a remote hit and a read-only token's refused upload.
