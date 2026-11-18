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
import { stageSlug } from "./Names.ts";
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

// The roles of one stage: pinned `beep-fleet-<slug>-*` names and Alchemy's generated `CiRunners-<id>-<slug>-<suffix>`.
const fleetRolesOf = (slug: string) => [
  `arn:aws:iam::${account}:role/beep-fleet-${slug}-*`,
  `arn:aws:iam::${account}:role/CiRunners-*-${slug}-*`,
];

const fleetRoles = fleetRolesOf("prod");

/**
 * The ARN of a stage's permissions boundary: a bootstrap object the gate
 * creates out of band (decision "CI runners deploy through a stack-scoped
 * OIDC role"), one per stage, at a path no deploy-role policy grant reaches,
 * so the deploy role can neither edit nor replace it.
 *
 * **Example** (The production boundary)
 *
 * ```ts
 * import { fleetBoundaryPolicyArnFor } from "@beep/infra-ci-runners/DeployRolePolicy"
 *
 * console.log(fleetBoundaryPolicyArnFor("prod")) // "arn:aws:iam::832907639880:policy/beep-fleet-boundary/fleet-boundary-prod"
 * ```
 *
 * @param stage - The Alchemy stage, slugged into the policy name (`dev_Alice` becomes `fleet-boundary-dev-alice`).
 * @returns The boundary policy ARN of that stage.
 * @category configuration
 * @since 0.0.0
 */
export const fleetBoundaryPolicyArnFor = (stage: string): string =>
  `arn:aws:iam::${account}:policy/beep-fleet-boundary/fleet-boundary-${stageSlug(stage)}`;

