# Readiness friction ledger

| Date | Friction and evidence | Prevention or proposed goal addition |
| --- | --- | --- |
| 2026-10-14 | Historical sudo recipe said pam_ssh_agent_auth; the live dankserver PAM file uses pam_rssh. Old module rejected ED25519-SK before a touch. | Treat live managed-host configuration as the source; pin/build the FIDO-aware module reproducibly and verify fresh sudo. |
| 2026-10-14 | Fresh FIDO SSH requests can expire while unrelated browser approvals are being completed; two agent-refused attempts preceded a successful third attempt. | Persistent touch notifications, serialized hardware operations and bounded retries. |
| 2026-10-14 | Compose HTTP probe raced nginx startup: curl returned an empty reply immediately after up. | Poll a bounded real HTTP readiness check and always tear down the disposable service. |
| 2026-10-14 | 1Password service-account item reads require --vault even for an item UUID. Doctor confirmed service-account identity; vault-scoped retry follows. | Inventory full UUID references and verify the actual required operation, not a desktop sign-in assumption. |
| 2026-10-14 | Local op-doctor found shim ordering failure in the systemd fallback surface when the user bus is unavailable. | Include user-systemd PATH and op-lane tests in portability acceptance; do not infer desktop state from an agent failure. |
| 2026-10-14 | Mise checksum filenames contain a ./ prefix; first exact filename lookup missed it. The correct published checksum subsequently matched. | Fail closed before executing installers and normalize manifest filename prefixes. |
| 2026-10-14 | Wrangler's first device authorization expired after five minutes; its CLI timeout matches the browser's rejected-code result. | Issue short-lived codes close to the operator's approval, replace expired requests and verify login through the worker CLI. |
| 2026-10-14 | Azure CLI's successful resource-group read emitted a Python 3.14 invalid-escape SyntaxWarning from its SDK. | Track warning-only runtime compatibility separately from authentication; do not reinterpret a successful read as a failed login. |
| 2026-10-14 | An initial Pulumi probe targeted the hosted service, while DankStation uses an S3 DIY backend; its bare AWS login had expired. | Match the live backend and use the worker's approved op-run AWS environment. S3 login and four-stack discovery now pass; do not copy workstation credential caches. |
| 2026-10-14 | Fresh audit inherited a forwarded agent from a reused SSH master despite the new ssh invocation using -a; an independent presence probe confirmed it. | Remove SSH_AUTH_SOCK explicitly from workload process environments and verify inside each profile. Preserve T3's UnsetEnvironment drop-in; first audit launch is not isolation proof. Corrected native reruns are recorded separately. |

## Headless qualification findings

Two bounded native sessions completed: Codex gpt-6.1-sol/medium in a read-only
sandbox and Claude Opus 5.5/medium in plan mode. Full sanitized reports are in
history/2026-10-14-headless-{codex,claude}-audit.md. These are audit results, not
proof of publish/merge readiness. Codex's sandbox denied network/user-bus access;
its failed gh/op probes do not contradict the direct SSH authentication proofs.
Claude's plan session connected to the user manager but ignored untrusted
project permission entries. The first audit began before the remaining CLI scan
was complete; missing-tool findings are timestamped initial-wave evidence.

| Finding | Classification | Disposition / next proof |
| --- | --- | --- |
| Bun archive setup omitted bunx; shadcn and next-devtools MCP failed with ENOENT. | Introduced provisioning omission | Created bunx beside Bun; version now matches the repo pin. Fresh MCP startup remains a separate proof. |
| Graft absent at initial startup; Effect references absent. | Host-specific dependency/setup gap | Installed Graft CLI; version passes. Native parser and structural graph qualification plus approved reference provisioning remain needed; never run a deep build as a shortcut. |
| ~/.config/beep/models.yaml absent. | Host configuration gap | Provision the nonsecret model manifest and qualify native/proxy defaults against current aliases. |
| Borrowed node_modules symlink made the disposable checkout untracked and redirected Yeet's reported ledger to the source clone. | Introduced audit harness shortcut; source path ownership needs attribution | Replace borrowed dependencies with an independent frozen install before treating checkout/ledger behavior as repository drift. Do not patch Yeet from this ambiguous probe. |
| Read-only sandbox denied gh/op network and user-systemd bus; op-doctor could not write temporary diagnostics. | Execution-profile restriction | Declare capabilities by execution profile; separate sandbox constraints from actual authentication/service state. |
| Box MCP lacked host authorization; other MCPs assume IDE/local endpoints or op-backed configuration. | Workflow/host-specific integration gap | Create required/optional MCP matrix and qualify each actual host-scoped workflow. CLI login does not authenticate every connector. |
| Claude ignored 64 permission entries because project trust had not been established. | Headless bootstrap gap | Add an explicit trusted-checkout enrollment step and record trust separately from provider sign-in. |
| Retired cloud-session-setup.sh commands still appear in SPEC acceptance; cloud runbook closeout differs from D4. | Inherited contract drift | Reconcile current commands and publish/closeout boundaries per host class; preserve historical evidence as history. |
| Desktop notifications/hooks lack managed-worker guards and detached Yeet slice/job behavior is unproven. | Inherited workstation coupling | Add explicit supported host capabilities and qualify attached versus detached jobs; never equate help output with full Yeet readiness. |
| npm skipped native/parser/workerd install scripts. | Package-manager policy difference | Scoped package-script approval plus native runtime proof; no blanket global allow-all. |
| opencode-ai@2.0.27 absent from npm despite workstation opencode v2.0.27. | Packaging/provenance mismatch | Trace the actual workstation package source and install its correct artifact; do not silently substitute another CLI version or product. |


