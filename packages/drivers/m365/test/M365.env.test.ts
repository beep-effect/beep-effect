import { loadM365AppOnlyEnv, M365EnvError, m365AppOnlyEnvNames } from "@beep/m365";
import { it } from "@beep/test-runner";
import { describe } from "@effect/vitest";
import { assertFalse, assertInstanceOf, deepStrictEqual, strictEqual } from "@effect/vitest/utils";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Effect from "effect/Effect";
import * as Redacted from "effect/Redacted";
import * as Str from "effect/String";

// Synthetic values only; none of these is a real tenant, application or key.
const complete = {
  LANE_TEST_TENANT_ID: "00000000-0000-0000-0000-000000000001",
  LANE_TEST_CLIENT_ID: "00000000-0000-0000-0000-000000000002",
  LANE_TEST_CERT_THUMBPRINT_SHA256: "AB12CD34".repeat(8),
  LANE_TEST_CERT_PRIVATE_KEY: "synthetic-private-key-text",
  LANE_TEST_MAILBOX: "drawings@example.test",
};

const loadWith = (env: Record<string, string>, prefix = "LANE_TEST") =>
  loadM365AppOnlyEnv(prefix).pipe(
    Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromEnv({ env }))
  );

const refusalOf = (env: Record<string, string>, prefix?: string) => Effect.flip(loadWith(env, prefix));

describe("loadM365AppOnlyEnv", () => {
  it("names the five variables of a prefix", () => {
    deepStrictEqual(
      { ...m365AppOnlyEnvNames("CLOUD_M365_DOCKET") },
      {
        tenantId: "CLOUD_M365_DOCKET_TENANT_ID",
        clientId: "CLOUD_M365_DOCKET_CLIENT_ID",
        certThumbprintSha256: "CLOUD_M365_DOCKET_CERT_THUMBPRINT_SHA256",
        certPrivateKey: "CLOUD_M365_DOCKET_CERT_PRIVATE_KEY",
        mailbox: "CLOUD_M365_DOCKET_MAILBOX",
      }
    );
  });

  it.effect(
    "loads a complete lane into the app-only certificate settings",
    Effect.fnUntraced(function* () {
      const settings = yield* loadWith(complete);
      strictEqual(settings.mailbox, "drawings@example.test");
      strictEqual(settings.appOnly.tenantId, complete.LANE_TEST_TENANT_ID);
      strictEqual(settings.appOnly.clientId, complete.LANE_TEST_CLIENT_ID);
      strictEqual(settings.appOnly.credential._tag, "M365CertificateCredential");
      if (settings.appOnly.credential._tag === "M365CertificateCredential") {
        strictEqual(Redacted.value(settings.appOnly.credential.privateKey), complete.LANE_TEST_CERT_PRIVATE_KEY);
      }
    })
  );

  it.effect(
    "refuses an unresolved op:// value and names only the setting",
    Effect.fnUntraced(function* () {
      const error = yield* refusalOf({
        ...complete,
        LANE_TEST_CERT_PRIVATE_KEY: "op://Vault/Item/private key",
      });
      assertInstanceOf(error, M365EnvError);
      strictEqual(error.problem, "unresolved-reference");
      strictEqual(error.setting, "LANE_TEST_CERT_PRIVATE_KEY");
      assertFalse(Str.includes("Vault")(error.message));
    })
  );

  it.effect(
    "refuses a missing or blank setting",
    Effect.fnUntraced(function* () {
      const { LANE_TEST_TENANT_ID: _omitted, ...withoutTenant } = complete;
      const missing = yield* refusalOf(withoutTenant);
      strictEqual(missing.setting, "LANE_TEST_TENANT_ID");
      strictEqual(missing.problem, "missing");
      const blank = yield* refusalOf({ ...complete, LANE_TEST_CLIENT_ID: "   " });
      strictEqual(blank.setting, "LANE_TEST_CLIENT_ID");
      strictEqual(blank.problem, "missing");
    })
  );

  it.effect(
    "refuses a mailbox that is not a safe Graph path segment",
    Effect.fnUntraced(function* () {
      const error = yield* refusalOf({ ...complete, LANE_TEST_MAILBOX: "../users" });
      strictEqual(error.setting, "LANE_TEST_MAILBOX");
      strictEqual(error.problem, "invalid");
    })
  );

  it.effect(
    "refuses a thumbprint that is not 64 hex digits and names only the setting",
    Effect.fnUntraced(function* () {
      const short = yield* refusalOf({ ...complete, LANE_TEST_CERT_THUMBPRINT_SHA256: "AB12CD34" });
      strictEqual(short.setting, "LANE_TEST_CERT_THUMBPRINT_SHA256");
      strictEqual(short.problem, "invalid");
      const colons = yield* refusalOf({ ...complete, LANE_TEST_CERT_THUMBPRINT_SHA256: `${"AB:".repeat(31)}CD` });
      strictEqual(colons.problem, "invalid");
      assertFalse(Str.includes("AB:")(colons.message));
    })
  );

  it.effect(
    "refuses a prefix that is not an upper-case variable stem",
    Effect.fnUntraced(function* () {
      const error = yield* refusalOf(complete, "lane-test");
      strictEqual(error.problem, "invalid");
    })
  );
});
