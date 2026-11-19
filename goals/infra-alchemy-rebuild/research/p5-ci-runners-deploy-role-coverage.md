# P5 CI runners: deploy-role coverage after the failed step 1a

Recorded 2026-11-19 by the packet gate. Cutover step 1a (run 44435840783, `mode=bootstrap`) passed its plan
check and stopped in the deploy step on permissions the deploy role did not hold. This file is the evidence the
fix PR carries: what was denied, why, what the re-run will plan, and every AWS call the providers make for the
stack's 72 resources mapped to the statement that allows it.

Method: nine readers traced the Alchemy 2.0.0-beta.87 provider sources for the stack's resource types and the
engine's resume path; each reader's gaps were re-checked by a second reader told to refute them, and a last pass
compared every client call in the 22 provider files with the tables (286 calls). The Service Authorization
Reference decided which resources and condition keys each action is authorized against. Live state rows and
CloudTrail confirmed the preconditions.

## What was denied

CloudTrail, deploy session `alchemy-ci-runners-prod`, 277 events between 01:19:29Z and 01:19:51Z. 14 were
denied, every one "because no identity-based policy allows" the action: none was an explicit deny or a boundary
deny, so the fix is grants only.

| Time (Z) | Action | Resource | Count |
| --- | --- | --- | --- |
| 01:19:36 | `iam:ListPolicyTags` | the runner IMDS-disable policy | 1 |
| 01:19:37 | `ec2:CreateFlowLogs` | the new fleet VPC | 1 |
| 01:19:37 | `ec2:CreateRouteTable` | the new fleet VPC | 1 |
| 01:19:37 to 01:19:38 | `ec2:CreateSubnet` | the new fleet VPC | 5 |
| 01:19:38 | `ec2:CreateSecurityGroup` | the new fleet VPC | 1 |
| 01:19:48 to 01:19:51 | `lambda:GetFunctionConcurrency` | the five functions created seconds earlier | 5 |

Every other error in the session is a not-found probe before a create. `CreateFunction` succeeded five times,
after 28 `InvalidParameterValueException` retries while the new execution roles propagated.

## Why the EC2 creates failed, per action

`Ec2CreatesTagged` allows the creates on `Resource: "*"` under `aws:RequestTag` for the two ownership tags.
EC2 authorizes each of these four creates against two resources: the one being created and the parent VPC. The
request tags exist only on the first check.

| Action | Resource being created (keys) | Parent resource (keys) | What allows the parent check now |
| --- | --- | --- | --- |
| `ec2:CreateSubnet` | `subnet` (`aws:RequestTag`, `aws:TagKeys`) | `vpc` (`aws:ResourceTag`, `ec2:ResourceTag`) | `Ec2CreatesInOwnedVpc` |
| `ec2:CreateRouteTable` | `route-table` (`aws:RequestTag`, `aws:TagKeys`) | `vpc` (`aws:ResourceTag`, `ec2:ResourceTag`) | `Ec2CreatesInOwnedVpc` |
| `ec2:CreateSecurityGroup` | `security-group` (`aws:RequestTag`, `aws:TagKeys`) | `vpc` (`aws:ResourceTag`, `ec2:ResourceTag`) | `Ec2CreatesInOwnedVpc` |
| `ec2:CreateFlowLogs` | `vpc-flow-log` (`aws:RequestTag`, `aws:TagKeys`) | `vpc` (`aws:ResourceTag`, `ec2:ResourceTag`); the delivery role through `iam:PassRole` | `Ec2CreatesInOwnedVpc`, `IamPassFleetRoles` |

`Ec2CreatesInOwnedVpc` names `vpc/*` under `aws:ResourceTag` for the two ownership tags. The reference lists
that key on the `vpc` resource for all four actions, so the policy names no VPC id and nothing is regenerated if
the VPC is ever replaced. `Ec2CreatesTagged` is unchanged: the created resource still needs the request tags.
`ec2:CreateVpc`, `CreateInternetGateway` and `CreateLaunchTemplate` have no parent resource and succeeded or
are untouched. Policy v2 never scoped these creates (it only adds the default group's two revokes), so the
statement is in v1 and v2.

## Why 59 passing simulations missed it

`aws iam simulate-custom-policy` applies every supplied context key to every resource. The earlier cases
supplied the request tags, so the simulator let `Ec2CreatesTagged` answer for whichever ARN the case named,
the VPC included. No case modelled the parent check the way EC2 makes it (the VPC ARN with no request tags in
context), and no case covered a provider's read after a create. The new cases do both, and the re-run's
CloudTrail, not a simulation, is what confirms the grants.

## What the re-run plans

The state store holds 72 rows: 20 `created` and 52 `creating` with no recorded outputs. Six of the 52 exist in
AWS because their create succeeded and only the read back was denied: the five functions (with their execution
roles and log groups) and the IMDS-disable policy. All six carry the ownership tags and were created by the
deploy session.

- A `creating` row is planned again as a `create` (`alchemy/src/Plan.ts`, `diffResource`). When its stored
  props are complete the plan first runs the provider's `read`; only defects are caught there, so a denied read
  stops the plan itself. That is why the two Lambda reads and `iam:ListPolicyTags` are needed even for a
  plan-only run.
- The apply drives the same create handler under the first attempt's instance id (`alchemy/src/Apply.ts`,
  `resolveInstanceId`), so generated names repeat. The function provider finds the function by its pinned name,
  accepts it only with the three `alchemy::` tags, reuses the role and log group and updates in place; the
  policy provider reads the policy by ARN and skips the create. Nothing is deleted and recreated.
- The 20 `created` rows diff against their stored props and plan `noop`.
- Five rows plan `replace`: the event-source mappings. They were checkpointed before their source queue
  existed, so the stored props hold no `eventSourceArn`; the provider's diff reads the now-known ARN as a
  change. No mapping exists, and Alchemy drops such an empty generation without a provider call.
- Eleven function rows carry a binding the failed run already saved, so the binding diffs `noop` or `update`,
  not `create`.

The bootstrap expectation now reads the last two as what they are (`ResumeKind` in `src/CheckedDeploy.ts`):
a row that continues the stopped deploy prints `resumed create`, the digest covers that label, and the empty
mapping replace passes only when the type is `AWS.Lambda.EventSourceMapping`, the prior state is `creating`
with no outputs and incomplete props, and the replace does not delete first. Every other mode refuses it.

## Grants added

| Statement | Added | Held to | Needed by |
| --- | --- | --- | --- |
| `Ec2CreatesInOwnedVpc` (new) | `ec2:CreateSubnet`, `CreateRouteTable`, `CreateSecurityGroup`, `CreateFlowLogs` | `vpc/*` with both ownership tags on the VPC | step 1a |
| `LambdaFleetFunctions` | `lambda:GetFunctionConcurrency`, `lambda:GetFunctionEventInvokeConfig` | `function:beep-fleet-prod-*` | step 1a, every plan of a function |
| `IamFleetPolicies` | `iam:ListPolicyTags`, `iam:SetDefaultPolicyVersion` | `policy/beep-fleet/prod/*` | step 1a (tags); any later edit of the IMDS-disable document (default version) |
| `IamFleetProfiles` | `iam:UntagInstanceProfile` | `instance-profile/beep-fleet-prod-*` | tag drift repair |
| `SsmFleetParameters` | `ssm:GetParametersByPath` | `parameter/beep-fleet/prod/*` | `RunnerSweep` when the fleet is destroyed |
| `LogsFleetGroups` | `logs:PutLogGroupDeletionProtection` | the fleet's two log group prefixes | a log group delete or replace |
| `SqsList` (new) | `sqs:ListQueues` | `*` (the service gives it no resource type; a read) | every queue delete confirms absence |
| `S3Binaries` | `s3:ListBucketVersions`, `ListBucketMultipartUploads`, `AbortMultipartUpload`, `DeleteObjectVersion` | the binaries bucket and its objects | the bucket's force-destroy |

## Deliberately not granted

Neither step 1a nor step 1b reaches any of these; each fails closed if a later change reaches it.

| Action | Why not | When it would be reached |
| --- | --- | --- |
| `iam:DeleteRolePermissionsBoundary` | The role could strip the boundary from a fleet Lambda role it also writes policies on and runs code under. The provider's call is patched out instead: IAM deletes a role with its boundary in place. | every role delete, before the patch |
| `iam:UpdateAssumeRolePolicy` | A fleet role's trust policy stays as created. | trust-policy drift |
| `ec2:ModifySecurityGroupRules` | It needs `security-group-rule/*`, and inline rules carry no tags to hold it to. | a rule description change |
| `ec2:AuthorizeSecurityGroupIngress` | The stack declares no ingress. | an ingress rule is declared |
| `ec2:ReplaceRouteTableAssociation` | Reached only if the route table is renamed or split. | a future route-table move |
| `ec2:DeleteNetworkInterface` | The provider swallows the denial and waits. | a stuck Lambda network interface on teardown |
| `kms:ScheduleKeyDeletion`, `EnableKey`, `DisableKey`, `CancelKeyDeletion`, `UpdateKeyDescription`, `UntagResource`, `PutKeyPolicy` | Key state and policy stay operator-owned. | key drift, or a destroy of the secrets key |
| `lambda:PutFunctionEventInvokeConfig`, `DeleteFunctionEventInvokeConfig`, alias and version actions | The stack sets none of them. | a prop that enables them |
| `lambda:UntagResource` on a mapping | A mapping is tagged once, on create. | tag drift on a mapping |
| `s3:DeleteBucketPolicy`, `PutBucketNotification`, and every write on the state bucket | The stack declares no bucket policy or notification; the state bucket's settings are a tripwire. | out-of-band drift |
| every `List*` the providers use only for `alchemy nuke` or `drift` | Not part of plan or deploy. | never on this job |

## Two things only the real run settles

- Whether Lambda fills `lambda:FunctionArn` on `CreateEventSourceMapping` when the request names the function
  by name is not documented. The stack now passes the function ARN, and the first mapping create in CloudTrail
  is the proof.
- `PutFunctionConcurrency` on the two scale-up functions needs the account's unreserved concurrency to stay at
  or above 100. The account limit is 1,000 with 848 unreserved; two reserved leaves 846.

## Simulations

`aws iam simulate-custom-policy` on the generated managed documents (`managed-v1-*.json`,
`managed-v2-*.json`), both versions per case.

