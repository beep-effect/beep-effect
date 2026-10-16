# CLIProxyAPI route qualification — 2026-10-14

Qualified direct loopback API requests and the installed claudex, claudeg and
claudem wrappers on beep-worker at
`ec329502ba16d7b4d07630834f29fe2291e893d6`. The Claude proxy model returns
HTTP 429 and remains unavailable for this probe. No authentication or proxy
configuration was changed.

## Direct API probes

The existing cli-proxy-api user service is active. Read the existing mode-0600
client-token file inside the probe process without printing it or putting it in
argv. An authenticated GET to loopback `/v1/models` returns HTTP 200 and 62
models, including the four installed wrapper selections.

Sequential `/v1/chat/completions` requests selected each model, medium reasoning,
non-streaming output, a 1,024-token cap and a fixed response prompt forbidding
tools/web search. Each HTTP operation had a 90-second timeout.

| Wrapper selection | Requested model | Direct result |
| --- | --- | --- |
| claudex | gpt-6.1-sol | HTTP 200; response model gpt-6.1-sol; exact marker; zero tool calls |
| claudeg | grok-4.7 | HTTP 200; response model grok-4.7-build; declined fixed-marker prompt; zero tool calls |
| claudep | claude-fable-5-1 | HTTP 429, rate_limit_error; no successful inference |
| claudem | muse-wonder-1.0 | HTTP 200; response model muse-wonder-1.0; exact marker; zero tool calls |

Grok's response was a content refusal, not a transport/authentication error.
The Claude error says the request would exceed the account's rate limit.
This does not identify its reset time or prove that it has the same cause as
the separately recorded native Claude weekly quota. No model substitution,
relogin, account rotation or fallback was performed.

The first probe's response parser assumed tool_calls was always a list and
failed on null before writing its receipt. Corrected the parser to treat null
as zero tool calls and reran the bounded probes. The earlier request reached
the service but is not counted as a retained successful receipt.

## Installed wrapper execution

Tested the three available wrappers sequentially with the ordinary prompt
"What is 2 + 2? Answer with the number only. Do not use any tools."
Each used `-p`, medium effort, JSON output, empty built-in tools, a strict empty
MCP configuration, an explicit `--` argument boundary, stdin from `/dev/null`
and a finite 120-second timeout. The Claude route was not repeatedly probed
through its wrapper after the direct rate-limit result.

| Wrapper | Result | Client modelUsage identity | Elapsed |
| --- | --- | --- | --- |
| claudex | Exit 0, is_error false, one turn, response 4 | gpt-6.1-sol(medium) | 15.01 s |
| claudeg | Exit 0, is_error false, one turn, response 4 | grok-4.7 | 20.25 s |
| claudem | Exit 0, is_error false, one turn, response 4 | muse-wonder-1.0(medium) | 15.08 s |

The successful Grok wrapper answer qualifies its ordinary inference path even
though the preceding fixed-marker request was refused. Wrapper usage labels
and direct API response identities are the observed model evidence; they do
not independently attest which upstream account was selected or every internal
reasoning setting.

All three wrappers emit two Claude Code startup warnings: proxy credentials
take precedence over the native claude.ai login and disable its organization
connectors; custom model ids are marked unrecognized. These do not prevent
the recorded successful responses. Keep connector expectations explicit:
native Claude login and proxy execution have different authentication paths.

## Preservation and limits

All workload launches explicitly unset SSH_AUTH_SOCK. The wrapper harness
hashes the seven existing tracked edits and untracked `.grok/config.toml`
before and after and verifies byte equality. No additional repository changes
were observed. Private API and wrapper receipts, launch argv, stdout and
stderr remain under `~/.cache/beep/readiness/post-main/proxy/`; no credential
values were printed or committed.

This qualifies inference for the three available proxy selections, including
their installed shell wrappers. It does not qualify proxy shell tools, MCP,
account-pool redundancy, T3 routing, inference after reboot or heavy/parallel
workloads. Claude proxy availability, native Claude quota, Box authentication
and reboot recovery remain separate readiness items.
