---
title: "Count descriptor bindings, process owners and Diff/Xml workers in the probe"
date: 2026-11-13
lane: "perf/citation-hoist-installs"
pullRequest: 3282
reversal: "Drop the three columns from CitationEngineWorkCounts and the full-span tables."
---

Review round 1: bindDescriptors builds a descriptor registry (regex input, program, point sets, timing) on each generated-reference call under a span the probe ignored. Rather than hoist part of the registry, the probe counts it as regexDescriptorBindings, so the per-call table is honest. nativeProcessOwners counts physical process owners and diffXmlWorkerConstructions counts Diff and Xml worker constructions; the construction row asserts zero for both, which fails if an engine-time install ever starts a process owner (and so binds a Scope) or builds a Diff or Xml worker.
