---
title: "Surface a hoisted install failure where each request used to install the stage"
date: 2026-11-13
lane: "perf/citation-hoist-installs"
reversal: "Let hoisted stage installs fail engine construction directly."
---

CitationSemanticExtraction.test.ts installs the semantic stage under a deliberately tiny producedTextUtf16 and expects the eyecite shortcut to succeed. Hoisted, the tokenizer install refused at construction (its extractor selection cannot hold extractor strings longer than the limit), so the whole stage failed to install. Before A3 that refusal reached only non-shortcut requests. Each stage-tree hoist site (source, verified, semantic, entry, document, tokenized, loop) and the annotation entry's HTML geometry and wrap installs now run once at construction under Effect.exit, and the request yields that Exit at the point where it used to install the stage. Results, refusal labels and their order are unchanged; the install still runs once and the probe counts are unaffected. The engine-construction type guard still rejects any install that reads a request value.
