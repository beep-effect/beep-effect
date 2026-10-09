# Relay reproduction boundaries

The two JavaScript files are retained as `.mjs.txt` research source artifacts.
They belong to the disposable third-party installation below, not a repository
workspace or its dependency graph. Copying them restores their executable names;
the source bytes remain unchanged.

This spike uses npm release 13.2.0. Byte equivalence with source reference
`5b30a69d7ac62190e89f8b1e13ccbd9a38a3a2db` was not established. No lockfile or
installed dependencies are committed; transitive versions may change on a fresh
install. Exact top-level packages and scripts-disabled install:

```sh
mkdir -p "$HOME/.cache/beep"
task_relay_cache="$(mktemp -d "$HOME/.cache/beep/relay-spike.XXXXXX")"
export BEEP_SPIKE_ROOT="$task_relay_cache"
mkdir -p "$task_relay_cache"
chmod 700 "$task_relay_cache"
npm install --prefix "$task_relay_cache" --ignore-scripts --no-audit --no-fund \
  @agent-relay/sdk@13.2.0 @agent-relay/harness-driver@13.2.0 \
  @agent-relay/harnesses@13.2.0
cp probes/broker-probe.mjs.txt "$task_relay_cache/broker-probe.mjs"
cp probes/session-fixture.mjs.txt "$task_relay_cache/session-fixture.mjs"
cp probes/fixture.py "$task_relay_cache/fixture.py"
cd "$task_relay_cache"
timeout 110s node broker-probe.mjs
timeout 30s node session-fixture.mjs write
timeout 30s node session-fixture.mjs read
```

The optional Linux x64 broker package is 13.2.0. This specific broker probe
requires Linux x64, Node >=22 and `python3` on PATH. Packaged sources were hardened after the captured run; only syntax and static
checks were repeated. `BEEP_SPIKE_ROOT` is mandatory and must resolve to an
existing directory strictly below `~/.cache/beep`; the original captured Relay
cache directory is refused. The recipe creates a fresh root, installs dependencies
there and copies sources there so Node imports resolve those dependencies. A
repeated run in the same root is a recovery test rather than a pristine baseline;
preserve first receipts before interpreting counts. The second session fixture deliberately reuses the first fixture's
durable queue.

The broker command uses `init --local-only --persist --state-dir <owned-cache>`
with loopback bind and an OS-assigned port. It gets only PATH, locale and a fresh
generated local authentication token. No Relaycast workspace key or inherited
cloud credential is supplied. `--local-only` is essential: omitting it is not
authorized by this reproduction recipe. The driver helper's structured spawn
options omit this flag, so the script directly owns the broker process.

Only `fixture.py` is spawned, as a custom native JSON-over-stdio sidecar. It
does not call a provider. The separate session fixture supplies a fake host to
the actual published `RelayHarnessSession` class. These cases establish broker
and queue mechanics, not model receipt, native provider fidelity or existing app
attachment. No model, paid endpoint, cloud workspace, global installation,
auto-setup, or global configuration mutation is part of the commands.

Raw logs include generated local tokens and opaque IDs. Keep mode 600 and never
publish them. Published receipts must replace opaque request/event/delivery IDs,
absolute home paths and account details. The captured JSONs in this packet are
sanitized; runtime scripts produce raw receipts for local inspection.

The broker's internal bound is 90 seconds; each API request is bounded at five
seconds. It releases the owned fixture, disconnects its client, terminates only
the owned broker, and uses a five-second forced-exit fallback. The Node fixtures
need no inference and exit after their synthetic class operations.
