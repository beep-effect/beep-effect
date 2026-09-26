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

## Final local checkpoint

The flake pass retained Firecrawl's deterministic watcher startup, completion,
failure and close oracles. Runpod keeps seven independent unit fixtures and
Sanity now isolates its mutable responder per block. No retries, sleeps or
suite-wide timeout changes were introduced.

Commit `30035e3b38` adopts the instrumented runner across all eight files.
Firecrawl's missing-key placeholder is now a skip. Runpod preserves Config-based
credential lookup and reports its two missing-key branches through the native
TestContext skip operation. These paths passed on Node and Bun. No live provider
acceptance is claimed.

All three packages passed full package audit and docgen after instrumentation.
The final configured runtime runs exited zero with stable source, manifest and
lockfile hashes. API-key variables were explicitly blank.

| Package | Node before / after | Bun before / after | Final pass / skip |
| --- | ---: | ---: | ---: |
| Firecrawl | 4.786 / 4.681 s | 2.099 / 1.437 s | 15 / 1 |
| Runpod | 4.805 / 4.368 s | 2.350 / 1.459 s | 9 / 2 |
| Sanity | 4.360 / 4.223 s | 2.052 / 1.401 s | 7 / 0 |

Final reports and resource-load contexts are in the final/service-drivers timing
and matching context directories. These are shared-workstation observations,
not controlled speedup claims.

The existing 85-row ledger has 59 fixed findings and 26 no-findings rows.
Strict validation covers all eight current files and four lenses with no missing
coverage. Three whole-file Runpod ranges were refreshed after source shortening.
Firecrawl's historical EV001 finding is attributed to upstream `b1aa7e320cde`,
not to this wave. The baseline removes exactly 52 currently tracked findings;
the current detector reports zero new findings and no remaining findings in
these three packages. The full scan still takes about 12.3 seconds, exceeding
the goal's ten-second target; that broader acceptance gate remains open.

Runner dependencies add 30 reviewed cache edges, retaining multiplicity and
removing none. The cache audit has zero blocking findings and 1,251 unassessed
computations. Generated TypeScript references were refreshed with tsconfig-sync
and its check reports no drift. Hosted proof, adversarial review and operator
merge remain outstanding; this checkpoint does not close the goal.

## PR review follow-up

The timing table above predates the OpenAPI review correction. Runpod's generated
getOpenAPI operation is explicitly unauthenticated and its unit test already
checks the absence of an Authorization header. The live OpenAPI case therefore
no longer depends on API-key availability. Credential skipping remains on the
authenticated listPods case. Earlier two-skip measurements are retained as
historical evidence and do not prove the newly ungated public endpoint.

Repo Sanity also found unordered Runpod devDependencies after adding the test
runner. The manifest order is corrected without changing dependency versions.
