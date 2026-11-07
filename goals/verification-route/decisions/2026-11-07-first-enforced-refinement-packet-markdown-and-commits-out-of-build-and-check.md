---
title: "First enforced refinement: packet markdown and commits out of build and check"
date: 2026-11-07
lane: "feat/verification-route-slice-2"
reversal: "Set the refinement's mode to shadow, or revoke it in standards/verification-route.sentinel.json"
---

Census rank 2 narrowed to the two lanes where the absence is provable from the checkout: packet markdown is root-owned (outside every workspace glob), turbo registers no //#build or //#check, and no non-test source imports .md/.mdx. Both lanes read the tree only, so the commits atom is removed too. Packet data stays in both footprints. Fixtures: test/ci-route-refinements.test.ts; replay: research/slice-2-replay.md.