/**
 * The production boundary ARN, the only one the deploy role's role grants
 * accept.
 *
 * **Example** (Outside the stack's policy path)
 *
 * ```ts
 * import { fleetBoundaryPolicyArn } from "@beep/infra-ci-runners/DeployRolePolicy"
 *
 * console.log(fleetBoundaryPolicyArn.includes("/beep-fleet/prod/")) // false
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const fleetBoundaryPolicyArn = fleetBoundaryPolicyArnFor("prod");

const withBoundary = { "iam:PermissionsBoundary": fleetBoundaryPolicyArn };

const instances = `arn:aws:ec2:${region}:${account}:instance/*`;

/**
 * Why each boundary allow that names `Resource: "*"` needs the wildcard, by
 * `Sid`. Every one grants read-only actions: the property tests hold the rest
 * of the ceiling to fleet ARNs and fleet tags.
 *
 * **Example** (The EC2 reads)
 *
 * ```ts
 * import { boundaryWildcardReasons } from "@beep/infra-ci-runners/DeployRolePolicy"
 *
 * console.log(typeof boundaryWildcardReasons.CeilingEc2Reads) // "string"
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const boundaryWildcardReasons: Readonly<Record<string, string>> = {
  CeilingEc2Reads: "EC2 Describe calls take no resource-level scope.",
  CeilingListReads: "DescribeParameters, DescribeLogGroups and GetCallerIdentity take no resource-level scope.",
};

// Each allow is one stage's own reach: pinned names start `beep-fleet-<slug>-` and Alchemy's generated ones
// `CiRunners-<id>-<slug>-` (S3: lower case), so no pattern reaches another stage.
const fleetCeilingStatements = (stage: string): ReadonlyArray<IAM.PolicyStatement> => {
  const slug = stageSlug(stage);
  const environment = `beep-fleet-${slug}-*`;
  const parameters = `arn:aws:ssm:${region}:${account}:parameter/beep-fleet/${slug}/*`;
  const named = (service: string) => [
    `arn:aws:${service}:${region}:${account}:${service === "lambda" ? "function:" : ""}beep-fleet-${slug}-*`,
    `arn:aws:${service}:${region}:${account}:${service === "lambda" ? "function:" : ""}CiRunners-*-${slug}-*`,
  ];
  return [
    {
      Sid: "CeilingEc2Reads",
      Effect: "Allow",
      Action: ["ec2:DescribeInstances", "ec2:DescribeLaunchTemplateVersions", "ec2:DescribeTags"],
      Resource: ["*"],
    },
    {
      Sid: "CeilingListReads",
      Effect: "Allow",
      Action: ["ssm:DescribeParameters", "logs:DescribeLogGroups", "sts:GetCallerIdentity"],
      Resource: ["*"],
    },
    // A launch creates the instance, its volumes and the EC2 Fleet request, each tagged with the pool's environment.
    {
      Sid: "CeilingLaunchTagged",
      Effect: "Allow",
      Action: ["ec2:CreateFleet", "ec2:RunInstances"],
      Resource: [instances, `arn:aws:ec2:${region}:${account}:volume/*`, `arn:aws:ec2:${region}:${account}:fleet/*`],
      Condition: { StringLike: { "aws:RequestTag/ghr:environment": environment } },
    },
    // ...and only into the stack's own subnet and security group (and its launch template, when one is named).
    {
      Sid: "CeilingLaunchFromStack",
      Effect: "Allow",
      Action: ["ec2:CreateFleet", "ec2:RunInstances"],
      Resource: [
        `arn:aws:ec2:${region}:${account}:launch-template/*`,
        `arn:aws:ec2:${region}:${account}:subnet/*`,
        `arn:aws:ec2:${region}:${account}:security-group/*`,
      ],
      Condition: {
        StringEquals: { "aws:ResourceTag/alchemy::stack": "CiRunners", "aws:ResourceTag/alchemy::stage": stage },
      },
    },
    // The launch reads the AMI and its snapshots and creates the interface and the Spot request it has no tags for;
    // the subnet and security group the interface joins are held by CeilingLaunchFromStack.
    {
      Sid: "CeilingLaunchInputs",
      Effect: "Allow",
      Action: ["ec2:CreateFleet", "ec2:RunInstances"],
      Resource: [
        `arn:aws:ec2:${region}::image/*`,
        `arn:aws:ec2:${region}::snapshot/*`,
        `arn:aws:ec2:${region}:${account}:network-interface/*`,
        `arn:aws:ec2:${region}:${account}:spot-instances-request/*`,
      ],
    },
    {
      Sid: "CeilingTagOnLaunch",
      Effect: "Allow",
      Action: ["ec2:CreateTags"],
      Resource: [instances, `arn:aws:ec2:${region}:${account}:volume/*`, `arn:aws:ec2:${region}:${account}:fleet/*`],
      Condition: {
        StringEquals: { "ec2:CreateAction": ["CreateFleet", "RunInstances"] },
        StringLike: { "aws:RequestTag/ghr:environment": environment },
      },
    },
    {
      Sid: "CeilingFleetInstances",
      Effect: "Allow",
      Action: ["ec2:CreateTags", "ec2:DeleteTags", "ec2:TerminateInstances", "ec2:ModifyInstanceMetadataOptions"],
      Resource: [instances],
      Condition: { StringLike: { "aws:ResourceTag/ghr:environment": environment } },
    },
    {
      Sid: "CeilingFleetParameters",
      Effect: "Allow",
      Action: [
        "ssm:AddTagsToResource",
        "ssm:DeleteParameter",
        "ssm:GetParameter",
        "ssm:GetParameters",
        "ssm:GetParametersByPath",
        "ssm:PutParameter",
      ],
      Resource: [parameters],
    },
    // Fleet secrets are SecureStrings under the fleet key or aws/ssm: a key serves the fleet only through SSM and only
    // for a fleet parameter, whose ARN SSM puts in the encryption context.
    {
      Sid: "CeilingKmsThroughFleetParameters",
      Effect: "Allow",
      Action: ["kms:Decrypt", "kms:Encrypt", "kms:GenerateDataKey"],
      Resource: [`arn:aws:kms:${region}:${account}:key/*`],
      Condition: {
        StringEquals: { "kms:ViaService": `ssm.${region}.amazonaws.com` },
        StringLike: { "kms:EncryptionContext:PARAMETER_ARN": parameters },
      },
    },
    {
      Sid: "CeilingFleetBinaries",
      Effect: "Allow",
      Action: ["s3:GetObject", "s3:GetObjectTagging", "s3:PutObject", "s3:PutObjectTagging"],
      Resource: [`arn:aws:s3:::beep-fleet-${slug}-binaries-*/*`, `arn:aws:s3:::cirunners-*-${slug}-*/*`],
    },
    {
      Sid: "CeilingFleetLogs",
      Effect: "Allow",
      Action: ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:DescribeLogStreams", "logs:PutLogEvents"],
      Resource: [
        `arn:aws:logs:${region}:${account}:log-group:/beep-fleet/${slug}/*`,
        `arn:aws:logs:${region}:${account}:log-group:/aws/lambda/beep-fleet-${slug}-*`,
        `arn:aws:logs:${region}:${account}:log-group:/aws/lambda/CiRunners-*-${slug}-*`,
      ],
    },
    {
      Sid: "CeilingFleetQueues",
      Effect: "Allow",
      Action: [
        "sqs:ChangeMessageVisibility",
        "sqs:DeleteMessage",
        "sqs:GetQueueAttributes",
        "sqs:ReceiveMessage",
        "sqs:SendMessage",
      ],
      Resource: named("sqs"),
    },
    {
      Sid: "CeilingFleetFunctions",
      Effect: "Allow",
      Action: ["lambda:InvokeFunction"],
      Resource: named("lambda"),
    },
    { Sid: "CeilingPassFleetRoles", Effect: "Allow", Action: ["iam:PassRole"], Resource: fleetRolesOf(slug) },
  ];
};

/**
 * The permissions boundary of every role one stage creates (runner, Lambda
 * execution, flow logs, reaper), published at
 * {@link fleetBoundaryPolicyArnFor}. A role's permissions are the
 * intersection of its policies and this ceiling, so even a policy the deploy
 * role writes cannot exceed it.
 *
 * **Details**
 *
 * The allow statements are the ceiling, scoped to the one stage: for `prod`
 * no wider than the deploy role's own reach, and matching no name of another
 * stage. They cover that stage's SSM parameters, queues, functions, log groups and
 * binaries bucket by ARN, KMS only through SSM for a fleet parameter, and EC2
 * mutations only on instances tagged with a fleet `ghr:environment`; a
 * launch needs that request tag and a stack-owned subnet and security group
 * (and launch template, when the request names one). Only the reads in {@link boundaryWildcardReasons} name
 * `Resource: "*"`. There is no snapshot, image or volume-attribute grant. The deny statements close the escalation paths
 * explicitly: every IAM write but passing a fleet role, assuming or passing
 * any role outside the stage's fleet, and every Organizations, account and billing
 * action. The IMDS deny keeps a runner from re-enabling the metadata endpoint
 * once its boundary script has disabled it.
 *
 * **Example** (Read the escalation denies)
 *
 * ```ts
 * import { fleetBoundary } from "@beep/infra-ci-runners/DeployRolePolicy"
 *
 * console.log(fleetBoundary("prod").Statement.filter((statement) => statement.Effect === "Deny").length) // 5
 * ```
 *
 * @param stage - The stage whose roles the boundary caps.
 * @returns The boundary document.
 * @category configuration
 * @since 0.0.0
 */
