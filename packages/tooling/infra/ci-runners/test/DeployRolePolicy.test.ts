import { fleetResourceNames, poolResourceNames } from "@beep/alchemy-github-runners/RunnerFleetNames";
import {
  DeployPolicyVersionRequest,
  DeployPolicyVersionUnstated,
  deployPolicyVersion,
} from "@beep/infra-ci-runners/DeployPolicyVersion";
import {
  boundaryWildcardReasons,
  chunkByLength,
  defaultGroupStatement,
  deployRolePolicy,
  ec2CreateActions,
  ec2CreatesInVpc,
  fleetBoundary,
  fleetBoundaryPolicyArn,
  fleetBoundaryPolicyArnFor,
  managedPolicyDocuments,
  managedPolicyLimit,
  wildcardResourceReasons,
} from "@beep/infra-ci-runners/DeployRolePolicy";
import { requireDistinctStage } from "@beep/infra-ci-runners/Guards";
import { physicalNames, poolEnvironment } from "@beep/infra-ci-runners/Names";
import { describe, expect, it } from "@effect/vitest";
import { assertFalse, assertTrue } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import type * as IAM from "@alchemy.run/aws/IAM";

const vpcArn = "arn:aws:ec2:us-east-1:832907639880:vpc/vpc-0000000000000new0";
const v1 = deployRolePolicy(O.none());
const v2 = deployRolePolicy(O.some(vpcArn));

const actionsOf = (statement: IAM.PolicyStatement): ReadonlyArray<string> => statement.Action ?? [];
const resourcesOf = (statement: IAM.PolicyStatement): ReadonlyArray<string> =>
  P.isString(statement.Resource) ? [statement.Resource] : (statement.Resource ?? []);
const conditionKeys = (statement: IAM.PolicyStatement): ReadonlyArray<string> =>
  A.flatMap(R.values(statement.Condition ?? {}), (operator) => R.keys(operator));
const grants = (statement: IAM.PolicyStatement, action: string) => A.contains(actionsOf(statement), action);
const isReadOnly = (action: string) => /^[a-z0-9]+:(?:Describe|Get|List)/u.test(action);

describe("CiRunners deploy role policy chunks", () => {
  it.effect("keeps items whole and in order, within the limit, and isolates an oversized item", () =>
    Effect.sync(() => {
      const chunk = (lengths: ReadonlyArray<number>) => chunkByLength({ lengths, limit: 2000, overhead: 100 });
      expect(chunk([])).toStrictEqual([]);
      expect(chunk([600, 600, 600])).toStrictEqual([[0, 1, 2]]);
      expect(chunk([900, 900, 900])).toStrictEqual([[0, 1], [2]]);
      expect(chunk([2500, 10])).toStrictEqual([[0], [1]]);
      expect(chunk([900, 900])).toStrictEqual([[0, 1]]);
    })
  );
});

const encodeJson = S.encodeEffect(S.fromJsonString(S.Unknown));

describe("CiRunners deploy role policy version", () => {
  const vpcArn = O.some("arn:aws:ec2:us-east-1:832907639880:vpc/vpc-0123456789abcdef0");

  it.effect("writes v2 with the fleet VPC ARN and v1 only on an explicit pre-VPC run", () =>
    Effect.gen(function* () {
      const v2 = yield* deployPolicyVersion(DeployPolicyVersionRequest.make({ vpcArn, beforeVpc: false }));
      const v1 = yield* deployPolicyVersion(DeployPolicyVersionRequest.make({ vpcArn: O.none(), beforeVpc: true }));
      expect([v2, v1]).toStrictEqual(["v2", "v1"]);
    })
  );

  it.effect("refuses a run that states neither version, and one that states both", () =>
    Effect.gen(function* () {
      const neither = yield* Effect.flip(
        deployPolicyVersion(DeployPolicyVersionRequest.make({ vpcArn: O.none(), beforeVpc: false }))
      );
      const both = yield* Effect.flip(
        deployPolicyVersion(DeployPolicyVersionRequest.make({ vpcArn, beforeVpc: true }))
      );
      expect([neither._tag, both._tag]).toStrictEqual(["DeployPolicyVersionUnstated", "DeployPolicyVersionUnstated"]);
      expect(S.is(DeployPolicyVersionUnstated)(neither) ? neither.reason : "").toContain("--vpc-arn");
    })
  );
});

describe("CiRunners deploy role managed policies", () => {
  it.effect("splits v1 and v2 into whole statements in source order, each document within the IAM limit", () =>
    Effect.gen(function* () {
      for (const policy of [v1, v2]) {
        const documents = yield* managedPolicyDocuments(policy);
        const lengths = yield* Effect.forEach(documents, (document) => Effect.map(encodeJson(document), Str.length), {
          concurrency: 1,
        });
        assertTrue(A.every(lengths, (length) => length <= managedPolicyLimit));
        expect(
          documents.length,
          "the role holds exactly two managed policies; a third needs a policy created and attached by hand first"
        ).toBe(2);
        expect(
          A.flatMap(documents, (document) => document.Statement),
          "the union is the source: every statement once, whole, with its Sid, in the source order"
        ).toStrictEqual(policy.Statement);
        expect(A.dedupe(A.map(documents, (document) => document.Version))).toStrictEqual([policy.Version]);
        assertTrue(A.every(documents, (document) => A.isReadonlyArrayNonEmpty(document.Statement)));
        assertTrue(A.every(policy.Statement, (statement) => P.isString(statement.Sid)));
        const again = yield* managedPolicyDocuments(policy);
        expect(again, "the same source splits the same way").toStrictEqual(documents);
      }
    })
  );
});

