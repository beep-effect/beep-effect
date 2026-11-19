---
title: "P0: the actor of an admission, a person's challenge and a retraction is the slice-supplied principal id"
date: 2026-11-19
lane: "goals/text-knowledge-stack-rebuild-p0-design"
pullRequest: 3420
reversal: "Type the actor as an AgentRef instead, by a decision file before P4 opens; the L4 design file and the admission token binding are edited in the same change."
---

The actor of an Admission, of a Challenge by a person and of a Retraction is the slice-supplied principal id. AgentRef (a software agent with its model pin, a person, an organization) describes who asserted or generated a record, not who acted on it. An admission token is bound to that principal, together with the action, the revision and the scope.
