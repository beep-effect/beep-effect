# Stage 5 cache — blocked preparatory receipt

Revision measured: `9914e98a8624e24c3193a1357e593ce0a65404cd`. Final base refresh: `7febc0287bed98ae84659ee7278e3fe8f2e28b65`.
UTC census timestamp: `2026-10-09T17:07:47Z`. Mode: read-only measurements; no apply.

## Remote auth

At `2026-10-09T17:05:52Z`, `op-doctor` ran once. It identified the
service-account route and reported the user-bus environment limitation.
Only the three existing Turbo reference lines were copied to an ignored
lane-local env file. The exact read-only operation was:

```sh
OP_AGENT_BACKEND=connect op run --env-file=.beep/rsc-g-storage/turbo-read.env -- true >/dev/null
```

It exited 1: the read-only token reference's vault was not found. The secret
path stopped. No raw secret or item JSON was printed, no Desktop sign-in was
attempted, and the write token was not used. The five authenticated HEAD
probes and zero control were not run; status codes remain unknown.
The orchestrator must arrange an agent-visible **read-only** reference (R59).
The trusted artifacts may expire before the nominal `2026-11-05` deadline
if they were created before the last writer run.

## Effective paths

At `2026-10-09T17:07Z`, Turbo 2.11.7 was probed from this lane.

| Route / command | Effective `cacheDir` | Result |
| --- | --- | --- |
| Current Codex full-access zsh shell: `node_modules/.bin/turbo config` | `~/.cache/beep/turbo` | observed |
| Scrubbed bash: `env -i HOME=<home> PATH=/usr/bin:/bin bash -c 'node_modules/.bin/turbo config'` | `.turbo/cache` | observed |
| Scrubbed zsh with the same environment | `~/.cache/beep/turbo` | observed |
| `TURBO_CACHE_DIR=.beep/rsc-g-storage/explicit-cache node_modules/.bin/turbo config` | `.beep/rsc-g-storage/explicit-cache` | explicit override preserved |

`turbo config --cache-dir=...` is rejected by this installed version; the
environment override above is the working config probe. These are path
observations, not hit evidence. Current-shell config reports Vercel's default
API, null team, strict env mode, and no configured remote credentials.

Claude Desktop/proxy tools, Codex workspace-write/app-server tools, Cursor,
Grok, proof services, heavy services, and timers were not launched as route
fixtures. Shell inheritance does not prove their actual child configuration.
The complete clone/worktree effective-path inventory remains open.
No workstation-wide read-only posture claim is made before E-02/E-03.

## Remote hit

Not run. Requires a resolvable read-only token and the historical fixture at
`602e28d3ab` in the sibling worktree root. This worker is confined to its lane.
Trusted expected hashes from the private sweep are `0d8ccf62fa69d324`
(`@beep/fc-runs#build`) and `7d05d61faf1b47a2` (`@beep/types#build`).
They are not observed hits in this receipt.

## Local hit

Not run. A current-head isolated-cache dry calculation was collected with:

```sh
node_modules/.bin/turbo run '@beep/fc-runs#build' '@beep/types#build' --cache=local:rw --cache-dir=.beep/rsc-g-storage/local-cache --dry=json
```

Hashes: `3ca643e559fb1d3a` and `f8b314d6bfaf4138`, respectively. Both are
`MISS`, with `local: false`, `remote: false`; no task executed and no outputs
were restored. These hashes are at the current measured source revision,
not the historical artifact revision, so the difference is expected.

## Cross-checkout

Not run. R62 requires a linked worktree in the sibling root and a disposable
second clone under the home cache; both writes exceed the worker's explicit
lane-only scope. There is no evidence of cross-clone or linked-worktree reuse.

## Changed input

Not run. No tracked input was mutated. Invalidation remains unproved.

## Configuration repair handoff

- F owns `[sandbox_workspace_write].writable_roots` in the home Codex config.
  Requested cache path: `~/.cache/beep/turbo`; preserve existing roots and
  explicit overrides, apply through F's owned-field writer with backup.
- G's durable `environment.d` source requires a home write outside this launch
  scope; no home file was changed.
- The scrubbed-bash route still falls back to `.turbo/cache`. Root bare-Turbo
  scripts belong to `rsc-shared`; route them through the existing CLI cache
  plan or an equivalent tracked source while preserving CI-owned paths.
- E owns durable run-summary upload and attribution of the prior 413 build
  uploads (`@beep/todox`, `@beep/oip-web`, `@beep/storybook`) under R65.
  These are prior sweep findings, not new live job failures in this receipt.
- The two legacy per-checkout caches were retained. No TTC reuse or remote
  workstation writes were enabled.

## Resume evidence — 2026-10-09