| Case | Expected | v1 and v2 |
| --- | --- | --- |
| E1 CreateSubnet on subnet/* with request tags | allowed | pass |
| E2 CreateSubnet on subnet/* without request tags | implicitDeny | pass |
| E3 CreateSubnet on the fleet VPC with the fleet tags on it | allowed | pass |
| E4 CreateSubnet: the parent check as EC2 makes it (no request tags), on a VPC without the fleet tags | implicitDeny | pass |
| E4b CreateSubnet: the parent check as EC2 makes it, fleet VPC, tags not supplied | implicitDeny | pass |
| E5 CreateSubnet on a VPC tagged for another stage | implicitDeny | pass |
| E1 CreateRouteTable on route-table/* with request tags | allowed | pass |
| E2 CreateRouteTable on route-table/* without request tags | implicitDeny | pass |
| E3 CreateRouteTable on the fleet VPC with the fleet tags on it | allowed | pass |
| E4 CreateRouteTable: the parent check as EC2 makes it (no request tags), on a VPC without the fleet tags | implicitDeny | pass |
| E4b CreateRouteTable: the parent check as EC2 makes it, fleet VPC, tags not supplied | implicitDeny | pass |
| E5 CreateRouteTable on a VPC tagged for another stage | implicitDeny | pass |
| E1 CreateSecurityGroup on security-group/* with request tags | allowed | pass |
| E2 CreateSecurityGroup on security-group/* without request tags | implicitDeny | pass |
| E3 CreateSecurityGroup on the fleet VPC with the fleet tags on it | allowed | pass |
| E4 CreateSecurityGroup: the parent check as EC2 makes it (no request tags), on a VPC without the fleet tags | implicitDeny | pass |
| E4b CreateSecurityGroup: the parent check as EC2 makes it, fleet VPC, tags not supplied | implicitDeny | pass |
| E5 CreateSecurityGroup on a VPC tagged for another stage | implicitDeny | pass |
| E1 CreateFlowLogs on vpc-flow-log/* with request tags | allowed | pass |
| E2 CreateFlowLogs on vpc-flow-log/* without request tags | implicitDeny | pass |
| E3 CreateFlowLogs on the fleet VPC with the fleet tags on it | allowed | pass |
| E4 CreateFlowLogs: the parent check as EC2 makes it (no request tags), on a VPC without the fleet tags | implicitDeny | pass |
| E4b CreateFlowLogs: the parent check as EC2 makes it, fleet VPC, tags not supplied | implicitDeny | pass |
| E5 CreateFlowLogs on a VPC tagged for another stage | implicitDeny | pass |
| E6 CreateVpc gets nothing from the VPC-side grant | implicitDeny | pass |
| E7 CreateTags on a VPC without the fleet tags (request tags, no create action) | implicitDeny | pass |
| E8 CreateTags on a VPC without the fleet tags (no context) | implicitDeny | pass |
| E9 CreateFlowLogs passes the flow-logs role to vpc-flow-logs | allowed | pass |
| L1 GetFunctionConcurrency on beep-fleet-prod-webhook | allowed | pass |
| L1 GetFunctionConcurrency on beep-fleet-prod-reaper | allowed | pass |
| L1 GetFunctionConcurrency on beep-fleet-prod-ssm-housekeeper | allowed | pass |
| L1 GetFunctionConcurrency on beep-fleet-prod-termination-watcher | allowed | pass |
| L1 GetFunctionConcurrency on beep-fleet-prod-binaries-syncer | allowed | pass |
| L1 GetFunctionConcurrency on beep-fleet-prod-heavy-scale-up | allowed | pass |
| L2 GetFunctionConcurrency on the live fleet's beep-ci-scale-up | implicitDeny | pass |
| L1 GetFunctionEventInvokeConfig on beep-fleet-prod-webhook | allowed | pass |
| L1 GetFunctionEventInvokeConfig on beep-fleet-prod-reaper | allowed | pass |
| L1 GetFunctionEventInvokeConfig on beep-fleet-prod-ssm-housekeeper | allowed | pass |
| L1 GetFunctionEventInvokeConfig on beep-fleet-prod-termination-watcher | allowed | pass |
| L1 GetFunctionEventInvokeConfig on beep-fleet-prod-binaries-syncer | allowed | pass |
| L1 GetFunctionEventInvokeConfig on beep-fleet-prod-heavy-scale-up | allowed | pass |
| L2 GetFunctionEventInvokeConfig on the live fleet's beep-ci-scale-up | implicitDeny | pass |
| L3 no event-invoke write on a fleet function | implicitDeny | pass |
| I1 ListPolicyTags on runner-imds-disable | allowed | pass |
| I2 ListPolicyTags on the deploy role's own managed policy | implicitDeny | pass |
| I3 SetDefaultPolicyVersion on a fleet policy | allowed | pass |
| I4 no version write on the deploy role's own ci-runners-deploy-1 | implicitDeny | pass |
| I4 no version write on the deploy role's own ci-runners-deploy-2 | implicitDeny | pass |
| I4 no version write on the deploy role's own ci-runners-deploy-3 | implicitDeny | pass |
| I5 no version write on the fleet boundary | implicitDeny | pass |
| I6 UntagInstanceProfile on a fleet profile | allowed | pass |
| I7 UntagInstanceProfile on another profile | implicitDeny | pass |
| I8 never removes a boundary, never rewrites a trust policy | implicitDeny | pass |
| I9 no attach/put/detach on the deploy role itself | implicitDeny | pass |
| S1 SSM path listing on the fleet path | allowed | pass |
| S2 SSM path listing on the live fleet's path | implicitDeny | pass |
| G1 deletion protection on a fleet log group | allowed | pass |
| G2 deletion protection on another log group | implicitDeny | pass |
| Q1 queue listing | allowed | pass |
| Q2 no queue write outside the fleet | implicitDeny | pass |
| B1 force-destroy listings on the binaries bucket | allowed | pass |
| B2 force-destroy object actions in the binaries bucket | allowed | pass |
| B3 none of the four on the state bucket | implicitDeny | pass |
| B4 none of the four on a state object | implicitDeny | pass |
| B5 none of the four on the turbo cache bucket | implicitDeny | pass |
| N1 no rule-level security group write | implicitDeny | pass |
| N2 no network interface delete | implicitDeny | pass |
| N3 no key state change | implicitDeny | pass |
| N4 no launch, no fleet call | implicitDeny | pass |

138 evaluations: pass=138 fail=0.

The earlier suite (82 cases over v1, v2, the boundary and the runner identity) re-run on the new documents gives
the same result as on the old ones: 81 pass, and the one IMDS case the simulator cannot model fails as before.
The 18 principal simulations and the role self-escalation cases run on the live role after each version is
applied.

## Coverage by resource type

One row per action per lifecycle step. "Allowed by" names the statement in `src/DeployRolePolicy.ts`; "not
granted" rows are the deliberate omissions above or calls this stack's props never reach.

### AWS.EC2.FlowLog

1 of the 72 resources: `FlowLog` (not built).

| Lifecycle | Action | Allowed by | Reach and note | Provider source |
| --- | --- | --- | --- | --- |
| create | `ec2:CreateFlowLogs` | `Ec2CreatesTagged`, `Ec2CreatesInOwnedVpc` | unconditional on first create. Unsuccessful[] errors other than FlowLogAlreadyExists are retried 15x/3s; a thrown UnauthorizedOperation is not retried. GAP (seen in run1a.log:723) on the vpc ARN, the same cause as CreateSecurityGroup. The log group destination | FlowLog.ts:301-336; Network.ts:227-235; DeployRolePolicy.ts:88-94 |
| create | `iam:PassRole` | `IamPassFleetRoles` | unconditional on create (deliverLogsPermissionArn set) The SAR operation table for CreateFlowLogs gives the value iam:PassedToService = vpc-flow-logs.amazonaws.com, which IamPassFleetRoles lists. The role ARN matches role/beep-fleet-prod-*. | FlowLog.ts:308; Network.ts:86-88,233; Names.ts:126 (flowLogRole beep-fleet-prod-flow-logs); DeployRolePolicy.t |
| tag | `ec2:CreateTags` | `Ec2TagOnCreate`, `Ec2TagOwned` | unconditional on create | FlowLog.ts:312-317; DeployRolePolicy.ts:95-103 (CreateAction=CreateFlowLogs) |
| read back | `ec2:DescribeFlowLogs` | `Ec2Reads` | unconditional | FlowLog.ts:206-210, 256-261, 289-291, 339, 355-370, 382; DeployRolePolicy.ts:87 |
| read back | `ec2:DescribeTags` | `Ec2Reads` | unconditional | FlowLog.ts:206-210, 256-261, 289-291, 339, 355-370, 382; DeployRolePolicy.ts:87 |
| update | `ec2:DeleteTags` | `Ec2TagOwned` | conditional on tag drift (no-op after tag-on-create) | FlowLog.ts:371-380; DeployRolePolicy.ts:104-110 (Ec2TagOwned) |
| update | `ec2:CreateTags` | `Ec2TagOnCreate`, `Ec2TagOwned` | conditional on tag drift (no-op after tag-on-create) | FlowLog.ts:371-380; DeployRolePolicy.ts:104-110 (Ec2TagOwned) |
| delete | `ec2:DeleteFlowLogs` | `Ec2MutateOwned` | destroy, or replace (any structural prop change, FlowLog.ts:263-280) | FlowLog.ts:386-392; DeployRolePolicy.ts:131 (Ec2MutateOwned) |
| list (not on deploy) | `ec2:DescribeFlowLogs` | `Ec2Reads` | not on the deploy path | FlowLog.ts:230-254 |

### AWS.EC2.InternetGateway

1 of the 72 resources: `InternetGateway` (built).

| Lifecycle | Action | Allowed by | Reach and note | Provider source |
| --- | --- | --- | --- | --- |
| read back | `ec2:DescribeInternetGateways` | `Ec2Reads` | unconditional when no output id Ec2Reads | InternetGateway.ts:202 (findInternetGatewayByTags, used :290, :374) |
| delete | `ec2:DescribeInternetGateways` | `Ec2Reads` | unconditional Ec2Reads | InternetGateway.ts:284, :357, :545 (findInternetGateway, used by describeInternetGateway :556, waitForInternet |
| create | `ec2:CreateInternetGateway` | `Ec2CreatesTagged` | on create Ec2CreatesTagged; only one authorized resource, request tags present. Tag-on-create covered by Ec2TagOnCreate (CreateAction=CreateInternetGateway) | InternetGateway.ts:379-387 (tags :347-352) |
| create / update (reconcile) | `ec2:AttachInternetGateway` | `Ec2MutateOwned` | unconditional on create (stack passes vpcId, Network.ts:197-200) Ec2MutateOwned aws:ResourceTag satisfied on BOTH resources: the IGW and the VPC each carry alchemy::stack=CiRunners / alchemy::stage=prod | InternetGateway.ts:412-427 |
| create / update (reconcile) | `ec2:DetachInternetGateway` | `Ec2MutateOwned` | conditional: attached VPC != news.vpcId (VPC replacement) Ec2MutateOwned; both resources stack-tagged. Would be denied only if the old VPC were not stack-owned | InternetGateway.ts:403-411 |
| update | `ec2:DeleteTags` | `Ec2TagOwned` | conditional on tag drift Ec2TagOwned | InternetGateway.ts:442-453 |
| update | `ec2:CreateTags` | `Ec2TagOnCreate`, `Ec2TagOwned` | conditional on tag drift Ec2TagOwned | InternetGateway.ts:442-453 |
| delete | `ec2:DetachInternetGateway` | `Ec2MutateOwned` | destroy / replace Ec2MutateOwned | InternetGateway.ts:481-504 |
| delete | `ec2:DescribeNetworkInterfaces` | `Ec2Reads` | conditional: only after a DependencyViolation on detach Ec2Reads; errors are swallowed anyway (orElseSucceed) | LingeringEnis.ts:59-63 (via retryWhileLingeringEnis :140) |
| delete | `ec2:DeleteNetworkInterface` | **not granted** | conditional and effectively unreachable: needs DependencyViolation AND an available ENI with InterfaceType=lambda; no function in this stack is VPC-attached (no vpcConfig in ci-runners or alchemy-github-runners src) Implicitly denied, but the denial is non-fat | LingeringEnis.ts:74-88 |
| delete | `ec2:DeleteInternetGateway` | `Ec2MutateOwned` | destroy Ec2MutateOwned | InternetGateway.ts:507-528 |
| list (not on deploy) | `ec2:DescribeVpcs` | `Ec2Reads` | not reachable in deploy (Nuke.ts:207 only) | InternetGateway.ts:305-306; defaultVpcScope.ts:26, :43, :65 |
| list (not on deploy) | `ec2:DescribeSecurityGroups` | `Ec2Reads` | not reachable in deploy (Nuke.ts:207 only) | InternetGateway.ts:305-306; defaultVpcScope.ts:26, :43, :65 |
| list (not on deploy) | `ec2:DescribeInternetGateways` | `Ec2Reads` | not reachable in deploy (Nuke.ts:207 only) | InternetGateway.ts:305-306; defaultVpcScope.ts:26, :43, :65 |

### AWS.EC2.Route

1 of the 72 resources: `PublicDefaultRoute` (not built).

| Lifecycle | Action | Allowed by | Reach and note | Provider source |
| --- | --- | --- | --- | --- |
| read back | `ec2:DescribeRouteTables` | `Ec2Reads` | unconditional Ec2Reads | Route.ts:531 (describeRoute, used :335, :368, :397) |
| create | `ec2:CreateRoute` | `Ec2MutateOwned` | unconditional on create (Network.ts:205-209) Per SAR, CreateRoute authorizes only route-table (not the internet-gateway target); route table is stack-tagged, Ec2MutateOwned allows. Becomes reachable only after the CreateRouteTable gap is fixed | Route.ts:372-384 |
| create / update (reconcile) | `ec2:ReplaceRoute` | `Ec2MutateOwned` | conditional: route already present (target update, e.g. IGW replacement, or recovery of an interrupted create) Ec2MutateOwned | Route.ts:385-394 |
| delete | `ec2:DeleteRoute` | `Ec2MutateOwned` | destroy / replace Ec2MutateOwned | Route.ts:470-484 |
| list (not on deploy) | `ec2:DescribeVpcs` | `Ec2Reads` | not in deploy | Route.ts:412-413; defaultVpcScope.ts:26,43,65 |
| list (not on deploy) | `ec2:DescribeSecurityGroups` | `Ec2Reads` | not in deploy | Route.ts:412-413; defaultVpcScope.ts:26,43,65 |
| list (not on deploy) | `ec2:DescribeRouteTables` | `Ec2Reads` | not in deploy | Route.ts:412-413; defaultVpcScope.ts:26,43,65 |

### AWS.EC2.RouteTable

1 of the 72 resources: `PublicRouteTable` (not built).

| Lifecycle | Action | Allowed by | Reach and note | Provider source |
| --- | --- | --- | --- | --- |
| read back | `ec2:DescribeRouteTables` | `Ec2Reads` | unconditional Ec2Reads. read returns undefined without output (:425), no recovery-by-tags | RouteTable.ts:427, :448, :589 (describeRouteTable, used :479, :503), :620 (waitForRouteTableDeleted) |
| create | `ec2:CreateRouteTable` | `Ec2CreatesTagged`, `Ec2CreatesInOwnedVpc` | unconditional on create (Network.ts:201-204) KNOWN GAP. route-table check passes Ec2CreatesTagged; vpc check implicitly denied (RequestTag absent). v1 and v2 identical | RouteTable.ts:460-476 (tags :441-442) |
| tag | `ec2:CreateTags` | `Ec2TagOnCreate`, `Ec2TagOwned` | on create Ec2TagOnCreate | RouteTable.ts:463-468 |
| update | `ec2:DeleteTags` | `Ec2TagOwned` | conditional on tag drift Ec2TagOwned | RouteTable.ts:488-500 |
| update | `ec2:CreateTags` | `Ec2TagOnCreate`, `Ec2TagOwned` | conditional on tag drift Ec2TagOwned | RouteTable.ts:488-500 |
| delete | `ec2:DeleteRouteTable` | `Ec2MutateOwned` | destroy Ec2MutateOwned | RouteTable.ts:554-572 |

### AWS.EC2.RouteTableAssociation

5 of the 72 resources: `PublicSubnet-us-east-1aRoute` (not built), `PublicSubnet-us-east-1bRoute` (not built), `PublicSubnet-us-east-1cRoute` (not built), `PublicSubnet-us-east-1dRoute` (not built), `PublicSubnet-us-east-1fRoute` (not built).

| Lifecycle | Action | Allowed by | Reach and note | Provider source |
| --- | --- | --- | --- | --- |
| read back | `ec2:DescribeRouteTables` | `Ec2Reads` | unconditional Ec2Reads | RouteTableAssociation.ts:228, :271, :406 (waitForAssociationState) |
| create | `ec2:AssociateRouteTable` | `Ec2MutateOwned` | unconditional on create, once per subnet (Network.ts:133-136) Ec2MutateOwned aws:ResourceTag satisfied on both route-table and subnet (both stack-tagged) | RouteTableAssociation.ts:304-322 |
| update | `ec2:ReplaceRouteTableAssociation` | **not granted** | conditional: only when the association found by its persisted associationId points to a different route table than news.routeTableId. In this stack the route table and subnet both replace on vpcId change (RouteTable.ts:374, Subnet.ts:400-412 -> RTA diff :210 r | RouteTableAssociation.ts:336-358 |
| delete | `ec2:DisassociateRouteTable` | `Ec2MutateOwned` | destroy / replace Ec2MutateOwned; both stack-tagged | RouteTableAssociation.ts:377-385 |
| list (not on deploy) | `ec2:DescribeRouteTables` | `Ec2Reads` | not in deploy | RouteTableAssociation.ts:175 |

### AWS.EC2.SecurityGroup

1 of the 72 resources: `RunnerSecurityGroup` (not built).

| Lifecycle | Action | Allowed by | Reach and note | Provider source |
| --- | --- | --- | --- | --- |
| create | `ec2:CreateSecurityGroup` | `Ec2CreatesTagged`, `Ec2CreatesInOwnedVpc` | unconditional on first create; retried 8x only on InvalidVpcID.NotFound GAP (seen in run1a.log:789). The security-group check passes on RequestTag. The vpc check cannot pass: Ec2CreatesTagged requires aws:RequestTag, which the SAR does not list on the vpc reso | node_modules/@alchemy.run/aws/src/EC2/SecurityGroup.ts:898-920; policy DeployRolePolicy.ts:88-94 (Ec2CreatesTa |
| tag | `ec2:CreateTags` | `Ec2TagOnCreate`, `Ec2TagOwned` | unconditional on create The SAR operation table lists ec2:CreateTags as the extra action for CreateSecurityGroup. | SecurityGroup.ts:903-908; DeployRolePolicy.ts:95-103 (Ec2TagOnCreate, CreateAction=CreateSecurityGroup + reque |
| read back | `ec2:DescribeSecurityGroups` | `Ec2Reads` | unconditional | SecurityGroup.ts:521-533, 535-543, 781-786, 847, 881-893, 923, 973; DeployRolePolicy.ts:87 (Ec2Reads ec2:Descr |
| read back | `ec2:DescribeSecurityGroupRules` | `Ec2Reads` | unconditional | SecurityGroup.ts:545-553, 791, 852, 950, 987-993; DeployRolePolicy.ts:87 |
| update | `ec2:RevokeSecurityGroupEgress` | `Ec2MutateOwned`, `DefaultGroupRulesFleetVpc` | unconditional on first create (the default allow-all egress is always there and not desired); on update when drift exists The new group carries the owned tags from tag-on-create, so Ec2MutateOwned matches. The SAR lists no security-group-rule resource for Revo | SecurityGroup.ts:678-701, 964-970; Network.ts:212-219; DeployRolePolicy.ts:111-140 (Ec2MutateOwned, aws:Resour |
| update | `ec2:RevokeSecurityGroupIngress` | `Ec2MutateOwned`, `DefaultGroupRulesFleetVpc` | conditional: only when an undeclared ingress rule shows up (ingress: [] is declared, and a new VPC SG has no ingress). Not reached on first create. | SecurityGroup.ts:694-701, 957-963; DeployRolePolicy.ts:111-140 |
| update | `ec2:AuthorizeSecurityGroupEgress` | `Ec2MutateOwned` | unconditional on first create The provider passes no TagSpecifications, so neither ec2:CreateTags nor the security-group-rule ARN comes into play. AWS's own example (EC2 UG 'Work with security groups') grants Authorize* on security-group/* only. If tagged rule | SecurityGroup.ts:729-741; DeployRolePolicy.ts:124 (Ec2MutateOwned) |
| update | `ec2:AuthorizeSecurityGroupIngress` | **not granted** | unreachable with this stack's props (ingress: [], Network.ts:216). The desired ingress map is empty, so 'added' is always empty. Not in any statement. This is not a gap today; it becomes one if ingress is ever declared. | SecurityGroup.ts:733-740; Network.ts:216 |
| update | `ec2:ModifySecurityGroupRules` | **not granted** | conditional: an existing egress rule matches a declared one by protocol/ports/cidr but its description differs (out-of-band edit, or a description change in runnerEgressRules). Not reached on first create, because the 5 rules are authorized with their descript | SecurityGroup.ts:703-728 |
| update | `ec2:DeleteTags` | `Ec2TagOwned` | conditional on cloud tags differing from desired. The create case is a no-op because DescribeSecurityGroups returns the tag-on-create tags. Only fails if someone strips alchemy::stack/stage out of band (the group is then no longer owned). | SecurityGroup.ts:928-946; DeployRolePolicy.ts:104-110 (Ec2TagOwned) |
| update | `ec2:CreateTags` | `Ec2TagOnCreate`, `Ec2TagOwned` | conditional on cloud tags differing from desired. The create case is a no-op because DescribeSecurityGroups returns the tag-on-create tags. Only fails if someone strips alchemy::stack/stage out of band (the group is then no longer owned). | SecurityGroup.ts:928-946; DeployRolePolicy.ts:104-110 (Ec2TagOwned) |
| delete | `ec2:DeleteSecurityGroup` | `Ec2MutateOwned` | destroy, or replace on vpcId/groupName change | SecurityGroup.ts:1003-1031; DeployRolePolicy.ts:132 (Ec2MutateOwned) |
| delete | `ec2:DescribeNetworkInterfaces` | `Ec2Reads` | only after a DependencyViolation on delete Wrapped in orElseSucceed, so it cannot fail the delete. | LingeringEnis.ts:59-63; DeployRolePolicy.ts:87 |
| delete | `ec2:DeleteNetworkInterface` | **not granted** | only on SG delete with DependencyViolation and a detached Lambda ENI in the group Not granted, but the error is swallowed (orElseSucceed at :87), so it degrades to waiting (up to about 25 min) and never fails the call. Not a blocking gap. | LingeringEnis.ts:74-88 |
| list (not on deploy) | `ec2:DescribeVpcs` | `Ec2Reads` | not called by deploy/plan for this stack | SecurityGroup.ts:798-827; defaultVpcScope.ts:25-61 |
| list (not on deploy) | `ec2:DescribeSecurityGroups` | `Ec2Reads` | not called by deploy/plan for this stack | SecurityGroup.ts:798-827; defaultVpcScope.ts:25-61 |
| list (not on deploy) | `ec2:DescribeSecurityGroupRules` | `Ec2Reads` | not called by deploy/plan for this stack | SecurityGroup.ts:798-827; defaultVpcScope.ts:25-61 |

### AWS.EC2.Subnet

5 of the 72 resources: `PublicSubnet-us-east-1a` (not built), `PublicSubnet-us-east-1b` (not built), `PublicSubnet-us-east-1c` (not built), `PublicSubnet-us-east-1d` (not built), `PublicSubnet-us-east-1f` (not built).

| Lifecycle | Action | Allowed by | Reach and note | Provider source |
| --- | --- | --- | --- | --- |
| read back | `ec2:DescribeSubnets` | `Ec2Reads` | unconditional Ec2Reads | Subnet.ts:440, :447 |
| delete | `ec2:DescribeSubnets` | `Ec2Reads` | unconditional (conflict path conditional) Ec2Reads | Subnet.ts:474, :523 (InvalidSubnet.Conflict recovery), :636, :758 (waitForSubnetAvailable), :790 (waitForSubne |
| create | `ec2:CreateSubnet` | `Ec2CreatesTagged`, `Ec2CreatesInOwnedVpc` | unconditional on create: one per configured subnet slot (Network.ts:126-132) KNOWN GAP. subnet check passes Ec2CreatesTagged; vpc check: Ec2CreatesTagged requires aws:RequestTag which is not in the vpc resource context -> implicit deny. No other statement gran | Subnet.ts:483-502 (tags :466-467) |
| tag | `ec2:CreateTags` | `Ec2TagOnCreate`, `Ec2TagOwned` | on create Ec2TagOnCreate | Subnet.ts:495-500 |
| create / update (reconcile) | `ec2:ModifySubnetAttribute` | `Ec2MutateOwned` | conditional on drift only: stack sets mapPublicIpOnLaunch: false (Network.ts:130) = default; assignIpv6/enableDns64 unset -> false = default; hostnameType/enableResourceName* unset so the :594 guard blocks the call Ec2MutateOwned; subnet is the only authorized | Subnet.ts:559-565, :568-574, :577-583, :594-612 |
| update | `ec2:DeleteTags` | `Ec2TagOwned` | conditional on tag drift Ec2TagOwned | Subnet.ts:619-633 |
| update | `ec2:CreateTags` | `Ec2TagOnCreate`, `Ec2TagOwned` | conditional on tag drift Ec2TagOwned | Subnet.ts:619-633 |
| delete | `ec2:DeleteSubnet` | `Ec2MutateOwned` | destroy / replace; ENI reap only on DependencyViolation with lambda ENIs (none expected) DeleteSubnet allowed by Ec2MutateOwned. DeleteNetworkInterface implicitly denied but swallowed (LingeringEnis.ts:87) - non-fatal | Subnet.ts:678-693; LingeringEnis.ts:59-88 |
| delete | `ec2:DescribeNetworkInterfaces` | `Ec2Reads` | destroy / replace; ENI reap only on DependencyViolation with lambda ENIs (none expected) DeleteSubnet allowed by Ec2MutateOwned. DeleteNetworkInterface implicitly denied but swallowed (LingeringEnis.ts:87) - non-fatal | Subnet.ts:678-693; LingeringEnis.ts:59-88 |
| delete | `ec2:DeleteNetworkInterface` | **not granted** | destroy / replace; ENI reap only on DependencyViolation with lambda ENIs (none expected) DeleteSubnet allowed by Ec2MutateOwned. DeleteNetworkInterface implicitly denied but swallowed (LingeringEnis.ts:87) - non-fatal | Subnet.ts:678-693; LingeringEnis.ts:59-88 |
| list (not on deploy) | `ec2:DescribeSubnets` | `Ec2Reads` | not in deploy | Subnet.ts:652 |

### AWS.EC2.VPC

1 of the 72 resources: `Vpc` (built).

| Lifecycle | Action | Allowed by | Reach and note | Provider source |
| --- | --- | --- | --- | --- |
| read back | `ec2:DescribeVpcs` | `Ec2Reads` | unconditional Ec2Reads ec2:Describe* on * (DeployRolePolicy.ts:87) | node_modules/@alchemy.run/aws/src/EC2/Vpc.ts:438 (findVpcByInstanceTags, used at :495 and :540); engine read c |
| delete | `ec2:DescribeVpcs` | `Ec2Reads` | unconditional Ec2Reads | Vpc.ts:492, :534, :641, :738 (waitForVpcAvailable), :770 (waitForVpcDeleted) |
| read back | `ec2:DescribeVpcAttribute` | `Ec2Reads` | unconditional whenever a VPC is found Resource-level action, but Ec2Reads grants ec2:Describe* on Resource * with no condition, so the vpc check passes | Vpc.ts:448-449 (called from read :500, lookup :485) |
| create / update (reconcile) | `ec2:DescribeVpcAttribute` | `Ec2Reads` | unconditional Ec2Reads | Vpc.ts:593, Vpc.ts:606 |
| create | `ec2:CreateVpc` | `Ec2CreatesTagged` | only when no VPC is persisted or recoverable; stack passes cidrBlock only (Network.ts:190-195), so ipam-pool/ipv6pool are not authorized Ec2CreatesTagged (DeployRolePolicy.ts:88-94): request tags present on the only authorized resource (vpc). Would fail on ipa | Vpc.ts:548-568 (tags built :521-524 from createInternalTags, alchemy/src/Tags.ts:39-47) |
| tag | `ec2:CreateTags` | `Ec2TagOnCreate`, `Ec2TagOwned` | on create Ec2TagOnCreate (DeployRolePolicy.ts:95-103) | Vpc.ts:561-566 |
| create / update (reconcile) | `ec2:ModifyVpcAttribute` | `Ec2MutateOwned` | unconditional on first create: stack sets enableDnsHostnames: true (Network.ts:192) and a new VPC defaults to false Ec2MutateOwned aws:ResourceTag; the VPC carries alchemy::stack/stage from TagSpecifications. Consistent with first deploy reaching CreateSubnet  | Vpc.ts:611-617 |
| update | `ec2:DeleteTags` | `Ec2TagOwned` | conditional: only when observed tags contain keys not in desired Ec2TagOwned (DeployRolePolicy.ts:104-110); fails by design if ownership tags were stripped out of band | Vpc.ts:624-630 |
| update | `ec2:CreateTags` | `Ec2TagOnCreate`, `Ec2TagOwned` | conditional: tag drift, or recovery adoption via alchemy::instance (tags already match then) Ec2TagOwned | Vpc.ts:631-637 |
| delete | `ec2:DeleteVpc` | `Ec2MutateOwned` | destroy / replace Ec2MutateOwned | Vpc.ts:682-706 |
| list (not on deploy) | `ec2:DescribeVpcs` | `Ec2Reads` | not reachable in deploy (list only called from alchemy/src/Nuke.ts:207) | Vpc.ts:662 |

### AWS.EventBridge.Rule

7 of the 72 resources: `ReaperSchedule` (not built), `Runners/InstanceStateChangeRule` (not built), `Runners/Poolheavy/ScaleDownSchedule` (not built), `Runners/Pooloverflow/ScaleDownSchedule` (not built), `Runners/RunnerBinariesSyncerSchedule` (not built), `Runners/SpotInterruptionRule` (not built), `Runners/SsmHousekeeperSchedule` (not built).

| Lifecycle | Action | Allowed by | Reach and note | Provider source |
| --- | --- | --- | --- | --- |
| read back | `events:DescribeRule` | `EventsFleetRules` | unconditional on read (Plan.ts:1749/1887, Apply.ts:238). ResourceNotFoundException is caught. AccessDenied is not caught. Every prod rule name is pinned under rule/beep-fleet-prod-* (CiRunners.ts:148 namePrefix=beep-fleet-prod; Reaper schedule CiRunners.ts:186 | node_modules/@alchemy.run/aws/src/EventBridge/Rule.ts:363-368 |
| read back | `events:ListTagsForResource` | `EventsFleetRules` | only when DescribeRule finds the rule | node_modules/@alchemy.run/aws/src/EventBridge/Rule.ts:376-378 |
| read back | `events:ListTargetsByRule` | `EventsFleetRules` | unconditional in reconcile, and in read when the rule exists | node_modules/@alchemy.run/aws/src/EventBridge/Rule.ts:322-329 (called from 383 and 589) |
| update | `events:PutRule` | `EventsFleetRules` | unconditional. The stack never sets roleArn, so no iam:PassRole is needed. Policy statement has no conditions, so no unsatisfiable RequestTag check. Same in v1 and v2. | node_modules/@alchemy.run/aws/src/EventBridge/Rule.ts:494-503 |
| update | `events:TagResource` | `EventsFleetRules` | unconditional. The stack never sets roleArn, so no iam:PassRole is needed. Policy statement has no conditions, so no unsatisfiable RequestTag check. Same in v1 and v2. | node_modules/@alchemy.run/aws/src/EventBridge/Rule.ts:494-503 |
| update | `iam:PassRole` | `IamPassFleetRoles` | unconditional. The stack never sets roleArn, so no iam:PassRole is needed. Policy statement has no conditions, so no unsatisfiable RequestTag check. Same in v1 and v2. | node_modules/@alchemy.run/aws/src/EventBridge/Rule.ts:494-503 |
| create / update (reconcile) | `events:ListTargetsByRule` | `EventsFleetRules` | unconditional | node_modules/@alchemy.run/aws/src/EventBridge/Rule.ts:513-523 |
| create / update (reconcile) | `events:RemoveTargets` | `EventsFleetRules` | conditional: only when live targets that are no longer desired exist (not on first create) | node_modules/@alchemy.run/aws/src/EventBridge/Rule.ts:528-540 |
| create / update (reconcile) | `events:PutTargets` | `EventsFleetRules` | unconditional (every rule has one Lambda target). Targets carry no RoleArn (Reaper.ts:229-233, RunnerFleet.ts:205-209, 755-759), so there is no PassRole. The Lambda invoke grant is a separate Lambda.Permission (lambda:AddPermission), which is outside this area | node_modules/@alchemy.run/aws/src/EventBridge/Rule.ts:542-549 |
| create / update (reconcile) | `iam:PassRole` | `IamPassFleetRoles` | unconditional (every rule has one Lambda target). Targets carry no RoleArn (Reaper.ts:229-233, RunnerFleet.ts:205-209, 755-759), so there is no PassRole. The Lambda invoke grant is a separate Lambda.Permission (lambda:AddPermission), which is outside this area | node_modules/@alchemy.run/aws/src/EventBridge/Rule.ts:542-549 |
| create / update (reconcile) | `events:ListTagsForResource` | `EventsFleetRules` | unconditional, on the RuleArn PutRule returned | node_modules/@alchemy.run/aws/src/EventBridge/Rule.ts:553-557 |
| create / update (reconcile) | `events:UntagResource` | `EventsFleetRules` | conditional: only when the observed tags hold keys that are not desired | node_modules/@alchemy.run/aws/src/EventBridge/Rule.ts:566-571 |
| create / update (reconcile) | `events:TagResource` | `EventsFleetRules` | conditional: only when observed tags differ (not after a tagged PutRule create) | node_modules/@alchemy.run/aws/src/EventBridge/Rule.ts:573-578 |
| create / update (reconcile) | `events:DescribeRule` | `EventsFleetRules` | unconditional (no catch) | node_modules/@alchemy.run/aws/src/EventBridge/Rule.ts:581-584 |
| delete | `events:ListTargetsByRule` | `EventsFleetRules` | only on destroy, replace (a name or bus change) or removal from the program | node_modules/@alchemy.run/aws/src/EventBridge/Rule.ts:601-630 |
| delete | `events:RemoveTargets` | `EventsFleetRules` | only on destroy, replace (a name or bus change) or removal from the program | node_modules/@alchemy.run/aws/src/EventBridge/Rule.ts:601-630 |
| delete | `events:DeleteRule` | `EventsFleetRules` | only on destroy, replace (a name or bus change) or removal from the program | node_modules/@alchemy.run/aws/src/EventBridge/Rule.ts:601-630 |
| list (not on deploy) | `events:ListEventBuses` | **not granted** | no: provider.list is used only by Nuke.ts/Drift.ts, never by Plan/Apply. The deploy workflow runs only plan-check plan/deploy (.github/workflows/deploy-ci-runners.yml:123-152). This is not a deploy gap. It would fail under `alchemy drift` or `nuke` run as this | node_modules/@alchemy.run/aws/src/EventBridge/Rule.ts:391-474 |
| list (not on deploy) | `events:ListRules` | **not granted** | no: provider.list is used only by Nuke.ts/Drift.ts, never by Plan/Apply. The deploy workflow runs only plan-check plan/deploy (.github/workflows/deploy-ci-runners.yml:123-152). This is not a deploy gap. It would fail under `alchemy drift` or `nuke` run as this | node_modules/@alchemy.run/aws/src/EventBridge/Rule.ts:391-474 |

### AWS.IAM.InstanceProfile

2 of the 72 resources: `Runners/Poolheavy/RunnerInstanceProfile` (not built), `Runners/Pooloverflow/RunnerInstanceProfile` (not built).

| Lifecycle | Action | Allowed by | Reach and note | Provider source |
| --- | --- | --- | --- | --- |
| delete | `iam:GetInstanceProfile` | `IamFleetProfiles` | unconditional IamFleetProfiles; names beep-fleet-prod-{heavy,overflow}-runner, path '/'. | InstanceProfile.ts:130 |
| create | `iam:CreateInstanceProfile` | `IamFleetProfiles` | when absent IamFleetProfiles grants both. | InstanceProfile.ts:239-244 |
| create | `iam:TagInstanceProfile` | `IamFleetProfiles` | when absent IamFleetProfiles grants both. | InstanceProfile.ts:239-244 |
| create / update (reconcile) | `iam:AddRoleToInstanceProfile` | `IamFleetProfiles` | when the profile has no role or a different one (always on create) IamFleetProfiles plus IamPassFleetRoles (role beep-fleet-prod-<pool>-runner matches beep-fleet-prod-*, and ec2.amazonaws.com is in the PassedToService list). | InstanceProfile.ts:155-158 |
| create / update (reconcile) | `iam:PassRole` | `IamPassFleetRoles` | when the profile has no role or a different one (always on create) IamFleetProfiles plus IamPassFleetRoles (role beep-fleet-prod-<pool>-runner matches beep-fleet-prod-*, and ec2.amazonaws.com is in the PassedToService list). | InstanceProfile.ts:155-158 |
| create / update (reconcile) | `iam:PassedToService` | **not granted** | when the profile has no role or a different one (always on create) IamFleetProfiles plus IamPassFleetRoles (role beep-fleet-prod-<pool>-runner matches beep-fleet-prod-*, and ec2.amazonaws.com is in the PassedToService list). | InstanceProfile.ts:155-158 |
| delete | `iam:RemoveRoleFromInstanceProfile` | `IamFleetProfiles` | reconcile: only when the role changes; delete: once per attached role IamFleetProfiles | InstanceProfile.ts:148, :321 |
| create / update (reconcile) | `iam:TagInstanceProfile` | `IamFleetProfiles` | conditional on tag diff IamFleetProfiles | InstanceProfile.ts:285 |
| create / update (reconcile) | `iam:UntagInstanceProfile` | `IamFleetProfiles` | conditional: the live profile carries a tag key the desired set (internal alchemy:: tags only; RunnerFleet.ts:390 passes no tags) lacks, through out-of-band tagging or adoption GAP | InstanceProfile.ts:290-294 |
| delete | `iam:DeleteInstanceProfile` | `IamFleetProfiles` | on delete IamFleetProfiles | InstanceProfile.ts:328-332 |
| list (not on deploy) | `iam:ListInstanceProfiles` | **not granted** | not reachable in deploy (Nuke.ts:207 only) | InstanceProfile.ts:179 |

### AWS.IAM.Policy

1 of the 72 resources: `ImdsDisablePolicy` (exists, state `creating`).

| Lifecycle | Action | Allowed by | Reach and note | Provider source |
| --- | --- | --- | --- | --- |
| read back | `iam:GetPolicy` | `IamFleetPolicies` | unconditional IamFleetPolicies; ARN arn:aws:iam::<account>:policy/beep-fleet/prod/beep-fleet-prod-runner-imds-disable | Policy.ts:270 (called from :295, :432, :450, :515) |
| read back | `iam:ListPolicyTags` | `IamFleetPolicies` | unconditional: read :300, reconcile tag sync :496 after every create/update, and the EntityAlreadyExists adopt path :456 GAP (the observed failure). | Policy.ts:300, :456, :496 (and :361 in list) |
| read back | `iam:GetPolicyVersion` | `IamFleetPolicies` | unconditional IamFleetPolicies | Policy.ts:286 |
| create | `iam:CreatePolicy` | `IamFleetPolicies` | when absent IamFleetPolicies grants both, no condition. | Policy.ts:439-446 |
| create | `iam:TagPolicy` | `IamFleetPolicies` | when absent IamFleetPolicies grants both, no condition. | Policy.ts:439-446 |
| update | `iam:ListPolicyVersions` | `IamFleetPolicies` | conditional: the document changed (Policy.ts:479); DeletePolicyVersion only when there are 5 or more versions IamFleetPolicies | Policy.ts:328, :338 |
| update | `iam:DeletePolicyVersion` | `IamFleetPolicies` | conditional: the document changed (Policy.ts:479); DeletePolicyVersion only when there are 5 or more versions IamFleetPolicies | Policy.ts:328, :338 |
| update | `iam:CreatePolicyVersion` | `IamFleetPolicies` | conditional: JSON.stringify(observed doc) differs from JSON.stringify(news.policyDocument). This is a raw comparison, not normalizePolicyDocument. IamFleetPolicies | Policy.ts:479-485 |
| update | `iam:SetDefaultPolicyVersion` | `IamFleetPolicies` | conditional, same branch as CreatePolicyVersion: runs whenever imdsDisablePolicyDocument (RunnerBootstrap.ts:465) changes, or whenever IAM returns the document in a different key or array form. The first deploy failed at ListPolicyTags (:496), which comes afte | Policy.ts:486-491 |
| create / update (reconcile) | `iam:TagPolicy` | `IamFleetPolicies` | conditional on tag diff (unreachable today because :496 fails first) IamFleetPolicies | Policy.ts:502, :508 |
| create / update (reconcile) | `iam:UntagPolicy` | `IamFleetPolicies` | conditional on tag diff (unreachable today because :496 fails first) IamFleetPolicies | Policy.ts:502, :508 |
| delete | `iam:ListPolicyVersions` | `IamFleetPolicies` | on delete beta.87 Policy.delete makes no ListEntitiesForPolicy call (grep finds it only in actions.generated.ts:9117). DeletePolicy relies on RunnerRole having detached the policy, which is blocked by the Role.delete gaps. | Policy.ts:539-558 |
| delete | `iam:DeletePolicyVersion` | `IamFleetPolicies` | on delete beta.87 Policy.delete makes no ListEntitiesForPolicy call (grep finds it only in actions.generated.ts:9117). DeletePolicy relies on RunnerRole having detached the policy, which is blocked by the Role.delete gaps. | Policy.ts:539-558 |
| delete | `iam:DeletePolicy` | `IamFleetPolicies` | on delete beta.87 Policy.delete makes no ListEntitiesForPolicy call (grep finds it only in actions.generated.ts:9117). DeletePolicy relies on RunnerRole having detached the policy, which is blocked by the Role.delete gaps. | Policy.ts:539-558 |
| list (not on deploy) | `iam:ListPolicies` | **not granted** | not reachable in deploy (Nuke.ts:207 only) | Policy.ts:350 |

### AWS.IAM.Role

3 of the 72 resources: `FlowLogsRole` (built), `Runners/Poolheavy/RunnerRole` (not built), `Runners/Pooloverflow/RunnerRole` (not built).

| Lifecycle | Action | Allowed by | Reach and note | Provider source |
| --- | --- | --- | --- | --- |
| delete | `iam:GetRole` | `IamFleetRoleReads` | unconditional IamFleetRoleReads. Covers roles beep-fleet-prod-flow-logs and beep-fleet-prod-{heavy,overflow}-runner, path '/'. | node_modules/@alchemy.run/aws/src/IAM/Role.ts:494, :566, :586, :681, :759 |
| create | `iam:CreateRole` | `IamFleetRoleBounded` | unconditional when the role is absent IamFleetRoleBounded passes because all three roles pass permissionsBoundary: Network.ts:89, and RunnerFleet.ts:358 through CiRunners.ts:159. The dependent TagRole is allowed by IamFleetRoleMetadata without a condition. | Role.ts:574-582 |
| create | `iam:TagRole` | `IamFleetRoleMetadata` | unconditional when the role is absent IamFleetRoleBounded passes because all three roles pass permissionsBoundary: Network.ts:89, and RunnerFleet.ts:358 through CiRunners.ts:159. The dependent TagRole is allowed by IamFleetRoleMetadata without a condition. | Role.ts:574-582 |
| create / update (reconcile) | `iam:UpdateAssumeRolePolicy` | **not granted** | conditional: runs when the normalized live trust document differs from the desired one (Role.ts:603-607). This should not happen on create, because the CreateRole response is normalized with sorted keys and single-item arrays collapsed. It does happen on trust | Role.ts:608-613 |
| create / update (reconcile) | `iam:UpdateRole` | `IamFleetRoleMetadata` | effectively every reconcile: the stack sets neither description nor maxSessionDuration, so desired = undefined while IAM returns MaxSessionDuration 3600, and the check at Role.ts:617-619 is true IamFleetRoleMetadata, no condition. | Role.ts:621-625 |
| create / update (reconcile) | `iam:PutRolePermissionsBoundary` | `IamFleetRoleBounded` | conditional: live boundary differs from news.permissionsBoundary (drift only) IamFleetRoleBounded; the requested ARN is the prod boundary. | Role.ts:630-635 |
| create / update (reconcile) | `iam:DeleteRolePermissionsBoundary` | **not granted** | not reachable: only when news.permissionsBoundary is unset, and every role in this stack sets it | Role.ts:636-641 |
| delete | `iam:DeleteRolePermissionsBoundary` | **not granted** | unconditional on every Role delete (destroy, replace, or removing the role from the graph). Only NoSuchEntityException is caught, so AccessDenied aborts the delete. GAP: the first IAM call of Role.delete. | Role.ts:704-708 |
| delete | `iam:ListRolePolicies` | `IamFleetRoleReads` | unconditional IamFleetRoleReads | Role.ts:286, :710 |
| read back | `iam:GetRolePolicy` | `IamFleetRoleReads` | unconditional, once per inline policy IamFleetRoleReads | Role.ts:292 |
| delete | `iam:ListAttachedRolePolicies` | `IamFleetRoleReads` | unconditional IamFleetRoleReads | Role.ts:311, :724 |
| read back | `iam:ListRoleTags` | `IamFleetRoleReads` | unconditional IamFleetRoleReads | Role.ts:321 (called from :505, :665) |
| create / update (reconcile) | `iam:AttachRolePolicy` | `IamFleetRoleAttach` | RunnerRole only: managedPolicyArns = [imds-disable policy] (RunnerFleet.ts:361, CiRunners.ts:156). FlowLogsRole sets none. IamFleetRoleAttach: the policy ARN arn:aws:iam::<account>:policy/beep-fleet/prod/beep-fleet-prod-runner-imds-disable matches the ArnLike, | Role.ts:341-344 |
| create / update (reconcile) | `iam:DetachRolePolicy` | `IamFleetRoleBounded` | conditional: an attached policy is no longer desired (drift or removal) IamFleetRoleBounded; the role still carries the boundary at this point. | Role.ts:350-355 |
| create / update (reconcile) | `iam:PutRolePolicy` | `IamFleetRoleBounded` | conditional on the inline document differing; always on first create (flow-logs, runner) IamFleetRoleBounded | Role.ts:375-379 |
| create / update (reconcile) | `iam:DeleteRolePolicy` | `IamFleetRoleBounded` | conditional: a live inline policy is no longer desired IamFleetRoleBounded | Role.ts:385-390 |
| delete | `iam:DeleteRolePolicy` | `IamFleetRoleBounded` | unconditional on delete for a role with inline policies (all three roles have them) GAP / unsatisfiable condition: IamFleetRoleBounded needs StringEquals iam:PermissionsBoundary, but Role.delete has already removed the boundary, so the key is missing and the s | Role.ts:710-722 |
| delete | `iam:DetachRolePolicy` | `IamFleetRoleBounded` | on RunnerRole delete (imds-disable policy is attached) GAP / unsatisfiable condition, same reason as DeleteRolePolicy at :713. | Role.ts:724-736 |
| create / update (reconcile) | `iam:TagRole` | `IamFleetRoleMetadata` | conditional on tag diff IamFleetRoleMetadata, no condition. | Role.ts:668, :674 |
| create / update (reconcile) | `iam:UntagRole` | `IamFleetRoleMetadata` | conditional on tag diff IamFleetRoleMetadata, no condition. | Role.ts:668, :674 |
| delete | `iam:DeleteRole` | `IamFleetRoleMetadata` | on delete; unreachable today because :705 fails first IamFleetRoleMetadata. Role.delete in beta.87 does not remove the role from instance profiles (no ListInstanceProfilesForRole/RemoveRoleFromInstanceProfile in Role.ts), so it relies on InstanceProfile being  | Role.ts:739-752 |
| list (not on deploy) | `iam:ListRoles` | **not granted** | not reachable in deploy: provider.list is called only from alchemy/src/Nuke.ts:207 | Role.ts:403 |

### AWS.KMS.Alias

1 of the 72 resources: `Runners/SecretsKeyAlias` (built).

| Lifecycle | Action | Allowed by | Reach and note | Provider source |
| --- | --- | --- | --- | --- |
| delete | `kms:ListAliases` | `KmsListAliases` | unconditional (Apply read on create, Alias.ts:110; reconcile :123,:138,:153; delete poll :170) CloudTrail ok x3. | node_modules/@alchemy.run/aws/src/KMS/Alias.ts:207; DeployRolePolicy.ts:700 KmsListAliases |
| create / update (reconcile) | `kms:DescribeKey` | `KmsOwnedKeys` | unconditional on every reconcile | node_modules/@alchemy.run/aws/src/KMS/Alias.ts:221; DeployRolePolicy.ts:669 |
| create | `kms:CreateAlias` | `KmsOwnedKeys`, `KmsFleetAliases` | when ListAliases does not find the alias CloudTrail CreateAlias ok 01:19:37Z. | node_modules/@alchemy.run/aws/src/KMS/Alias.ts:127; alias check DeployRolePolicy.ts:702 KmsFleetAliases (no co |
| update | `kms:UpdateAlias` | `KmsOwnedKeys`, `KmsFleetAliases` | conditional: readAlias returns undefined right after create, or the target key changes (key replaced) Both keys would be stack-owned tagged keys. An alias pointing at a foreign untagged key would be denied, which cannot happen with this stack. | node_modules/@alchemy.run/aws/src/KMS/Alias.ts:143; DeployRolePolicy.ts:702 + :669 |
| delete | `kms:DeleteAlias` | `KmsOwnedKeys`, `KmsFleetAliases` | destroy / alias-name change | node_modules/@alchemy.run/aws/src/KMS/Alias.ts:165; DeployRolePolicy.ts:702 + :669 |

### AWS.KMS.Key

1 of the 72 resources: `Runners/SecretsKey` (built).

| Lifecycle | Action | Allowed by | Reach and note | Provider source |
| --- | --- | --- | --- | --- |
| create | `kms:CreateKey` | `KmsCreateTagged` | unconditional on create/replace Condition keys available: aws:RequestTag, aws:TagKeys, kms:KeySpec/KeyUsage/MultiRegion/BypassPolicyLockoutSafetyCheck. RequestTag+ForAllValues TagKeys satisfied (internal tags are exactly the 3 alchemy keys, alchemy/src/Tags.ts | node_modules/@alchemy.run/aws/src/KMS/Key.ts:296; policy DeployRolePolicy.ts:659 KmsCreateTagged |
| create | `kms:TagResource` | `KmsCreateTagged` | unconditional on create Proven by the successful CreateKey in cloudtrail-1a-session.json. | node_modules/@alchemy.run/aws/src/KMS/Key.ts:302; DeployRolePolicy.ts:659 |
| delete | `kms:DescribeKey` | `KmsOwnedKeys` | unconditional (read only when output.keyId exists, Key.ts:243; post-create Key.ts:310; converge Key.ts:531 twice; delete poll Key.ts:454) Tag-ABAC: KMS docs say tag changes can take up to 5 min to affect authorization; the post-create repeat (Key.ts:310-316) o | node_modules/@alchemy.run/aws/src/KMS/Key.ts:484 (readKey), :454; DeployRolePolicy.ts:669 KmsOwnedKeys |
| read back | `kms:ListResourceTags` | `KmsOwnedKeys` | unconditional CloudTrail ok. | node_modules/@alchemy.run/aws/src/KMS/Key.ts:587 (from readKey :498 and reconcile :397); DeployRolePolicy.ts:6 |
| read back | `kms:GetKeyRotationStatus` | `KmsOwnedKeys` | unconditional AccessDenied is not in its catchTags. | node_modules/@alchemy.run/aws/src/KMS/Key.ts:596; DeployRolePolicy.ts:669 |
| read back | `kms:GetKeyPolicy` | `KmsOwnedKeys` | unconditional | node_modules/@alchemy.run/aws/src/KMS/Key.ts:610; DeployRolePolicy.ts:669 |
| update | `kms:EnableKeyRotation` | `KmsOwnedKeys` | when observed keyRotationEnabled !== true: always on create; on update only after drift CloudTrail ok. | node_modules/@alchemy.run/aws/src/KMS/Key.ts:369; DeployRolePolicy.ts:669 |
| update | `kms:TagResource` | `KmsCreateTagged` | conditional: observed tags differ from the 3 internal tags (drift only); stack passes no tags prop Upserted keys are always a subset of the 3 alchemy keys with the stack values, so RequestTag and TagKeys hold. | node_modules/@alchemy.run/aws/src/KMS/Key.ts:401; DeployRolePolicy.ts:659 KmsCreateTagged (Resource *) |
| update | `kms:UntagResource` | **not granted** | conditional: someone adds a non-alchemy tag to the key out of band (removed = observed keys not in desiredTags) | node_modules/@alchemy.run/aws/src/KMS/Key.ts:414; no grant in DeployRolePolicy.ts (comment at :654-657 says no |
| update | `kms:UpdateKeyDescription` | **not granted** | conditional: observed description != 'GitHub App secrets of runner fleet beep-fleet-prod' (out-of-band edit, or a code change to RunnerFleet.ts:303 / props.name). Not reached on create (CreateKey sets it) | node_modules/@alchemy.run/aws/src/KMS/Key.ts:325; no grant |
| update | `kms:CancelKeyDeletion` | **not granted** | conditional: the persisted key is in PendingDeletion (scheduled out of band) | node_modules/@alchemy.run/aws/src/KMS/Key.ts:290; no grant |
| update | `kms:EnableKey` | **not granted** | conditional: key disabled out of band (enabled defaults to true) | node_modules/@alchemy.run/aws/src/KMS/Key.ts:338; no grant |
| create / update (reconcile) | `kms:PutKeyPolicy` | **not granted** | unreachable: stack sets no policy prop (desiredPolicy undefined, Key.ts:272-277,346) | node_modules/@alchemy.run/aws/src/KMS/Key.ts:347 |
| create / update (reconcile) | `kms:DisableKeyRotation` | **not granted** | unreachable: enableKeyRotation is true (RunnerFleet.ts:304) | node_modules/@alchemy.run/aws/src/KMS/Key.ts:380 |
| create / update (reconcile) | `kms:DisableKey` | **not granted** | unreachable: enabled not set (defaults true) | node_modules/@alchemy.run/aws/src/KMS/Key.ts:389 |
| delete | `kms:ScheduleKeyDeletion` | **not granted** | conditional: destroy, removing the key from the program, or a replace (keyUsage/keySpec/multiRegion change, Key.ts:254-259; none changes today) | node_modules/@alchemy.run/aws/src/KMS/Key.ts:442; no grant (deliberate per DeployRolePolicy.ts:654-657) |
| list (not on deploy) | `kms:ListKeys` | **not granted** | only from alchemy/src/Nuke.ts:207; not on deploy | node_modules/@alchemy.run/aws/src/KMS/Key.ts:206 |

### AWS.Lambda.EventSourceMapping

5 of the 72 resources: `Runners/DeregisterRetrySource` (not built), `Runners/Poolheavy/JobRetrySource` (not built), `Runners/Poolheavy/ScaleUpSource` (not built), `Runners/Pooloverflow/JobRetrySource` (not built), `Runners/Pooloverflow/ScaleUpSource` (not built).

| Lifecycle | Action | Allowed by | Reach and note | Provider source |
| --- | --- | --- | --- | --- |
| read back | `lambda:ListEventSourceMappings` | `LambdaMappingsRead` | unconditional on first create / interrupted create | ESM:734, ESM:836, ESM:871 |
| read back | `lambda:ListTags` | `LambdaFleetFunctions`, `LambdaMappingsRead` | unconditional after create LambdaMappingsRead Resource * | ESM:706, ESM:846, ESM:879, ESM:975 |
| read back | `lambda:GetEventSourceMapping` | `LambdaMappingsRead` | after create when state != Enabled; with output.uuid | ESM:728, ESM:824, ESM:948, ESM:967 |
| create / update (reconcile) | `lambda:CreateEventSourceMapping` | `LambdaMappingsCreate` | unconditional (3 mappings per deploy: ScaleUpSource x2 pools, JobRetrySource x2, DeregisterRetrySource) Never exercised (CloudTrail has no CreateEventSourceMapping). LambdaMappingsCreate's aws:RequestTag holds. Whether lambda:FunctionArn is the resolved ARN wh | ESM:867 |
| create / update (reconcile) | `lambda:TagResource` | `LambdaFleetFunctions`, `LambdaMappingsTagOnCreate` | unconditional (3 mappings per deploy: ScaleUpSource x2 pools, JobRetrySource x2, DeregisterRetrySource) Never exercised (CloudTrail has no CreateEventSourceMapping). LambdaMappingsCreate's aws:RequestTag holds. Whether lambda:FunctionArn is the resolved ARN wh | ESM:867 |
| create | `lambda:UpdateEventSourceMapping` | `LambdaMappingsOwned` | unconditional LambdaMappingsOwned: ResourceTag present after create; same lambda:FunctionArn bare-name caveat | ESM:927 |
| tag | `lambda:TagResource` | `LambdaFleetFunctions`, `LambdaMappingsTagOnCreate` | only if observed tags differ from desired; after a tagged create they match -> normally unreachable TagResource allowed (LambdaMappingsTagOnCreate); UntagResource on a mapping is not granted anywhere (LambdaFleetFunctions grants it only on function ARNs) | ESM:995, ESM:986 |
| tag | `lambda:UntagResource` | `LambdaFleetFunctions` | only if observed tags differ from desired; after a tagged create they match -> normally unreachable TagResource allowed (LambdaMappingsTagOnCreate); UntagResource on a mapping is not granted anywhere (LambdaFleetFunctions grants it only on function ARNs) | ESM:995, ESM:986 |
| delete | `lambda:DeleteEventSourceMapping` | `LambdaMappingsOwned` | on destroy/replace LambdaMappingsOwned | ESM:712 via ESM:1006, ESM:943 |

### AWS.Lambda.Function

11 of the 72 resources: `Reaper` (exists, state `creating`), `Runners/Poolheavy/JobRetry` (not built), `Runners/Poolheavy/ScaleDown` (not built), `Runners/Poolheavy/ScaleUp` (not built), `Runners/Pooloverflow/JobRetry` (not built), `Runners/Pooloverflow/ScaleDown` (not built), `Runners/Pooloverflow/ScaleUp` (not built), `Runners/RunnerBinariesSyncer` (exists, state `creating`), `Runners/SsmHousekeeper` (exists, state `creating`), `Runners/TerminationWatcher` (exists, state `creating`), `Runners/Webhook` (exists, state `creating`).

| Lifecycle | Action | Allowed by | Reach and note | Provider source |
| --- | --- | --- | --- | --- |
| create / update (reconcile) (execution role cross-reference) | `iam:GetRole` | `IamFleetRoleReads` | unconditional for all 8 functions; every one passes the boundary (RunnerFleet.ts:473, 613, 634, 678, 722; Reaper.ts:220) iam:PolicyARN is in the IamFleetRoleAttach ArnLike list. | node_modules/@alchemy.run/aws/src/Lambda/Function.ts:1735, :1742-1761, :1770, :1777-1782 |
| create / update (reconcile) (execution role cross-reference) | `iam:CreateRole` | `IamFleetRoleBounded` | unconditional for all 8 functions; every one passes the boundary (RunnerFleet.ts:473, 613, 634, 678, 722; Reaper.ts:220) iam:PolicyARN is in the IamFleetRoleAttach ArnLike list. | node_modules/@alchemy.run/aws/src/Lambda/Function.ts:1735, :1742-1761, :1770, :1777-1782 |
| create / update (reconcile) (execution role cross-reference) | `iam:PutRolePermissionsBoundary` | `IamFleetRoleBounded` | unconditional for all 8 functions; every one passes the boundary (RunnerFleet.ts:473, 613, 634, 678, 722; Reaper.ts:220) iam:PolicyARN is in the IamFleetRoleAttach ArnLike list. | node_modules/@alchemy.run/aws/src/Lambda/Function.ts:1735, :1742-1761, :1770, :1777-1782 |
| create / update (reconcile) (execution role cross-reference) | `iam:AttachRolePolicy` | `IamFleetRoleAttach` | unconditional for all 8 functions; every one passes the boundary (RunnerFleet.ts:473, 613, 634, 678, 722; Reaper.ts:220) iam:PolicyARN is in the IamFleetRoleAttach ArnLike list. | node_modules/@alchemy.run/aws/src/Lambda/Function.ts:1735, :1742-1761, :1770, :1777-1782 |
| delete (execution role cross-reference) | `iam:PutRolePolicy` | `IamFleetRoleBounded` | unconditional / on delete IamFleetRoleBounded / IamFleetRoleReads / IamFleetRoleMetadata | Lambda/Function.ts:1665, :1675, :1710, :1824, :1831, :2005, :2025, :3393-3452 |
| delete (execution role cross-reference) | `iam:DeleteRolePolicy` | `IamFleetRoleBounded` | unconditional / on delete IamFleetRoleBounded / IamFleetRoleReads / IamFleetRoleMetadata | Lambda/Function.ts:1665, :1675, :1710, :1824, :1831, :2005, :2025, :3393-3452 |
| delete (execution role cross-reference) | `iam:GetRolePolicy` | `IamFleetRoleReads` | unconditional / on delete IamFleetRoleBounded / IamFleetRoleReads / IamFleetRoleMetadata | Lambda/Function.ts:1665, :1675, :1710, :1824, :1831, :2005, :2025, :3393-3452 |
| delete (execution role cross-reference) | `iam:ListRolePolicies` | `IamFleetRoleReads` | unconditional / on delete IamFleetRoleBounded / IamFleetRoleReads / IamFleetRoleMetadata | Lambda/Function.ts:1665, :1675, :1710, :1824, :1831, :2005, :2025, :3393-3452 |
| delete (execution role cross-reference) | `iam:ListAttachedRolePolicies` | `IamFleetRoleReads` | unconditional / on delete IamFleetRoleBounded / IamFleetRoleReads / IamFleetRoleMetadata | Lambda/Function.ts:1665, :1675, :1710, :1824, :1831, :2005, :2025, :3393-3452 |
| delete (execution role cross-reference) | `iam:DetachRolePolicy` | `IamFleetRoleBounded` | unconditional / on delete IamFleetRoleBounded / IamFleetRoleReads / IamFleetRoleMetadata | Lambda/Function.ts:1665, :1675, :1710, :1824, :1831, :2005, :2025, :3393-3452 |
| delete (execution role cross-reference) | `iam:DeleteRole` | `IamFleetRoleMetadata` | unconditional / on delete IamFleetRoleBounded / IamFleetRoleReads / IamFleetRoleMetadata | Lambda/Function.ts:1665, :1675, :1710, :1824, :1831, :2005, :2025, :3393-3452 |
| read back | `lambda:GetFunction` | `LambdaFleetFunctions` | unconditional LambdaFleetFunctions; also used by waitForFunctionUpdate F:1910 and create-conflict path F:2456 | F:2919 |
| read back | `lambda:ListTags` | `LambdaFleetFunctions`, `LambdaMappingsRead` | unconditional LambdaFleetFunctions; also used by waitForFunctionUpdate F:1910 and create-conflict path F:2456 | F:2919 |
| read back | `lambda:GetAlias` | **not granted** | conditional on props.alias / output.aliasName; stack never sets alias -> unreachable not granted; harmless while alias unset | F:2936 |
| read back | `lambda:GetFunctionUrlConfig` | `LambdaFleetFunctions` | unconditional (read and end of reconcile F:3366-3372) ResourceNotFound caught | F:1963 via F:2012, F:2948 |
| read back | `logs:DescribeLogGroups` | `LogsDescribe` | conditional on logging.retention; stack sets logging {retention:'14 days'} on every function (RunnerFleet.ts:301, Reaper.ts:227) -> reached LogsDescribe | F:2016 |
| delete | `iam:ListAttachedRolePolicies` | `IamFleetRoleReads` | unconditional Lambda roles are generated CiRunners-<logicalId>-prod-<16 base32> (CloudTrail shows e.g. CiRunners-Webhook-prod-...; longest ~50 chars, no truncation so '-prod-' survives) | F:2025, F:3417 |
| read back | `iam:GetRolePolicy` | `IamFleetRoleReads` | unconditional | F:2005, F:1825 |
| read back | `lambda:GetFunctionEventInvokeConfig` | `LambdaFleetFunctions` | UNCONDITIONAL. Only ResourceNotFoundException is caught (EIC:64), so AccessDenied fails read and reconcile. The first deploy never got here only because GetFunctionConcurrency (F:3325) failed first; on the next deploy read() of the 5 existing functions hits it | EIC:61 (observeConfig) called from F:2037 (read F:2940 and reconcile F:3366) and from syncEventInvokeConfig F: |
| read back | `lambda:GetFunctionConcurrency` | `LambdaFleetFunctions` | unconditional; only ResourceNotFound caught KNOWN GAP (CloudTrail AccessDenied x5) | F:1954 via F:2951 (read) and F:2112 (reconcile, from F:3325) |
| create / update (reconcile) | `lambda:PutFunctionConcurrency` | `LambdaFleetFunctions` | conditional on reservedConcurrentExecutions; set to 1 on ScaleUp (RunnerFleet.ts:485) -> reached for both pools non-IAM risk: Lambda rejects a reservation that leaves <100 unreserved account concurrency (account quota unknown) | F:2127 |
| create / update (reconcile) | `lambda:DeleteFunctionConcurrency` | `LambdaFleetFunctions` | only if observed reservation exists and prop undefined; not for new functions | F:2118 |
| create (execution role) | `iam:GetRole` | `IamFleetRoleReads` | unconditional | F:1735, F:1762 |
| create / update (reconcile) (execution role) | `iam:CreateRole` | `IamFleetRoleBounded` | when role absent IamFleetRoleBounded: iam:PermissionsBoundary is a CreateRole key and the stack passes the boundary (RunnerFleet.ts:221, Reaper.ts:220); TagRole via IamFleetRoleMetadata. Proven OK in CloudTrail (CreateRole ok x6) | F:1742-1760 |
| create / update (reconcile) (execution role) | `iam:TagRole` | `IamFleetRoleMetadata` | when role absent IamFleetRoleBounded: iam:PermissionsBoundary is a CreateRole key and the stack passes the boundary (RunnerFleet.ts:221, Reaper.ts:220); TagRole via IamFleetRoleMetadata. Proven OK in CloudTrail (CreateRole ok x6) | F:1742-1760 |
| create / update (reconcile) (execution role) | `iam:PutRolePermissionsBoundary` | `IamFleetRoleBounded` | only if role's boundary differs | F:1770 |
| create / update (reconcile) (execution role) | `iam:AttachRolePolicy` | `IamFleetRoleAttach` | unconditional IamFleetRoleAttach: iam:PolicyARN list includes this ARN; CloudTrail ok x5 | F:1777-1780 |
| create / update (reconcile) (execution role) | `iam:DetachRolePolicy` | `IamFleetRoleBounded` | when olds undefined and output defined (read-admitted re-run, i.e. likely on the NEXT deploy for the 5 existing functions) IamFleetRoleBounded; SAR lists iam:PermissionsBoundary on DetachRolePolicy; NoSuchEntity caught | F:1709-1714 |
| create / update (reconcile) (execution role) | `iam:PutRolePolicy` | `IamFleetRoleBounded` | guard: when absent/different; bindings: every function calls .bind with statements CloudTrail ok x11 | F:1831, F:1665 |
| delete (execution role) | `iam:DeleteRolePolicy` | `IamFleetRoleBounded` | reconcile only when no binding statements (not this stack); delete always SAR lists iam:PermissionsBoundary on DeleteRolePolicy | F:1674, F:3406, F:3450 |
| create / update (reconcile) (log group) | `logs:CreateLogGroup` | `LogsFleetGroups` | unconditional (ResourceAlreadyExists caught) CloudTrail ok | F:1855 |
| create / update (reconcile) (log group) | `logs:TagResource` | `LogsFleetGroups` | unconditional (ResourceAlreadyExists caught) CloudTrail ok | F:1855 |
| create / update (reconcile) (log group) | `logs:PutRetentionPolicy` | `LogsFleetGroups` | retention set -> reached | LR:45 via F:1857 |
| create / update (reconcile) (log group) | `logs:DeleteRetentionPolicy` | **not granted** | only for retention 'forever'; unreachable | LR:39 |
| create / update (reconcile) (code) | `s3:GetObject` | `StateObjects`, `S3Binaries` | UNREACHABLE: Assets service is optional (Effect.serviceOption) and ci-runners Providers.ts:158-167 does not provide AssetsLive (only AWS.providers() does, aws Providers.ts:1896); code ships inline as ZipFile no S3 or extra role actions needed for bundles; Func | F:2321-2329, Assets.ts:113-131,158-176 |
| create / update (reconcile) (code) | `s3:PutObject` | `StateObjects`, `S3Binaries` | UNREACHABLE: Assets service is optional (Effect.serviceOption) and ci-runners Providers.ts:158-167 does not provide AssetsLive (only AWS.providers() does, aws Providers.ts:1896); code ships inline as ZipFile no S3 or extra role actions needed for bundles; Func | F:2321-2329, Assets.ts:113-131,158-176 |
| create | `lambda:CreateFunction` | `LambdaFleetFunctions` | first create Layers:[] so no lambda:GetLayerVersion; CloudTrail ok x5 (28 InvalidParameterValue = role propagation retries) | F:2482 |
| create | `lambda:TagResource` | `LambdaFleetFunctions`, `LambdaMappingsTagOnCreate` | first create Layers:[] so no lambda:GetLayerVersion; CloudTrail ok x5 (28 InvalidParameterValue = role propagation retries) | F:2482 |
| create | `iam:PassRole` | `IamPassFleetRoles` | first create Layers:[] so no lambda:GetLayerVersion; CloudTrail ok x5 (28 InvalidParameterValue = role propagation retries) | F:2482 |
| create | `iam:PassedToService` | **not granted** | first create Layers:[] so no lambda:GetLayerVersion; CloudTrail ok x5 (28 InvalidParameterValue = role propagation retries) | F:2482 |
| update | `lambda:UpdateFunctionCode` | `LambdaFleetFunctions` | preferUpdate (output defined, e.g. read-admitted on next deploy) or create conflict | F:2401 |
| update | `lambda:UpdateFunctionConfiguration` | `LambdaFleetFunctions` | same as above | F:2415 |
| update | `iam:PassRole` | `IamPassFleetRoles` | same as above | F:2415 |
| update | `lambda:ListTags` | `LambdaFleetFunctions`, `LambdaMappingsRead` | ListTags on every update; TagResource only on tag mismatch | F:2449, F:2451, F:2466 |
| update | `lambda:TagResource` | `LambdaFleetFunctions`, `LambdaMappingsTagOnCreate` | ListTags on every update; TagResource only on tag mismatch | F:2449, F:2451, F:2466 |
| create / update (reconcile) | `lambda:PublishVersion` | **not granted** | only with alias prop; unset -> unreachable | F:2666, F:2698, F:2702, F:2725, F:2731 |
| create / update (reconcile) | `lambda:GetAlias` | **not granted** | only with alias prop; unset -> unreachable | F:2666, F:2698, F:2702, F:2725, F:2731 |
| create / update (reconcile) | `lambda:CreateAlias` | **not granted** | only with alias prop; unset -> unreachable | F:2666, F:2698, F:2702, F:2725, F:2731 |
| create / update (reconcile) | `lambda:UpdateAlias` | **not granted** | only with alias prop; unset -> unreachable | F:2666, F:2698, F:2702, F:2725, F:2731 |
| create / update (reconcile) | `lambda:DeleteAlias` | **not granted** | only with alias prop; unset -> unreachable | F:2666, F:2698, F:2702, F:2725, F:2731 |
| create / update (reconcile) | `lambda:PutFunctionEventInvokeConfig` | **not granted** | Put needs eventInvokeConfig prop (unset); Delete only if a config is observed (none exists) -> unreachable | EIC:113, EIC:86 |
| create / update (reconcile) | `lambda:DeleteFunctionEventInvokeConfig` | **not granted** | Put needs eventInvokeConfig prop (unset); Delete only if a config is observed (none exists) -> unreachable | EIC:113, EIC:86 |
| create / update (reconcile) (URL) | `lambda:CreateFunctionUrlConfig` | `LambdaFleetFunctions` | Webhook only (RunnerFleet.ts:617) lambda:FunctionUrlAuthType key available but policy has no condition | F:2628, F:2632 |
| create / update (reconcile) (URL) | `lambda:UpdateFunctionUrlConfig` | `LambdaFleetFunctions` | Webhook only (RunnerFleet.ts:617) lambda:FunctionUrlAuthType key available but policy has no condition | F:2628, F:2632 |
| create / update (reconcile) (URL) | `lambda:AddPermission` | `LambdaFleetFunctions` | Webhook (authType NONE) account-level public-access controls/SCP on public function URLs: unknown | F:2531-2539, F:2549-2566 |
| create / update (reconcile) (URL) | `lambda:RemovePermission` | `LambdaFleetFunctions` | Webhook (authType NONE) account-level public-access controls/SCP on public function URLs: unknown | F:2531-2539, F:2549-2566 |
| create / update (reconcile) (URL) | `lambda:DeleteFunctionUrlConfig` | `LambdaFleetFunctions` | when olds undefined: normalizeFunctionUrl(undefined) defaults to NONE (F:853-863) so hadFunctionUrl=true -> reached for the 4 URL-less existing functions on a read-admitted re-run | F:2578, F:2515-2524 via F:2648 |
| create / update (reconcile) | `lambda:GetFunctionConfiguration` | `LambdaFleetFunctions` | unconditional | F:3368 |
| delete | `iam:ListRolePolicies` | `IamFleetRoleReads` | on destroy/replace | F:3394, F:3424, F:3434, F:3452, F:3468 |
| delete | `iam:DetachRolePolicy` | `IamFleetRoleBounded` | on destroy/replace | F:3394, F:3424, F:3434, F:3452, F:3468 |
| delete | `lambda:DeleteFunction` | `LambdaFleetFunctions` | on destroy/replace | F:3394, F:3424, F:3434, F:3452, F:3468 |
| delete | `iam:DeleteRole` | `IamFleetRoleMetadata` | on destroy/replace | F:3394, F:3424, F:3434, F:3452, F:3468 |
| delete | `logs:DeleteLogGroup` | `LogsFleetGroups` | on destroy/replace | F:3394, F:3424, F:3434, F:3452, F:3468 |
| list (not on deploy) | `lambda:ListFunctions` | **not granted** | not on deploy | F:3008, PERM:201 |
| create (log group) | `logs:CreateLogGroup` | `LogsFleetGroups` | unconditional on every Function reconcile (Function.ts:3100, 3170). ResourceAlreadyExistsException is caught. Every prod function name is pinned beep-fleet-prod-* (Reaper CiRunners.ts:184; RunnerFleet.ts:486,532,553,614,635,679,723), so LogsFleetGroups /aws/la | node_modules/@alchemy.run/aws/src/Lambda/Function.ts:1846-1858 |
| create (log group) | `logs:TagResource` | `LogsFleetGroups` | unconditional on every Function reconcile (Function.ts:3100, 3170). ResourceAlreadyExistsException is caught. Every prod function name is pinned beep-fleet-prod-* (Reaper CiRunners.ts:184; RunnerFleet.ts:486,532,553,614,635,679,723), so LogsFleetGroups /aws/la | node_modules/@alchemy.run/aws/src/Lambda/Function.ts:1846-1858 |
| create (log group) | `logs:TagLogGroup` | **not granted** | unconditional on every Function reconcile (Function.ts:3100, 3170). ResourceAlreadyExistsException is caught. Every prod function name is pinned beep-fleet-prod-* (Reaper CiRunners.ts:184; RunnerFleet.ts:486,532,553,614,635,679,723), so LogsFleetGroups /aws/la | node_modules/@alchemy.run/aws/src/Lambda/Function.ts:1846-1858 |
| read back (log group) | `logs:DescribeLogGroups` | `LogsDescribe` | when logging.retention is set (it always is) | node_modules/@alchemy.run/aws/src/Lambda/Function.ts:2013-2025 |
| delete (log group) | `logs:DeleteLogGroup` | `LogsFleetGroups` | Function delete only | node_modules/@alchemy.run/aws/src/Lambda/Function.ts:3467-3469 |
| list (not on deploy) (log group) | `logs:StartLiveTail` | **not granted** | no: only from `alchemy tail` or `alchemy logs`, never from plan/deploy | node_modules/@alchemy.run/aws/src/Lambda/Function.ts:3477-3480, 3511-3516 |
| list (not on deploy) (log group) | `logs:FilterLogEvents` | **not granted** | no: only from `alchemy tail` or `alchemy logs`, never from plan/deploy | node_modules/@alchemy.run/aws/src/Lambda/Function.ts:3477-3480, 3511-3516 |

### AWS.Lambda.Permission

7 of the 72 resources: `ReaperInvoke` (not built), `Runners/InstanceStateChangeInvoke` (not built), `Runners/Poolheavy/ScaleDownInvoke` (not built), `Runners/Pooloverflow/ScaleDownInvoke` (not built), `Runners/RunnerBinariesSyncerInvoke` (not built), `Runners/SpotInterruptionInvoke` (not built), `Runners/SsmHousekeeperInvoke` (not built).

| Lifecycle | Action | Allowed by | Reach and note | Provider source |
| --- | --- | --- | --- | --- |
| read back | `lambda:GetPolicy` | `LambdaFleetFunctions` | unconditional | PERM:167 via PERM:260, PERM:280, PERM:302 |
| create / update (reconcile) | `lambda:AddPermission` | `LambdaFleetFunctions` | unconditional lambda:Principal key available, policy has no condition | PERM:161, PERM:164, PERM:281, PERM:287, delete ~PERM:309 |
| create / update (reconcile) | `lambda:RemovePermission` | `LambdaFleetFunctions` | unconditional lambda:Principal key available, policy has no condition | PERM:161, PERM:164, PERM:281, PERM:287, delete ~PERM:309 |

### AWS.Logs.LogGroup

1 of the 72 resources: `FlowLogGroup` (built).

| Lifecycle | Action | Allowed by | Reach and note | Provider source |
| --- | --- | --- | --- | --- |
| delete | `logs:DescribeLogGroups` | `LogsDescribe` | unconditional LogsDescribe grants Resource "*". | node_modules/@alchemy.run/aws/src/Logs/LogGroup.ts:189-195 (used at 282, 322, 337, 456) |
| read back | `logs:ListTagsForResource` | `LogsFleetGroups` | when the group exists The ListTagsForResource API maps only to logs:ListTagsForResource, not ListTagsLogGroup. Policy pattern log-group:/beep-fleet/prod/* matches both the bare and the :* ARN forms. | node_modules/@alchemy.run/aws/src/Logs/LogGroup.ts:293-300 |
| create | `logs:CreateLogGroup` | `LogsFleetGroups` | when the group is absent (first deploy). ResourceAlreadyExistsException is caught. The CreateLogGroup API reference says tagging on create needs either logs:TagResource or logs:TagLogGroup. LogsFleetGroups grants logs:TagResource with no condition. | node_modules/@alchemy.run/aws/src/Logs/LogGroup.ts:327-338 |
| create | `logs:TagResource` | `LogsFleetGroups` | when the group is absent (first deploy). ResourceAlreadyExistsException is caught. The CreateLogGroup API reference says tagging on create needs either logs:TagResource or logs:TagLogGroup. LogsFleetGroups grants logs:TagResource with no condition. | node_modules/@alchemy.run/aws/src/Logs/LogGroup.ts:327-338 |
| create | `logs:TagLogGroup` | **not granted** | when the group is absent (first deploy). ResourceAlreadyExistsException is caught. The CreateLogGroup API reference says tagging on create needs either logs:TagResource or logs:TagLogGroup. LogsFleetGroups grants logs:TagResource with no condition. | node_modules/@alchemy.run/aws/src/Logs/LogGroup.ts:327-338 |
| create / update (reconcile) | `logs:AssociateKmsKey` | **not granted** | no with this stack: Network.ts:221-225 passes no kmsKeyId and the group has none, so news.kmsKeyId === observed (undefined) and neither call runs. Latent: this becomes a gap if kmsKeyId is ever set, or if someone associates a key out of band. That would also n | node_modules/@alchemy.run/aws/src/Logs/LogGroup.ts:342-356 |
| create / update (reconcile) | `logs:DisassociateKmsKey` | **not granted** | no with this stack: Network.ts:221-225 passes no kmsKeyId and the group has none, so news.kmsKeyId === observed (undefined) and neither call runs. Latent: this becomes a gap if kmsKeyId is ever set, or if someone associates a key out of band. That would also n | node_modules/@alchemy.run/aws/src/Logs/LogGroup.ts:342-356 |
| create / update (reconcile) | `logs:PutLogGroupDeletionProtection` | `LogsFleetGroups` | no on reconcile with this stack: desired false (prop unset) equals observed false. It would run only if protection were enabled out of band. | node_modules/@alchemy.run/aws/src/Logs/LogGroup.ts:360-367 |
| create / update (reconcile) | `logs:PutRetentionPolicy` | `LogsFleetGroups` | when observed retention != 14. It runs on first create; Config.ts:645 sets flowLogRetentionDays 14. | node_modules/@alchemy.run/aws/src/Logs/LogGroup.ts:369-384 |
| create / update (reconcile) | `logs:DeleteRetentionPolicy` | **not granted** | no: only when retention is unset, and the stack always sets it | node_modules/@alchemy.run/aws/src/Logs/LogGroup.ts:372-377 |
| create / update (reconcile) | `logs:ListTagsForResource` | `LogsFleetGroups` | unconditional Effect.orElseSucceed swallows every error here, including AccessDenied. A denied read would show up as {} and send a full TagResource upsert instead of failing. | node_modules/@alchemy.run/aws/src/Logs/LogGroup.ts:388-397 |
| create / update (reconcile) | `logs:TagResource` | `LogsFleetGroups` | conditional on tag drift (not after a tagged create) | node_modules/@alchemy.run/aws/src/Logs/LogGroup.ts:399-410 |
| create / update (reconcile) | `logs:UntagResource` | `LogsFleetGroups` | conditional on tag drift (not after a tagged create) | node_modules/@alchemy.run/aws/src/Logs/LogGroup.ts:399-410 |
| delete | `logs:PutLogGroupDeletionProtection` | `LogsFleetGroups` | unconditional on delete (destroy, replace on a name or class change, or removal from the program). Only ResourceNotFoundException is caught, so AccessDenied aborts the delete before DeleteLogGroup runs. GAP for teardown and replace only. A routine or bootstrap | node_modules/@alchemy.run/aws/src/Logs/LogGroup.ts:425-439 |
| delete | `logs:DeleteLogGroup` | `LogsFleetGroups` | on delete, but only after the deletion-protection call succeeds | node_modules/@alchemy.run/aws/src/Logs/LogGroup.ts:440-453 |
| list (not on deploy) | `logs:DescribeLogGroups` | `LogsDescribe` | no: list runs only from Nuke/Drift, and the stack makes no LogGroup lookup ListTagsForResource on non-fleet groups would be denied under drift or nuke. | node_modules/@alchemy.run/aws/src/Logs/LogGroup.ts:203-248, 258-279 |
| list (not on deploy) | `logs:ListTagsForResource` | `LogsFleetGroups` | no: list runs only from Nuke/Drift, and the stack makes no LogGroup lookup ListTagsForResource on non-fleet groups would be denied under drift or nuke. | node_modules/@alchemy.run/aws/src/Logs/LogGroup.ts:203-248, 258-279 |

### AWS.S3.Bucket

1 of the 72 resources: `Runners/RunnerBinaries` (built).

| Lifecycle | Action | Allowed by | Reach and note | Provider source |
| --- | --- | --- | --- | --- |
| read back | `s3:GetBucketLocation` | `StateBucket`, `S3Binaries` | unconditional Sid S3Binaries. Props passed: bucketName, forceDestroy:true, publicAccessBlock (all true) (alchemy-github-runners/src/RunnerFleet.ts:321-330). No tags, versioning, cors, lifecycle, policy, acl, ownership, logging, website, replication, tiering or | S3/Bucket.ts:1999; engine alchemy/src/Plan.ts:1749 |
| read back | `s3:GetBucketTagging` | `S3Binaries` | unconditional NoSuchTagSet is caught as an empty set. | S3/Bucket.ts:783 (fetchBucketTags) via :820, :1150, :1175, :2077 |
| tag | `s3:PutBucketTagging` | `S3Binaries` | conditional: the stack sets no tags and the provider stamps none (comment at :2283-2286), so this runs only if tags appear out of band (DeleteBucketTagging) or an EventBridge binding exists (none) DeleteBucketTagging is authorized as s3:PutBucketTagging, which | S3/Bucket.ts:848, :862, :1183, :1210, :1220 |
| read back | `s3:GetBucketPolicy` | `S3Binaries` | unconditional NoSuchBucketPolicy is caught. | S3/Bucket.ts:877 (readBucketPolicy) via :912, :1884 |
| update | `s3:DeleteBucketPolicy` | **not granted** | conditional: no policy is desired (no props.policy, no bucket bindings), so this runs only when a policy is present out of band PutBucketPolicy (:926) is unreachable: desiredPolicy is undefined. | S3/Bucket.ts:935 |
| read back | `s3:GetEncryptionConfiguration` | `StateBucket`, `S3Binaries` | unconditional | S3/Bucket.ts:2407 via :1885, :2052, :2152 (sync :2422), :2156 |
| create / update (reconcile) | `s3:PutEncryptionConfiguration` | `S3Binaries` | conditional: when the live rule differs from AES256 / BucketKeyEnabled false / BlockedEncryptionTypes [NONE]. Likely on create if new-bucket defaults block SSE-C (unknown). Sid S3Binaries | S3/Bucket.ts:2429 |
| read back | `s3:GetBucketNotification` | `S3Binaries` | unconditional | S3/Bucket.ts:1149, :1172, :2071 (and :1006 only for legacy bindings) |
| create / update (reconcile) | `s3:PutBucketNotification` | **not granted** | unreachable for this stack: the bucket has no bindings, and mergeNotifications (:1060-1117) keeps external targets, so notificationKey(existing) equals notificationKey(next) It would become a gap only if a notification binding were added. | S3/Bucket.ts:1199 |
| read back | `s3:GetBucketPublicAccessBlock` | `StateBucket`, `S3Binaries` | unconditional (publicAccessBlock is set) | S3/Bucket.ts:1316 via :1349-1352, :1895 |
| create / update (reconcile) | `s3:PutBucketPublicAccessBlock` | `S3Binaries` | conditional: on create, and on drift Sid S3Binaries | S3/Bucket.ts:1354 |
| create | `s3:GetBucketLocation` | `StateBucket`, `S3Binaries` | unconditional on create | S3/Bucket.ts:710, :759 |
| create | `s3:CreateBucket` | `S3Binaries` | conditional: bucket absent s3:PutBucketObjectLockConfiguration and s3:PutBucketVersioning are needed only when object lock is true, and it is false. The us-east-1 branch is used, so :741 is unreachable. | S3/Bucket.ts:726 |
| delete | `s3:ListBucketVersions` | `S3Binaries` | conditional: on bucket delete (destroy, or replace if the name changes). forceDestroy is true in RunnerFleet.ts:323. GAP. Without it the destroy fails before DeleteBucket. | S3/Bucket.ts:619 (called from :2297 and again from :2321) |
| delete | `s3:DeleteObject` | `StateObjects`, `S3Binaries` | conditional: on bucket delete with objects present (the syncer Lambda writes the runner tarball) s3:DeleteObject is granted. s3:DeleteObjectVersion is not. The API reference requires it for a specific version in a versioning-enabled bucket. This bucket is neve | S3/Bucket.ts:640-648 |
| delete | `s3:DeleteObjectVersion` | `S3Binaries` | conditional: on bucket delete with objects present (the syncer Lambda writes the runner tarball) s3:DeleteObject is granted. s3:DeleteObjectVersion is not. The API reference requires it for a specific version in a versioning-enabled bucket. This bucket is neve | S3/Bucket.ts:640-648 |
| delete | `s3:ListBucketMultipartUploads` | `S3Binaries` | conditional: on every bucket delete (forceDestroy) GAP | S3/Bucket.ts:660 |
| delete | `s3:AbortMultipartUpload` | `S3Binaries` | conditional: on bucket delete, only when an upload is in progress GAP | S3/Bucket.ts:676 |
| delete | `s3:DeleteBucket` | `S3Binaries` | conditional: on delete | S3/Bucket.ts:2307 |
| list (not on deploy) | `s3:ListAllMyBuckets` | **not granted** | unreachable in deploy/destroy (only nuke/list) | S3/Bucket.ts:1957 |

### AWS.SQS.Queue

10 of the 72 resources: `Runners/DeregisterRetryQueue` (built), `Runners/DeregisterRetryQueueDlq` (built), `Runners/Poolheavy/BuildQueue` (built), `Runners/Poolheavy/BuildQueueDlq` (built), `Runners/Poolheavy/JobRetryQueue` (built), `Runners/Poolheavy/JobRetryQueueDlq` (built), `Runners/Pooloverflow/BuildQueue` (built), `Runners/Pooloverflow/BuildQueueDlq` (built), `Runners/Pooloverflow/JobRetryQueue` (built), `Runners/Pooloverflow/JobRetryQueueDlq` (built).

| Lifecycle | Action | Allowed by | Reach and note | Provider source |
| --- | --- | --- | --- | --- |
| read back | `sqs:GetQueueUrl` | `SqsFleetQueues` | unconditional Sid SqsFleetQueues. Props: queueName, messageRetentionPeriod or visibilityTimeout, sqsManagedSseEnabled:true, and redrivePolicy on the main queue (RunnerFleet.ts:235-245). No tags, policy, KMS key or bindings. | SQS/Queue.ts:511, :530, :604 |
| create | `sqs:CreateQueue` | `SqsFleetQueues` | conditional: queue absent The SAR maps CreateQueue to sqs:CreateQueue and sqs:TagQueue. Both are granted, and the statement has no conditions. The RedrivePolicy DLQ ARN is also beep-fleet-prod-*. The SAR lists no extra resource check on the DLQ. | SQS/Queue.ts:524-528 |
| create | `sqs:TagQueue` | `SqsFleetQueues` | conditional: queue absent The SAR maps CreateQueue to sqs:CreateQueue and sqs:TagQueue. Both are granted, and the statement has no conditions. The RedrivePolicy DLQ ARN is also beep-fleet-prod-*. The SAR lists no extra resource check on the DLQ. | SQS/Queue.ts:524-528 |
| delete | `sqs:GetQueueAttributes` | `SqsFleetQueues` | unconditional | SQS/Queue.ts:616, :715, :846 |
| create / update (reconcile) | `sqs:SetQueueAttributes` | `SqsFleetQueues` | conditional: attribute delta | SQS/Queue.ts:744 |
| read back | `sqs:ListQueueTags` | `SqsFleetQueues` | unconditional | SQS/Queue.ts:610, :672, :764 |
| create / update (reconcile) | `sqs:TagQueue` | `SqsFleetQueues` | conditional: tag drift | SQS/Queue.ts:787, :800 |
| create / update (reconcile) | `sqs:UntagQueue` | `SqsFleetQueues` | conditional: tag drift | SQS/Queue.ts:787, :800 |
| delete | `sqs:DeleteQueue` | `SqsFleetQueues` | conditional: destroy/replace | SQS/Queue.ts:824 |
| delete | `sqs:ListQueues` | `SqsList` | conditional: after every DeleteQueue (destroy/replace) GAP. The SAR gives ListQueues no resource type, so it needs Resource '*'. Only RequestThrottled is caught, so AccessDenied fails the delete after the queue is already gone. List at :557 is nuke-only. | SQS/Queue.ts:857 |

### AWS.SSM.Parameter

3 of the 72 resources: `Runners/AppId` (built), `Runners/AppKey` (built), `Runners/WebhookSecret` (built).

| Lifecycle | Action | Allowed by | Reach and note | Provider source |
| --- | --- | --- | --- | --- |
| read back | `ssm:GetParameter` | `SsmFleetParameters` | unconditional | node_modules/@alchemy.run/aws/src/SSM/Parameter.ts:355 (lookup :323); DeployRolePolicy.ts:640 SsmFleetParamete |
| create / update (reconcile) | `ssm:GetParameter` | `SsmFleetParameters` | GetParameter unconditional; Decrypt only when the parameter exists (update path) | node_modules/@alchemy.run/aws/src/SSM/Parameter.ts:418; DeployRolePolicy.ts:640 + :687 KmsThroughFleetParamete |
| create / update (reconcile) | `kms:Decrypt` | `KmsThroughFleetParameters` | GetParameter unconditional; Decrypt only when the parameter exists (update path) | node_modules/@alchemy.run/aws/src/SSM/Parameter.ts:418; DeployRolePolicy.ts:640 + :687 KmsThroughFleetParamete |
| create / update (reconcile) | `kms:ViaService` | **not granted** | GetParameter unconditional; Decrypt only when the parameter exists (update path) | node_modules/@alchemy.run/aws/src/SSM/Parameter.ts:418; DeployRolePolicy.ts:640 + :687 KmsThroughFleetParamete |
| create | `ssm:PutParameter` | `SsmFleetParameters` | unconditional on create CloudTrail PutParameter ok x3, Encrypt ok x3. Whether SSM also calls kms:DescribeKey on the caller's behalf: unknown; none appears in CloudTrail beyond the provider's own calls. | node_modules/@alchemy.run/aws/src/SSM/Parameter.ts:431; DeployRolePolicy.ts:640 + :687 |
| create | `ssm:AddTagsToResource` | `SsmFleetParameters` | unconditional on create CloudTrail PutParameter ok x3, Encrypt ok x3. Whether SSM also calls kms:DescribeKey on the caller's behalf: unknown; none appears in CloudTrail beyond the provider's own calls. | node_modules/@alchemy.run/aws/src/SSM/Parameter.ts:431; DeployRolePolicy.ts:640 + :687 |
| create | `kms:Encrypt` | `KmsThroughFleetParameters` | unconditional on create CloudTrail PutParameter ok x3, Encrypt ok x3. Whether SSM also calls kms:DescribeKey on the caller's behalf: unknown; none appears in CloudTrail beyond the provider's own calls. | node_modules/@alchemy.run/aws/src/SSM/Parameter.ts:431; DeployRolePolicy.ts:640 + :687 |
| create | `kms:GenerateDataKey` | `KmsThroughFleetParameters` | unconditional on create CloudTrail PutParameter ok x3, Encrypt ok x3. Whether SSM also calls kms:DescribeKey on the caller's behalf: unknown; none appears in CloudTrail beyond the provider's own calls. | node_modules/@alchemy.run/aws/src/SSM/Parameter.ts:431; DeployRolePolicy.ts:640 + :687 |
| update | `ssm:PutParameter` | `SsmFleetParameters` | conditional: ParameterAlreadyExists, or value/type/keyId drift (P:468-477) The keyId drift compares DescribeParameters' KeyId to the key ARN. Whether DescribeParameters returns the ARN form is unknown; if it does not, every update overwrites (still allowed). | node_modules/@alchemy.run/aws/src/SSM/Parameter.ts:445, :480; DeployRolePolicy.ts:640 + :687 |
| update | `kms:Encrypt` | `KmsThroughFleetParameters` | conditional: ParameterAlreadyExists, or value/type/keyId drift (P:468-477) The keyId drift compares DescribeParameters' KeyId to the key ARN. Whether DescribeParameters returns the ARN form is unknown; if it does not, every update overwrites (still allowed). | node_modules/@alchemy.run/aws/src/SSM/Parameter.ts:445, :480; DeployRolePolicy.ts:640 + :687 |
| read back | `ssm:DescribeParameters` | `SsmDescribe` | read when found; reconcile only when the parameter exists (P:467) | node_modules/@alchemy.run/aws/src/SSM/Parameter.ts:261; DeployRolePolicy.ts:653 SsmDescribe |
| create / update (reconcile) | `kms:DescribeKey` | `KmsOwnedKeys` | reconcile unconditional for SecureString (P:535, errors not swallowed except NotFound); read P:364 (errors swallowed) Would be denied for alias/aws/ssm (untagged AWS key), but keyId is always set to the fleet key here. | node_modules/@alchemy.run/aws/src/SSM/Parameter.ts:277; DeployRolePolicy.ts:669 |
| read back | `ssm:ListTagsForResource` | `SsmFleetParameters` | unconditional | node_modules/@alchemy.run/aws/src/SSM/Parameter.ts:284; DeployRolePolicy.ts:640 |
| create / update (reconcile) | `ssm:AddTagsToResource` | `SsmFleetParameters` | conditional on tag drift (or the overwrite fallback) | node_modules/@alchemy.run/aws/src/SSM/Parameter.ts:504; DeployRolePolicy.ts:640 |
| create / update (reconcile) | `ssm:RemoveTagsFromResource` | `SsmFleetParameters` | conditional on extra observed tags | node_modules/@alchemy.run/aws/src/SSM/Parameter.ts:518; DeployRolePolicy.ts:640 |
| delete | `ssm:DeleteParameter` | `SsmFleetParameters` | destroy / name change (replace) | node_modules/@alchemy.run/aws/src/SSM/Parameter.ts:558; DeployRolePolicy.ts:640 |

### BeepAWS.EC2.RunnerLaunchTemplate

2 of the 72 resources: `Runners/Poolheavy/LaunchTemplate` (not built), `Runners/Pooloverflow/LaunchTemplate` (not built).

| Lifecycle | Action | Allowed by | Reach and note | Provider source |
| --- | --- | --- | --- | --- |
| read back | `ec2:DescribeLaunchTemplates` | `Ec2Reads` | unconditional: read on every plan (by id when output exists, else by pinned name beep-fleet-prod-<pool>), reconcile always, updateTemplate refresh on every update. NotFound tags are caught (RunnerLaunchTemplate.ts:672-682,831). Same in v1 and v2. | packages/tooling/library/alchemy-aws-extras/src/RunnerLaunchTemplate.ts:827-846 (describe/describeById/describ |
| create | `ec2:CreateLaunchTemplate` | `Ec2CreatesTagged` | unconditional on first deploy (once per pool: heavy, overflow) aws:RequestTag is present on the single authorized resource (launch-template), so the condition is satisfiable. The composite never passes tagSpecifications inside LaunchTemplateData (RunnerFleetLa | RunnerLaunchTemplate.ts:902-919 (createTemplate), :983-991 (reconcile -> createTemplate), desired tags :986-98 |
| tag | `ec2:CreateTags` | `Ec2TagOnCreate`, `Ec2TagOwned` | unconditional with create (SAR Operations mapping for CreateLaunchTemplate lists ec2:CreateTags) Same in v1 and v2. | RunnerLaunchTemplate.ts:910; SAR operations CreateLaunchTemplate -> AuthorizedActions [ec2:CreateLaunchTemplat |
| update | `iam:PassRole` | `IamPassFleetRoles` | unconditional: composite always sets instanceProfileArn (RunnerFleet.ts:397), so toInstanceProfile emits IamInstanceProfile.Arn (RunnerLaunchTemplate.ts:750-755, 801) Role has no IAM path, so its ARN role/beep-fleet-prod-<pool>-runner matches role/beep-fleet-p | RunnerLaunchTemplate.ts:750-755, :801; RunnerFleet.ts:340-342 (RunnerRole pinned roleName, no path), :390-397; |
| update | `ec2:CreateLaunchTemplateVersion` | `Ec2MutateOwned` | conditional: needsNewVersion true when olds undefined, template not owned (missing alchemy::* tags), or launch data changed (userData/AMI/SG/etc). Not on the first create. Reached on later deploys whenever userData (runner tarball URL, post-install) or AMI cha | RunnerLaunchTemplate.ts:865-873 (publishVersion), :924-932 (needsNewVersion), :934-946 (updateTemplate); polic |
| update | `ec2:ModifyLaunchTemplate` | `Ec2MutateOwned` | conditional: immediately after each publishVersion Same in v1 and v2. | RunnerLaunchTemplate.ts:880; policy Sid Ec2MutateOwned |
| update | `ec2:DeleteTags` | `Ec2TagOwned` | conditional: only when observed template tags contain a key not in desired tags (e.g. a networkTags key removed). Not on first deploy. Same in v1 and v2. | RunnerLaunchTemplate.ts:883-891; policy Sid Ec2TagOwned (DeployRolePolicy.ts:104-110) aws:ResourceTag stack/st |
| update | `ec2:CreateTags` | `Ec2TagOnCreate`, `Ec2TagOwned` | conditional: when desired tags add or change a value. Not on first deploy. Ec2TagOwned keys on the existing aws:ResourceTag, so it is satisfiable on an owned template; denied on an unowned/adopted one (see CreateLaunchTemplateVersion note). | RunnerLaunchTemplate.ts:892-894; policy Sid Ec2TagOwned |
| delete | `ec2:DeleteLaunchTemplate` | `Ec2MutateOwned` | conditional: destroy, or replace when the template name changes (diff RunnerLaunchTemplate.ts:959-964; prod name is pinned, so not on a normal deploy) ec2:DeleteLaunchTemplateVersions is granted but never called by the provider. | RunnerLaunchTemplate.ts:1004-1008; policy Sid Ec2MutateOwned |
| list (not on deploy) | `ec2:DescribeLaunchTemplates` | `Ec2Reads` | only on `alchemy nuke`/list, not deploy | RunnerLaunchTemplate.ts:972-982; policy Sid Ec2Reads |

### BeepGitHubRunners.RunnerSweep

1 of the 72 resources: `Runners/Sweep` (not built).

| Lifecycle | Action | Allowed by | Reach and note | Provider source |
| --- | --- | --- | --- | --- |
| delete | `ec2:DescribeInstances` | `Ec2Reads` | delete only; once per pool environment Runs with the deploy role's credentials: the sweep services take AwsCredentials from the stack's providers layer (Providers.ts:129-132, 158-166, AwsCredentials.fromEnvironment). | RunnerSweep.ts:125-130 -> Aws.layer.ts:220-232 (runnerFilters :153-161); policy Sid Ec2Reads |
| delete | `ec2:TerminateInstances` | `SweepTerminate` | delete only, per runner instance found | RunnerSweep.ts:132 -> Aws.layer.ts:253-255; instances tagged ghr:environment=<fleet>-<pool> by ScaleUp.program |
| delete | `ssm:GetParameter` | `SsmFleetParameters` | delete only, when at least one runner instance carries ghr:Owner and a valid ghr:Type (RunnerSweep.ts:136-139); cached after the first read IAM side allowed. Whether the fleet KMS key's key policy delegates to IAM (account root) is not in this area: unknown fr | RunnerSweep.ts:133-147 -> TerminationWatcher.program.ts:116-122 -> internal/Installation.ts:39-45 -> GitHubApp |
| delete | `kms:Decrypt` | `KmsThroughFleetParameters` | delete only, when at least one runner instance carries ghr:Owner and a valid ghr:Type (RunnerSweep.ts:136-139); cached after the first read IAM side allowed. Whether the fleet KMS key's key policy delegates to IAM (account root) is not in this area: unknown fr | RunnerSweep.ts:133-147 -> TerminationWatcher.program.ts:116-122 -> internal/Installation.ts:39-45 -> GitHubApp |
| delete | `ssm:GetParametersByPath` | `SsmFleetParameters` | delete only, unconditional within the sweep (once per token path; runs even when no instances exist) GAP. It runs after terminate and deregister, so a destroy terminates instances and deregisters runners, then dies (Effect.orDie, RunnerSweep.ts:339) before del | RunnerSweep.ts:148 -> Aws.layer.ts:329-334; token paths RunnerFleet.ts:632, 789 and SsmParameters.models.ts:11 |
| delete | `ssm:DeleteParameter` | `SsmFleetParameters` | delete only, per token listed (unreachable today because the listing before it is denied) | RunnerSweep.ts:150 -> Aws.layer.ts:322-328; policy Sid SsmFleetParameters |

### AWS.EC2.DefaultSecurityGroup

Not in step 1a: created by step 1b (`default-security-group`), under policy v2 only.

| Lifecycle | Action | Allowed by | Reach and note | Provider source |
| --- | --- | --- | --- | --- |
| read back | `ec2:DescribeSecurityGroups` | `Ec2Reads` | unconditional (excluded from step 1a by CheckedDeploy, run in step 1b) | DefaultSecurityGroup.ts:248-267, 440-471, 477-495; DeployRolePolicy.ts:87 |
| read back | `ec2:DescribeSecurityGroupRules` | `Ec2Reads` | unconditional (excluded from step 1a by CheckedDeploy, run in step 1b) | DefaultSecurityGroup.ts:248-267, 440-471, 477-495; DeployRolePolicy.ts:87 |
| update | `ec2:RevokeSecurityGroupIngress` | `Ec2MutateOwned`, `DefaultGroupRulesFleetVpc` | unconditional on first reconcile (step 1b); ingress: [] declared (Network.ts:196) v1: implicit deny. The default group is AWS-created and never tagged (the provider has no tag calls), so Ec2MutateOwned's aws:ResourceTag can never match it. v2: allowed, because | DefaultSecurityGroup.ts:373-389, 498-503; v1: no matching statement; v2: DeployRolePolicy.ts:812-818 (DefaultG |
| update | `ec2:RevokeSecurityGroupEgress` | `Ec2MutateOwned`, `DefaultGroupRulesFleetVpc` | unconditional on first reconcile (step 1b); egress: [] declared Same as ingress: denied in v1, allowed in v2. | DefaultSecurityGroup.ts:373-389, 504-509; DeployRolePolicy.ts:812-818 |
| update | `ec2:ModifySecurityGroupRules` | **not granted** | unreachable with ingress: [] and egress: []. The desired maps are empty, so the description branch (:390) and the add loop (:417) never run. | DefaultSecurityGroup.ts:390-434; Network.ts:196 |
| update | `ec2:AuthorizeSecurityGroupIngress` | **not granted** | unreachable with ingress: [] and egress: []. The desired maps are empty, so the description branch (:390) and the add loop (:417) never run. | DefaultSecurityGroup.ts:390-434; Network.ts:196 |
| update | `ec2:AuthorizeSecurityGroupEgress` | `Ec2MutateOwned` | unreachable with ingress: [] and egress: []. The desired maps are empty, so the description branch (:390) and the add loop (:417) never run. | DefaultSecurityGroup.ts:390-434; Network.ts:196 |

### Engine (state store, credentials, assets)

Calls the engine makes outside any resource.

| Lifecycle | Action | Allowed by | Reach and note | Provider source |
| --- | --- | --- | --- | --- |
| engine | `sts:GetCallerIdentity` | `Sts` | conditional: only when AWS_ACCOUNT_ID is unset Sid Sts allows it. AWS does not require a permission for GetCallerIdentity in any case. Region is pinned by AwsRegion.of(us-east-1) (Providers.ts:160) with no call. Nothing in this stack calls EC2 DescribeRegions  | node_modules/@alchemy.run/aws/src/AuthProvider.ts:218 (getAccountId; reached via :605-606 / :750-752 when AWS_ |
| engine | `s3:ListBucket` | `StateBucket`, `S3Binaries` | unconditional (first state operation) Allowed by Sid StateBucket. If the bucket were missing, Provisioning.deployMissing (alchemy/src/State/Provisioning.ts:63) refuses in CI without --yes, so CreateBucket (State.ts:395) is not reached. | node_modules/@alchemy.run/aws/src/StateStore/State.ts:68 (stateBucketExists), :389 and :425 (ensureStateBucket |
| engine | `s3:GetBucketVersioning` | `StateBucket` | unconditional Sid StateBucket | StateStore/State.ts:437 |
| update | `s3:PutBucketVersioning` | **not granted** | conditional: only when the observed Status is not Enabled (state-bucket drift) Not granted. The first deploy got past state init, so the live bucket matched then. | StateStore/State.ts:440-444 |
| engine | `s3:GetEncryptionConfiguration` | `StateBucket`, `S3Binaries` | unconditional; it reads again after a write (:2435) Sid StateBucket | StateStore/State.ts:447 -> S3/Bucket.ts:2422 (readBucketEncryption :2405-2408) |
| update | `s3:PutEncryptionConfiguration` | `S3Binaries` | conditional: only when the live rule's fingerprint differs from alchemy.run.ts:14-17 (aws:kms with no KMSMasterKeyID, BucketKeyEnabled true, BlockedEncryptionTypes [SSE-C]) Not granted on the state bucket (S3Binaries grants it only on the binaries bucket). A r | S3/Bucket.ts:2429 via StateStore/State.ts:447 (syncBucketEncryption) |
| engine | `s3:GetBucketPublicAccessBlock` | `StateBucket`, `S3Binaries` | unconditional Sid StateBucket | StateStore/State.ts:455 |
| update | `s3:PutBucketPublicAccessBlock` | `S3Binaries` | conditional: only when any of the four flags is not true Not granted on the state bucket. | StateStore/State.ts:466-473 |
| engine | `s3:GetBucketOwnershipControls` | `StateBucket` | unconditional Sid StateBucket | StateStore/State.ts:476 |
| update | `s3:PutBucketOwnershipControls` | **not granted** | conditional: only when ownership is not BucketOwnerEnforced Not granted on the state bucket. | StateStore/State.ts:480-487 |
| tag | `s3:ListBucket` | `StateBucket`, `S3Binaries` | unconditional listStacks lists the bucket root (prefix ''). The statement has no s3:prefix condition, so this is allowed. | StateStore/State.ts:271, :281; alchemy/src/State/BucketState.ts:210, :417-425, :469 |
| engine | `s3:GetObject` | `StateObjects`, `S3Binaries` | unconditional Every key is {stack}/{stage}/... (BucketState.ts:181-185, prefix unset), which is inside CiRunners/*. The SSE-KMS objects use the AWS-managed aws/s3 key (no kmsMasterKeyId), whose key policy admits same-account callers through S3, so no IAM KMS g | StateStore/State.ts:293 |
| engine | `s3:PutObject` | `StateObjects`, `S3Binaries` | unconditional Conditional writes need only s3:PutObject. | StateStore/State.ts:309-319; BucketState.ts:204-205, :242-263 |
| delete | `s3:DeleteObject` | `StateObjects`, `S3Binaries` | unconditional (lease release); per resource on delete No VersionId is sent, so s3:DeleteObjectVersion is not needed. | StateStore/State.ts:345-349; BucketState.ts:353, :444 |
| tag | `s3:DeleteObject` | `StateObjects`, `S3Binaries` | conditional: stage removal only | StateStore/State.ts:359; BucketState.ts:210-214 |

