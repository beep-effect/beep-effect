---
title: "Two accepted-cf46 installations preserve the same raw dependency identity"
date: 2026-11-07
kind: checkpoint
lane: "codex/cache-current-dependency-evidence-20261107"
reversal: "Retain the immutable observations and mark this profile prerequisite unproven if a later authenticated comparison contradicts it; do not normalize digests or reuse it for an unreviewed profile."
---

Serial source-only inspection runs 42332185638 and 42333355378 passed at accepted source cf46c700488b6950ea7340369e0d0508e596cd1e with exact caller and resolved Heavy revision. Authenticated source reports are byte-identical; raw dependency digest c112ea17c1f7526a0d6a43583ca3d27179220c00d1ba706e8ef941ea1e11ab3d, all 2194 package groups, thirteen control hashes and resource bounds agree. Diagnostic times are 43.781 and 44.406 seconds; each combined report pair is 3411533 bytes under 4 MiB. Neither complete group inventory contains node-gyp, so its optional file-detail comparison is not applicable, not a file-level pass. Retain research/current-dependency-inspection-2026-11-07.json and narrative. No exclusions, normalization or cleanup produced equality. This establishes dependency repeatability only for that exact source/profile; independent producer approval, signed execution/publication/import, task qualification, representative windows and both whole-goal acceptance gates remain open. No signing, capability, production or lifecycle change and no local quality suite.
