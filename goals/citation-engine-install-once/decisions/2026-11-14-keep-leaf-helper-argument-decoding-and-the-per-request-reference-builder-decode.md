---
title: "Keep leaf helper argument decoding and the per-request reference builder decode"
date: 2026-11-14
lane: "perf/citation-owned-configuration"
reversal: "Type the leaf helper and reference builder arguments and delete their decodes in a follow-on slice."
---

A4 removes every configuration detach below the boundary and every stage-level configuration decode: makeCitationMetadataStage, the publication operation, installCitationMetadataConfigurationStage and the four detachCitationMetadataConfiguration sites no longer decode or detach, and stage installers take CitationOwned configuration with typed limits and runtime. Leaf helpers below the stages (context matcher, metadata strings and year, regex input, evaluator install, token dispatch, edition inference, extractor ordering and recipes) keep their existing unknown-typed signatures and re-validate their scalar arguments; they are shared with many direct tests and copy nothing the probe counts. The per-request reference-pattern builder (kept per request by the A3 decision on generated references) still decodes its configuration argument each request. Both are argument validation, not ownership; typing them through is mechanical and left for a follow-on slice so this one stays reviewable.
