---
title: "The pre-change fixture snapshot is stored as text Biome does not format"
date: 2026-11-06
lane: "feat/fleet-root-registry"
reversal: "Rename roots-unset.snapshot.txt back to .json and add the path to Biome's ignore list."
---

The pre-commit Biome hook reformatted the first golden (roots-unset.json, collapsing short arrays), so the post-change comparison failed on whitespace with identical data. The golden is now roots-unset.snapshot.txt, reconstructed byte-exact as JSON.stringify(value, null, 2) of the captured pre-change value, which is what the test emits.
