---
title: "Own the default engine configuration by derivation from the owned caller configuration"
date: 2026-11-14
lane: "perf/citation-owned-configuration"
reversal: "Have makeDefault call make with the assembled configuration again, so make's boundary detach owns it (two detaches per default engine)."
---

Owner ruling, round 3, replacing the round-1 and round-2 stop on the default engine. The installed default configuration is owned by derivation: `makeDefault` owns the caller's raw `CitationEngineDefaultConfiguration` once with `ownCitationConfiguration` (the engine's only configuration detach), then derives the installed configuration from that owned value with `ownedDerive`. The derivation runs `makeCitationDefaultEngineConfiguration` (sealed asset reads, the tokenizer catalog and helper derivations, the clock-computed year) and assembles `CitationEngineConfiguration`, validated by its `make`, from the derived assets and the limits and runtimes of the owned default configuration. `makeDefault` then calls the internal `install`, which takes `CitationOwned<CitationEngineConfiguration>`. `make` (CitationEngineLive, the raw boundary) keeps its one own and calls the same `install`. Result: one configuration detach per engine; the full-span construction row shows 1.

Aliasing check, by reading: `makeDefault` reads `raw` only in its first `ownCitationConfiguration`. Everything below reads the owned copy or values the engine reads itself, so nothing in the derived configuration can alias an object the caller still holds. The default-boundary mutation test already exists: `CitationEngineLayer.test.ts` › "four-operation engine Layer" › "captures default owners and executes all four operations on bun" and "… on node" mutate the caller's `limits.cleanDeadline` and `runtime.workerFile` after the default Layer is built and assert that the reported deadline is unchanged and all four operations still run.

Outside the detach count, unchanged: `makeCitationDefaultEngineConfiguration`, `makeCitationEngineArtifact` and `makeCitationSixFormArtifact` keep their own raw-input snapshots, because each is a separately callable entry point with tests of raw input.

The round-2 stop recorded what the loaders do: `loadCitationJsonAsset` decodes sealed text through each asset's JSON codec, and the tokenizer catalog and helper configurations are then derived from those assets by engine computation. That is why derivation, not a second detach or a string-storage route, is the owned path.
