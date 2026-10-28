# Execution friction

## 2026-10-28: historical merge cannot establish completion

While resuming closeout, `beep goals completion refresh --slug tsrs-gates`
returned `unsatisfied` for #2262. Merge-time required checks Security and
Heavy / Effect Diagnostics failed, and the declared Yeet verdict was absent.
The current ruleset has retired the context, but cannot repair historical
required failures. A fresh closeout PR now carries the qualification work.
Checking completion evidence before lane retirement would have exposed this
while the original readiness artifacts were still available.
