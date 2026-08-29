---
"@beep/repo-cli": patch
---

Fix the delete-package post-apply doctor flagging its own `{}` deletion
changeset as pending-changeset residue: the canonical `delete-<slug>.md`
note is the intentional deletion record and is now exempt from the residue
scan, while every other pending changeset naming the package still reports.
Caught by the live Track A zero-consumer round-trip proof.
