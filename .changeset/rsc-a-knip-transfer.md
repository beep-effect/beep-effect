---
"@beep/box-provisioning": patch
"@beep/box": patch
"@beep/freshbooks": patch
"@beep/occt": patch
"@beep/pdf-tools": patch
"@beep/wink": patch
"@beep/colors": patch
"@beep/data": patch
"@beep/repo-ai-metrics": patch
"@beep/codegen-kit": patch
"@beep/repo-cli": patch
---

Narrow file-local helper exports, remove unused internal data and research parsing code,
and declare the FreshBooks test compiler dependency directly. Public package entrypoints
and the transcript path helper exported through the public barrel retain their behavior.
