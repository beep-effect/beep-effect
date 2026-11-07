---
title: "Require a closed error channel in the protocol example"
date: 2026-11-07
kind: checkpoint
lane: "codex/audit-error-boundary"
reversal: "Revert the example and its regression, regenerate packet projections, and retain the private before/after compiler receipts."
---

Parent review validated a precision gap in the worked protocol handler:
Effect.catchTags can leave a newly added action error in the inferred channel.
The example now declares Effect.fn.Return<void | typeof ProblemDetail.Type>,
preserving its success shape while requiring a never error channel.

The regression typechecks the actual Markdown fence. The current example and
an explicitly unguarded expanded-union control compile; the guarded example
rejects the newly unhandled tag. No illustrative service or handler is invoked.
The test also fails against the old guide. Initial probes that incorrectly
required a problem-detail value on successful void paths were rejected and
retained in the private archive.

This is bounded example proof and standing regression protection, not evidence
of production transport behavior, every translator, or complete audit coverage.
P4 remains active. Original reports and raw proof stay private; no paid pilot
or cloud work is admitted.
