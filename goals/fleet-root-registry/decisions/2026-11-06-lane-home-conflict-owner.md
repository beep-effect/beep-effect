---
title: "Flat lanes/ stands; the worktree add switch belongs to lane-bootstrap"
date: 2026-11-06
lane: "@chore/deps-update-11-6-26 (grill session)"
reversal: "Reverse the exploration's lane-home decision: drop lanes/ from the roots list, make owningSeat a path fact again and leave Worktree.service.ts:1540 as is."
---

AGENTS.md Quality Operator, Worktree.service.ts:1540 and Worktree.command.ts:462 still derive the managed root from <clone>-worktrees, while the exploration decided flat <fleet>/lanes/<slug> with the owning seat as a registry fact. This packet carries owningSeat in the registry schema and lanes/ in the roots list; the worktree add rewrite and the AGENTS.md worktree bullet edit are assigned to lane-bootstrap. Rejected: keeping sibling -worktrees roots (reverses a grilled decision for less churn); pulling the managed-root rewrite into this packet (grows the first PR).
