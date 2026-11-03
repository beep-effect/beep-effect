# Brief

## Problem

The operator wants T3 Code to be the one place they run and coordinate
beep-effect agent work, on DankStation and on the tailnet hosts. The repo
today points the other way:

- the orchestrator skills and runbooks route cross-session messaging through
  a home-grown mailbox (`beep agent-message`, `@beep/t3-code`, session
  bridges) whose T3 driver reaches only loopback;
- only DankStation and beep-worker run T3, and beep-worker runs a build that
  is not the fork;
- harnesses outside T3 cannot reach T3 sessions at all;
- when DankStation is under pressure, nothing says where work should go.

T3 already does most of this natively. It injects its MCP tools into every
session it launches, addresses threads on linked environments, runs headless
under systemd, and drives many environments from one client. The job is to
adopt it, spread it across the fleet, and delete the parallel stack.

## Appetite

Four bounded goals, each one PR or one ops campaign. Repo code is mostly
deletion. New repo prose is limited to skills, runbooks and host profiles.
New host-side machinery is limited to one publish step on DankStation and one
pull timer per host. No new `beep` services, no daemon, no dispatcher.

## Solution sketch

1. **T3-native orchestration.** Delete the beep agent-messaging tooling, the
   managed session adapters in `@beep/ai-provider-cli`, `@beep/t3-code`, and
   the agent-to-agent goal and exploration packets. `retired:wake-service` is
   superseded, and the agent-message observation enrollment path is retired
   along with its now-unused ai-metrics modules
   ([research/removal-map.md](research/removal-map.md)). Links to the retired
   packets become `retired:<slug>` plus a commit permalink, following the
   PR #1975 precedent. After the merge, clean the local state the old tooling
   left on DankStation. Rewrite `orchestrate`, `operator-handoff`,
   `remote-development-agents`, `closeout` and the messaging, notification
   and pool runbooks around T3's tools: `orchestrator_capabilities`,
   `t3_thread_launch`, `t3_thread_send`/`read`/`wait`/`interrupt`,
   `delegate_task`, `environmentId`, and scheduled tasks. Receiving a message
   still does not transfer repository authority; the registered orchestrator,
   briefs, ownership and Yeet gates are unchanged.
2. **Fleet rollout.** DankStation's fork sync also packs the server bundle
   and publishes it with its SHA-256 on a tailnet-only endpoint. Each host
   runs a pull timer that verifies the hash, installs, and restarts a
   `t3 service` systemd user unit with linger. Hosts are served over
   Tailscale HTTPS and linked hub-and-spoke from DankStation with full access:
   - beep-worker: convert the existing service to the fork build.
   - dankserver: new install, fitting inside its job slice.
   - tom-pc-1: a new dedicated WSL distro with automount and interop off and
     its own user and credentials.
   - tbk-worker: gated on the operator releasing its latch, reached only
     through an SSH forward.
   - grok-bot-box-1: out of scope.
3. **Harness MCP.** On every host, each harness running outside T3 (terminal
   Claude Code, Codex, Grok, cursor-agent, Junie) registers `t3-hub`, the
   DankStation environment, with a Full-access OAuth grant. A live check must
   show that T3-launched sessions do not double-load it. Renewal reminders
   cover the 30-day grants and links.
4. **Spill routing.** An advisory rule in `orchestrate`: read
   `beep palantiri parcel host-pressure --json` before substantive work;
   above the thresholds, launch on beep-worker, then tom-pc-1 (one job), then
   dankserver, with tbk-worker after beep-worker once released. The
   thresholds come from the 7-day baseline once the MemAvailable-0 sample is
   explained.

## Rabbit holes

- Linked environments are a Labs beta. If a link proves unreliable, fall
  back to per-environment saved connections in the client and record it. Do
  not build a relay.
- T3's OAuth scope is environment-wide. Do not build a narrowing proxy;
  full-access links go only to provisioned worker hosts.
- `t3 service` under systemd inside WSL is undocumented. Prove it once; if
  it fails, accept "desktop app stays open" on tom-pc-1.
- The fork bundle must match the host's architecture and Node version. Pin
  the Node range in the published metadata.
- Do not let T3's own updater overwrite the fork build on hosts; verify how
  to disable it.
- Provider credentials on each host stay that host's own logins. Never copy
  DankStation credentials.

## No-gos

- No new beep messaging, relay, mailbox or dispatcher code.
- No T3 Connect tunnel, no Funnel, no public listeners. Everything is
  tailnet-only or loopback.
- No starting tbk-worker. No Hyper-V on tom-pc-1. Nothing on grok-bot-box-1.
- No repo-owned writer for harness config; that is
  `agent-config-canonicalization`.
- No client data or tailnet identifiers in the public repo.
