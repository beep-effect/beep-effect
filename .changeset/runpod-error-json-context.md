---
"@beep/runpod": patch
---

Make the exported Runpod error options schemas (`RunpodErrorOptions`, `RunpodDocsErrorOptions`) round-trip deterministically by holding a sanitized `cause` string (`OptionFromOptionalKey(String)`) instead of `S.Defect`. `S.Defect` allowed non-serializable values (e.g. `new Error("")`, nested objects, functions) into an exported schema whose encode/decode equivalence then depended on host-sensitive structural equality (fast-check seed 948470019 found the counterexample). Raw thrown causes are now accepted through private `*Input` schemas and normalized via `causeFromUnknown` before construction, mirroring the `@beep/box` `BoxErrorOptions` / `BoxErrorOptionsInput` split.
