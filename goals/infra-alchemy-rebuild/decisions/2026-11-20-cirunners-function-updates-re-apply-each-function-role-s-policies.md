---
title: "CiRunners function updates re-apply each function role's policies"
date: 2026-11-20
lane: "docs/infra-alchemy-p5-m6i-and-iam-reapply"
reversal: "if the provider stops re-PUTting role policies, drop the 22 expected IAM writes from the post-check; if a deploy shows a changed document, stop and re-rule"
---

The CI goals driver accepted the 22 IAM writes of the PR 2 CiRunners deploy (run 44671153275, 2026-11-20) as an
idempotent role reapply, and made them a standing expectation for every CiRunners deploy that updates functions.

What the deploy did, from the deploy role's CloudTrail (two reads from saved events over 03:57-04:05Z, identical):

- `iam:AttachRolePolicy` (AWSLambdaBasicExecutionRole) and `iam:PutRolePolicy` (the role's own inline policy) on
  each of the 11 functions' execution roles, 22 writes in all, and no other role or policy.
- Each PutRolePolicy document was byte-identical, as canonical JSON, to the same role's document in the previous
  deploy (2026-11-19, run 44507595565).
- 22 log-group writes (CreateLogGroup, which already existed, and PutRetentionPolicy) on the 11 functions' log groups.

The plan shows the role rows as noop, but the Lambda provider re-PUTs each function's role policies when the function
is updated.

Standing rule: every CiRunners function-update deploy expects exactly these 22 IAM writes and 22 log-group writes. Its
post-check compares the targets, and each PutRolePolicy document against the previous deploy's. A differing document,
or any other role or policy touched, stops the cutover and goes to the driver. Counts come from saved CloudTrail events,
never from pretty-printed lines.