## T3 remote qualification findings — 2026-10-14

- Use the same release channel and compare orchestration protocol versions;
  two installations labelled 0.0.45 had incompatible protocols. Worker CLI,
  backend and desktop now use nightly 0.0.46-nightly.20261014.3093 / protocol 2.
- Separate native saved-environment enablement from a direct browser connection.
  The operator's native environment was Off, while the test existed on the host.
- Pairing codes are one-time: opening the URL in a browser spends it before
  Add environment. Paste fresh links directly into the intended client dialog.
- Supervised T3 approvals belong to the human UI. Its MCP pending-request tools
  expose questions, not shell approval resolution. Browser automation can operate
  specifically authorized read-only approvals without changing runtime mode.
- Configure enabled T3 provider instances and explicit executable paths for the
  installed Cursor/Grok/Muse clients, then qualify those providers independently.
- Version commands may write alias/update metadata. Preserve sandbox protection;
  record warning-only writes separately from actual CLI execution failures.
- Headless agent self-reports need comparison against actual activity and elapsed
  timers. This run inaccurately claimed no approvals and a two-minute duration.

Evidence: [T3 remote smoke](../history/2026-10-14-t3-remote-smoke.md).


## T3 provider qualification follow-up — 2026-10-14

The installed Claude, Cursor, Grok and Muse providers are now enabled and each
has a successful T3 shell smoke. Cursor's separate SDK browser login, exact
AppArmor helper profiles and D21-respecting test are recorded in
[provider qualification](../history/2026-10-14-t3-provider-qualification.md).

- Maintain version-pinned Cursor sandbox AppArmor attachments during upgrades.
- Match smoke commands to provider-lane policy; Cursor Git checks belong to the
  orchestrator under D21. Do not loosen the deny rule to reuse a generic test.
- Qualify T3's own GitHub account binding; its PR lookups hit rate limits while
  authenticated native gh had its full core allowance. Resolved for read-only
  discovery/list/detail workflows by the follow-up qualification below.
- Review Claude SDK's MCP allowedTools/canUseTool shadowing warning separately.
- Refresh browser/native connection grants only through an explicit operator
  action when management permissions are required; viewing status is distinct
  from provider management.

## T3 GitHub qualification follow-up — 2026-10-14

The worker's gh 2.46.0 lacked T3's documented >=2.81 structured account
discovery interface. Installed checksum-verified official gh 2.102.0 in the
user-local PATH, preserved the existing login, and restarted the idle T3 backend.
T3's browser UI now reports authenticated GitHub and loads PR lists and details.
Enforce the compatibility floor during provisioning and verify both structured
account discovery and the actual T3 workflow. Native gh authentication alone
was insufficient proof. GitHub writes/publishing were not exercised.

Evidence: [GitHub qualification](../history/2026-10-14-t3-github-qualification.md).

## Fresh headless follow-up — 2026-10-14

[Combined receipt](../history/2026-10-14-headless-portability-follow-up.md)
records corrected Codex/Claude runs. Bunx, Graft's executable, the model manifest,
independent dependencies and upgraded gh now pass inspection. References,
structural graph/parser, actual MCP connections and detached Yeet remain open.
Seven model-policy findings reproduce on DankStation; the worker home-config
locator remains unattributed. Do not turn network-sandbox denials into host-auth
failures or choose proposed model candidates automatically.

