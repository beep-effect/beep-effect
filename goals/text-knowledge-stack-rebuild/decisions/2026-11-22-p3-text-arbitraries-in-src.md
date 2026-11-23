---
title: "P3: the @beep/text law generators move to src as @beep/text/Arbitrary and take the digest as an argument"
date: 2026-11-22
lane: "goals/text-knowledge-stack-rebuild-p3-annotation"
reversal: "Move them back to text/test/support and give @beep/annotation its own copy under a duplication waiver, by a decision file"
---

The L2 laws need well-formed text, scalar-boundary ranges and `Anchored` rows, which `packages/foundation/modeling/text/test/support/generators.ts` already builds. Another package may not import a test file across packages, and a copy would trip the duplication gate. `@beep/file-processing` already ships its test engine from `src` (`src/test.ts`, served as `@beep/file-processing/test`). So `wellFormedTextWith`, `rangeIn`, `sourceFor` and `anchoredOn` move to `packages/foundation/modeling/text/src/Arbitrary.ts`, served as `@beep/text/Arbitrary`. They take a `JsoncDigest` argument instead of calling `node:crypto`, so the module stays runtime-neutral. The text tests import them from there, and the text laws cover the module fully. The annotation package's own generators (documents, document triples, containment cases) live in its `test/support`.
