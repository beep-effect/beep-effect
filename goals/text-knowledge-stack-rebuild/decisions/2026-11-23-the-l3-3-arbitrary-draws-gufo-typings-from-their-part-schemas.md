---
title: "P5: the L3-3 arbitrary builds partial typings from the GufoTyping part schemas, because the struct filter discards whole samples"
date: 2026-11-23
lane: "p5"
reversal: "Draw partial typings with Arbitrary.schema(GufoTyping) again once Effect's Arbitrary retries a filtered struct per element instead of discarding the run"
---

Design section 3.6 says the L3-3 test draws its partial typing with Arbitrary.schema(GufoTyping). Run that way, the property exhausted after 18 runs and 1001 discards. The GufoTyping filter (mediates non-empty exactly for a Relator) rejects about 30 percent of draws, Effect's Arbitrary turns a rejected filter into a discard of the whole sample, and a ten-term hierarchy passes only about 0.7^10 of the time. test/support/TypedHierarchy.arbitrary.ts therefore draws classType, instanceCategory and mediated pairs from Arbitrary.schema(GufoClassType), Arbitrary.schema(GufoInstanceCategory) and Arbitrary.schema(MediationCardinality), and builds each typing with GufoTyping.makeOption, giving mediation only to relators. Completions still come from Arbitrary.schema(GufoClassType) per untyped term. Every typing the filter admits whose mediated types lie in the fixed test namespace can be generated, with cardinalities over the whole positive range; mediated types outside the hierarchy never change an audit result.
