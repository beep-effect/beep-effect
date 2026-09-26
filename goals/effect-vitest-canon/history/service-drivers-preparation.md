# Firecrawl, Runpod and Sanity preparation

This wave starts from main `7980e5aaa1` and the existing wave-six schedule.
It covers eight recorded files and85 existing inventory rows. Current test
membership matches those eight paths. All1460 source lines were read alongside
the four lens charters before implementation; no global reinventory was used.

Three files differ from the frozen census commit
`662823dd960367046ba7d73dd8fd25d15782865a`. Runpod and Sanity have import-path
modernization. Firecrawl also replaced its synchronous property helper with
Effect codecs and an Effect registration, retaining16 schema domains and
`fcRuns(25)`. Its historical runtime-runner finding needs current attribution.

## Before measurements

All six configured runs exited0 with stable source, manifest and lockfile
hashes. Firecrawl and Runpod API-key variables were explicitly blank in each
subprocess. No credentials were resolved or external calls performed. Their
passing missing-key branches are baseline registrations, not live-service proof.

| Package | Node command | Bun command | Passing registrations |
| --- | ---: | ---: | ---: |
| Firecrawl | 4.786 s | 2.099 s | 14 |
| Runpod | 4.805 s | 2.350 s | 11 |
| Sanity | 4.360 s | 2.052 s | 6 |

Raw reports and workstation load/pressure contexts are retained in the matching
preparation/service-drivers timing directories. These shared-workstation
measurements do not establish comparative speedups.

## Ordered remediation

Scope first: isolate Sanity's mutable responder/capture fixture, retain the
already independent Runpod blocks, bound local fixture acquisition, and replace
Runpod's copied live provider wrapper with explicit layer ownership. Preserve
Firecrawl watcher completion, failure and close assertions.

Then migrate typed assertions, preserving all payloads and original first-error
observations. Property work retains Firecrawl's16 domains at25 runs, Runpod's10
domains at25 runs and Sanity's seven existing domains at50 runs. Add synthetic
Firecrawl credential-gate boundaries and Sanity's omitted token-present domain
without weakening existing predicates. Flake review precedes instrumentation
and honest live-test skip reporting. No production fixes are authorized by
this preparation, and no inventory remediation is claimed yet.
