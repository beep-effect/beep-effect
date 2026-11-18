/**
 * The inline policy of the `beep-alchemy-ci-runners-deploy` role, built as
 * data (decision "CI runners deploy through a stack-scoped OIDC role").
 *
 * **Details**
 *
 * v1, the bootstrap version, carries no default-security-group grant. v2
 * adds the default group's two revokes, scoped by `ArnEquals ec2:Vpc` to the
 * fleet VPC that cutover step 1a created. `deploy-role-policy.ts` writes either
 * version as JSON, plus the chunks `aws iam simulate-custom-policy` needs.
 *
 * Ownership is the pair of tags Alchemy stamps on every resource it creates,
 * `alchemy::stack = CiRunners` and `alchemy::stage = prod`. A request can set
 * them only while creating a resource (`ec2:CreateAction`); a direct
 * `ec2:CreateTags` needs them on the target already, so the role can never
 * claim a resource it did not create.
 *
 * @packageDocumentation
 * @category configuration
 * @since 0.0.0
 */

import * as A from "effect/Array";
import * as O from "effect/Option";
import * as Str from "effect/String";
import type * as IAM from "@alchemy.run/aws/IAM";

const account = "832907639880";
const region = "us-east-1";

const owned = { "aws:ResourceTag/alchemy::stack": "CiRunners", "aws:ResourceTag/alchemy::stage": "prod" };
const requested = { "aws:RequestTag/alchemy::stack": "CiRunners", "aws:RequestTag/alchemy::stage": "prod" };

