# Rule cards

One card per diagnostic the sweep remediates, plus the repo-local Match law.
Cards are authored in P2 by discovery lanes from the two clones and are the
only rule knowledge a fixer receives. A card is complete when no `TODO`
remains and every API citation resolves to a real `file:line` in the clone.

| Card | Source | Approx sites |
| --- | --- | --- |
| schemaSync | tsgo 0.45.0 | ~2,900 |
| matchEffectToMatch, matchEffectToMapBoth | tsgo 0.42.0 | 55 |
| nodeBuiltinImport (0.43 extension) | tsgo | 42 + 9 directives |
| provideLayerSucceedToProvideService | tsgo 0.42.0 | 31 |
| flatMapIgnoredParamToAndThen | tsgo 0.45.0 | 30 |
| catchAllTagDispatchToCatchTag, catchIfTagToCatchTag | tsgo | tbd |
| timeoutCatchTagToTimeoutOrElse, raceFirstWithSleepToTimeout | tsgo | 6 + tbd |
| runOfExitToRunExit | tsgo 0.42.0 | 4 |
| importFromBarrel, obsoleteMatchImport, obsoleteSchemaImport | tsgo 0.44+ | 0 known; keys decide |
| missingPipeableSignature | tsgo (existing) | 60 directives |
| strictEffectProvide | tsgo (existing) | 16 directives |
| schemaNumber | tsgo (existing) | 2 directives |
| match-combinators | repo law `match-shapes` | 66 files + audit |
