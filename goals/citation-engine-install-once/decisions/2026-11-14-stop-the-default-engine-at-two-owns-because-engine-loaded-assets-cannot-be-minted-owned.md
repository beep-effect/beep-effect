---
title: "Stop the default engine at two owns: engine-loaded assets cannot be minted owned"
date: 2026-11-14
lane: "perf/citation-owned-configuration"
reversal: "Delete this stop once the operator picks a reshape; until then the default engine owns its raw configuration and its assembled configuration."
---

Stop rule, design section 2.1. The design runs ownCitationConfiguration in both makeDefault and make and expects one detach per engine. makeDefault owns its caller configuration (limits, build, asset paths, runtimes) before the asynchronous asset reads, as the old snapshot did. It then assembles a CitationEngineConfiguration from that owned value and from values the engine itself decoded from sealed asset files (parser catalog, helper configurations, vocabulary). Nothing outside the engine holds those, but the brand constructor is module-private and the only minting route is the JSON-codec detach, so the assembly reaches the installers through make, which owns it with a second detach. The full-span construction row therefore shows 2 configuration detaches, not 1 (10 before; the per-call rows stay 0). An engine built with CitationEngineLive and the extractor own once.

Not improvised: exporting a mint for engine-built values would be the brand constructor under another name. Proposed reshapes, operator's choice: (a) give ConfigurationOwnership a second minting route that decodes sealed asset text through the JSON codec (decoding from an immutable string yields unshared values) and have the asset loaders and makeCitationDefaultConfiguration return owned parts, assembled with ownedStruct; or (b) accept 2 for the default engine and amend acceptance criterion A4 to one own per caller boundary.

Also still below the default boundary and not counted by the probe: makeCitationDefaultEngineConfiguration snapshots build identity and limits (two snapshotCitationValue calls), and makeCitationEngineArtifact and makeCitationSixFormArtifact snapshot their artifact descriptors. These are separately tested artifact-identity entry points that take unknown input; reshape (a) would type them owned and drop the snapshots.
