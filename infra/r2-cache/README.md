# R2 remote cache: bounded first cohort

This deployment uses Alchemy's Effect stack and Cloudflare provider for one private
Standard R2 bucket. A checksum-pinned `brunojppb/turbo-cache-server` 4.0.20 adapter
runs on loopback on each consumer host. No shared API server or Worker is needed.

The fleet covers the operator's Linux workstation, existing trusted Linux workers,
and Turbo-backed CI jobs. The original first cohort used only `heavy.yml`.
Named trusted workstation agents and protected main CI can write. Same-repository
PR jobs read only; forks stay local-only. Existing AWS infrastructure stays intact.
No task becomes cacheable as part of this transport change.

## Ownership, pins and deployment state

The tracked template is copied to `pilot/alchemy.run.ts` in the pinned Alchemy workspace,
where its Alchemy and Effect dependencies are installed. It is not a member of this
repository’s TypeScript workspace.

`alchemy.run.ts.template` retains the pilot stack/resource identity and bucket name to avoid
replacing the already deployed bucket. Managed public access is disabled. Artifacts
expire after 30 days; incomplete multipart uploads expire after one day. Nonempty
destruction is disabled. Tokens are not Alchemy resources or stack outputs.

`alchemy.sh` uses Alchemy commit `95f15813480deb39f922d6590f223bc1a5eeb5a1` and
its distilled gitlink `b659514328c8001c39ac22667da2d331b980310b`. The split provider
at this source revision was unpublished; the isolated frozen workspace install is
intentional. The reference checkout remains untouched. It is provisioned through
`bun run beep refs provision`; `BEEP_REFERENCES_ROOT` selects its parent root.

Only the owner workstation runs deployment. The tool clone lives under
`~/.cache/beep/alchemy-r2-pilot-95f1581`. The wrapper relocates existing local
Alchemy state to `~/.local/state/beep/r2-cache/alchemy`, keeps the original state
directory as a recovery copy, links the tool to the durable state, and makes a
unique timestamped pre-operation archive. Later operations retain earlier snapshots.
A conflicting state root stops provisioning.

Use the reference-only management environment produced by the credential handoff:

```sh
op run --env-file="$HOME/.config/beep/r2-cache/provisioning.env" -- infra/r2-cache/alchemy.sh plan
```

Inspect the plan before `deploy`. Do not use `destroy` until the owned bucket's
contents have been inventoried and deliberately emptied. Keep the state archive.
This stack has no public endpoint or remote state bootstrap.

## Credentials and rotation

Keep credentials in 1Password; never put resolved values in tracked files, command
arguments, adapter logs, or stack output. Runtime grants come from the pinned
Alchemy `s3CredentialsPolicy` helper: `read` for PR consumers and `read-write` for
the workstation and protected CI. The provisioning credential separately needs
Workers R2 Storage Write for this account. It is not a runtime credential and
has no token-creation authority.

The initial credential handoff creates independent host/CI grants, verifies the
returned policies, stores them in the agent-accessible vault, and writes only
`op://` references to the workstation files. Use the human `op-human` lane for
vault creation when the agent lane cannot write; agents never invoke Desktop auth.
The owner retains the sanitized handoff receipt outside the repository.

The initial grants expire after 90 days; arrange replacement before day 60.
Rotate one grant at a time: create a replacement with the same Alchemy-derived
policy, update its vault fields and only its corresponding CI secret copies,
restart its consumer, prove a read/write or read-only operation as appropriate,
and revoke the old grant. Do not revoke an old grant before the replacement
works. A missing/expired credential must not block quality execution.

GitHub secret placement:

| Name | Scope |
| --- | --- |
| `TURBO_R2_WRITE_ACCESS_KEY_ID`, `TURBO_R2_WRITE_SECRET_ACCESS_KEY` | Protected `turbo-cache-write` environment |
| `TURBO_R2_READ_ACCESS_KEY_ID`, `TURBO_R2_READ_SECRET_ACCESS_KEY` | Repository secrets for same-repository PR reads |

Public variables are `TURBO_R2_ENDPOINT`, `TURBO_R2_BUCKET`, and the activation
flag `TURBO_R2_ENABLED`. Stage the flag as `false`; turn it on only after the
main-ref integration and both credential roles pass qualification. The protected manual `r2_probe`
mode can qualify the staged keys while the global flag remains false. Never replace
the existing AWS `TURBO_API`, `TURBO_TOKEN`, `TURBO_READ_TOKEN`, or `TURBO_TEAM`.

## Workstation lifecycle and enrollment

`~/.config/beep/r2-cache/workstation.env` contains nonsecret endpoint, bucket, port
and team values, plus references for the host key, S3 secret and loopback bearer.
The storage credentials resolve once when the user service starts. Client bearer
references still use the CLI's existing secret-session path; include that overhead
in whole-command measurements. No quality command needs a Cloudflare login.

```sh
infra/r2-cache/workstation.sh install
infra/r2-cache/workstation.sh enable /absolute/path/to/the/checkout
```

The installed unprivileged `beep-turbo-r2.service` binds `127.0.0.1:9427`, limits
restart attempts and memory, and runs two adapter workers. It receives storage
access but strips vault and application credentials from the adapter environment.
A persistent failure leaves quality commands able to execute locally.

Enrollment changes only the cache quad plus `BEEP_TURBO_TRUSTED_WRITER=true` in
that checkout. It refuses duplicate cache entries, symlinked dotenv files, and
raw existing cache tokens. A private receipt retains only the old/new cache fields
and references, retaining original cache lines for rollback, including `export`
and spacing. Other dotenv values and unrelated later edits stay intact.
Fleet enrollment checks the source revision before selecting a cache mode. Older
resolvers receive their supported read mode; current resolvers permit trusted
writes. An explicit direct-Turbo launcher supports historical source without edits.

