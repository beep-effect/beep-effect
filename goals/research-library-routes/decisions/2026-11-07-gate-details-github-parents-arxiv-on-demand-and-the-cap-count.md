---
title: "Gate details: GitHub parents, arXiv on demand and the cap count"
date: 2026-11-07
lane: "feat/research-library-routes"
reversal: "Change libraryHopGate: allow children of GitHub parents, admit arXiv without --source, or count only this run"
---

GitHub is never transitive in either direction: a GitHub child and any child of a GitHub parent are refused. arXiv hop 2 is admitted only when --source names it. The 25-per-domain-per-intake cap counts hop-2 sources already captured plus this run's admissions, in canonical-URL order, so reruns stay within the cap. Policy values are LibraryHopPolicy, a typed config outside the catalog schema; --hop2-domain-cap overrides the cap.
