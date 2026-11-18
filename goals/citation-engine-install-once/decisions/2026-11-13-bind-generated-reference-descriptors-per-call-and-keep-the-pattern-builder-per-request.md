---
title: "Bind generated reference descriptors per call and keep the pattern builder per request"
date: 2026-11-13
lane: "perf/citation-hoist-installs"
reversal: "Construct the generated-reference regex worker inside each prepare again."
---

GeneratedReferences builds its regex pattern from each citation's metadata, so the descriptors are request data. The evaluator is installed once per generator with an empty static registry, and bindDescriptors builds a registry for the generated descriptors at the point the worker used to be constructed, sharing every other constant. makeCitationReferencePatterns stays per request (stop rule): constructing it reserves its fixed fragments on the request text budget and checks the enclosing budget against the policy, so hoisting it would change producedTextUtf16 in the report and drop a refusal. It constructs no regex evaluator.
