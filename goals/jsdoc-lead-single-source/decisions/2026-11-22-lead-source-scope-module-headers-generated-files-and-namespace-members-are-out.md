---
title: "Lead-source scope: module headers, generated files and namespace members are out"
date: 2026-11-22
lane: "goals/jsdoc-lead-single-source-p0"
reversal: "Remove the moduleHeader and generated guards from restatingLeadFindings in JSDocDocumentationInventory.ts."
---

Blocks carrying @packageDocumentation, @fileoverview or @file are module headers even when they lead the first re-export, so they are never restating leads. Generated files (_generated/, generated/, .generated.ts, a GENERATED FILE header) are rewritten by their generators and are not counted. Types inside a companion namespace get a derived lead in docgen, but the inventory scores only top-level exports, so the sweep leaves their written leads alone.
