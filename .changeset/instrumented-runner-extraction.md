---
"@beep/test-runner": patch
"@beep/test-utils": patch
"@beep/repo-configs": patch
---

Extract the instrumented Effect Vitest runner into a package without application
package dependencies. Preserve the test-utils compatibility exports and historical
error schema identities, and move the existing runtime lint exceptions with the
implementation.
