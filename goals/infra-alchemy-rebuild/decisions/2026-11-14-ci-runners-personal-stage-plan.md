---
title: "CI runners personal-stage plan: 66 to create, 9 binding changes, no EC2 reads"
date: 2026-11-14
lane: "goals/infra-alchemy-rebuild-p5-ci-runners"
reversal: "None needed: the plan changed nothing; delete this record if it is superseded by a later plan."
---

Personal-stage plan, read-only, run once (budget: at most two) from `packages/tooling/infra/ci-runners` on 2026-11-14 with the aws-vault session exported and no `CI_RUNNERS_*` variable set: `bunx alchemy plan --stage "dev_$USER" --env-file /dev/null`. No deploy, no `--yes`.

Result: exit 0 in 3.6 s, `Plan: 66 to create, 9 binding changes`; 0 update, 0 replace, 0 delete, 0 orphan, 0 adopt. The 66 creates by area: network 18 (VPC, default security group, internet gateway, route table, default route, 5 subnets, 5 route-table associations, runner security group, flow log, log group), flow-logs role 1, runner policies 2, reaper 3 (function, schedule, permission), fleet composite 42 (KMS key and alias, 3 App parameters, binaries bucket, 2 launch templates, 2 runner roles, 2 instance profiles, 6 queues, 8 functions, 3 event-source mappings, 6 rules, 6 permissions, the sweep). The 9 bindings are the inline policies of the nine functions, the reaper included. Every line of the output passed the pre-deploy gate (`test/support/PersonalPlan.ts` is this log with the stage renamed and timestamps zeroed).

AWS reads: a fresh stage has no state, so the plan read only the credentials resolution and the state bucket; it made no EC2 describe call, in line with the window-5 owner's budget. A plan of an existing stage reads each resource back once per plan (about 25 EC2 describes for the network, templates and security group); the deploy job should plan once per run.

Not verified without a deploy: provider behaviour against real AWS (bundling of the nine Effect Lambdas, the function URL, IAM eventual consistency, flow-log delivery, `CreateFleet` against the launch template), and the destroy ordering beyond the in-memory test.
