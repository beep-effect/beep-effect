---
title: "Adapter port review: repeated names, every unit fault, bounded console logs"
date: 2026-11-19
lane: "feat/gate-report-wiring"
reversal: "Revert the adapter changes in the merge commit that carries them."
---

The port review found four things in the Vitest adapter and they are fixed. Two tests with one full name in one file stay distinct items: the adapter numbers the repeats, the first keeping its plain name so existing keys are stable. It is done in the adapter, which knows the two test cases are distinct objects; the reducer only sees keys and must keep replacing by key for retries. Every module or suite error is its own unit fault, up to ten per module, where only the first was kept. Console lines accumulate up to one mebibyte, after which later lines are counted and the log says so. The timeout helper is named in the provenance and its upstream test cases are carried over. The escape-stripping pattern is one public leaf of the model, used by the plain-text projection and the stray-output recorder.
