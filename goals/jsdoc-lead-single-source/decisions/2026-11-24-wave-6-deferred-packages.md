---
title: "Wave 6 sweeps the packages earlier waves deferred, minus fenced and lane-owned files"
date: 2026-11-24
lane: "goals/jsdoc-lead-single-source-w6"
reversal: "Revert the wave 6 commit and re-run jsdoc-ratchet --write-baseline"
---

Waves 2 and 3 skipped the packages comment-law-sweep had in flight (jsonl, csv, semver, spdx, npm-spec, tsconfig, md) and `@beep/schema`. Those sweeps have merged, so wave 6 runs the codemod over them plus `package-json`, which carried 58 rows. Three sets stay out. The 53 `@beep/schema` files that sit in the CI binary closure or the runner handler graphs keep their leads, because those fences are per file. `infra/src` keeps its 14 leads: it is the Pulumi estate the infra-alchemy-rebuild lanes are replacing during the P5 cutover, and edits there would collide with them. `@beep/text` belongs to the in-flight text-knowledge-stack lanes. The codemod's guard also kept every row in ontology, law-practice, agents, m365, github-actions and cli-kit, because removing those leads would change meaning or leave an empty block. Wave 6 also restores the leads in 24 `@beep/schema` files: removing them left 54 exports with no summary. Those exports sit behind `{@inheritDoc X}` companions or annotations the inventory's lead derivation does not reach, such as `$I.annoteSchema` after `S.brand` in a `.pipe(...)`. Without the leads, `@beep/schema` would read needs-remediation and the `packagesNeedingRemediation` ceiling would rise from 15 to 16. The removed count is 338, not 445.
