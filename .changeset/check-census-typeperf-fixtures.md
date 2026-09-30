---
"@beep/schema": patch
"@beep/repo-configs": patch
---

Add compile-only typeperf fixtures under `test/fixtures/typeperf/` for the check-census
instantiation gate; no source or export changes. The deprecated-apis ESLint profile now
admits that fixture directory through `allowDefaultProject`, so its project service can
parse the fixtures.
