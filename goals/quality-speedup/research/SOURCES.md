# Sources

## Originating mission

- "Speed Up yeet & other quality checks" mission prompt (2026-08-03), pasted as
  the packet-opening instruction. Defines the three workstreams, the
  instrument-before-treating rule, the census method carry-overs, and the stop
  conditions mirrored in `SPEC.md`.

## Prior art (cite, do not re-derive)

- `goals/repo-quality-throughput/` — `SPEC.md`,
  `research/batch-01-quality-command-map.md`,
  `research/batch-02-repo-cli-orchestration.md`. Completed-retained; the
  original End-to-End Green measurement + implementation packet.
- `explorations/agent-pipeline-velocity/research/baseline-pipeline.md` —
  baseline pipeline timing exploration (completed 2026-07-06).
- `goals/coding-agent-effectiveness-evidence-loop/SPEC.md`, `PLAN.md` — yeet
  mistrial doctrine, exhibit-required failure, durable per-lane proofs.
- `goals/box-typecheck-cost/SPEC.md`, `research/measurements.md` — the
  canonical instantiation measurement method; measured dead ends
  (withCodecStatics removal +41%, file splits redistribute, ≤2.4% annotation
  levers); budget framing (marginal vs absolute; ~1.65M import floor at the
  time of measurement).
- `.repos/effect/packages/effect/typeperf/` — upstream per-fixture type-perf
  regression-gate prior art.

## Prior census (headline findings to re-verify, raw data not retained)

An earlier session on 2026-08-03 ran the full 129-package census with
tsgo 7.0.2+effect-tsgo.0.24.3; its raw artifacts lived in a session scratchpad
and did not survive. P0 re-runs the sweep to produce committed data. Headline
findings recorded from that run, each requiring re-verification against the
committed re-run before being cited as fact:

1. `packages/foundation/modeling/schema/src/MimeType.ts` check-time regression
   introduced by `880c620e89` (PR #531): type-level slicing of the
   2,302-literal IANA union (`Extract`/`Exclude` + `A.filter` inference + 6
   LiteralKits) adding ~17.7s check time to every `@beep/schema` barrel
   importer (~742 files / 105 packages).
2. The `@beep/schema` barrel is the effective import floor (~1.85M
   instantiations / ~18s at HEAD then); `effect/Schema` alone is ~37
   instantiations; subpath imports were ~406K / 0.14s.
3. An ~12.3M-instantiation "html lump" (`Html.serialize.ts` / `Html.policy.ts`
   derived ops) inherited through `@beep/md` → agents layers → ontology-client
   → professional-desktop (~23.5M, ~9.0GB peak RSS) and repo-cli (~20.5M,
   ~4.6GB).
4. Domain packages are cheap (ontology-domain ~503K, agents-domain ~2.2M);
   client/server/use-cases layers inherit the lump.
5. Hosted CI "OOMs" were whole-runner deaths on 4vcpu blacksmith runners
   (turbo default concurrency 10 when `isCi()` skips `--concurrency=3` via
   `boundedRootTurboArgs`, `Quality/Tasks.ts`); most lanes were bumped to
   8vcpu, the push-only Build lane reportedly still 4vcpu (`check.yml`).
6. Yeet verify structure: 21 strictly sequential lanes; warm ~9–12 min, cold
   ~2h (cold `check:tsgo:tests` ~2,959s, docgen ~1,442s).

## Data provenance for this packet

- `research/data/census-results.tsv` — P0 re-run (this packet), sequential
  sweep, overlay tsconfig per package, `--extendedDiagnostics` + peak RSS via
  `/usr/bin/time -v`, tsgo version recorded per row.
- `research/data/fleet-*.tsv` — anonymized fleet scan of local clones
  (`cloneNN` ids; no absolute paths).
- `research/data/ci-lane-timings.tsv` — hosted CI job timings via `gh run`
  (REST).