Claude's plan run exceeded the requested mutation/job/batch boundaries with a
temporary file and transient systemd diagnostic. Future audits need enforceable
capability/budget boundaries, not reliance on the model's plan-mode description.
The canonical proxy executable is cli-proxy-api; guessed spellings missing from
PATH do not establish a provisioning failure.

## Reference graph qualification friction — 2026-10-14

The canonical refs provision command only clones and links; its plan also prints
operator-only deep refresh commands. Do not equate the printed plan with setup
execution. Provisioning's child environment omits arbitrary Git configuration
variables, so a temporary PATH wrapper supplies a command-scoped HTTPS rewrite
for manifest SSH clone URLs without forwarding an administrator agent or changing
global Git configuration. Structural builds preserve upstream ignore files.

T3's 5,456-file reference graph built successfully, but its freshness check hit
the initial 120-second harness bound on the worker. Retry under a bounded
600-second check and record the result; a timeout is not proof of graph drift.
Successful checks for other members are reused rather than repeated.

All eleven member freshness checks eventually passed. Alchemy's build nevertheless
reports a parse/extraction failure in AWS/IAM/actions.generated.ts (Maximum call
stack size exceeded); zero build/check exits are not full parser-coverage proof.
The parent workspace build federates all eleven members and repeats that warning.
Its aggregate freshness check consumed roughly 10 GiB process memory, filled
swap and left about 444 MiB available. The orchestrator stopped only its owned
read-only check; memory recovered and T3, Docker and proxy services stayed active.
Aggregate checking is not qualified on this worker. Subsequent graph operations
use transient user scopes with explicit MemoryMax/MemorySwapMax and time bounds;
record scoped-query coverage separately from complete workspace validation.

Follow-up: [qualification receipt](../history/2026-10-14-graft-reference-qualification.md)
records successful bounded Beep build/check, direct Effect lookup and scoped
workspace/Beep source queries. Reference clones now have equivalent HTTPS
origins for future agent-free updates. Persistent workload resource guards,
aggregate freshness policy and the Alchemy parsing failure remain explicit
follow-up; deep ingestion was not run.

Resource-guard follow-up: [installed guard receipt](../history/2026-10-14-graft-resource-guards.md)
records a persistent shared slice and PATH wrapper. Sanitized-environment native
checking, actual cgroup limits and unavailable-runtime refusal pass. The worker's
systemd uses OOMPolicy=kill; MemoryOOMGroup assignment was rejected before the
first probe ran. MCP server lifetime is preserved but protocol requests remain
unqualified. Alchemy parsing and aggregate coverage remain open; explicit native
entrypoints need inventory before claiming every workload uses the guard.


## Model-policy reconciliation follow-up — 2026-10-14

[Receipt](../history/2026-10-14-model-policy-reconciliation.md) records zero
findings on DankStation and the worker's matching readiness worktree, including
the live proxy overlay. Worker config defaults and native/proxy wrappers now
match October 14 policy. Historical smoke results retain their actual pins.

- Model manifests and CLI schemas need version-compatible rollout; the worker's
  active root main checkout predates the new role vocabulary. Use the readiness
  worktree for current checks until root source integration is scheduled.
- A missing optional proxy token silently omits that catalog overlay; require
  overlay-presence evidence in parity acceptance. The expected private token
  path now exists and the live overlay answered.
- Worker executable wrappers are outside shell-function locator coverage.
  Add portable wrapper/library locators; explicit inspection caught the stale
  lightweight default despite the first zero-finding check.
- Optional Junie/Graft deep targets remain unqualified when absent. Do not
  interpret their skipped checks as an installed/authenticated integration.
- Continue with actual MCP tool requests and detached Yeet proof.


## MCP qualification follow-up — 2026-10-14

[Receipt](../history/2026-10-14-mcp-qualification.md) and sanitized protocol
summary distinguish seven actual read-only tool successes, two startup-only
servers and three unavailable/authentication-dependent paths. Native Codex's
read-only/never-approval session now calls WordCount and Phoenix docs successfully.

- Unannotated Effect tools advertise destructive defaults. WordCount was blocked
  despite its pure implementation; only its four hints were corrected. Audit
  other pure NLP tools individually and prove native approval behavior.
- Enabled Stately still needs OAuth; decide authentication versus a host-scoped
  optional disable. Serena/WebStorm retain their default-disabled IDE boundary.
