---
"@beep/repo-cli": patch
---

Refresh a package's Turbo build dependency closure before running its default
package verification audit, preventing stale upstream build artifacts from
creating false local failure capsules after base updates.