/**
 * The EC2 create actions the stack calls; each tags its resource on create.
 *
 * **Example** (The VPC create)
 *
 * ```ts
 * import { ec2CreateActions } from "@beep/infra-ci-runners/DeployRolePolicy"
 *
 * console.log(ec2CreateActions.includes("ec2:CreateVpc")) // true
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const ec2CreateActions: ReadonlyArray<string> = [
  "ec2:CreateVpc",
  "ec2:CreateSubnet",
  "ec2:CreateInternetGateway",
  "ec2:CreateRouteTable",
  "ec2:CreateSecurityGroup",
  "ec2:CreateFlowLogs",
  "ec2:CreateLaunchTemplate",
];

/**
 * Why each statement that grants a mutating EC2 action on `Resource: "*"`
 * needs the wildcard, by `Sid`. Every one of them is held by a condition on
 * the ownership tags instead.
 *
 * **Example** (The create grant)
 *
 * ```ts
 * import { wildcardResourceReasons } from "@beep/infra-ci-runners/DeployRolePolicy"
 *
 * console.log(typeof wildcardResourceReasons.Ec2CreatesTagged) // "string"
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const wildcardResourceReasons: Readonly<Record<string, string>> = {
  Ec2CreatesTagged:
    "A create names a resource whose id AWS assigns, so no ARN exists to scope; aws:RequestTag binds it to the stack.",
  Ec2TagOnCreate:
    "Tag-on-create targets the resource being created, whose ARN is not known; ec2:CreateAction binds it.",
  Ec2TagOwned:
    "EC2 network objects and launch templates have AWS-assigned ids; aws:ResourceTag on the target scopes it.",
  Ec2MutateOwned:
    "EC2 network objects and launch templates have AWS-assigned ids; aws:ResourceTag on the target scopes it.",
};

const ec2Statements: ReadonlyArray<IAM.PolicyStatement> = [
  { Sid: "Ec2Reads", Effect: "Allow", Action: ["ec2:Describe*"], Resource: ["*"] },
  {
    Sid: "Ec2CreatesTagged",
    Effect: "Allow",
    Action: [...ec2CreateActions],
    Resource: ["*"],
    Condition: { StringEquals: requested },
  },
  {
    Sid: "Ec2TagOnCreate",
    Effect: "Allow",
    Action: ["ec2:CreateTags"],
    Resource: ["*"],
    Condition: {
      StringEquals: { "ec2:CreateAction": A.map(ec2CreateActions, Str.replace("ec2:", "")), ...requested },
    },
  },
  {
    Sid: "Ec2TagOwned",
    Effect: "Allow",
    Action: ["ec2:CreateTags", "ec2:DeleteTags"],
    Resource: ["*"],
    Condition: { StringEquals: owned },
  },
  {
    Sid: "Ec2MutateOwned",
    Effect: "Allow",
    Action: [
      "ec2:ModifyVpcAttribute",
      "ec2:AttachInternetGateway",
      "ec2:DetachInternetGateway",
      "ec2:CreateRoute",
      "ec2:ReplaceRoute",
      "ec2:DeleteRoute",
      "ec2:AssociateRouteTable",
      "ec2:DisassociateRouteTable",
      "ec2:ModifySubnetAttribute",
      "ec2:AuthorizeSecurityGroupEgress",
      "ec2:RevokeSecurityGroupEgress",
      "ec2:RevokeSecurityGroupIngress",
      "ec2:CreateLaunchTemplateVersion",
      "ec2:ModifyLaunchTemplate",
      "ec2:DeleteLaunchTemplateVersions",
      "ec2:DeleteLaunchTemplate",
      "ec2:DeleteFlowLogs",
      "ec2:DeleteSecurityGroup",
      "ec2:DeleteSubnet",
      "ec2:DeleteRouteTable",
      "ec2:DeleteInternetGateway",
      "ec2:DeleteVpc",
    ],
    Resource: ["*"],
    Condition: { StringEquals: owned },
  },
  {
    Sid: "SweepTerminate",
    Effect: "Allow",
    Action: ["ec2:TerminateInstances"],
    Resource: [`arn:aws:ec2:${region}:${account}:instance/*`],
    Condition: { StringLike: { "ec2:ResourceTag/ghr:environment": "beep-fleet-prod-*" } },
  },
];

const fleetRoles = [
  `arn:aws:iam::${account}:role/beep-fleet-prod-*`,
  `arn:aws:iam::${account}:role/CiRunners-*-prod-*`,
];

const iamStatements: ReadonlyArray<IAM.PolicyStatement> = [
  {
    Sid: "IamFleetRoles",
    Effect: "Allow",
    Action: [
      "iam:CreateRole",
      "iam:DeleteRole",
      "iam:GetRole",
      "iam:UpdateRole",
      "iam:UpdateAssumeRolePolicy",
      "iam:TagRole",
      "iam:UntagRole",
      "iam:PutRolePolicy",
      "iam:DeleteRolePolicy",
      "iam:GetRolePolicy",
      "iam:ListRolePolicies",
      "iam:AttachRolePolicy",
      "iam:DetachRolePolicy",
      "iam:ListAttachedRolePolicies",
      "iam:PutRolePermissionsBoundary",
    ],
    Resource: fleetRoles,
  },
  {
    Sid: "IamFleetPolicies",
    Effect: "Allow",
    Action: [
      "iam:CreatePolicy",
      "iam:DeletePolicy",
      "iam:GetPolicy",
      "iam:GetPolicyVersion",
      "iam:ListPolicyVersions",
      "iam:CreatePolicyVersion",
      "iam:DeletePolicyVersion",
      "iam:TagPolicy",
      "iam:UntagPolicy",
    ],
    Resource: [`arn:aws:iam::${account}:policy/beep-fleet/prod/*`],
  },
  {
    Sid: "IamFleetProfiles",
    Effect: "Allow",
    Action: [
      "iam:CreateInstanceProfile",
      "iam:DeleteInstanceProfile",
      "iam:GetInstanceProfile",
      "iam:TagInstanceProfile",
      "iam:AddRoleToInstanceProfile",
      "iam:RemoveRoleFromInstanceProfile",
    ],
    Resource: [`arn:aws:iam::${account}:instance-profile/beep-fleet-prod-*`],
  },
  {
    Sid: "IamPassFleetRoles",
    Effect: "Allow",
    Action: ["iam:PassRole"],
    Resource: fleetRoles,
    Condition: {
      StringEquals: {
        "iam:PassedToService": ["lambda.amazonaws.com", "ec2.amazonaws.com", "vpc-flow-logs.amazonaws.com"],
      },
    },
  },
];

const fleetFunctions = `arn:aws:lambda:${region}:${account}:function:beep-fleet-prod-*`;

const serviceStatements: ReadonlyArray<IAM.PolicyStatement> = [
  {
    Sid: "StateBucket",
    Effect: "Allow",
    Action: [
      "s3:ListBucket",
      "s3:GetBucketLocation",
      "s3:GetBucketVersioning",
      "s3:GetBucketOwnershipControls",
      "s3:GetBucketPublicAccessBlock",
      "s3:GetEncryptionConfiguration",
    ],
    Resource: [`arn:aws:s3:::alchemy-state-${account}-${region}-an`],
  },
  {
    Sid: "StateObjects",
    Effect: "Allow",
    Action: ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"],
    Resource: [`arn:aws:s3:::alchemy-state-${account}-${region}-an/CiRunners/*`],
  },
  {
    Sid: "LambdaFleetFunctions",
    Effect: "Allow",
    Action: [
      "lambda:CreateFunction",
      "lambda:DeleteFunction",
      "lambda:GetFunction",
      "lambda:GetFunctionConfiguration",
      "lambda:UpdateFunctionCode",
      "lambda:UpdateFunctionConfiguration",
      "lambda:CreateFunctionUrlConfig",
      "lambda:UpdateFunctionUrlConfig",
      "lambda:DeleteFunctionUrlConfig",
      "lambda:GetFunctionUrlConfig",
      "lambda:PutFunctionConcurrency",
      "lambda:DeleteFunctionConcurrency",
      "lambda:TagResource",
      "lambda:UntagResource",
      "lambda:ListTags",
      "lambda:AddPermission",
      "lambda:RemovePermission",
      "lambda:GetPolicy",
    ],
    Resource: [fleetFunctions],
  },
  // An event-source mapping has no ARN until it exists: its create is scoped by the target function instead.
  {
    Sid: "LambdaMappingsCreate",
    Effect: "Allow",
    Action: ["lambda:CreateEventSourceMapping"],
    Resource: ["*"],
    Condition: { ArnLike: { "lambda:FunctionArn": fleetFunctions } },
  },
  {
    Sid: "LambdaMappingsRead",
    Effect: "Allow",
    Action: ["lambda:ListEventSourceMappings", "lambda:GetEventSourceMapping"],
    Resource: ["*"],
  },
  {
    Sid: "LambdaMappingsOwned",
    Effect: "Allow",
    Action: ["lambda:UpdateEventSourceMapping", "lambda:DeleteEventSourceMapping"],
    Resource: ["*"],
    Condition: { ArnLike: { "lambda:FunctionArn": fleetFunctions } },
  },
  {
    Sid: "SqsFleetQueues",
    Effect: "Allow",
    Action: [
      "sqs:CreateQueue",
      "sqs:DeleteQueue",
      "sqs:GetQueueAttributes",
      "sqs:SetQueueAttributes",
      "sqs:GetQueueUrl",
      "sqs:TagQueue",
      "sqs:UntagQueue",
      "sqs:ListQueueTags",
    ],
    Resource: [`arn:aws:sqs:${region}:${account}:beep-fleet-prod-*`],
  },
  {
    Sid: "SsmFleetParameters",
    Effect: "Allow",
    Action: [
      "ssm:PutParameter",
      "ssm:GetParameter",
      "ssm:GetParameters",
      "ssm:DeleteParameter",
      "ssm:AddTagsToResource",
      "ssm:RemoveTagsFromResource",
      "ssm:ListTagsForResource",
    ],
    Resource: [`arn:aws:ssm:${region}:${account}:parameter/beep-fleet/prod/*`],
  },
  { Sid: "SsmDescribe", Effect: "Allow", Action: ["ssm:DescribeParameters"], Resource: ["*"] },
  {
    Sid: "KmsCreateTagged",
    Effect: "Allow",
    Action: ["kms:CreateKey", "kms:TagResource"],
    Resource: ["*"],
    Condition: { StringEquals: { "aws:RequestTag/alchemy::stack": "CiRunners" } },
  },
  {
    Sid: "KmsOwnedKeys",
    Effect: "Allow",
    Action: [
      "kms:DescribeKey",
      "kms:GetKeyPolicy",
      "kms:PutKeyPolicy",
      "kms:EnableKeyRotation",
      "kms:GetKeyRotationStatus",
      "kms:ScheduleKeyDeletion",
      "kms:TagResource",
      "kms:UntagResource",
      "kms:ListResourceTags",
      "kms:Encrypt",
      "kms:Decrypt",
      "kms:GenerateDataKey",
    ],
    Resource: ["*"],
    Condition: { StringEquals: { "aws:ResourceTag/alchemy::stack": "CiRunners" } },
  },
  {
    Sid: "KmsFleetAliases",
    Effect: "Allow",
    Action: ["kms:CreateAlias", "kms:UpdateAlias", "kms:DeleteAlias"],
    Resource: [`arn:aws:kms:${region}:${account}:alias/beep-fleet-prod-*`],
  },
  {
    Sid: "S3Binaries",
    Effect: "Allow",
    Action: [
      "s3:CreateBucket",
      "s3:DeleteBucket",
      "s3:PutBucketPublicAccessBlock",
      "s3:GetBucketPublicAccessBlock",
      "s3:PutBucketTagging",
      "s3:GetBucketTagging",
      "s3:PutObject",
      "s3:DeleteObject",
      "s3:GetObject",
      "s3:ListBucket",
    ],
    Resource: [
      `arn:aws:s3:::beep-fleet-prod-binaries-${account}`,
      `arn:aws:s3:::beep-fleet-prod-binaries-${account}/*`,
    ],
  },
  {
    Sid: "EventsFleetRules",
    Effect: "Allow",
    Action: [
      "events:PutRule",
      "events:DeleteRule",
      "events:DescribeRule",
      "events:PutTargets",
      "events:RemoveTargets",
      "events:ListTargetsByRule",
      "events:TagResource",
      "events:UntagResource",
      "events:ListTagsForResource",
    ],
    Resource: [`arn:aws:events:${region}:${account}:rule/beep-fleet-prod-*`],
  },
  {
    Sid: "LogsFleetGroups",
    Effect: "Allow",
    Action: [
      "logs:CreateLogGroup",
      "logs:DeleteLogGroup",
      "logs:PutRetentionPolicy",
      "logs:TagResource",
      "logs:UntagResource",
      "logs:ListTagsForResource",
    ],
    Resource: [
      `arn:aws:logs:${region}:${account}:log-group:/beep-fleet/prod/*`,
      `arn:aws:logs:${region}:${account}:log-group:/aws/lambda/beep-fleet-prod-*`,
    ],
  },
  { Sid: "LogsDescribe", Effect: "Allow", Action: ["logs:DescribeLogGroups"], Resource: ["*"] },
  { Sid: "Sts", Effect: "Allow", Action: ["sts:GetCallerIdentity"], Resource: ["*"] },
];

/**
 * The default group's two revokes, held to the fleet VPC itself.
 *
 * **Example** (Scoped to one VPC)
 *
 * ```ts
 * import { defaultGroupStatement } from "@beep/infra-ci-runners/DeployRolePolicy"
 *
 * const statement = defaultGroupStatement("arn:aws:ec2:us-east-1:832907639880:vpc/vpc-0abc")
 * console.log(statement.Condition) // { ArnEquals: { "ec2:Vpc": "arn:aws:ec2:us-east-1:832907639880:vpc/vpc-0abc" } }
 * ```
 *
 * @param vpcArn - The ARN of the prod fleet VPC (cutover step 1a).
 * @returns The statement policy v2 adds.
 * @category configuration
 * @since 0.0.0
 */
