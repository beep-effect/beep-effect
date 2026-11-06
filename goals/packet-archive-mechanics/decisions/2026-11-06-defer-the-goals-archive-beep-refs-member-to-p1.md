---
title: "Defer the goals-archive beep refs member to P1"
date: 2026-11-06
reversal: "Add the member to scripts/references.json once the archive repo exists"
---

beep refs provision clones every member with no per-member recovery, and refs refresh reports a missing member as pull-failed with a critical notification, so a member whose remote does not exist yet would break provisioning for every checkout. The member is added in P1 when beep-effect/beep-effect-goals-archive exists.
