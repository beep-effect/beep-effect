# P2 Professional Desktop pilot verdict

Date: 2026-09-03

Paired source revision: `a1652c1923eee0c33d9015da7fbf30449fa8269f`

Verdict: **INCONCLUSIVE — STOP**

The approved Professional Desktop pilot does not qualify the mass migration.
No primary metric produced a stable improvement that satisfies its threshold,
and no primary metric produced a stable material regression. The one permitted
symmetric extension is exhausted, so the packet's normative between-rules
case applies: P3 is not authorized.

## Scope and toolchain

The pilot mechanically migrated all live `apps/professional-desktop` scope:

- executable/type-only corpus: 106 files, 213 root declarations rewritten to
  505 per-module declarations;
- JSDoc corpus: 25 files, 41 root declarations rewritten to 42 per-module
  declarations; and
- manual reviews and parser warnings: zero in both modes.

Both states used Bun 1.4.0, Node v24.19.0, tsgo
`7.0.2+effect-tsgo.0.39.1`, Effect `4.0.0-rc.112`, and Portless 0.15.5.
Tracked samples and summaries are under [`measurements/`](./measurements/).

## Primary results

Negative deltas are improvements. `Noise floor` is twice the larger state's
relative MAD. Timing, RSS, Types, and Instantiations must exceed both their
normative threshold and this floor to be stable.

| Metric | Before median (MAD) | After median (MAD) | Delta | Noise floor | Result |
| --- | ---: | ---: | ---: | ---: | --- |
| Source tsgo wall, n=15 | 9.21 s (0.45) | 9.49 s (0.65) | +3.04% | 13.70% | No stable movement; below the 8% win and 5% regression thresholds |
| Source tsgo check, n=15 | 7.804 s (0.444) | 8.224 s (0.540) | +5.38% | 13.13% | Above 5% nominally, but explicitly unstable after extension |
| Source maximum RSS, n=15 | 6,178,520 KiB (106,604) | 6,112,188 KiB (70,216) | -1.07% | 3.45% | Below the 5% threshold |
| Source files, n=15 | 10,257 (exact) | 10,256 (exact) | -1 file | n/a | Structural reduction is below 5% |
| Source Types, n=15 | 3,378,201 (1,967) | 3,372,041 (846) | -0.18% | 0.12% | Stable direction, but below the 5% threshold |
| Source Instantiations, n=15 | 22,650,933 (6,749) | 22,615,741 (4,394) | -0.16% | 0.06% | Stable direction, but below the 5% threshold |
| Cold route, n=7 | 321 ms (5) | 329 ms (4) | +2.49%; +8 ms | 3.12% | Below all win/regression thresholds |
| Cold Vitest, n=15 | 3.44 s (0.32) | 3.26 s (0.12) | -5.23%; -180 ms | 18.60% | Meets only the 100 ms floor; misses 10% and stability |
| Vite build wall, n=5 | 1.27 s (0.08) | 1.32 s (0.06) | +3.94% | 12.60% | Secondary metric; unstable |

Production bytes were deterministic within each state. Total gzip changed
from 2,739,289 to 2,739,412 bytes (+0.0045%); total Brotli changed from
2,290,854 to 2,290,778 bytes (-0.0033%). The named Effect-vendor chunk was
unchanged at 133,349 gzip bytes and 113,394 Brotli bytes. This is bundle
neutral and does not approach the 2% qualifying or regression threshold.

The result does not satisfy the strict `no win` definition because two nominal
timing deltas remain just outside its 5% band: source check is +5.38% and
Vitest is -5.23%. Neither is stable under the required MAD test. The protocol
therefore classifies the post-extension result as inconclusive, not as a win
or material regression.

## Correctness and enforcement gates

All correctness gates passed:

- complete Professional Desktop package check before and after;
- complete Professional Desktop test suite before and after;
- one cold filtered Turbo check per state, 65/65 tasks successful with zero
  local-cache hits;
- untimed route smoke plus seven successful cold-route samples per state;
- five successful builds per state with deterministic byte rows;
- zero remaining root imports in executable and JSDoc pilot inventories;
- code and JSDoc writes are idempotent with identical before/after diff hashes;
  and
- the focused EffectImports suite passes 23/23 tests.

The direct-import compiler surfaced 25 attributable
`effect(missedPipeableOpportunity)` diagnostics: 23 in the source program and
2 in scripts. Each was repaired by the compiler-prescribed, behavior-preserving
`.pipe(...)` form. Both programs then passed every valid sample.

## Extension integrity

The initial seven samples made source-check and Vitest movement too noisy to
classify, triggering the protocol's one symmetric extension to 15. A first
attempt to collect the additional before samples from a disposable sibling
worktree was rejected because its compiler graph contained 10,325 files
instead of the original state's exact 10,257. Those samples were quarantined
machine-locally and excluded.

The before extension was repeated in the original checkout path by applying a
guarded reverse patch to reproduce the exact paired source revision. The
migrated patch was restored automatically and verified byte-for-byte. Every
valid before run then reported 10,257 files and every valid after run 10,256.

## Decision and authority boundary

P2 is complete with a recorded stop. P3 remains pending and unauthorized: no
Biome warn/error ratchet, foundation-kernel batch, vertical-family migration,
documentation mass rewrite, or global rule flip may begin from this verdict.
The migrated source stays in the bounded pilot as auditable measurement
evidence, while the default promoted-family ratchet returns to empty after the
stop.
The operator's D13 direction still authorizes publishing this bounded P2 pilot
and evidence through Yeet with `--start-pr-early`; it does not change the gate
classification and does not authorize merging the pull request.
