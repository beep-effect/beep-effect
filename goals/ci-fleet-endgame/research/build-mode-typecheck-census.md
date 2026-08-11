# Build-mode typecheck census

Measured 2026-08-10 on `research/build-mode-census`. This census measures the real
project-reference build workload. It does not modify the retained isolated census.

Raw measurements are in
[`data/build-mode-census.tsv`](./data/build-mode-census.tsv). The full command transcript is
committed as [`data/build-mode-census-transcript.md`](./data/build-mode-census-transcript.md).

## Method

All rows ran sequentially from the package directory. The baseline command was:

```sh
bunx tsgo --version
bunx tsgo -b tsconfig.json --clean
/usr/bin/time -v timeout --signal=INT --kill-after=30s 1200s \
  bunx tsgo -b tsconfig.json
```

`tsconfig.base.json` sets the build-info path to
`node_modules/.tmp/tsconfig.tsbuildinfo` relative to each config directory. The build-mode
`--clean` traversed the target's exact project-reference closure and removed its known
build-info and emitted outputs before every accepted baseline. The initial workspace had zero
workspace build-info files, independently confirming that the first epistemic run was cold.

The P2 override changes which target outputs `--clean` recognizes. For those rows, the closure
was cleaned with `tsgo -b tsconfig.json --clean`, then only the target package's remaining
`dist` files and `node_modules/.tmp/tsconfig.tsbuildinfo` were deleted explicitly. Both counts
were confirmed zero before measurement. No measured run reused an accepted run's incremental
state.

Every row used `tsgo 7.0.2+effect-tsgo.0.24.3`. The host was a 32-core, 64-thread machine
with 125 GiB reported RAM and 125 GiB swap. At the start it had 78 GiB available RAM, 32 GiB
swap occupied, and load averages of 19.31, 28.27, and 35.52. At the end it had 63 GiB
available and load averages of 32.23, 35.48, and 35.26. Other host work was not visible from
the sandbox process namespace. RSS belongs to the measured command, but wall time and garbage
collection behavior may still reflect that load.

No accepted row timed out or failed. Professional desktop was rerun once because its first
36.86 GiB result was both decisive and load-sensitive. The rerun reached 47.59 GiB. The table
uses the rerun and records the initial result in its note.

## Results

RSS is GiB (`Maximum resident set size` KiB divided by 1,048,576). Isolated RSS comes from
the prior census's exact TSV, not its rounded prose table. Ratio is build RSS divided by
isolated RSS.

| Package | Build RSS | Wall | Isolated RSS | Ratio |
| --- | ---: | ---: | ---: | ---: |
| `@beep/professional-desktop` | 47.59 GiB [1] | 122.43 s | 10.82 GiB | 4.40x |
| `@beep/epistemic-server` | 24.77 GiB | 36.90 s | 5.09 GiB | 4.87x |
| `@beep/db-admin` | 11.86 GiB | 24.60 s | 7.32 GiB | 1.62x |
| `@beep/ontology-ui` | 5.94 GiB | 13.97 s | 4.92 GiB | 1.21x |
| `@beep/repo-cli` | 5.09 GiB | 13.91 s | 5.65 GiB | 0.90x |
| `@beep/agents-server` | 4.20 GiB | 12.53 s | 5.15 GiB | 0.82x |
| `@beep/md` | 3.76 GiB | 9.97 s | 3.68 GiB | 1.02x |
| `@beep/html` | 3.28 GiB | 8.74 s | 3.79 GiB | 0.87x |
| `@beep/types` | 0.07 GiB | 0.05 s | 0.06 GiB | 1.14x |

[1] Initial professional-desktop run: 36.86 GiB and 114.97 s, a 3.41x isolated ratio.
Both observations exceed a 32 GiB worker before any concurrent package is added.

The build-mode ordering is not the isolated ordering. Professional desktop becomes the largest
row by a wide margin, epistemic server reproduces its known 24.7 GiB peak, and db-admin remains
the third RSS outlier despite much lower isolated instantiation count. Four rows are slightly
cheaper in build mode, so the multiplier is graph-specific rather than a universal cost of
`-b`.

## A/B probes

P1 is the unchanged cold baseline above. P2 changed only the target package's compiler options:

```json
{
  "composite": false,
  "declaration": false,
  "declarationMap": false
}
```

`composite: false` is required because a composite project cannot disable declarations.
`declarationMap: false` is required when both declaration and composite are false. Incremental
remained enabled because TypeScript accepts that combination. Referenced packages stayed
composite and continued emitting declarations. This was a measurement probe, not a proposal.

