---
"@beep/file-processing": minor
---

Add the `@beep/file-processing/PageOcr` contract: `PageOcrRequest` and `PageOcrResult` schemas for
reading one rendered page, `PageOcrEngineIdentity` and `PageOcrModelIdentity` so a stored page text
names the engine, runtime version and weights digest that produced it, the `PageOcrError` reasons,
and `PageOcrService` with `makePageOcrServiceLayer`, which routes by exact engine id and never
substitutes another engine. No engine is wired into extraction yet.