export const defaultGroupStatement = (vpcArn: string): IAM.PolicyStatement => ({
  Sid: "DefaultGroupRulesFleetVpc",
  Effect: "Allow",
  Action: ["ec2:RevokeSecurityGroupIngress", "ec2:RevokeSecurityGroupEgress"],
  Resource: [`arn:aws:ec2:${region}:${account}:security-group/*`],
  Condition: { ArnEquals: { "ec2:Vpc": vpcArn } },
});

/**
 * The deploy role's inline policy: v1 without a VPC, v2 with the fleet VPC.
 *
 * **Example** (Build v1)
 *
 * ```ts
 * import { deployRolePolicy } from "@beep/infra-ci-runners/DeployRolePolicy"
 * import * as O from "effect/Option"
 *
 * console.log(deployRolePolicy(O.none()).Version) // "2012-10-17"
 * ```
 *
 * @param vpcArn - The prod fleet VPC ARN for v2, or none for v1.
 * @returns The policy document.
 * @category configuration
 * @since 0.0.0
 */
export const deployRolePolicy = (vpcArn: O.Option<string>): IAM.PolicyDocument => ({
  Version: "2012-10-17",
  Statement: [
    ...serviceStatements,
    ...ec2Statements,
    ...iamStatements,
    ...O.toArray(O.map(vpcArn, defaultGroupStatement)),
  ],
});

