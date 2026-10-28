# Execution friction

## 2026-10-28: historical merge cannot establish completion

While resuming closeout, `beep goals completion refresh --slug tsrs-gates`
returned `unsatisfied` for #2262. Merge-time required checks Security and
Heavy / Effect Diagnostics failed, and the declared Yeet verdict was absent.
The current ruleset has retired the context, but cannot repair historical
required failures. A fresh closeout PR now carries the qualification work.
Checking completion evidence before lane retirement would have exposed this
while the original readiness artifacts were still available.

## 2026-10-28: publication inventory exceeded the local compute limit

The docs-only closeout publish spent over ten minutes in cheap-gates, ending
with `quality jsdoc-ratchet --regenerate` still active. The owned run was
interrupted and its processes exited before taking the documented hosted-CI
fallback. A diff-scoped inventory or reusable exact-input receipt would avoid
this full-repository scan for a packet-only update.

The later final-check coverage gate also exceeded ten minutes (10m06s). Its
original receipt is retained at `.beep/tsrs-closeout-before-coverage-skip.json`;
all other gates passed on that head. The local skip and the same-head policy
and Fallow reuse are recorded in the packet and PR body.
