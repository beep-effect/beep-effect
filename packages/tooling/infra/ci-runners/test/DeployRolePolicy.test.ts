import {
  defaultGroupStatement,
  deployRolePolicy,
  ec2CreateActions,
  wildcardResourceReasons,
} from "@beep/infra-ci-runners/DeployRolePolicy";
import { describe, expect, it } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
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

  it.effect("scopes event-source mapping writes to the fleet's functions", () =>
    Effect.sync(() => {
      const mappingWrites = A.filter(v2.Statement, (statement) =>
        A.some(actionsOf(statement), (action) => /^lambda:(?:Create|Update|Delete)EventSourceMapping$/u.test(action))
      );
      assertTrue(A.isReadonlyArrayNonEmpty(mappingWrites));
      for (const statement of mappingWrites) {
        expect(statement.Condition?.ArnLike?.["lambda:FunctionArn"]).toBe(
          "arn:aws:lambda:us-east-1:832907639880:function:beep-fleet-prod-*"
        );
      }
    })
  );
});
