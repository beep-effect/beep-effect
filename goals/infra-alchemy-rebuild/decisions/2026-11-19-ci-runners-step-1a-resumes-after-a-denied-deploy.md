---
title: "CI runners step 1a resumes after a denied deploy"
date: 2026-11-19
lane: "fix/ci-runners-deploy-role-read-and-vpc-grants"
pullRequest: 3408
reversal: "revert the PR; the deploy role's managed policies return to the previous default version with aws iam set-default-policy-version, and the workflow loses plan_only and expect_plan_digest"
---

Cutover step 1a (run 44435840783) passed its plan check and stopped in the deploy step on 14 denied calls, all implicit: four EC2 creates on the parent VPC, iam:ListPolicyTags and lambda:GetFunctionConcurrency. It left 20 state rows created and 52 creating; five functions and the runner IMDS-disable policy exist in AWS with their state rows still creating. The CI goals driver ruled, through the orchestrator:

- Resume, do not delete. Completing a state-tracked creating row is not adoption while the resource carries the CiRunners/prod tags and CloudTrail shows the deploy session created it. Both hold for all six. No state row is deleted by hand and no Pulumi apply runs on the live fleet.
- Grants only; the fleet boundary and the explicit deny stay. The parent-VPC side of a create is its own statement (Ec2CreatesInOwnedVpc) on vpc/* under aws:ResourceTag for the ownership tags, with no literal VPC id; the request-tag condition on the created resource is unchanged. The two Lambda reads are held to beep-fleet-prod-* functions and the IAM reads and the default-version write to policy/beep-fleet/prod/*. The teardown grants are held to the fleet's own names. iam:DeleteRolePermissionsBoundary is not granted: the provider's call on role delete is patched out.
- The bootstrap expectation takes a resumed create: a create whose prior state is creating, with its saved bindings as noop or update, and the replace of an event-source mapping generation that never existed (type AWS.Lambda.EventSourceMapping, prior state creating, no outputs, incomplete props, no delete-first). Each prints its own label, inside the plan-rows digest. Routine and step 1b refuse the replace. With every plan relayed for such a row the gate shows zero mappings on beep-fleet-prod-* functions and no CreateEventSourceMapping in CloudTrail since the first run.
- The workflow gains plan_only (ends after the plan step, runs unarmed, can never reach the deploy step) and expect_plan_digest (the deploy refuses unless its plan rows give that digest). Order: the PR is merged by hand, the corrected policy is applied and evidenced, a plan_only bootstrap runs, the driver reads its rows, digest and the CloudTrail proof that it only read, and the bootstrap then runs on the same commit with that digest.
- The policy stays in customer managed policies, split in statement order at 6,144 characters by managedPolicyDocuments; the drain and destroy step detaches and deletes every one of them, all versions.
- Mappings name their function by ARN.

Evidence: research/p5-ci-runners-deploy-role-coverage.md.