| Package | P1 RSS | P1 wall | P2 RSS | P2 wall | RSS change |
| --- | ---: | ---: | ---: | ---: | ---: |
| `@beep/epistemic-server` | 24.77 GiB | 36.90 s | 24.08 GiB | 32.48 s | -2.8% |
| `@beep/md` | 3.76 GiB | 9.97 s | 3.99 GiB | 11.62 s | +5.9% |

Answer: the target package's own declaration emit does not dominate the 24.7 GiB peak. Removing
it saved only 705 MiB for epistemic server, while md moved in the opposite direction. P2 did not
disable declarations in referenced projects, because project references require their
declaration surfaces, so this probe rules out target emit and nothing more: it does not
distribute the remaining 24.08 GiB among checking and inference, dependency declaration emit,
and build-program retention. Attributing that remainder needs a dependency-emit A/B or a
compiler trace.

## Isolated declarations probe

P3 enabled `isolatedDeclarations: true` on `@beep/fc-runs`, a leaf with two source files and
four value exports. It compiled in 0.09 s at 144,132 kB peak RSS with **zero errors**. The
package already annotates its exported function results, so its local migration estimate is zero.

That is a useful compatibility datum but a deliberately narrow one. It does not estimate the
annotation count for epistemic server or other heavy packages, and no heavy package was modified
to obtain such a count. The probe also supplies no evidence of a peak-RSS win: it is a tiny leaf,
and P2 shows target declaration work is not the epistemic bottleneck.

## Ranked recommendation

1. **Build-graph splitting.** It has the strongest direct evidence for a sub-16 GiB peak. The
   two aggregation-heavy rows inflate from 5.09 to 24.77 GiB and from 10.82 to at least
   36.86 GiB only in build mode. Split the closure into separately invoked processes so memory
   is released between shards, then measure each shard. A single multi-target `tsgo -b` process
   is not sufficient proof of release.
2. **HTML, md, and agents demand-scoping.** This is the best targeted follow-up for professional
   desktop because it aggregates those surfaces. Their own build rows are only 3.28 to 4.20 GiB,
   so this is not supported as the primary epistemic fix.
3. **`@beep/schema` barrel de-blast.** The prior isolated census proves broad inference cost,
   so this remains a cross-graph reduction lever. This census did not isolate its build-mode
   contribution, and the prior MimeType time bomb is already removed.
4. **`isolatedDeclarations`.** Keep it as a migration experiment, not the first OOM lever. The
   leaf probe needs zero edits, but target declaration removal changes epistemic RSS by only 2.8%.
5. **Concurrency cap.** Retain it as an immediate safety rail, but it cannot get a process below
   16 GiB. Concurrency one still leaves epistemic at 24.77 GiB and professional desktop above
   32 GiB; it cannot satisfy the concurrency-two target by itself.

Build-graph splitting is the only lever here aimed directly at the measured build-only multiplier.
It is the leading hypothesis, not yet proof of a sub-16 GiB result. The next falsifiable step is a
closure-shard census with a fresh process per shard.

## Limits

- The professional-desktop row varied by 10.73 GiB between two cold runs under high host load.
  Both values are retained; no idle-host third run was available.
- The process-level peak does not identify which referenced project or build phase held it.
  Per-project fresh-process measurements or a compiler trace are needed before choosing split
  boundaries.
- P2 disables declaration emit only for the target project, not referenced dependencies.
- P3 measures a compatible tiny leaf and yields no heavy-package annotation count.
- No row exceeded 20 minutes, so none was aborted. No package outside the requested nine-row
  baseline scope was measured, and that scope is a selected sample, not the nine highest
  isolated-RSS rows: the prior isolated census records higher isolated RSS for
  `@beep/law-practice-server`, `@beep/practice-kg-mcp`, `@beep/ontology-client`, and
  `@beep/agents-client` than for included rows such as md, html, and types, and none of those
  four has a build-mode measurement yet.
- This cold, closure-cleaned standalone invocation is not the workload the hosted Check lane
  runs: CI dispatches root Turbo at concurrency one, and `turbo.json` orders every workspace
  dependency's own `check` task first as a separate process whose dist and build-info outputs
  are preserved. These rows therefore bound the cold worst case of one process compiling the
  whole closure; they do not establish the per-process peak of the actual CI graph, and
  process-per-package sharding may partially duplicate what Turbo ordering already provides.
  Per-target RSS measured after `^check` prerequisites complete (or a cold root Check run with
  per-process RSS recording) is required before treating any row here as the fleet blocker.
- The 16 GiB target is not yet achieved by evidence in this document. This census identifies the
  failing rows and rejects the target package's own declaration emit as the primary explanation.

All probe overrides were removed. Final SHA-256 checks for every touched target config matched
their pre-probe values; no tsconfig remained modified.
