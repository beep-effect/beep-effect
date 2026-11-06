---
title: "The library root default moves to XDG data home; the operator path lives in the environment"
date: 2026-11-06
lane: "feat/research-library-ontology-core"
reversal: "Restore the previous fallback in Library.paths.ts"
---

SPEC forbids absolute or home-relative operator paths in repo files, and the old default hard-coded one in Library.service.ts, the flag help and the runbook. The resolution order is now --library, BEEP_RESEARCH_LIBRARY, XDG_DATA_HOME/beep/research-library, then HOME/.local/share/beep/research-library. The operator keeps the existing library by exporting BEEP_RESEARCH_LIBRARY.
