---
title: "The census ships as one pull request, not a library PR followed by a command PR"
date: 2026-11-19
lane: "goals/agent-output-census-library"
reversal: "Split the branch at the library boundary and open the command as a second PR stacked on the first."
---

The plan named two pull requests. In goals/gate-report-core three stacked lanes over squash merges each cost a wall of add/add conflicts and a regeneration pass, and a final waited hours at the merge gate; the command PR would wait on the library PR the same way. The library has no consumer but the command, the change is a single tooling library plus one command group, and the reproduction run is what proves both. One PR carries P1 to P4 and the closeout.
