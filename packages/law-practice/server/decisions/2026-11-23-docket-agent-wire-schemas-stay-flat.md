---
title: Docket agents answer in flat anonymous wire schemas decoded through the use-case models
date: 2026-11-23
reversal: Hand the provider the use-case schemas (or identifier-annotated wire schemas) as the structured-output schema.
governs:
  - src/DocketIntake/DocketIntake.agents.ts#ResponsePeriodWire
  - src/DocketIntake/DocketIntake.agents.ts#SecretaryWire
  - src/DocketIntake/DocketIntake.agents.ts#decodeEntry
enforcedBy: []
---

Every schema handed to the provider as a structured-output format is an anonymous, flat `S.Struct` with no identifier annotation, so its JSON Schema carries no shared `$defs`. Each answer is then rebuilt as the encoded form of the matching use-case model and decoded through it, so the model's own rules (ISO dates, positive periods, non-empty titles) decide what is valid.

Reason: provider structured-output modes reject the `$defs` that identifier-annotated members produce, and the repo's usual `$I.annote` schemas emit them.

Rejected: sending the use-case schemas directly, and annotating the wire schemas with `$I` identifiers like other schemas in the package.
