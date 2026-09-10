# Third-round scanner performance

The adopted 8,138-row baseline passes three consecutive ordinary commands
on the final optimized source. All 6,539 captured source/runtime inputs and
134 canonical artifacts remain stable before and after each observation.
Every complete row payload and all 132 owner JSONL files match the previously
reviewed inventory; all 1,110 census paths remain.

```sh
bun run beep lint effect-vitest
```

| Run | Whole command seconds | Scan milliseconds | Child CPU seconds | Host load, 1 minute | Available memory GiB |
| --- | ---: | ---: | ---: | ---: | ---: |
| 1 | 9.563075 | 7622.1 | 15.810 | 2.68 | 66.96 |
| 2 | 9.629857 | 7691.3 | 15.860 | 2.94 | 66.78 |
| 3 | 9.925870 | 7941.5 | 16.362 | 3.09 | 66.74 |

Measurements include the normal launcher and adopted-baseline comparison.
The fixed cohort was declared before execution. Raw receipts also preserve
CPU, memory and I/O pressure, swap deltas, process limits and cgroup context.
Elapsed time is not adjusted for host load. These observations establish the
local ten-second target for this cohort, with limited margin; they do not
establish a worst-case bound under arbitrary workstation load or a CI speedup.

The repair first filters impossible scoped-stage/provider candidates before
lexical resolution and ancestry work. It then reuses node kinds and avoids
allocating empty child arrays for parser token leaves. The installed
TypeScript traversal treats precisely that token range as leaf nodes.
The ts-morph Project, syntax traversal order, provenance resolution, scope
classification, occurrence identity and complete row output remain intact.
Full tests, policy, graph and Knowledge source are unchanged by the performance
passes. All 288 focused cases, compiler, lint and Fallow checks pass.

The final source identities are:

- EffectVitestDetectors.ts: `70c540ec23d6732a0a93e96cb91a8522ec18cc5675cd00e6d700b99a39cc0442`.
- EffectVitestSyntax.ts: `a8d350b005f600aee019b97034a1f4e0ab483af2e74cf91cd0753dade11df895`.
- Ordered complete finding payload: `740ab933657584072cc6236bbb9820d6f8c577f8c657a327dc32209c20c19b57`.

A later aggregate cheap-gates invocation ran concurrently with the full CLI
package audit. It passed membership checks with a reported 8.010-second scan
and 10.025-second child-command duration. This observation is retained as
separate concurrent verification context, outside the declared three-run
benchmark; it reinforces the limited margin and load qualification above.

## Retained failures and diagnostic limits

The initial adopted-baseline cohort took 10.690s, 10.548s and 10.659s. The
first optimization's normal cohort took 10.284s, 10.494s and 10.512s. All
commands passed membership checks, but every observation missed the target;
none was normalized or removed from the record.

A diagnostic optimization used the wrong rc.113 Array.filterMap contract
and lost 211 provider rows. It was rejected before adoption. The corrected
implementation uses the supported Option-collection idiom. Subsequent
private output and CPU-profile runs remain diagnostics, not substitutes for
the ordinary-command cohort above.

The token-leaf candidate initially increased Fallow complexity and exposed
an existing duplicated registration predicate. Both were repaired by
simplifying traversal and reusing the existing predicate, with no suppression
or threshold change. Failed Fallow receipts are retained alongside the green
reruns. A Root prerequisite-path error also failed before any scanner
launched; the refused run is recorded separately, with zero observations.

Full package verification, scoped coverage and exact-head local/hosted PR
checks remain separate gates; this receipt establishes scanner timing only.
