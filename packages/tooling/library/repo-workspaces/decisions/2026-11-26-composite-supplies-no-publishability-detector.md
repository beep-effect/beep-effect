---
title: Workspaces.layer supplies no default PublishabilityDetector, so a caller's detector wins in either merge order
date: 2026-11-26
reversal: Provide PublishabilityDetector.layerNpm inside Workspaces.layer and change the merge-order tests in test/Workspaces.test.ts to expect the default when the caller's detector is merged before the composite.
governs:
  - src/Workspaces.ts#Workspaces
  - src/Publishability.ts#PublishabilityDetector
enforcedBy: []
---

The composite neither provides nor requires a `PublishabilityDetector`; an operation that asks a publishability question carries the requirement, and the caller wires one explicitly.
With a default inside the composite, `Layer.mergeAll` being last-wins made the natural override spelling `Layer.mergeAll(myDetector, Workspaces.layer())` resolve to the default with no type error.
For the service that decides whether and where a package publishes, silently reverting to public npm with public access is the worst failure available.
Rejected: a built-in npm default in `Workspaces.layer()`, which shadows a detector merged before it.
