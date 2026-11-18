---
title: "Prove at compile time that engine stage installs read no request value"
date: 2026-11-13
lane: "perf/citation-hoist-installs"
reversal: "Remove installedWithoutRequestValues from CitationEngine.layer.ts."
---

The engine already installs its four stage trees in a Context without CitationOperationAdmission, and CitationInvocation exists only inside openCitationInvocation. A hoisted install that still yields CitationInvocation or CitationTextBudget would otherwise surface only as an extra Layer requirement at a use site. installedWithoutRequestValues makes each of the four engine installs pass true for a parameter typed false when the install's requirements contain either service, so such an install fails to typecheck at engine construction. Checked by adding a yield of CitationInvocation to the tokenized-extraction install: TS2345 at CitationEngine.layer.ts. The hoist also surfaced three factories that capture CitationTextBudget at construction (ReferencePatterns, ReferenceNames, AnnotationTemplate); none of them was hoisted.
