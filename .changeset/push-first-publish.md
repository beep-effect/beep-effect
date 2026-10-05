---
"@beep/repo-cli": minor
---

`yeet publish` is push-first: the push is gated on the cheap-gates tier and the
head-install preflight only, the pull request opens as a draft labelled
`ready-for-heavy` by default (`--no-pr` opts out), and the detached
`monitor --until-ready` job is submitted before publish exits. `--prove-first`
restores the previous full-proof-before-push order; `--fast` and
`--start-pr-early` are removed. The readiness monitor gains the
`ready-pending-flip` terminal and the new `yeet ready` command flips a draft
only when every review thread is answered and required checks are green.
