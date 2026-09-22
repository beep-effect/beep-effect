## Review (r8)

Confidence **4/5**. Delta since r7: follow-ups on resolved threads (`ee4cfd85`) + one-load proof shadow snapshot (`243a34bb`).

**NEW:** 1×P2 — Reply `hasFollowUp` should use `latest:comments(last:1)` like Status so `comments(first:100)` truncation cannot desync status vs reply.

Prior P1 still resolved. Snapshot fix addresses the four-load CodeRabbit note. `mergeable_state: blocked` — COMMENT only, do not APPROVE.
