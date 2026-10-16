# T3 provider qualification — 2026-10-14

## Configuration

The operator requested configuration and tests for T3's other installed providers
on beep-worker. T3 nightly 0.0.46-nightly.20261014.3093 now enables Codex,
Claude, Cursor, Grok and Muse. Updated only the appropriate providerInstances
entries and the approved new-thread default, retaining the other settings.
Explicit executable paths point at the worker's installed Claude/Grok/Muse
clients; Cursor V2 uses the SDK, not the legacy Cursor Agent CLI binary setting.
Settings are watched by T3, and the browser UI confirmed the enabled providers.

The existing browser session has limited provider-management permissions.
Configuration used the already-authorized SSH host-owner route; its browser
permissions were not broadened. Retained a mode-0600 settings backup at
`~/.cache/beep/readiness/t3-settings-before-providers.json`.

New-thread default: Codex GPT-6.1-Sol, medium reasoning. No full-access default
or global approval-policy change was introduced by these provider tests.

## Cursor authentication and sandbox repair

Cursor Agent CLI sign-in did not authenticate the T3 Cursor SDK. Used official
@cursor/sdk 1.0.35's browser login with a named key, "T3 Code - beep-worker
Cursor", and the default 90-day lifetime. The operator authorized the fresh
SDK sign-in. Its value was never printed or committed. The owner-only temporary
SDK file was imported through T3's supported legacy-store migration, then
removed by T3. The live provider catalog returned models with no authentication
constraints; the browser reported Cursor authenticated.

Initial Cursor starts failed with ConfigurationError: local SDK sandboxing was
requested but unsupported. Added an executable link for the existing official
Cursor CLI cursorsandbox helper. That alone did not fix the failure: kernel
logs showed AppArmor's unprivileged_userns profile denying net_admin during
isolated loopback setup for both native and SDK helpers. This is the verified
root cause; the initial PATH hypothesis was insufficient.

Installed `/etc/apparmor.d/beep-cursor-sandbox` using remote YubiKey sudo. It
contains two version-pinned executable profiles with flags=(unconfined) and
userns permission, one for the bundled T3 SDK helper and one for the native CLI
helper. This is a deliberate per-executable user-namespace exception for these
sandbox builders; it does not disable system-wide AppArmor or change the global
kernel.apparmor_restrict_unprivileged_userns value of 1. Both helpers subsequently
passed sandbox preflight. T3 was restarted only after other test runs completed
to clear cached preflight failure.

The fourth Cursor attempt started successfully but its combined command was
blocked by the repo's D21 Shell(git) deny policy. Preserved that policy. The fifth
attempt omitted Git and passed. Checkout cleanliness was independently checked
by the orchestrator over SSH, not attributed to Cursor.

When Cursor/T3 versions change, reconcile the exact helper attachment paths in
the AppArmor profile and rerun preflight. Rollback removes the two named profiles
from the kernel with apparmor_parser -R and removes this owned profile file;
restoring the settings backup reverses provider configuration. Revoke the named
SDK key in Cursor's account dashboard when decommissioning the host.

## Results

| Provider | Selection | Result |
| --- | --- | --- |
| Claude | claude-opus-5-5, effort medium | Completed, shell proof passed |
| Grok | grok-4.7, reasoningEffort medium | Completed, shell proof passed after one UI approval |
| Muse | muse-spark-1.3, reasoningEffort medium | Completed, shell proof passed |
| Cursor SDK | claude-opus-5-5, effort medium | Final supervised sandboxed run passed after setup/policy remediation |

The tests requested only hostname, cwd, Node/Bun versions and (outside Cursor)
git status. They forbade edits, installs, credential inspection, commits,
deployment and delegation. All successful runs reported beep-worker, the
beep-effect root, Node 24.21.0 and Bun 1.4.2. The orchestrator checked the
checkout remained clean after execution. These are launch/authentication/tool
smokes, not full application or representative package quality proofs.

## claudeAgent execution evidence

Thread: `mcp:3c3319d6-aa45-49e3-9dfa-a75c8355e401`.

```text
$ hostname; pwd; git status --short; node --version; bun --version
beep-worker
/home/elpresidank/YeeBois/projects/beep-effect
v24.21.0
1.4.2
```

Final provider report:

The smoke passed. I ran only the one command you specified.

| Check | Result |
| --- | --- |
| Host | `beep-worker` |
| Working directory | `/home/elpresidank/YeeBois/projects/beep-effect` |
| Checkout | Clean: `git status --short` printed nothing (branch `main`) |
| Node | `v24.21.0` |
| Bun | `1.4.2` |

I made no edits, installs, credential reads, delegations, commits or deploys.

## grok execution evidence

Thread: `mcp:313e6cc4-4500-4f0c-9872-e3bb7df14c96`.

```text
$ hostname; pwd; git status --short; node --version; bun --version
exit: 0
beep-worker
/home/elpresidank/YeeBois/projects/beep-effect
v24.21.0
1.4.2

```

Final provider report:

The smoke command finished successfully. The checkout is clean.

| Item | Value |
|---|---|
| Host | `beep-worker` |
| Path | `/home/elpresidank/YeeBois/projects/beep-effect` |
| Git status | clean (`git status --short` printed nothing) |
| Node | `v24.21.0` |
| Bun | `1.4.2` |

## muse execution evidence

Thread: `mcp:6d581584-c699-4727-a4a1-3cfd0c56fe39`.

```text
$ hostname; pwd; git status --short; node --version; bun --version
{
  "chunk_id": "exec-1-1",
  "command": "hostname; pwd; git status --short; node --version; bun --version",
  "description": "Run provider smoke check",
  "exit_code": 0,
  "terminal_status": "completed",
  "output": "beep-worker\n/home/elpresidank/YeeBois/projects/beep-effect\nv24.21.0\n1.4.2\n",
  "original_output_bytes": 74,
  "original_output_tokens": 19,
  "truncated": false
}
```

Final provider report:

Smoke complete:

- Host: `beep-worker`
- Path: `/home/elpresidank/YeeBois/projects/beep-effect`
- Checkout: clean (`git status --short` empty)
- Node: `v24.21.0`
- Bun: `1.4.2`


## cursor execution evidence

Thread: `mcp:39b2816a-e33d-4a53-8596-b878854e905b`.

```text
$ hostname; pwd; node --version; bun --version
beep-worker
/home/elpresidank/YeeBois/projects/beep-effect
v24.21.0
1.4.2

```

Final provider report:

The smoke passed. The command exited 0 and ran inside the Cursor sandbox, which allows writes only to the workspace and has network access blocked.

| Check | Result |
| --- | --- |
| Host | `beep-worker` |
| Path | `/home/elpresidank/YeeBois/projects/beep-effect` |
| Node | `v24.21.0` |
| Bun | `1.4.2` |

This lane did not check whether the checkout is clean, because `git` was not run. That result comes from your separate check over SSH. I made no edits, read no credentials and changed no hooks or policies.

## Remaining readiness friction

T3 logs report GitHub API rate-limit failures during PR lookup, while a separate
`gh api rate_limit` on the worker returned the authenticated 5000-request core
limit with all 5000 remaining. Native gh login is therefore not proof of T3's
source-control account binding. Qualify T3 GitHub integration separately.

Claude SDK emitted a warning that its bare T3 MCP allowedTools entries shadow
canUseTool callbacks. These tests performed no MCP mutations or delegation;
record the warning for adapter review rather than inferring a tested exploit.

The native DankStation environment was last shown Off. Its saved pairing and
these direct worker-web tests are separate from client-side enablement.
