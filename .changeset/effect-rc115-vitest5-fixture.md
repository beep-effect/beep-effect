---
"@beep/test-utils": patch
---

Pin the instrumented `each` title fixture to the interpolated title prefix so it
holds under Vitest 5's unquoted `$label` interpolation and formatter-dependent
trailing-argument dump.
