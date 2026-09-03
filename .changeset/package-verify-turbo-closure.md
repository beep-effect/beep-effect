---
"@beep/repo-cli": patch
---

Refresh a package's upstream Turbo build dependency closure before running its
default package verification audit, preventing stale upstream build artifacts
from creating false local failure capsules after base updates without rebuilding
the selected package twice.
