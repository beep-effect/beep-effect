---
title: "P6: the law-practice value concepts are hand-authored after an architecture dry-run"
date: 2026-11-24
lane: "p6"
reversal: "Apply the architecture plan once its law-practice values template stops writing placeholder content and rewriting the values barrel, and diff it against the hand-authored files"
---

The touch table routes new concepts through `bun run beep architecture`. For `law-practice` the only route is `architecture add concept law-practice <Concept> --domain-kind values`, which targets the legacy seven-package shape. Its dry-run plan for `LawClaim` writes placeholder `WorkPriority` model, behavior and test files (a `low`/`normal`/`high` literal kit). It also rewrites `packages/law-practice/domain/src/values/index.ts` to a single `WorkPriority` export, and it removes the fixture-lab specimen package and two CLI fixture paths. Applying the plan would replace the real values barrel and add content unrelated to the concept. The row ran the dry-run only, as evidence. It hand-authored `packages/law-practice/domain/src/values/LawClaim` and `packages/law-practice/domain/src/values/MatterScope` in the package's existing `values/<Concept>/{index,<Concept>.model}.ts` layout, with the two subpath exports the plan names (`@beep/law-practice-domain/values/LawClaim` and `@beep/law-practice-domain/values/MatterScope`).
