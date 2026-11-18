import {
  chunkByLength,
  defaultGroupStatement,
  deployRolePolicy,
  ec2CreateActions,
  fleetBoundaryDocument,
  fleetBoundaryPolicyArn,
  wildcardResourceReasons,
} from "@beep/infra-ci-runners/DeployRolePolicy";
import { describe, expect, it } from "@effect/vitest";
import { assertFalse, assertTrue } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
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

describe("CiRunners deploy role policy", () => {
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
        // A request tag alone never grants it: the target's own tags must match first.
        assertTrue(A.every(conditionKeys(statement), Str.startsWith("aws:ResourceTag/")));
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

  it.effect(
    "creates event-source mappings only for fleet functions, with the ownership tags, and writes only owned ones",
    () =>
      Effect.sync(() => {
        const statementFor = (action: string) => A.filter(v2.Statement, (statement) => grants(statement, action));
        for (const create of statementFor("lambda:CreateEventSourceMapping")) {
          expect(create.Condition?.ArnLike?.["lambda:FunctionArn"]).toBe(
            "arn:aws:lambda:us-east-1:832907639880:function:beep-fleet-prod-*"
          );
          expect(create.Condition?.StringEquals?.["aws:RequestTag/alchemy::stack"]).toBe("CiRunners");
          expect(create.Condition?.StringEquals?.["aws:RequestTag/alchemy::stage"]).toBe("prod");
        }
        for (const action of ["lambda:UpdateEventSourceMapping", "lambda:DeleteEventSourceMapping"]) {
          const owned = statementFor(action);
          assertTrue(A.isReadonlyArrayNonEmpty(owned));
          for (const statement of owned) {
            expect(statement.Condition?.StringEquals?.["aws:ResourceTag/alchemy::stack"]).toBe("CiRunners");
            expect(statement.Condition?.StringEquals?.["aws:ResourceTag/alchemy::stage"]).toBe("prod");
          }
        }
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
  const denies = A.filter(fleetBoundaryDocument.Statement, (statement) => statement.Effect === "Deny");
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
          "arn:aws:iam::832907639880:role/beep-fleet-*",
          "arn:aws:iam::832907639880:role/CiRunners-*",
        ]);
      }
    })
  );

  it.effect("allows no IAM action but passing a role, and covers what the runners and Lambdas use", () =>
    Effect.sync(() => {
      const allowed = A.flatMap(
        A.filter(fleetBoundaryDocument.Statement, (statement) => statement.Effect === "Allow"),
        actionsOf
      );
      expect(A.filter(allowed, Str.startsWith("iam:"))).toStrictEqual(["iam:PassRole"]);
      for (const action of ["ec2:*", "sqs:ReceiveMessage", "ssm:GetParameter", "kms:Decrypt", "logs:PutLogEvents"]) {
        assertTrue(A.contains(allowed, action));
      }
    })
  );
});
