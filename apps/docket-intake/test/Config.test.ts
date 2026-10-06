/**
 * Configuration decoding proofs. Every value is synthetic.
 */
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import { assertNone, assertSome, assertTrue } from "@effect/vitest/utils";
import { ConfigProvider, DateTime, Effect, Exit, Redacted } from "effect";
import * as O from "effect/Option";
import { DocketIntakeAppConfigFromEnv } from "@/Config";

const required = {
  DOCKET_INTAKE_CERT_PRIVATE_KEY: "fixture-private-key",
  DOCKET_INTAKE_CERT_THUMBPRINT_SHA256: "AB12",
  DOCKET_INTAKE_CLIENT_ID: "client-id",
  DOCKET_INTAKE_MAILBOX: "docket@fixture.invalid",
  DOCKET_INTAKE_TENANT_ID: "tenant-id",
  DOCKET_INTAKE_TIME_ZONE: "America/Chicago",
  HOME: "/home/fixture",
};

const load = (env: Readonly<Record<string, string>>) =>
  DocketIntakeAppConfigFromEnv.parse(ConfigProvider.fromUnknown(env));

describe("@beep/docket-intake configuration", () => {
  it.effect(
    "applies the defaults: negatives are reviewed, no start time, state under the home directory",
    Effect.fnUntraced(function* () {
      const config = yield* load(required);

      expect(config.reviewNegatives).toBe(true);
      assertNone(config.startAt);
      expect(config.stateDirectory).toBe("/home/fixture/.local/state/beep/docket-intake");
      expect(DateTime.zoneToString(config.timeZone)).toBe("America/Chicago");
      expect(Redacted.value(config.certPrivateKey)).toBe("fixture-private-key");
      expect(`${config.certPrivateKey}`).not.toContain("fixture-private-key");
    })
  );

  it.effect(
    "reads the optional settings and prefers an explicit state directory over the XDG state home",
    Effect.fnUntraced(function* () {
      const xdg = yield* load({ ...required, XDG_STATE_HOME: "/var/fixture/state" });
      const explicit = yield* load({
        ...required,
        DOCKET_INTAKE_REVIEW_NEGATIVES: "false",
        DOCKET_INTAKE_START_AT: "2030-01-01T06:00:00Z",
        DOCKET_INTAKE_STATE_DIR: "/srv/fixture/docket",
        XDG_STATE_HOME: "/var/fixture/state",
      });

      expect(xdg.stateDirectory).toBe("/var/fixture/state/beep/docket-intake");
      expect(explicit.stateDirectory).toBe("/srv/fixture/docket");
      expect(explicit.reviewNegatives).toBe(false);
      assertSome(O.map(explicit.startAt, DateTime.formatIso), "2030-01-01T06:00:00.000Z");
    })
  );

  it.effect(
    "fails when a required setting is missing, the time zone included",
    Effect.fnUntraced(function* () {
      const { DOCKET_INTAKE_TIME_ZONE: _zone, ...withoutZone } = required;
      const { DOCKET_INTAKE_MAILBOX: _mailbox, ...withoutMailbox } = required;

      const results = yield* Effect.all([
        Effect.exit(load(withoutZone)),
        Effect.exit(load(withoutMailbox)),
        Effect.exit(load({ ...required, DOCKET_INTAKE_TIME_ZONE: "Fixture/Nowhere" })),
        Effect.exit(load({ ...required, DOCKET_INTAKE_START_AT: "next Tuesday" })),
      ]);

      for (const result of results) {
        assertTrue(Exit.isFailure(result));
      }
    })
  );
});