/**
 * Split items into groups whose encoded document stays within `limit`
 * characters, keeping order and every item whole: an item joins the open
 * group while `overhead` plus the group's lengths and one separator per extra
 * item fits. An item longer than the limit sits alone in its group.
 *
 * **Example** (Two chunks)
 *
 * ```ts
 * import { chunkByLength } from "@beep/infra-ci-runners/DeployRolePolicy"
 *
 * console.log(chunkByLength({ lengths: [900, 900, 900], limit: 2000, overhead: 100 })) // [[0, 1], [2]]
 * ```
 *
 * @param input - Each item's encoded length in order, the most characters one encoded group may take, and the characters the enclosing document adds once per group.
 * @returns The item indexes of each group.
 * @category configuration
 * @since 0.0.0
 */
export const chunkByLength = (input: {
  readonly lengths: ReadonlyArray<number>;
  readonly limit: number;
  readonly overhead: number;
}): ReadonlyArray<ReadonlyArray<number>> => {
  // Each open group carries its encoded size so far: the overhead plus its items and their separators.
  const groups = A.reduce(
    input.lengths,
    A.empty<{ readonly members: ReadonlyArray<number>; readonly used: number }>(),
    (open, length, index) =>
      O.match(A.last(open), {
        onNone: () => [{ members: [index], used: input.overhead + length }],
        onSome: (last) =>
          last.used + 1 + length <= input.limit
            ? A.append(A.dropRight(open, 1), { members: A.append(last.members, index), used: last.used + 1 + length })
            : A.append(open, { members: [index], used: input.overhead + length }),
      })
  );
  return A.map(groups, (group) => group.members);
};
