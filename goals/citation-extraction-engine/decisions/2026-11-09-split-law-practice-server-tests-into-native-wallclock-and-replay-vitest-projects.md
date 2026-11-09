---
title: "Split law-practice-server tests into native-wallclock and replay Vitest projects"
date: 2026-11-09
lane: "claude/silly-brahmagupta-5a4fd5"
reversal: "Restore the package-wide test: { maxWorkers: 2, maxConcurrency: 2 } in packages/law-practice/server/vitest.config.ts and drop the two projects."
---

#2511 capped the whole package at two Vitest workers because real native worker tests include cold module loading and a saturated runner could consume a production deadline. Only sixteen files actually run native workers against the real wall clock: their fixture closure reaches `CitationNativeSpawner.fixtures.ts` without installing `makeCitationNativeManualClock`, `makeCitationNativeSleepClock` or the fixed `makeCitationNativeWallClock` (twelve unit files, `test/CitationBuiltinCleaners`, `CitationHtmlCleanerStage`, `CitationHtmlNativeInput`, `CitationHtmlWorkerCorpus` and `CitationLiteralUnicodeComposition` among them, and `test/integration/CitationCleanerNamedHtml`, `CitationCleanerNativeCustom`, `CitationHtmlUnicode`, `CitationRegexTranslator`). The other 313 unit and integration files drive every deadline through a substituted clock or spawn nothing.

`vitest.config.ts` now declares two projects: `native-wallclock` keeps `maxWorkers: 2` and `maxConcurrency: 2` for those sixteen files (`sequence.groupOrder: 0`), and `replay` runs everything else at Vitest's default worker count (`groupOrder: 1`). Vitest 5.1 applies the CLI `--maxWorkers` to every project, so the hosted coverage producers' single-worker topology is unchanged; `--shard` is applied by the root sequencer before projects are grouped, so the committed shard plan still covers both projects. `test/vitest-shards-plan.test.ts` re-derives the wall-clock list mechanically and fails when the config drifts from it. The integration script keeps running the four wall-clock integration files under the capped project.
