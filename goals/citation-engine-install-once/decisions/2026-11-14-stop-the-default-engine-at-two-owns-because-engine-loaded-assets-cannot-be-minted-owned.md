---
title: "Stop the default engine at two owns: the tokenizer catalog is derived, not decoded"
date: 2026-11-14
lane: "perf/citation-owned-configuration"
reversal: "Delete this stop once the owner picks how engine-derived configuration is typed owned; until then the default engine owns its caller configuration and its assembled configuration."
---

Second stop, after the owner's round-2 ruling chose reshape (a): a sealed-text minting route whose input is an immutable string decoded through the schema's JSON codec, loaders and `makeCitationDefaultEngineConfiguration` returning owned parts assembled with `ownedStruct`, and `makeDefault` calling the internal owned install directly.

What the loaders do. `loadCitationTextAsset` reads at most the sealed length plus one byte through Effect FileSystem, checks the length and the SHA-256 of the bytes, and returns `new TextDecoder().decode(bytes)`. `loadCitationJsonAsset` decodes that text through the asset's `S.toCodecJson` + `S.fromJsonString` codec. So the parser catalog asset and the helper configurations asset are decoded from text, and the sealed route would be sound for them; the vocabulary is raw text.

Why it still stops. The engine configuration is not those decoded assets; it is derived from them by engine computation:

- `makeCitationCanonicalTokenizerCatalog` (`TokenizerCatalog.ts`) takes the catalog's `payload` string and `metadata`, re-hashes the payload, decodes it into 6,805 source rows, converts each row's regex text into new native storage (`RegexInput.prepareText`), fingerprints it, looks the descriptor up in a `HashMap` built from metadata rows, converts each required string with `PythonUnicode.fromText`, and builds a new `CitationTokenizerExtractor` and ordering binding per row. The resulting `CitationTokenizerConfiguration` is the bulk of the engine configuration (`extraction.extraction.tokenizer`).
- `makeCitationHelperConfigurations` splices a `highestValidYear` computed from the Clock into four nested configurations and decodes edition bindings that `makeCitationDefaultConfiguration` derives from the computed catalog.

Those values are unshared by construction (new buffers from immutable strings, numbers, and objects built inside construction), but nothing types them owned: `ownedStruct` needs every field already `CitationOwned`, and the fresh pattern and string storages come out of `prepareText` and `fromText` as plain `CitationPythonUnicodeStorage`. Typing them owned needs a minting route for engine-encoded text (storage encoded from an immutable string) in `ConfigurationOwnership`, used by `PythonUnicode` and `RegexInput`, plus an owned primitive route for computed numbers; or the catalog derivation moves to build time and ships as sealed JSON. Neither is in the ruling, and a mint that accepts any engine-built value would be the brand constructor under another name, so this slice does not improvise one.

State kept: `makeDefault` owns its caller configuration (`ownCitationConfiguration`) before the asynchronous asset reads, then calls `make`, which owns the assembled configuration: 2 configuration detaches at construction. `makeCitationDefaultEngineConfiguration`, `makeCitationEngineArtifact` and `makeCitationSixFormArtifact` keep their `snapshotCitationValue` copies: each is a separately callable entry point with its own tests of raw input (`CitationDefaultConfiguration.test.ts`, `CitationEngineArtifact.test.ts`, `CitationSixFormArtifact.test.ts`).

Proposed reshapes, owner's choice: (1) an owned encoding route for text-to-storage in `ConfigurationOwnership` plus an owned-primitive route, threading `CitationOwned` through the catalog and helper derivations; or (2) precompute the tokenizer catalog and the year-free helper configuration at build time into sealed JSON assets, so the engine only decodes sealed text.
