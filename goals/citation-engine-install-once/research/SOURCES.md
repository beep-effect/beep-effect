# Citation Engine Install Once — Sources & Provenance

- **Source exploration:** `explorations/citation-engine-install-and-worker-reuse` — primary ledger:
  `explorations/citation-engine-install-and-worker-reuse/research/SOURCES.md`. The sections below reproduce it for
  implementation; the exploration's copy wins on any difference.
- **Design:** `explorations/citation-engine-install-and-worker-reuse/research/design-2026-11-12.md` and its review,
  `explorations/citation-engine-install-and-worker-reuse/research/design-review-2026-11-12.md`.

## 1. Mined source corpus

| Source | Title | Upstream (repo) | Location (`file:line`) | Theme | Disposition |
|--------|-------|-----------------|------------------------|-------|-------------|
| `eyecite-tokenizer` | Tokenizer built once, reused per call | freelawproject/eyecite @ `b70a146` | `eyecite/tokenizers.py:458-522, 664`; `eyecite/find.py:40-44` | install-once | reference (already ported under BSD-2-Clause attribution) |
| `effect-pool` | Scoped pool with invalidate | Effect-TS/effect 4.1.4 @ `9ef5cd04d2ec` | `packages/effect/src/Pool.ts:264-379, 865-1002` | worker reuse | reference; not the lease authority |
| `effect-rpc-worker` | Pool-backed worker protocol | Effect-TS/effect 4.1.4 | `packages/effect/src/rpc/RpcClient.ts:1497-1700` | worker reuse | reference; rejected as owner (cooperative interrupt, 5 s close) |
| `effect-child-process` | Kill options and scope release | Effect-TS/effect 4.1.4 | `packages/effect/src/process/ChildProcessSpawner.ts:86-208` | kill guarantee | use as shipped |
| `jsc-yarr-limit` | Match limit returns no-match | WebKit/WebKit @ `b09e16e` | `Source/JavaScriptCore/yarr/Yarr.h:49-51` | regex bound | reference |

**How these inform this packet:** eyecite shows install-once is the upstream
behavior. Effect's `Pool` shows the standard invalidate-and-replace shape, and
its worker protocol shows what the engine's lease contract forbids (capacity
reopening before confirmed retirement).

## 2. Upstream repositories & licenses

| Repo | License | Port discipline | What we take |
|------|---------|-----------------|--------------|
| freelawproject/eyecite | BSD-2-Clause | port-with-attribution (existing `THIRD_PARTY_NOTICES.md`) | nothing new; behavior reference only |
| Effect-TS/effect | MIT | dependency; use shipped modules | `Pool` shape as reference, `ChildProcess`, `Context`, `Scope`, `Schema` |
| WebKit/WebKit | LGPL-2.1 / BSD (per file) | reference only | a fact about the match limit, no code |
| piscinajs/piscina, tinylibs/tinypool, jestjs/jest, noxdafox/pebble | not verified by this lane | reference only | pool design answers, no code |

## 3. External research sources

- JavaScriptCore YARR match limit: <https://github.com/WebKit/WebKit/blob/b09e16e321736528fc10d31a8a1065e71d05c56d/Source/JavaScriptCore/yarr/Yarr.h#L49-L51>, <https://github.com/WebKit/WebKit/blob/b09e16e321736528fc10d31a8a1065e71d05c56d/Source/JavaScriptCore/yarr/YarrJIT.cpp#L1907-L1909>
- Bun workers and child processes: <https://bun.com/docs/runtime/workers>, <https://bun.com/docs/runtime/child-process>
- Bun issues: <https://github.com/oven-sh/bun/issues/44216>, <https://github.com/oven-sh/bun/issues/44886>, <https://github.com/oven-sh/bun/issues/46669>, <https://github.com/oven-sh/bun/issues/48600>
- Node worker threads: <https://nodejs.org/api/worker_threads.html>
- V8 non-backtracking engine: <https://v8.dev/blog/non-backtracking-regexp>
- Linear-time engines: <https://github.com/uhop/node-re2>, <https://github.com/google/re2-wasm>, <https://docs.rs/regex/latest/regex/>
- Pools: <https://github.com/piscinajs/piscina>, <https://github.com/tinylibs/tinypool>, <https://github.com/jestjs/jest/blob/main/packages/jest-worker/README.md>, <https://pebble.readthedocs.io/en/latest/>, <https://docs.python.org/3/library/concurrent.futures.html>, <https://chromium.googlesource.com/chromium/src/+/main/docs/process_model_and_site_isolation.md>
- eyecite: <https://github.com/freelawproject/eyecite/blob/b70a146d20f70b366baf150a1cc9e82229ef5a0d/eyecite/tokenizers.py>, <https://github.com/freelawproject/eyecite/blob/b70a146d20f70b366baf150a1cc9e82229ef5a0d/eyecite/find.py#L40-L44>, <https://github.com/freelawproject/eyecite/blob/b70a146d20f70b366baf150a1cc9e82229ef5a0d/eyecite/models.py#L866-L870>
- Local probes (Bun 1.4.4 worker termination and spawn cost, 2026-11-12) have
  no URL; see RESEARCH.md "Only an OS process kill bounds a regex in Bun" and
  "Where the 130 ms per spawn goes".

## 4. In-repo capability references

| Brick | Path | Use |
| --- | --- | --- |
| Operation admission and nested view | `packages/law-practice/server/src/internal/Citation/Admission.ts` | reuse |
| Native lease, quarantine | `.../Citation/NativeAdmission.ts` | extend (job slot on a leased process) |
| Process owner, retirement | `.../Citation/NativeProcess.ts` | extend (retire after many jobs) |
| Stdio RPC transport and frames | `.../Citation/NativeRpc.ts`, `ByteFrames.ts` | extend (many conversations per child) |
| Regex worker v2 | `.../Citation/RegexWorker*.ts` | extend to v3 |
| Text budget | `.../Citation/TextBudget.ts`, `@beep/law-practice-use-cases` `CitationTextBudget` | reuse |
| Stage installer | `.../Citation/MetadataComposition.ts` | rework |
| Tokenizer | `.../Citation/Tokenizer.ts`, `ExtractorOrdering.ts`, `ExtractorSelection.ts`, `ExtractorRecipes.ts` | rework (install once) |
| Spawn counter fixture | `packages/law-practice/server/test/CitationNativeSpawner.fixtures.ts` | reuse for before/after counts |
| Replay fixture | `packages/law-practice/server/test/CitationCanonicalExtractionRuntime.fixtures.ts` | reuse as the measurement fixture |
| Span recorder for tests | NET-NEW in `packages/law-practice/server/test` (four inline `Tracer.make` recorders exist elsewhere) | NET-NEW |

## 5. Cross-links & provenance

- Predecessor goal: `goals/citation-extraction-engine` (isolation contract in
  `history/evidence/2026-10-28-limits-isolation-contract.md`, reuse audit in
  `history/evidence/2026-11-02-effect-upstream-reuse-audit.md`).
- This packet: [`../RESEARCH.md`](../../../explorations/citation-engine-install-and-worker-reuse/RESEARCH.md),
  [`../DECISIONS.md`](../../../explorations/citation-engine-install-and-worker-reuse/DECISIONS.md), [`../BRIEF.md`](../../../explorations/citation-engine-install-and-worker-reuse/BRIEF.md),
  [`../MAP.md`](../../../explorations/citation-engine-install-and-worker-reuse/MAP.md).
- Test guard for the red episode: PR #3203.
