# Opportunities

## 2026-09-03 — Output limits did not automatically bound staging work

- **What I was doing:** Addressing the first review pass after the twelve
  security remediations and their focused regressions were published.
- **Evidence:** PR #949 review identified that the Markdown node counter and
  person-match discovery bounded their final counts but could still enqueue or
  materialize an attacker-sized input before rejecting it. The same pass found
  that individually bounded patent ranges could exceed the intended aggregate
  budget before deduplication, and that the worker JSON ceiling omitted its
  framing newline.
- **What would have prevented it:** Security-boundary reviews should separately
  account for source enumeration, intermediate staging, aggregate expansion,
  final retained output, and wire framing. Boundary tests should make data just
  beyond the decision point unreadable, not merely assert the final error.

## 2026-09-03 — Runtime-root rollout prose described an older predecessor

- **What I was doing:** Reviewing the operational handoff for the move to the
  home-backed coordination root.
- **Evidence:** PR #949 review compared the immediate parent revision and found
  that it coordinated below `/tmp`, while the hard-cutover prose told operators
  only to drain `/run/user/<uid>`.
- **What would have prevented it:** Migration instructions should be checked
  against the immediate parent revision and name every concrete legacy root;
  older historical roots can be listed in addition, but cannot replace the
  direct predecessor in the drain procedure.
