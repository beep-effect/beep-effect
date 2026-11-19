import { AWSEnvironment } from "@alchemy.run/aws/Environment";
import { AwsAccountId, DeployTarget, requireDeployTarget } from "@beep/alchemy-aws-extras/DeployTarget";
import { describe, expect, it } from "@effect/vitest";
import { assertFalse, assertTrue } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import * as Redacted from "effect/Redacted";
import * as S from "effect/Schema";

const isAccountId = S.is(AwsAccountId);
const target = DeployTarget.make({ stack: "CiRunners", accountId: "123456789012", region: "us-east-1" });

const inEnvironment = (accountId: string, region: string) =>
  Effect.provideService(
    AWSEnvironment,
    Effect.succeed({
      accountId,
      region,
      credentials: Effect.succeed({
        accessKeyId: Redacted.make("test"),
        secretAccessKey: Redacted.make("test"),
        sessionToken: undefined,
        region,
      }),
    }) as never
  );

describe("DeployTarget", () => {
  it.effect("accepts only twelve-digit account ids", () =>
    Effect.sync(() => {
      assertTrue(isAccountId("123456789012"));
      assertFalse(isAccountId("12345678901"));
      assertFalse(isAccountId("12345678901a"));
    })
  );

  it.effect("passes the target account and region and returns the account", () =>
    Effect.gen(function* () {
      const accountId = yield* requireDeployTarget(target).pipe(inEnvironment("123456789012", "us-east-1"));
      expect(accountId).toBe("123456789012");
    })
  );

  it.effect("refuses another account or region with a ConfigError naming the target", () =>
    Effect.gen(function* () {
      const otherAccount = yield* requireDeployTarget(target).pipe(
        inEnvironment("111111111111", "us-east-1"),
        Effect.flip
      );
      expect(otherAccount._tag).toBe("ConfigError");
      expect(otherAccount.message).toContain("CiRunners deploys only to AWS account 123456789012 in us-east-1");
      const otherRegion = yield* requireDeployTarget(target).pipe(
        inEnvironment("123456789012", "us-west-2"),
        Effect.flip
      );
      expect(otherRegion._tag).toBe("ConfigError");
    })
  );
});