- Fallow project_info's approximately 923 KB response is context friction even
  with optional sections disabled. Prefer bounded discovery surfaces.
- Graft MCP requires a positional indexed checkout path. Root main's graph passes;
  worktree graph freshness remains a separate source-version qualification.
- Claude native smoke was quota-blocked; direct MCP transport success is not a
  replacement for rerunning that provider profile later.
- Chrome debugging and M365 outbox startup do not qualify browser or mailbox
  operations. Preserve their explicit workflow/authorization boundaries.


## Detached Yeet follow-up — 2026-10-14

[Receipt](../history/2026-10-14-detached-yeet.md) records three real jobs,
terminal wait semantics, kernel budget evidence and archived cleanup receipts.

- Direct SSH submission fails the user-manager GetUnitByPID ownership probe.
  The installed beep-worker-yeet wrapper submits from a user-owned scope;
  decide whether core detached support should test manager reachability separately
  from current-process adoption.
- User-manager environment inheritance preserved an SSH agent despite an unset
  submitter variable. The worker-only proof-service prefix drop-in now removes
  it, with live-process proof.
- A 6 GiB MemoryHigh threshold stalled child cleanup and finalization. Final
  worker soft threshold is 7 GiB, with the 8 GiB hard ceiling retained. Qualify
  pressure-safe finalization separately from workload resource limits.
- A dead runner's loaded failed unit is not reconciled by the current read path,
  which requires not-found. Add safe failed/inactive-unit recovery using live
  main/control identity evidence and retain the observed systemd result.
- Cheap-gate refresh unshallows a fresh worker clone. Include history preparation
  in bootstrap cost/budget evidence; a three-minute ceiling did not complete all
  gates even on the rerun. No green proof was claimed.
- Normal failure and timeout wait paths pass; full green proof, cancellation and
  reboot recovery remain explicit acceptance work. Do not publish from these
  fixture receipts.


## Detached recovery repair follow-up — 2026-10-14

[Repair receipt](../history/2026-10-14-detached-recovery-fix.md) closes the
loaded-failed stale-record gap. Recovery requires a terminal unit, zero
main/control PIDs, empty task accounting or an absent cgroup, a dead recorded
identity and compatible invocation. Timeout/OOM causes and exit evidence are
preserved; absent proof outcomes never become green. 104 tests pass.

The real worker reported TasksCurrent=[not set] after its cgroup disappeared.
The first fixture read timed out; the corrected decoder accepts that sentinel
only as empty-unit evidence when ControlGroup is also empty. Unavailable
accounting for an existing cgroup still refuses recovery.

Canonical job wait recovered the same failed-loaded unit as timeout without
reset-failed. Observations now have a separate 1 GiB control budget outside the
proof slice, avoiding shared-pressure starvation. ExecStopPost remains in the
proof unit and can still be delayed; automatic recovery no longer depends on it
finishing once all owned work is gone. Heavy proof, cancellation/reboot behavior,
direct SSH detection and broader budget sizing remain separate acceptance.

## Worker cheap-gate concurrency — 2026-10-14

The [ten-minute proof](../history/2026-10-14-long-cheap-gates.md) still stalled at the 7 GiB soft ceiling: import-law and schema-first scans overlap under the hard-coded four-lane policy. Add an explicit or host-aware lower lane width, preserve the 8 GiB hard limit, and rerun actual detached cheap gates. Recovery safely refused remaining tasks and completed after bounded soft-throttle relief; finalizer execution under pressure remains separate work.

## Serial worker proof follow-up — 2026-10-14

The [one-lane rerun](../history/2026-10-14-cheap-gate-concurrency.md) proves the
configuration and detached forwarding. Required gate coverage and defaults
are unchanged. Concurrency no longer overlaps the scans, but import-law alone
grows past the soft threshold and the bounded proof times out. Bound that
scan's memory without weakening gate coverage. Shutdown still needs temporary
soft-throttle relief for stuck children; independent finalization alone cannot
free those tasks. Keep these as separate acceptance gaps.

## Import-law memory repair and next scanner — 2026-10-14

The [bounded scanner receipt](../history/2026-10-14-import-memory.md) closes the
import-law memory gap: same complete corpus, 92-second isolated check near 1 GiB,
97-second detached gate pass. Release each syntax tree after inspection instead
of retaining the whole corpus. The subsequent schema-first scan independently
grows past the soft threshold; apply an evidence-backed bound to that owner
without reducing required coverage. One canonical cancellation completed with
status 130 and no relief; reboot and harsher shutdown behavior remain open.

