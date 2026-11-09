# GitHub Packages census — 2026-10-23

Closes #1857. Decision: SPEC Decision Log, S44 rsc-gated-c package GET approval.

The agent shim resolved the approved existing package credential (exit 0).
The credential stayed in process memory/environment and was used only for GETs;
no scopes, packages, versions or secrets were changed. Each list was paginated
with `per_page=100`; each request succeeded. Only counts and package names were
retained from list responses.

| Owner | Type | Count | Names |
| --- | --- | ---: | --- |
| beep-effect | npm | 0 | none |
| beep-effect | container | 0 | none |
| beep-effect | maven | 0 | none |
| beep-effect | rubygems | 0 | none |
| beep-effect | docker | 0 | none |
| beep-effect | nuget | 0 | none |
| kriegcloud | npm | 0 | none |
| kriegcloud | container | 1 | falkordb-seeded |
| kriegcloud | maven | 0 | none |
| kriegcloud | rubygems | 0 | none |
| kriegcloud | docker | 0 | none |
| kriegcloud | nuget | 0 | none |

A GET of the single container's package metadata also succeeded: public,
three versions, repository link absent. Preserve `falkordb-seeded` and all its
versions: no deletion, transfer, dependency or consumer conclusion is authorized
by the absence of a repository link.

This completes the missing registry half of the bounded external-contract census.
The prior consumer census remains [stage-2-policy.md](https://github.com/beep-effect/beep-effect-goals-archive/blob/main/goals/repository-simplification-confidence/history/receipts/stage-2-policy.md#external-contracts):
61,378 local manifests, zero demonstrated consumers, with its original remote
and inaccessible-consumer limitations. It is historical evidence, not a fresh
scan. Current package versions and APIs are preserved. Note-reset recovery
parent `da1a85157d7c8cc6b72fe43f12d01389db811ce9` and original tree
`d839776128c29c6c4cc7c2937329942d873b973c` remain in the unchanged reset baseline.

Authentication: current shell shim, service-account mode. Doctor confirmed that
route, while reporting `FAIL PATH systemd-run-service-fallback: shim not first`
and `FAIL systemd user environment OP_ count: environment-blocked (user bus unavailable)`.
Neither systemd route was used. Desktop Environments MCP was skipped; this is
an agent credential operation. No raw response, token or credential file was retained.
Reversal: stop this read-only credential use; preserve published artifacts and
revert this receipt PR if its disposition is superseded.
