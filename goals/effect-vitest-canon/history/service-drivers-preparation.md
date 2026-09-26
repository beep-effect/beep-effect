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

## Scope, assertion and property checkpoint

Sanity's fixture isolation is committed in `1cd30e96b9`; Firecrawl and Runpod
scope changes are in `80040ad26f`. Five Firecrawl and seven Runpod unit layers
have five-second acquisition limits. Runpod's two live cases use explicit
30-second layers, preserving their Config-based credential guards. Existing
service bodies and assertions were retained during this phase.

Native typed assertions landed in `5cd7d753fc` and `5f108d1e61`. They preserve
plain-value assertions and first typed error observations without constructing
a new failure-cause expectation. Each package passed full audit and docgen.

Property commit `6cc5138000` migrates Firecrawl's16 schema domains and Runpod's10
to native registration with `fcRuns(25)`. Firecrawl retains Effect codecs and
schema equivalence. Runpod retains exact re-encoding, its equality-or-schema-
equivalence predicate, normalized raw-path arbitrary and `/future` oracle.
Sanity's `032cb23fc1` adds token-present configurations while retaining the
original seven-domain50-run property. Synthetic string tokens are generated
from the accepted token field domain; no real credentials are read.

Firecrawl's credential gate now trims before classification. Synthetic boundary
checks cover missing/empty/whitespace and unresolved references, and a generated
law preserves normalized configured keys. Existing live assertions remain.
Full package audit/docgen passed for all three final property surfaces.
All three configured Node suites also passed with `BEEP_FC_NUM_RUNS=400` and
`BEEP_FC_SEED=20260708`, with both provider key variables explicitly blank.

Flake review and final observability adoption, runtime timings, inventory
closure and PR gates remain. No live-provider acceptance or goal completion
is claimed by these local checks.