describe("CiRunners deploy role policy", () => {
  it.effect("grants the parent-VPC side of a create only on a VPC that carries the ownership tags", () =>
    Effect.gen(function* () {
      for (const policy of [v1, v2]) {
        for (const action of ec2CreatesInVpc) {
          const granting = A.filter(policy.Statement, (statement) => grants(statement, action));
          expect(A.map(granting, (statement) => statement.Sid)).toStrictEqual([
            "Ec2CreatesTagged",
            "Ec2CreatesInOwnedVpc",
          ]);
        }
        const [tagged] = A.filter(policy.Statement, (statement) => statement.Sid === "Ec2CreatesTagged");
        const [inVpc] = A.filter(policy.Statement, (statement) => statement.Sid === "Ec2CreatesInOwnedVpc");
        expect(tagged?.Condition, "the child-resource side still needs the request tags on every create").toStrictEqual(
          {
            StringEquals: { "aws:RequestTag/alchemy::stack": "CiRunners", "aws:RequestTag/alchemy::stage": "prod" },
          }
        );
        expect(actionsOf(tagged ?? { Effect: "Allow" })).toStrictEqual(ec2CreateActions);
        expect(
          resourcesOf(inVpc ?? { Effect: "Allow" }),
          "the VPC side names the VPC resource type only, never a literal VPC id"
        ).toStrictEqual(["arn:aws:ec2:us-east-1:832907639880:vpc/*"]);
        expect(inVpc?.Condition, "the VPC side needs the ownership tags on that VPC").toStrictEqual({
          StringEquals: { "aws:ResourceTag/alchemy::stack": "CiRunners", "aws:ResourceTag/alchemy::stage": "prod" },
        });
        expect(actionsOf(inVpc ?? { Effect: "Allow" })).toStrictEqual(ec2CreatesInVpc);
        assertTrue(A.every(ec2CreatesInVpc, (action) => A.contains(ec2CreateActions, action)));
        assertFalse(A.contains(ec2CreatesInVpc, "ec2:CreateVpc"));
      }
    })
  );

  it.effect("holds the reads and cleanup grants step 1a's failure showed to the fleet's own names", () =>
    Effect.gen(function* () {
      const only = (action: string) => A.filter(v2.Statement, (statement) => grants(statement, action));
      const scope = (action: string) => A.map(only(action), (statement) => [statement.Sid, resourcesOf(statement)]);
      const fleetFunctions = ["arn:aws:lambda:us-east-1:832907639880:function:beep-fleet-prod-*"];
      expect(scope("lambda:GetFunctionConcurrency")).toStrictEqual([["LambdaFleetFunctions", fleetFunctions]]);
      expect(scope("lambda:GetFunctionEventInvokeConfig")).toStrictEqual([["LambdaFleetFunctions", fleetFunctions]]);
      const fleetPolicies = ["arn:aws:iam::832907639880:policy/beep-fleet/prod/*"];
      expect(scope("iam:ListPolicyTags")).toStrictEqual([["IamFleetPolicies", fleetPolicies]]);
      expect(
        scope("iam:SetDefaultPolicyVersion"),
        "the default-version write reaches the fleet's policies only, never the deploy role's own managed policies"
      ).toStrictEqual([["IamFleetPolicies", fleetPolicies]]);
      expect(scope("iam:UntagInstanceProfile")).toStrictEqual([
        ["IamFleetProfiles", ["arn:aws:iam::832907639880:instance-profile/beep-fleet-prod-*"]],
      ]);
      expect(scope("ssm:GetParametersByPath")).toStrictEqual([
        ["SsmFleetParameters", ["arn:aws:ssm:us-east-1:832907639880:parameter/beep-fleet/prod/*"]],
      ]);
      const binaries = [
        "arn:aws:s3:::beep-fleet-prod-binaries-832907639880",
        "arn:aws:s3:::beep-fleet-prod-binaries-832907639880/*",
      ];
      for (const action of [
        "s3:ListBucketVersions",
        "s3:ListBucketMultipartUploads",
        "s3:AbortMultipartUpload",
        "s3:DeleteObjectVersion",
      ]) {
        expect(scope(action)).toStrictEqual([["S3Binaries", binaries]]);
      }
      expect(scope("logs:PutLogGroupDeletionProtection")).toStrictEqual([
        [
          "LogsFleetGroups",
          [
            "arn:aws:logs:us-east-1:832907639880:log-group:/beep-fleet/prod/*",
            "arn:aws:logs:us-east-1:832907639880:log-group:/aws/lambda/beep-fleet-prod-*",
          ],
        ],
      ]);
      expect(
        scope("sqs:ListQueues"),
        'SQS gives ListQueues no resource type; it is the only SQS grant on "*", and it reads'
      ).toStrictEqual([["SqsList", ["*"]]]);
      expect(A.flatMap(only("sqs:ListQueues"), actionsOf)).toStrictEqual(["sqs:ListQueues"]);
    })
  );

  it.effect("never names the deploy role's own managed policies, and never removes a boundary", () =>
    Effect.gen(function* () {
      const allows = A.filter(v2.Statement, (statement) => statement.Effect === "Allow");
      const text = yield* encodeJson(allows);
      assertFalse(Str.includes("beep-alchemy-deploy")(text));
      assertFalse(Str.includes("iam:DeleteRolePermissionsBoundary")(text));
      assertFalse(
        Str.includes("iam:UpdateAssumeRolePolicy")(text),
        "a fleet role's trust policy stays as created: no grant rewrites it"
      );
    })
  );

  it.effect("binds every tag-on-create grant to ec2:CreateAction and the requested ownership tags", () =>
    Effect.sync(() => {
      const tagOnCreate = A.filter(v2.Statement, (statement) =>
        P.isNotUndefined(statement.Condition?.StringEquals?.["ec2:CreateAction"])
      );
      assertTrue(A.isReadonlyArrayNonEmpty(tagOnCreate));
      for (const statement of tagOnCreate) {
        expect(actionsOf(statement)).toStrictEqual(["ec2:CreateTags"]);
        expect(statement.Condition?.StringEquals?.["ec2:CreateAction"]).toStrictEqual(
          A.map(ec2CreateActions, Str.replace("ec2:", ""))
        );
        expect(statement.Condition?.StringEquals?.["aws:RequestTag/alchemy::stack"]).toBe("CiRunners");
        expect(statement.Condition?.StringEquals?.["aws:RequestTag/alchemy::stage"]).toBe("prod");
      }
    })
  );

  it.effect("lets a direct CreateTags touch only a target that already carries both ownership tags", () =>
    Effect.sync(() => {
      const direct = A.filter(
        v2.Statement,
        (statement) => grants(statement, "ec2:CreateTags") && !A.contains(conditionKeys(statement), "ec2:CreateAction")
      );
      assertTrue(A.isReadonlyArrayNonEmpty(direct));
      for (const statement of direct) {
        expect(statement.Condition?.StringEquals?.["aws:ResourceTag/alchemy::stack"]).toBe("CiRunners");
        expect(statement.Condition?.StringEquals?.["aws:ResourceTag/alchemy::stage"]).toBe("prod");
        assertTrue(
          A.every(conditionKeys(statement), Str.startsWith("aws:ResourceTag/")),
          "a request tag alone never grants it: the target's own tags must match first"
        );
      }
    })
  );

  it.effect("scopes the default group's revokes to the given VPC only, and only in v2", () =>
    Effect.sync(() => {
      const revokes = (doc: IAM.PolicyDocument) =>
        A.filter(
          doc.Statement,
          (statement) =>
            grants(statement, "ec2:RevokeSecurityGroupEgress") &&
            !P.isNotUndefined(statement.Condition?.StringEquals?.["aws:ResourceTag/alchemy::stack"])
        );
      expect(revokes(v1)).toStrictEqual([]);
      expect(revokes(v2)).toStrictEqual([defaultGroupStatement(vpcArn)]);
      expect(defaultGroupStatement(vpcArn).Condition).toStrictEqual({ ArnEquals: { "ec2:Vpc": vpcArn } });
    })
  );

  it.effect("grants no iam:* wildcard and writes IAM only on the fleet's own roles, policies and profiles", () =>
    Effect.sync(() => {
      const iam = A.filter(v2.Statement, (statement) => A.some(actionsOf(statement), Str.startsWith("iam:")));
      assertTrue(A.every(iam, (statement) => !A.some(actionsOf(statement), (action) => Str.includes("*")(action))));
      const writes = A.filter(iam, (statement) => !A.every(actionsOf(statement), isReadOnly));
      assertTrue(
        A.every(writes, (statement) =>
          A.every(resourcesOf(statement), (arn) =>
            /:(?:role|policy|instance-profile)\/(?:beep-fleet[-/]prod|CiRunners-)/u.test(arn)
          )
        )
      );
    })
  );

  it.effect(
    "puts a mutating EC2 action on Resource * only in a justified statement held by an ownership condition",
    () =>
      Effect.sync(() => {
        const wildcardEc2Writes = A.filter(
          v2.Statement,
          (statement) =>
            A.contains(resourcesOf(statement), "*") &&
            A.some(actionsOf(statement), (action) => Str.startsWith("ec2:")(action) && !isReadOnly(action))
        );
        expect(A.map(wildcardEc2Writes, (statement) => statement.Sid)).toStrictEqual(R.keys(wildcardResourceReasons));
        assertTrue(
          A.every(wildcardEc2Writes, (statement) =>
            A.some(conditionKeys(statement), (key) =>
              ["aws:RequestTag/alchemy::stack", "aws:ResourceTag/alchemy::stack", "ec2:CreateAction"].includes(key)
            )
          )
        );
      })
  );

  const fleetFunctions = { "lambda:FunctionArn": "arn:aws:lambda:us-east-1:832907639880:function:beep-fleet-prod-*" };
  const mappingArn = "arn:aws:lambda:us-east-1:832907639880:event-source-mapping:*";
  const mappingStatements = (action: string) =>
    A.map(
      A.filter(v2.Statement, (statement) => statement.Effect === "Allow" && grants(statement, action)),
      (statement) => ({ resources: resourcesOf(statement), condition: statement.Condition })
    );

  it.effect("creates an event-source mapping only for a fleet function, with the ownership tags", () =>
    Effect.sync(() => {
      expect(mappingStatements("lambda:CreateEventSourceMapping")).toStrictEqual([
        {
          resources: ["*"],
          condition: {
            ArnLike: fleetFunctions,
            StringEquals: { "aws:RequestTag/alchemy::stack": "CiRunners", "aws:RequestTag/alchemy::stage": "prod" },
          },
        },
      ]);
    })
  );

  it.effect("updates and deletes only owned mappings that target a fleet function", () =>
    Effect.sync(() => {
      const owned = {
        resources: [mappingArn],
        condition: {
          ArnLike: fleetFunctions,
          StringEquals: { "aws:ResourceTag/alchemy::stack": "CiRunners", "aws:ResourceTag/alchemy::stage": "prod" },
        },
      };
      expect(mappingStatements("lambda:UpdateEventSourceMapping")).toStrictEqual([owned]);
      expect(mappingStatements("lambda:DeleteEventSourceMapping")).toStrictEqual([owned]);
    })
  );

  it.effect("tags a mapping only with the ownership keys and values, and never untags one", () =>
    Effect.sync(() => {
      const onMappings = (action: string) =>
        A.filter(mappingStatements(action), (statement) => A.contains(statement.resources, mappingArn));
      expect(onMappings("lambda:TagResource")).toStrictEqual([
        {
          resources: [mappingArn],
          condition: {
            StringEquals: { "aws:RequestTag/alchemy::stack": "CiRunners", "aws:RequestTag/alchemy::stage": "prod" },
            "ForAllValues:StringEquals": { "aws:TagKeys": ["alchemy::stack", "alchemy::stage", "alchemy::id"] },
          },
        },
      ]);
      expect(onMappings("lambda:UntagResource")).toStrictEqual([]);
    })
  );

  it.effect("denies every mapping write on exactly the live fleet's six mappings, by ARN alone", () =>
    Effect.sync(() => {
      const liveMappings = A.map(
        [
          "fbc1f039-9aef-40a2-9481-c8a18e6c4157",
          "e93fcf22-bfe9-4da4-92e7-a124812ac31b",
          "eb15d409-4ee9-4d5c-b599-d7116dcf804c",
          "5bd25a59-5455-4923-aadb-e4db4c600439",
          "c54ad5fd-8b22-4e61-b52b-1fb9857c70a7",
          "fe8ccc78-bafa-4ea2-aff9-b022acd2f642",
        ],
        (uuid) => `arn:aws:lambda:us-east-1:832907639880:event-source-mapping:${uuid}`
      );
      for (const policy of [v1, v2]) {
        const denies = A.filter(policy.Statement, (statement) => statement.Effect === "Deny");
        expect(denies).toStrictEqual([
          {
            Sid: "DenyLiveFleetMappings",
            Effect: "Deny",
            Action: [
              "lambda:TagResource",
              "lambda:UntagResource",
              "lambda:UpdateEventSourceMapping",
              "lambda:DeleteEventSourceMapping",
            ],
            Resource: liveMappings,
          },
        ]);
      }
      expect(
        A.map(
          A.filter(v2.Statement, (statement) => statement.Sid === "LambdaMappingsTagOnCreate"),
          (statement) => [statement.Effect, statement.Action, statement.Resource]
        ),
        "tag on create for the stack's own mappings is untouched"
      ).toStrictEqual([["Allow", ["lambda:TagResource"], [mappingArn]]]);
    })
  );

  it.effect("lets a tag on a KMS key grant only reads, rotation and fleet aliases, and data use only through SSM", () =>
    Effect.sync(() => {
      const sid = (name: string) => A.filter(v2.Statement, (statement) => statement.Sid === name);
      const kmsActions = A.filter(
        A.flatMap(
          A.filter(v2.Statement, (statement) => statement.Effect === "Allow"),
          actionsOf
        ),
        Str.startsWith("kms:")
      );
      for (const action of ["kms:PutKeyPolicy", "kms:ScheduleKeyDeletion", "kms:DisableKey", "kms:UntagResource"]) {
        assertFalse(A.contains(kmsActions, action));
      }
      expect(A.map(sid("KmsCreateTagged"), (statement) => statement.Condition)).toStrictEqual([
        {
          StringEquals: { "aws:RequestTag/alchemy::stack": "CiRunners", "aws:RequestTag/alchemy::stage": "prod" },
          "ForAllValues:StringEquals": { "aws:TagKeys": ["alchemy::stack", "alchemy::stage", "alchemy::id"] },
        },
      ]);
      expect(A.flatMap(sid("KmsOwnedKeys"), actionsOf)).toStrictEqual([
        "kms:DescribeKey",
        "kms:GetKeyPolicy",
        "kms:GetKeyRotationStatus",
        "kms:ListResourceTags",
        "kms:EnableKeyRotation",
        "kms:CreateAlias",
        "kms:UpdateAlias",
        "kms:DeleteAlias",
      ]);
      for (const statement of A.filter(v2.Statement, (s) =>
        A.some(actionsOf(s), (a) => a === "kms:Decrypt" || a === "kms:Encrypt")
      )) {
        expect(statement.Condition).toStrictEqual({
          StringEquals: { "kms:ViaService": "ssm.us-east-1.amazonaws.com" },
          StringLike: {
            "kms:EncryptionContext:PARAMETER_ARN": "arn:aws:ssm:us-east-1:832907639880:parameter/beep-fleet/prod/*",
          },
        });
      }
      expect(A.map(sid("KmsListAliases"), (statement) => [actionsOf(statement), resourcesOf(statement)])).toStrictEqual(
        [[["kms:ListAliases"], ["*"]]]
      );
    })
  );

  it.effect("grants the bucket reads Alchemy's reconcile makes on the prod binaries bucket only", () =>
    Effect.sync(() => {
      const binaries = A.filter(v2.Statement, (statement) => statement.Sid === "S3Binaries");
      for (const action of [
        "s3:GetBucketLocation",
        "s3:GetBucketNotification",
        "s3:GetBucketPolicy",
        "s3:GetEncryptionConfiguration",
        "s3:PutEncryptionConfiguration",
      ]) {
        assertTrue(A.some(binaries, (statement) => grants(statement, action)));
      }
      expect(A.flatMap(binaries, resourcesOf)).toStrictEqual([
        "arn:aws:s3:::beep-fleet-prod-binaries-832907639880",
        "arn:aws:s3:::beep-fleet-prod-binaries-832907639880/*",
      ]);
    })
  );

  const roleMutations = [
    "iam:CreateRole",
    "iam:PutRolePolicy",
    "iam:DeleteRolePolicy",
    "iam:AttachRolePolicy",
    "iam:DetachRolePolicy",
    "iam:PutRolePermissionsBoundary",
  ];

  it.effect("holds every role permission write to the exact fleet boundary, and never deletes a boundary", () =>
    Effect.sync(() => {
      for (const action of roleMutations) {
        const statements = A.filter(v2.Statement, (statement) => grants(statement, action));
        assertTrue(A.isReadonlyArrayNonEmpty(statements));
        for (const statement of statements) {
          expect(statement.Condition?.StringEquals?.["iam:PermissionsBoundary"]).toBe(fleetBoundaryPolicyArn);
        }
      }
      const everyAction = A.flatMap(v2.Statement, actionsOf);
      assertFalse(A.contains(everyAction, "iam:DeleteRolePermissionsBoundary"));
      assertFalse(A.contains(everyAction, "iam:UpdateAssumeRolePolicy"));
    })
  );

  it.effect("attaches only the fleet's own policies and the one named AWS-managed policy", () =>
    Effect.sync(() => {
      const attach = A.filter(v2.Statement, (statement) => grants(statement, "iam:AttachRolePolicy"));
      for (const statement of attach) {
        expect(statement.Condition?.ArnLike?.["iam:PolicyARN"]).toStrictEqual([
          "arn:aws:iam::832907639880:policy/beep-fleet/prod/*",
          "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole",
        ]);
      }
    })
  );

  it.effect("passes fleet roles only to the fleet's services", () =>
    Effect.sync(() => {
      const pass = A.filter(v2.Statement, (statement) => grants(statement, "iam:PassRole"));
      assertTrue(A.isReadonlyArrayNonEmpty(pass));
      for (const statement of pass) {
        expect(statement.Condition?.StringEquals?.["iam:PassedToService"]).toStrictEqual([
          "lambda.amazonaws.com",
          "ec2.amazonaws.com",
          "vpc-flow-logs.amazonaws.com",
        ]);
      }
    })
  );

  it.effect(
    "keeps the boundary outside every policy path the role can write, with no version or delete grant on it",
    () =>
      Effect.sync(() => {
        const policyWrites = A.filter(v2.Statement, (statement) =>
          A.some(actionsOf(statement), (action) =>
            /^iam:(?:CreatePolicy|CreatePolicyVersion|SetDefaultPolicyVersion|DeletePolicyVersion|DeletePolicy|TagPolicy|UntagPolicy)$/u.test(
              action
            )
          )
        );
        assertTrue(A.isReadonlyArrayNonEmpty(policyWrites));
        for (const statement of policyWrites) {
          for (const pattern of resourcesOf(statement)) {
            const matches = new RegExp(`^${Str.replaceAll("*", ".*")(Str.replaceAll(".", "\\.")(pattern))}$`, "u");
            assertFalse(matches.test(fleetBoundaryPolicyArn));
          }
        }
        assertFalse(Str.includes("/beep-fleet/prod/")(fleetBoundaryPolicyArn));
      })
  );
});

