---
title: "Own configuration once at the engine boundary and carry ownership in the type"
date: 2026-11-12
lane: "explore/citation-engine-install-and-worker-reuse"
reversal: "Restore the nested detach calls in each installer."
---

One detach through the JSON codec where configuration enters the engine mints `CitationOwned<Config>`; installers below accept it and never copy. Schema has no freeze or structural sharing, and an identity memo is ruled out by the repo's laws. Operator answer, exploration align round 1. Source: `explorations/citation-engine-install-and-worker-reuse/DECISIONS.md`, detach strategy.
