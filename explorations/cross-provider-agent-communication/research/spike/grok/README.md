# Grok native and two-provider evidence

These are sanitized results of the authorized disposable 2026-10-09 spike.
[REPORT.md](REPORT.md) records Grok's five idle and five busy cases, cancellation
and leader resume/attachment limits. [ROUNDTRIP.md](ROUNDTRIP.md) records one
Codex → Grok → Codex exchange. The exchange used **controller-mediated model
output forwarding**; autonomous reply-tool integration and existing-app
attachment were not tested.

`SUMMARY.json`, `results-prefixed.json`, `leader-result.json`,
`leader-no-load-result.json` and `roundtrip-result.json` contain sanitized
receipts. No private raw trace, exact runtime identity, account metadata or
transcript is included. Latencies describe these small observed samples.

## Reusable probes: explicit opt-in

The Python sources are portable replay variants of the measured cache helpers.
Their syntax was checked after packaging; the packaged variants were not run
against models. Review them before a replay. Running without the flag exits
before creating a workspace or starting a provider:

```sh
python native-probe.py
python roundtrip-probe.py
```

Only an explicitly authorized model replay should pass `--run-model-probes`.
Use an external wall-clock bound so an unexpected provider stall stays bounded:

```sh
timeout --signal=INT --kill-after=10s 300s python native-probe.py --run-model-probes
timeout --signal=INT --kill-after=10s 300s python roundtrip-probe.py --run-model-probes
```

Each opt-in replay creates a fresh mode-700 directory under
`~/.cache/beep/agent-comms-spike/grok-replay-*`, with an empty owned workspace
and private Grok home. The scripts never use their packet/repository directory
as provider cwd. They require bwrap and the exact measured Grok revision, use
the existing cached subscription auth through a read-only bind without reading
or copying credentials, and omit API-key environment routes. No fallback,
configuration repair, sign-in, install or new paid endpoint is attempted.

`native-probe.py` uses Grok 4.7 medium for bounded text/nonce prompts, five idle
interjections, five busy interjections and targeted cancellation. It verifies
fresh-home effective configuration before inference. Grok's own bundled skills
may appear after launch, as recorded in the measured report. All client tool
requests are refused; no files, tools, web search or delegation are requested.

`roundtrip-probe.py` additionally requires the installed Codex app-server and
Python `websockets` library. It copies the original controller's Client pattern,
with a fresh owned Unix socket and ephemeral Codex thread. It forces existing
ChatGPT auth, `gpt-6.1-sol` medium, no fallback, read-only/never, disabled project
docs, configured MCP servers, hooks, plugins, apps, memories and subagents.
Codex produces a request envelope, Grok replies, and Codex acknowledges the
actual forwarded reply. Peer output is synthetic data. No production broker or
ambient session is connected.

The sources log raw protocol into private files in the new cache directory,
including opaque runtime IDs and authentication metadata. Those files must
remain private; do not copy them into this public packet. Provider children are
terminated in `finally` blocks, with a bounded kill fallback. Remove only the
new replay directory after its owned processes have stopped. Replays may spend
existing subscription quota; they are not required to read these results.

The measured owned-leader tests are represented by receipts rather than a
packaged leader-launch script. Explicit load passed; no-load live attachment
failed. Neither is a GUI/TUI attachment claim.