Revision: `7febc0287bed98ae84659ee7278e3fe8f2e28b65`; UTC credential retry:
`2026-10-09T17:24:32Z`. Resume ruling 1 permits the private fixtures and defers
home writes. The exact suppressed operation `env -u OP_AGENT_BACKEND op run
--env-file=<lane-private-refs> -- true >/dev/null` exited 1 with:
`"BEEP_CI" isn't a vault in this account.` `op-doctor` ran once. No read token
resolved. Remote-hit and authenticated HEAD claims remain **unsupported external
condition**, rather than misses or authentication success. No write token was used.

At `2026-10-09T17:27Z`, an admitted cold local build of `@beep/fc-runs#build`
and `@beep/types#build` used a private empty local cache, `--cache=local:rw`
and `--summarize`. Both tasks executed successfully with hashes
`3ca643e559fb1d3a` and `f8b314d6bfaf4138`. The admitted warm rerun at
`2026-10-09T17:31Z` reported `HIT`, `local: true`, `remote: false`,
`source: LOCAL` for both hashes. `fc-runs/dist` was absent before the rerun and
was restored. Summaries were copied immediately to private lane evidence;
output-manifest comparisons and changed-input execution are recorded below
when qualified. The first warm run did not remove the actual `types/dist`
path, so it establishes its local hit without claiming restoration for that
package from that run.

The durable home-source proposal is
[`stage-5-cache-environment.sh`](./stage-5-cache-environment.sh). It writes only
`~/.config/environment.d/90-beep-turbo-cache.conf`, defaults to dry run,
retains explicit environment overrides, backs up its owned file under
`~/.config-backups/`, refuses symlinks and unowned fields, and prints rollback.
Shell syntax validation passed. It has **not** been applied to the workstation.
The F-owned Codex cache writable-root change and shared root-script routing
remain with `rsc-f-agents` and `rsc-shared`, respectively.

## Current-process effective-path inventory

At `2026-10-09T18:37Z`, the same Turbo executable ran `turbo config` with the
G worker's inherited environment from 262 fleet checkout roots. 261 config
probes succeeded, all with effective `~/.cache/beep/turbo`; one root returned
an error. Only cache path/API/team/environment metadata was retained privately;
raw config output and credentials were not printed or committed. This is a
current-process route inventory, not proof of other harness child environments
or workstation-wide remote posture. It changes no checkout configuration.
The home proposal also passed synthetic dry-run, repeated-apply/idempotence,
backup, unowned-field and symlink-refusal checks; actual home files are unchanged.

## Output-restoration and cross-checkout qualification

Latest completed fixture run: source `f56271b6a381ba8d23d55b34da28e2b62368c923`,
`2026-10-09T19:58Z`. An admitted runner used a private local cache, removed
both actual output directories before every task, and copied every Turbo
summary immediately. Output roots: `packages/tooling/test-kit/fc-runs/dist`
and `packages/foundation/primitive/types/dist`.

| Fixture | Task hashes (fc-runs / types) | Task source | Restored files | Result |
| --- | --- | --- | ---: | --- |
| Lane, private local cache | `3ca643e559fb1d3a` / `f8b314d6bfaf4138` | both LOCAL HIT | 28 | pass |
| Owned linked worktree | same | both LOCAL HIT | 28 | pass |
| Owned fresh clone | same | both LOCAL HIT | 28 | pass |
| Lane, normal shared cache route | same | both LOCAL HIT | 28 | pass |
| Lane, repeated shared restoration | same | both LOCAL HIT | 28 | pass |

All five output SHA-256 manifests are identical, with empty output manifests
before restoration. Reuse across the two clones and linked worktree is proven
for these exact inputs and tasks. Cache artifacts were produced at earlier
revisions with identical relevant inputs; the fixture execution revision alone
does not identify an artifact's producer. No remote cache or TTC proof reuse
was enabled.

A relevant source comment changed fc-runs to `793c738517d0e311`: dry lookup
reported MISS (`local: false`, `remote: false`), while types retained its hash
and LOCAL HIT. Actual execution also reported the fc-runs MISS, but exited 127:
`tsc: command not found`. The linked fixture lacked installed dependencies.
The input bytes were restored. This proves hash invalidation and a miss, but
not a successful changed-input build. The fixture now requires frozen installs
in both clone and linked checkout before the rerun. Final execution evidence
will be appended after that admitted run.

Private evidence: `cache-r1/cache-fixtures.json`, copied task summaries, output
SHA-256 manifests, changed-input dry summary and execution log. The earlier
launch restrictions and pending claims above are historical and superseded
by resume ruling 1 and these completed fixtures. Remote auth remains the
approved unsupported external condition; workstation-wide harness posture,
home writes and retiring legacy local caches remain owner dependencies.
