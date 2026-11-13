---
title: "Preserve boundary-specific deadline placement around admission"
date: 2026-11-13
reversal: "Remove deadlineStarts and restore the previous invocation ordering only with an explicit behavior change."
---

Review round 1 identified that engine queue wait must count against each stage deadline, while the public six-form extractor historically starts that deadline after admission. CitationInvocationPolicy now has a schema-backed deadlineStarts literal with explicit values at both public boundaries. There remains one invocation constructor: engine timing wraps admission.run; extractor timing wraps its body inside admission.run. The request Scope remains inside admission in both cases, so cleanup precedes permit release. Manual-clock public boundary tests cover queue plus work and refusal labels without native children.