export const fleetBoundary = (stage: string): IAM.PolicyDocument => ({
  Version: "2012-10-17",
  Statement: [
    ...fleetCeilingStatements(stage),
    {
      Sid: "DenyIamWrites",
      Effect: "Deny",
      Action: [
        "iam:Add*",
        "iam:Attach*",
        "iam:Change*",
        "iam:Create*",
        "iam:Deactivate*",
        "iam:Delete*",
        "iam:Detach*",
        "iam:Enable*",
        "iam:Put*",
        "iam:Remove*",
        "iam:Reset*",
        "iam:Set*",
        "iam:Tag*",
        "iam:Untag*",
        "iam:Update*",
        "iam:Upload*",
      ],
      Resource: ["*"],
    },
    {
      Sid: "DenyPassOutsideFleet",
      Effect: "Deny",
      Action: ["iam:PassRole"],
      NotResource: fleetRolesOf(stageSlug(stage)),
    },
    {
      Sid: "DenyAssumeOutsideFleet",
      Effect: "Deny",
      Action: ["sts:AssumeRole*"],
      NotResource: fleetRolesOf(stageSlug(stage)),
    },
    {
      Sid: "DenyOrganizationAccountBilling",
      Effect: "Deny",
      Action: ["organizations:*", "account:*", "aws-portal:*", "billing:*"],
      Resource: ["*"],
    },
    {
      Sid: "DenyMetadataOptionsOnceDisabled",
      Effect: "Deny",
      Action: ["ec2:ModifyInstanceMetadataOptions"],
      Resource: ["*"],
      Condition: { StringEquals: { "ec2:MetadataHttpEndpoint": "disabled" } },
    },
  ],
});

// The only AWS-managed policy the stack attaches: Alchemy's Lambda execution roles get it.
const lambdaBasicExecution = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole";
const fleetPolicies = `arn:aws:iam::${account}:policy/beep-fleet/prod/*`;

