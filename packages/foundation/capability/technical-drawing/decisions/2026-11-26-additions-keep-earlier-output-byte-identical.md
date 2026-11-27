---
title: Output added after the first sheets is emitted only when used, so earlier renders stay byte-identical
date: 2026-11-26
reversal: Emit every new SVG layer and manifest key unconditionally, drop the legacy-camera defaults, and re-baseline the goldens.
governs:
  - src/Sheet.compose.ts#composeSheet
  - src/Sheet.compose.ts#chainSegments
  - src/FigureSet.service.ts#makeService
  - src/Geometry.schemas.ts#hiddenLinePassAboutKey
  - src/View.schemas.ts#negateWithoutNegativeZero
  - src/View.schemas.ts#perspective
enforcedBy: []
---

Every layer, manifest field or camera input added after the first sheet sets were written stays out of the output until a render uses it: the shading, emphasis and label-outline SVG layers are written only when they have marks, a lone broken segment stays the `M..L..` subpath it always was, `emphasisSegments` and `outlineSeparations` are recorded only when drawn, `hiddenLinePassAbout` is encoded only when it is not `origin`, a camera without a set azimuth keeps the legacy perspective eye verbatim, and the plan camera negates without minting −0.
Reason: goldens, recorded manifests and sheet-set approvals pin bytes, so a render that uses none of the additions must encode exactly as before.
Rejected: always emitting the new layers and keys with empty or default values, which is uniform but changes every earlier golden and manifest.
