---
title: "Reject captured-context lookups of citation request authority"
date: 2026-11-13
lane: "perf/citation-hoist-installs"
pullRequest: 3282
reversal: "Remove the get, getUnsafe and getOrElse forms from no-citation-optional-invocation."
---

Review round 1: the rule covered optional lookups but not Context.get, Context.getUnsafe or Context.getOrElse on a captured context for CitationTextBudget, CitationOperationAdmission and CitationInvocation. Both data-first and data-last forms are added, with fixtures for all three names plain and namespaced (36 new invalid cases), and the Citation directory passes the extended rule.