const iamStatements: ReadonlyArray<IAM.PolicyStatement> = [
  {
    Sid: "IamFleetRoleReads",
    Effect: "Allow",
    Action: [
      "iam:GetRole",
      "iam:GetRolePolicy",
      "iam:ListRolePolicies",
      "iam:ListAttachedRolePolicies",
      "iam:ListRoleTags",
    ],
    Resource: fleetRoles,
  },
  // Every write to a fleet role's permissions needs the fleet boundary on the role, so whatever it holds stays capped.
  {
    Sid: "IamFleetRoleBounded",
    Effect: "Allow",
    Action: [
      "iam:CreateRole",
      "iam:PutRolePolicy",
      "iam:DeleteRolePolicy",
      "iam:DetachRolePolicy",
      "iam:PutRolePermissionsBoundary",
    ],
    Resource: fleetRoles,
    Condition: { StringEquals: withBoundary },
  },
  {
    Sid: "IamFleetRoleAttach",
    Effect: "Allow",
    Action: ["iam:AttachRolePolicy"],
    Resource: fleetRoles,
    Condition: { StringEquals: withBoundary, ArnLike: { "iam:PolicyARN": [fleetPolicies, lambdaBasicExecution] } },
  },
  // Metadata only: tags, description and the delete of a fleet role grant no permission.
  {
    Sid: "IamFleetRoleMetadata",
    Effect: "Allow",
    Action: ["iam:TagRole", "iam:UntagRole", "iam:UpdateRole", "iam:DeleteRole"],
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
    Resource: [fleetPolicies],
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
  // Every mapping write names a fleet function by lambda:FunctionArn (the Service Authorization Reference lists the
  // key on Create, Update and Delete); a later write also needs the ownership tags on the mapping.
  {
    Sid: "LambdaMappingsCreate",
    Effect: "Allow",
    Action: ["lambda:CreateEventSourceMapping"],
    Resource: ["*"],
    Condition: { ArnLike: { "lambda:FunctionArn": fleetFunctions }, StringEquals: requested },
  },
  // CreateEventSourceMapping with Tags depends on lambda:TagResource, and tag on create carries no create-action
  // key, so this is the narrowest tag grant Alchemy's create needs: only the three ownership keys, with the stack's
  // values. Tagging a foreign mapping makes it writable only if it targets a fleet function. Which function ARN AWS
  // evaluates on a retargeting Update is unverified, so the live mappings are covered by DenyLiveFleetMappings and the
  // by-target live check (after 1a, after 1b and before the drain), not by the lambda:FunctionArn condition. No other
  // automation principal can attach a mapping to a fleet function (account admins could; that check catches any).
  {
    Sid: "LambdaMappingsTagOnCreate",
    Effect: "Allow",
    Action: ["lambda:TagResource"],
    Resource: [`arn:aws:lambda:${region}:${account}:event-source-mapping:*`],
    Condition: {
      StringEquals: requested,
      "ForAllValues:StringEquals": { "aws:TagKeys": ["alchemy::stack", "alchemy::stage", "alchemy::id"] },
    },
  },
  {
    Sid: "LambdaMappingsRead",
    Effect: "Allow",
    Action: ["lambda:ListEventSourceMappings", "lambda:GetEventSourceMapping", "lambda:ListTags"],
    Resource: ["*"],
  },
  {
    Sid: "LambdaMappingsOwned",
    Effect: "Allow",
    Action: ["lambda:UpdateEventSourceMapping", "lambda:DeleteEventSourceMapping"],
    Resource: [`arn:aws:lambda:${region}:${account}:event-source-mapping:*`],
    Condition: { ArnLike: { "lambda:FunctionArn": fleetFunctions }, StringEquals: owned },
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

// The live Pulumi fleet's six event-source mappings (beep-ci and beep-ovf: scale-up, job-retry, deregister-retry),
// read with `aws lambda list-event-source-mappings` on 2026-11-18. Removed at P5 drain+destroy.
const liveFleetMappingUuids = [
  "fbc1f039-9aef-40a2-9481-c8a18e6c4157", // beep-ci-job-retry
  "e93fcf22-bfe9-4da4-92e7-a124812ac31b", // beep-ci-scale-up
  "eb15d409-4ee9-4d5c-b599-d7116dcf804c", // beep-ci-deregister-retry
  "5bd25a59-5455-4923-aadb-e4db4c600439", // beep-ovf-job-retry
  "c54ad5fd-8b22-4e61-b52b-1fb9857c70a7", // beep-ovf-deregister-retry
  "fe8ccc78-bafa-4ea2-aff9-b022acd2f642", // beep-ovf-scale-up
];

// Mapping tags grant ownership, and an update can retarget a mapping, so no grant may reach the live fleet's mappings:
// a stalled live scale-up stalls production CI. Keyed on the ARNs alone, with no condition. Removed at P5 drain+destroy.
const denyLiveFleetMappings: IAM.PolicyStatement = {
  Sid: "DenyLiveFleetMappings",
  Effect: "Deny",
  Action: [
    "lambda:TagResource",
    "lambda:UntagResource",
    "lambda:UpdateEventSourceMapping",
    "lambda:DeleteEventSourceMapping",
  ],
  Resource: A.map(liveFleetMappingUuids, (uuid) => `arn:aws:lambda:${region}:${account}:event-source-mapping:${uuid}`),
};

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
 * Both end with `DenyLiveFleetMappings`, which keeps every grant off the
 * live fleet's six event-source mappings until the P5 drain and destroy.
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
    denyLiveFleetMappings,
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