describe("CiRunners fleet boundary", () => {
  const prodBoundary = fleetBoundary("prod");
  const denies = A.filter(prodBoundary.Statement, (statement) => statement.Effect === "Deny");
  const denied = (action: string) => A.some(denies, (statement) => A.contains(actionsOf(statement), action));

  it.effect("denies IAM writes, roles outside the fleet, and organization, account and billing actions", () =>
    Effect.sync(() => {
      for (const action of ["iam:Create*", "iam:Put*", "iam:Attach*", "iam:Delete*", "iam:Update*", "iam:Detach*"]) {
        assertTrue(denied(action));
      }
      for (const action of ["organizations:*", "account:*", "aws-portal:*", "billing:*"]) {
        assertTrue(denied(action));
      }
      const outsideFleet = A.filter(denies, (statement) => A.isReadonlyArrayNonEmpty(statement.NotResource ?? []));
      expect(A.flatMap(outsideFleet, actionsOf)).toStrictEqual(["iam:PassRole", "sts:AssumeRole*"]);
      for (const statement of outsideFleet) {
        expect(statement.NotResource).toStrictEqual([
          "arn:aws:iam::832907639880:role/beep-fleet-prod-*",
          "arn:aws:iam::832907639880:role/CiRunners-*-prod-*",
        ]);
      }
    })
  );

  const allows = A.filter(prodBoundary.Statement, (statement) => statement.Effect === "Allow");
  const allowedActions = A.flatMap(allows, actionsOf);

  it.effect("allows no IAM action but passing a fleet role, and no wildcard action", () =>
    Effect.sync(() => {
      expect(A.filter(allowedActions, Str.startsWith("iam:"))).toStrictEqual(["iam:PassRole"]);
      assertFalse(A.some(allowedActions, Str.includes("*")));
      for (const statement of A.filter(allows, (allow) => grants(allow, "iam:PassRole"))) {
        expect(resourcesOf(statement)).toStrictEqual([
          "arn:aws:iam::832907639880:role/beep-fleet-prod-*",
          "arn:aws:iam::832907639880:role/CiRunners-*-prod-*",
        ]);
      }
    })
  );

  it.effect('names Resource "*" only for read-only actions, each statement with its reason', () =>
    Effect.sync(() => {
      const wildcard = A.filter(allows, (statement) => A.contains(resourcesOf(statement), "*"));
      expect(A.map(wildcard, (statement) => statement.Sid)).toStrictEqual(R.keys(boundaryWildcardReasons));
      for (const statement of wildcard) {
        expect(resourcesOf(statement)).toStrictEqual(["*"]);
        assertTrue(A.every(actionsOf(statement), isReadOnly));
        assertTrue(P.isUndefined(statement.Condition));
      }
    })
  );

  it.effect("grants no snapshot, image or instance-attribute write", () =>
    Effect.sync(() => {
      for (const action of [
        "ec2:CreateSnapshot",
        "ec2:ModifySnapshotAttribute",
        "ec2:CreateImage",
        "ec2:ModifyImageAttribute",
        "ec2:ModifyInstanceAttribute",
        "ec2:StopInstances",
        "ec2:AttachVolume",
      ]) {
        assertFalse(A.contains(allowedActions, action));
      }
    })
  );

  it.effect("holds every EC2 write to fleet tags, and launches to the stack's templates, subnets and groups", () =>
    Effect.sync(() => {
      const ec2Writes = A.filter(
        allows,
        (statement) =>
          A.some(actionsOf(statement), Str.startsWith("ec2:")) && !A.every(actionsOf(statement), isReadOnly)
      );
      for (const statement of ec2Writes) {
        const keys = conditionKeys(statement);
        const launchOnly = A.every(
          actionsOf(statement),
          (action) => action === "ec2:RunInstances" || action === "ec2:CreateFleet"
        );
        assertTrue(
          A.contains(keys, "aws:RequestTag/ghr:environment") ||
            A.contains(keys, "aws:ResourceTag/ghr:environment") ||
            A.contains(keys, "aws:ResourceTag/alchemy::stack") ||
            launchOnly
        );
        for (const resource of resourcesOf(statement)) {
          assertTrue(Str.startsWith("arn:aws:ec2:us-east-1:")(resource));
        }
      }
      const fromStack = A.filter(allows, (statement) => statement.Sid === "CeilingLaunchFromStack");
      expect(A.flatMap(fromStack, resourcesOf)).toStrictEqual([
        "arn:aws:ec2:us-east-1:832907639880:launch-template/*",
        "arn:aws:ec2:us-east-1:832907639880:subnet/*",
        "arn:aws:ec2:us-east-1:832907639880:security-group/*",
      ]);
      expect(A.map(fromStack, (statement) => statement.Condition)).toStrictEqual([
        { StringEquals: { "aws:ResourceTag/alchemy::stack": "CiRunners", "aws:ResourceTag/alchemy::stage": "prod" } },
      ]);
      const unconditioned = A.filter(ec2Writes, (statement) => P.isUndefined(statement.Condition));
      for (const resource of A.flatMap(unconditioned, resourcesOf)) {
        assertTrue(
          /:(?:image|snapshot|network-interface|spot-instances-request)\/\*$/u.test(resource),
          "unconditioned launch inputs are only those a launch reads or creates untagged, never an instance or a volume"
        );
      }
    })
  );

  it.effect("serves KMS only through SSM, for a fleet parameter", () =>
    Effect.sync(() => {
      const kms = A.filter(allows, (statement) => A.some(actionsOf(statement), Str.startsWith("kms:")));
      expect(A.length(kms)).toBe(1);
      for (const statement of kms) {
        expect(statement.Condition).toStrictEqual({
          StringEquals: { "kms:ViaService": "ssm.us-east-1.amazonaws.com" },
          StringLike: {
            "kms:EncryptionContext:PARAMETER_ARN": "arn:aws:ssm:us-east-1:832907639880:parameter/beep-fleet/prod/*",
          },
        });
      }
    })
  );

  it.effect("scopes SSM, S3, logs, SQS and Lambda to fleet ARNs, never the alchemy state bucket", () =>
    Effect.sync(() => {
      const fleetScoped = [
        ["ssm:", /^arn:aws:ssm:us-east-1:832907639880:parameter\/beep-fleet\/prod\/\*$/u],
        ["s3:", /^arn:aws:s3:::(?:beep-fleet-prod-binaries-\*|cirunners-\*-prod-\*)\/\*$/u],
        [
          "logs:",
          /^arn:aws:logs:us-east-1:832907639880:log-group:\/(?:beep-fleet\/prod\/|aws\/lambda\/(?:beep-fleet-prod-|CiRunners-\*-prod-))\*$/u,
        ],
        ["sqs:", /^arn:aws:sqs:us-east-1:832907639880:(?:beep-fleet-prod-|CiRunners-\*-prod-)\*$/u],
        ["lambda:", /^arn:aws:lambda:us-east-1:832907639880:function:(?:beep-fleet-prod-|CiRunners-\*-prod-)\*$/u],
      ] as const;
      for (const [service, pattern] of fleetScoped) {
        const scoped = A.filter(
          allows,
          (statement) =>
            A.some(actionsOf(statement), Str.startsWith(service)) && !A.contains(resourcesOf(statement), "*")
        );
        assertTrue(A.isReadonlyArrayNonEmpty(scoped));
        for (const resource of A.flatMap(scoped, resourcesOf)) {
          assertTrue(pattern.test(resource));
          assertFalse(Str.includes("alchemy-state")(resource));
        }
      }
    })
  );

  it.effect("keeps every action the fleet's own role policies grant", () =>
    Effect.sync(() => {
      for (const action of [
        "ec2:CreateFleet",
        "ec2:RunInstances",
        "ec2:CreateTags",
        "ec2:DeleteTags",
        "ec2:TerminateInstances",
        "ec2:ModifyInstanceMetadataOptions",
        "ec2:DescribeInstances",
        "ec2:DescribeTags",
        "ec2:DescribeLaunchTemplateVersions",
        "sqs:ReceiveMessage",
        "sqs:DeleteMessage",
        "sqs:GetQueueAttributes",
        "sqs:ChangeMessageVisibility",
        "sqs:SendMessage",
        "ssm:GetParameter",
        "ssm:PutParameter",
        "ssm:AddTagsToResource",
        "ssm:DeleteParameter",
        "ssm:GetParametersByPath",
        "kms:Decrypt",
        "s3:GetObject",
        "s3:GetObjectTagging",
        "s3:PutObject",
        "s3:PutObjectTagging",
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents",
        "logs:DescribeLogStreams",
        "logs:DescribeLogGroups",
        "iam:PassRole",
      ]) {
        assertTrue(A.contains(allowedActions, action));
      }
    })
  );
});

