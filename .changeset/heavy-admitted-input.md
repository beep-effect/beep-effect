---
{}
---

No release: `heavy.yml` accepts a `workflow_call` input `admitted` (default
`true`, so every existing caller is unchanged). `false` skips the seven-lane
matrix at job level, so each `Heavy / <lane>` context reports `skipped`
without queueing on `beep-ec2-heavy`. The caller-side admission decision
(label gate, docs-only filter) lands separately once this input is on `main`,
because the heavy runner group admits main-ref workflows only.