## Schema-first memory acceptance and quality closeout — 2026-10-14

The [schema-first receipt](../history/2026-10-14-schema-memory.md) closes the
measured scanner gap: preserved semantic checks, ambient declarations and test
arbitrary coverage; byte-identical 3,698-file result; 117-second detached gate
pass under the unchanged limits. Peak sits just below MemoryHigh, so concurrent
proofs and future corpus growth remain unqualified. Fallow audit now exposes
introduced complexity in recovery readLocked and model bindingProblem. Refactor
those owners, rerun their focused regressions, and then allow a longer finite
deadline for the complete serial cheap-gate tier. The final health check was
interrupted at ten minutes; no green complete verdict exists yet.

## Complete cheap-tier execution — 2026-10-14

The [closeout receipt](../history/2026-10-14-fallow-closeout.md) closes the
introduced Fallow complexity and reviewed-cache-config integration gaps. The
worker's complete serial cheap tier passes at bc1ff53d58 in 613.5 seconds with
normal success publication and wait 0. Use a finite fifteen-minute ceiling for
this measured shape; ten minutes was insufficient. Keep the existing memory
limits and one-lane width. Heavy/full proof, reboot recovery, concurrent runs,
complete cache qualification and post-main runtime/model-policy parity remain
separate acceptance items. No publication or orchestrator report was implied.

## Post-main runtime compatibility — 2026-10-14

The [fresh headless audit](../history/2026-10-14-post-main-headless-parity.md)
qualifies native Codex inference, bounded read-only CLI inspection and direct
host Docker/GitHub/service probes at 3721696041. Ordinary model checking stops
at the old `muse.optin` role spelling. A privately generated main seed passes
with zero findings across 360 models, and differs from the installed manifest
only by that spelling. Deploy the main-owned seed through backup-producing
adoption, then verify the ordinary path; do not change source policy to accept
an obsolete role. Separately trace an unauthenticated Box MCP startup connection
to its owning configuration before remediation. Other-provider post-main
inference and reboot acceptance remain open.

The [main manifest adoption receipt](../history/2026-10-14-worker-main-manifest-adoption.md)
closes that installed-manifest compatibility gap: canonical adoption preserves
the verified prior manifest backup, and the ordinary worker model check now
passes with zero findings across 360 models. Existing service launch-time
defaults and the older root CLI remain outside this verification. One catalog
effort-ladder change is reported separately; no candidate model was adopted.

The [Box source trace](../history/2026-10-14-box-mcp-source-trace.md) identifies
the installed, enabled remote Box plugin as the endpoint owner. Explicit
`mcp_servers` and `codex mcp list` do not expose that remote registration, so
future MCP inventories must inspect plugin registrations as well. The recorded
startup connection lacks a token; authenticate and qualify it if needed, or
evaluate a headless-scoped exclusion with Desktop impact understood. No plugin
state was changed during the trace.

The [post-main provider smokes](../history/2026-10-14-post-main-provider-smokes.md)
qualify fresh native Cursor, Grok and Muse inference with selected model
identity evidence. Claude's corrected launch is weekly-quota blocked; repeat
that route after availability returns rather than treating a fallback as its
qualification. Muse needs explicit workspace trust to load repo context; its
trusted prompt catalog compacts two skill descriptions without omitting ids.
Bounded shell-tool qualification, T3/proxy routes and reboot recovery remain
distinct from these inference-only runs.

The [bounded native shell smokes](../history/2026-10-14-post-main-provider-shell-smokes.md)
close the one-command execution gap for Cursor, Grok and Muse, with actual
tool output and unchanged existing-file hashes. Grok's CLI tool selector is
`Bash`, not its `run_terminal_command` RPC event name; an invalid selector warns
and leaves other tools available. Preserve that correction in future harnesses.
This does not qualify arbitrary sandbox enforcement, T3 SDK or proxy routes;
Claude remains quota-blocked and reboot recovery remains open.

The [proxy route receipt](../history/2026-10-14-proxy-route-qualification.md)
qualifies direct API inference and installed claudex/claudeg/claudem wrappers.
Claude proxy returns HTTP 429 independently of the native weekly-limit receipt.
Grok refuses the fixed-marker prompt but answers the ordinary arithmetic smoke
through its wrapper. Claude Code labels custom proxy models unrecognized and
disables native organization connectors when proxy credentials take precedence;
successful inference does not qualify those connectors. Proxy tool execution,
account-pool redundancy and reboot recovery remain open.