const globMatches = (pattern: string, value: string) =>
  new RegExp(`^${Str.replaceAll("*", ".*")(Str.replaceAll(".", "\\.")(pattern))}$`, "u").test(value);

const stringsOf = (value: unknown): ReadonlyArray<string> =>
  P.isString(value)
    ? [value]
    : A.isArray(value)
      ? A.flatMap(value, stringsOf)
      : P.isObject(value)
        ? A.flatMap(R.values(value as Record<string, unknown>), stringsOf)
        : [];

describe("CiRunners fleet boundary per stage", () => {
  const prodBoundary = fleetBoundary("prod");
  const stageOwnedArnsAndTagValues = (stage: string): ReadonlyArray<string> => {
    const stageNames = physicalNames(stage);
    const pools = A.map(["heavy", "overflow"] as const, (pool) => poolResourceNames(stageNames.fleet, pool));
    const fleetNames = fleetResourceNames(stageNames.fleet);
    const names = [
      ...A.filter(A.filter(R.values(stageNames), P.isString), (value) => !Str.startsWith("/")(value)),
      ...A.flatMap(pools, (pool) => A.filter(R.values(pool), P.isString)),
      ...A.filter(R.values(fleetNames), P.isString),
      `CiRunners-Runners-Poolheavy-ScaleUp-${stageNames.slug}-0123456789abcdef`,
    ];
    return [
      ...A.flatMap(names, (name) => [
        `arn:aws:iam::832907639880:role/${name}`,
        `arn:aws:lambda:us-east-1:832907639880:function:${name}`,
        `arn:aws:sqs:us-east-1:832907639880:${name}`,
        `arn:aws:logs:us-east-1:832907639880:log-group:/aws/lambda/${name}:log-stream:x`,
        `arn:aws:s3:::${name}/x`,
        `arn:aws:s3:::${Str.toLowerCase(name)}/x`,
      ]),
      `arn:aws:s3:::${fleetNames.binariesBucketPrefix}-832907639880/x`,
      `arn:aws:ssm:us-east-1:832907639880:parameter${stageNames.ssmRoot}/app/id`,
      `arn:aws:logs:us-east-1:832907639880:log-group:${stageNames.flowLogGroup}:log-stream:x`,
      poolEnvironment(stage, "heavy"),
      poolEnvironment(stage, "overflow"),
      stage,
    ];
  };
  const namePatterns = A.filter(
    A.dedupe(
      A.flatMap(prodBoundary.Statement, (statement) => [
        ...stringsOf(statement.Resource),
        ...stringsOf(statement.NotResource),
        ...stringsOf(statement.Condition),
      ])
    ),
    (pattern) => /beep-fleet|CiRunners-|cirunners-/u.test(pattern)
  );
  const matchesOf = (stage: string) =>
    A.filter(
      A.flatMap(namePatterns, (pattern) =>
        A.map(stageOwnedArnsAndTagValues(stage), (value) => [pattern, value] as const)
      ),
      ([pattern, value]) => globMatches(pattern, value)
    );

  it.effect("matches no name, ARN or tag value of another stage, and scopes every name pattern to prod", () =>
    Effect.sync(() => {
      assertTrue(A.isReadonlyArrayNonEmpty(namePatterns));
      for (const pattern of namePatterns) {
        expect([pattern, Str.includes("prod")(pattern)]).toStrictEqual([pattern, true]);
      }
      expect(matchesOf("dev-alice")).toStrictEqual([]);
    })
  );

  it.effect("matches nothing of any stage the stage guard accepts", () =>
    Effect.sync(() => {
      const stageNamesAroundProd = [
        "dev-alice",
        "staging",
        "dev-product",
        "reprod-1",
        "xprod",
        "a-prodx",
        "pr",
        "dev-al",
        "alice-prod",
        "dev-prod-x",
        "prod-x",
        "product-x",
        "p-r-o-d",
      ];
      const accepted = A.filter(stageNamesAroundProd, (stage) =>
        Exit.isSuccess(requireDistinctStage(stage).pipe(Effect.runSyncExit))
      );
      expect(accepted).toStrictEqual([
        "dev-alice",
        "staging",
        "dev-product",
        "reprod-1",
        "xprod",
        "a-prodx",
        "dev-al",
        "p-r-o-d",
      ]);
      for (const stage of accepted) {
        expect([stage, matchesOf(stage)]).toStrictEqual([stage, []]);
      }
      assertTrue(
        A.isReadonlyArrayNonEmpty(matchesOf("alice-prod")),
        "the refused alice-prod is the case the guard exists for: the prod patterns match its generated names"
      );
    })
  );

  it.effect("puts each stage's boundary at its own ARN, and the deploy role accepts only prod's", () =>
    Effect.sync(() => {
      expect(fleetBoundaryPolicyArn).toBe("arn:aws:iam::832907639880:policy/beep-fleet-boundary/fleet-boundary-prod");
      expect(fleetBoundaryPolicyArnFor("dev-alice")).toBe(
        "arn:aws:iam::832907639880:policy/beep-fleet-boundary/fleet-boundary-dev-alice"
      );
      const boundaryValues = A.dedupe(
        A.flatMap(v2.Statement, (statement) =>
          A.filter(stringsOf(statement.Condition), Str.includes("beep-fleet-boundary"))
        )
      );
      expect(boundaryValues).toStrictEqual([fleetBoundaryPolicyArn]);
      const anyBoundary = "arn:aws:iam::832907639880:policy/beep-fleet-boundary/fleet-boundary-prod";
      for (const statement of A.filter(v2.Statement, (allow) => allow.Effect === "Allow")) {
        const iamActions = A.filter(actionsOf(statement), Str.startsWith("iam:"));
        if (A.isReadonlyArrayNonEmpty(iamActions)) {
          assertFalse(
            A.some(resourcesOf(statement), (pattern) => globMatches(pattern, anyBoundary)),
            "no grant of the deploy role reaches any boundary policy object"
          );
        }
      }
    })
  );
});