## CI lifecycle and fallback

The heavy workflow starts the adapter only when the opt-in variable is true and
the event is either a protected main push or a same-repository PR. Write keys
come only from the protected environment; PR jobs receive only the reader grant.
Older PR checkouts without the helper preserve AWS caching. Startup/download
failure leaves the previously exported AWS quad unchanged. Cache request failures
are nonfatal to task execution; record them rather than calling failed uploads hits.

The job exports a fresh masked loopback bearer through GitHub's environment file.
It first confirms that the pinned adapter process owns the loopback listener;
an unrelated healthy service on that port preserves the original cache settings.
R2 storage keys stay in the startup step and adapter process. The adapter retains
`RUNNER_TRACKING_ID` so runner cancellation can reap it; the final always step
also stops its exact recorded process. Artifact logs and environments are not uploaded.

## Qualification and economics

Prove exact-hash upload/restoration in both directions, reader write rejection,
large payloads, credential failure, and restoration of the original configuration.
Preserve existing cache:false tasks and correctness tripwires. Count the adapter's
extra HEAD on GET and multipart operations in the R2 cost model. R2's per-key write
limit remains a contention risk; a three-writer burst is not sustained evidence.

Compare whole commands against the current AWS/shared-local setup with matched
inputs and toolchains. Keep local cache state comparable. Exclude forced/disabled
runs from eligible first-touch hit rates, and separate intentionally cold probes
from natural traffic. Runner-time savings become cash savings only when billable
VM lifetime decreases. During coexistence, AWS costs have not yet disappeared.
The accepted value gate is lower recurring cost with comparable real-world speed;
additional latency improvement is a bonus. Do not extrapolate the single cold-local
pilot comparison into a production percentage.

## Rollback

1. Set `TURBO_R2_ENABLED=false`; heavy jobs then retain the original AWS tuple.
2. Restore each enrolled checkout while its adapter is still available:

   ```sh
   infra/r2-cache/workstation.sh rollback /absolute/path/to/the/checkout
   infra/r2-cache/workstation.sh stop
   ```

3. Revoke only the cohort's grants after consumers have returned to AWS/local.
   Retain vault recovery metadata and Alchemy state. The AWS cache, keys and
   bucket were never changed. Bucket retirement is a separate operation.

The checkout rollback refuses to overwrite cache fields modified after enrollment
and preserves unrelated dotenv edits. Record any unresolved conflict explicitly.

## Bounded main-ref qualification

Run `probe.py seed --marker <sixteen-hex-marker>` on the owner workstation using
its resolved client environment. It executes a writer-only task and stores the
safe seed receipt and two large payloads. Dispatch Cache Warm on main with
`r2_probe=true`, that marker and a reviewed `r2_source_sha`. The source revision
must be an ancestor of main before any repository code runs. CI restores the
workstation hash, executes/uploads a second task and tests the reader grant.
The global heavy-job flag may remain false throughout this qualification.

Then run `probe.py restore` with the same marker. It requires the CI-produced
hash, the CI execution duration metadata and both large payloads to match.
Only the sanitized `ci-proof.json` is uploaded for a probe. A successful probe
is permission/transport evidence, not a measured fleet savings percentage.

`check.sh` exercises real adapter process isolation/cleanup and cache-only
enrollment/rollback with inert credentials, including an occupied-port fallback.
With an active user manager it also runs the rendered service through an inert
credential helper to verify paths containing spaces, percent and dollar characters.
It makes no 1Password or R2 data-plane requests.

## Fleet enrollment and direct commands

After installing the host adapter, inventory clones and registered worktrees with
an exact upstream check. The default is a read-only plan:

```sh
python3 infra/r2-cache/fleet.py "$HOME/YeeBois/projects"
python3 infra/r2-cache/fleet.py "$HOME/YeeBois/projects" --apply \
  --output "$HOME/.local/state/beep/r2-cache/fleet-enrollment.json"
```

Enrollment writes only ignored cache references and retains per-checkout rollback
receipts. Current resolvers receive trusted read/write mode; historical resolvers
receive read mode. Sources without that resolver are reported explicitly. Their
source and branch stay intact. `beep-turbo` provides the installed direct route:

```sh
beep-turbo lint --filter=@beep/brand
beep-turbo check --filter=@beep/brand
```

It selects the shared filesystem cache, records a run summary, and resolves only
the host client references. Use it for direct Turbo calls or historical branches;
ordinary current `bun run` quality commands already select the same cache.

Fresh current clones and raw Git/app worktrees with no cache settings load the
installed reference-only `client.env` at CLI startup after verifying the canonical
public upstream. Private forks and unrelated repositories do not inherit it. Explicit checkout settings,
CI and `BEEP_TURBO_HOST_CACHE_DISABLED=true` take precedence. The canonical
`beep worktree new` command also copies the enrolled primary checkout's `.env`.
No discovery daemon or recurring fleet job is installed.

The trusted Linux fleet initially shares the existing bucket-scoped host role.
Each host resolves it through its own approved `op` backend; no 1Password auth
store is copied. This role has joint revocation: rotate it on every enrolled
host before revoking its predecessor. Protected CI writers/readers retain their
separate grants. The grant expiry and replacement-before-day-60 rule above still
apply. Offline hosts need a live service and reuse proof before they count.

All Turbo-backed CI callers use the same optional startup in the existing setup
action and exact-process cleanup at job exit. Protected main pushes write;
same-repository PRs and main scheduled/manual jobs read. Forks stay local-only.
The separate Cache Warm probe keeps its existing protected qualification path.
