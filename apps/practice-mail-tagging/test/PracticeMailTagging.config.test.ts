/**
 * Settings decoding: defaults, required values, the shared docket-intake
 * names, and redaction. Every value is a placeholder.
 */

import { BoxCcgConfig, BoxDeveloperTokenConfig } from "@beep/box";
import { M365CertificateCredential } from "@beep/m365";
import { it } from "@beep/test-runner";
import { assertSchemaArbitraryDecodesToSelf } from "@beep/test-utils";
import { describe, expect } from "@effect/vitest";
import { assertInstanceOf, assertSome } from "@effect/vitest/utils";
import { Config, ConfigProvider, Effect } from "effect";
import * as DateTime from "effect/DateTime";
import * as Duration from "effect/Duration";
import * as Redacted from "effect/Redacted";
import * as S from "effect/Schema";
import {
  boxCredentialConfig,
  m365AppOnlyConfig,
  PracticeMailTaggingConfig,
  practiceMailTaggingConfig,
  stateDirectoryConfig,
} from "@/PracticeMailTagging.config";
import { credentialEnvironment, settingsEnvironment } from "./PracticeMailTagging.fixture.ts";

const parse = <A>(config: Config.Config<A>, values: Readonly<Record<string, string>>) =>
  config.parse(ConfigProvider.fromUnknown(values));

const required = {
  PRACTICE_MAIL_TAGGING_KG_BUNDLE_DIRECTORY: "/bundle",
  PRACTICE_MAIL_TAGGING_FOLDER_MAP_PATH: "/private/matter-folders.json",
  PRACTICE_MAIL_TAGGING_KNOWN_DOCUMENTS_PATH: "/private/box-files.jsonl",
  PRACTICE_MAIL_TAGGING_BOX_CALL_LEDGER_PATH: "/private/box-api-calls.jsonl",
};

const boxClientPair = { DMS_BOX_CLIENT_ID: "box-client-0001", DMS_BOX_CLIENT_SECRET: "placeholder-secret" };

describe("practiceMailTaggingConfig", () => {
  it.effect("fills every default and resolves the state directory under HOME", () =>
    Effect.gen(function* () {
      const config = yield* parse(practiceMailTaggingConfig, {
        ...required,
        HOME: "/home/operator/",
        CLOUD_M365_DOCKET_MAILBOX: "attorney@example.test",
      });

      expect(config.stateDirectory).toBe("/home/operator/.local/state/beep/practice-mail-tagging");
      expect(config.mailboxUserId).toBe("attorney@example.test");
      expect(config.excludedFolderIds).toEqual([]);
      expect(config.runLabel).toBe("practice-mail-tagging");
      expect(config.pageSize).toBe(50);
      expect(DateTime.formatIso(config.since)).toBe("2026-07-01T00:00:00.000Z");
      expect(Duration.toMinutes(config.pollInterval)).toBe(5);
      expect(Duration.toHours(config.maxBackoff)).toBe(1);
    })
  );

  it.effect("reads every override and never polls faster than once a minute", () =>
    Effect.gen(function* () {
      const config = yield* parse(practiceMailTaggingConfig, {
        ...settingsEnvironment,
        CLOUD_M365_DOCKET_MAILBOX: "docket@example.test",
        PRACTICE_MAIL_TAGGING_EXCLUDED_FOLDER_IDS: "folder-a,folder-b",
        PRACTICE_MAIL_TAGGING_RUN_LABEL: "mail-tagging-drill",
        PRACTICE_MAIL_TAGGING_PAGE_SIZE: "25",
        PRACTICE_MAIL_TAGGING_SINCE: "2026-08-01T00:00:00Z",
        PRACTICE_MAIL_TAGGING_POLL_INTERVAL: "10 seconds",
        PRACTICE_MAIL_TAGGING_MAX_BACKOFF: "30 minutes",
      });

      expect(config.stateDirectory).toBe(settingsEnvironment.PRACTICE_MAIL_TAGGING_STATE_DIRECTORY);
      expect(config.mailboxUserId).toBe("attorney@example.test");
      expect(config.excludedFolderIds).toEqual(["folder-a", "folder-b"]);
      expect(config.runLabel).toBe("mail-tagging-drill");
      expect(config.pageSize).toBe(25);
      expect(DateTime.formatIso(config.since)).toBe("2026-08-01T00:00:00.000Z");
      expect(Duration.toMinutes(config.pollInterval)).toBe(1);
      expect(Duration.toMinutes(config.maxBackoff)).toBe(30);
    })
  );

  it.effect("fails when a private path, the mailbox, or a usable page size is missing", () =>
    Effect.gen(function* () {
      const { PRACTICE_MAIL_TAGGING_FOLDER_MAP_PATH: _dropped, ...withoutFolderMap } = settingsEnvironment;
      const { PRACTICE_MAIL_TAGGING_MAILBOX_USER_ID: _mailbox, ...withoutMailbox } = settingsEnvironment;

      const missingPath = yield* Effect.flip(parse(practiceMailTaggingConfig, withoutFolderMap));
      const missingMailbox = yield* Effect.flip(parse(practiceMailTaggingConfig, withoutMailbox));
      const zeroPage = yield* Effect.flip(
        parse(practiceMailTaggingConfig, { ...settingsEnvironment, PRACTICE_MAIL_TAGGING_PAGE_SIZE: "0" })
      );
      const noHome = yield* Effect.flip(parse(stateDirectoryConfig, {}));

      assertInstanceOf(missingPath, Config.ConfigError);
      assertInstanceOf(missingMailbox, Config.ConfigError);
      assertInstanceOf(zeroPage, Config.ConfigError);
      assertInstanceOf(noHome, Config.ConfigError);
    })
  );

  it("decodes every generated settings value to itself", () => {
    assertSchemaArbitraryDecodesToSelf(S.toType(PracticeMailTaggingConfig), { runs: 10 });
  });
});

describe("m365AppOnlyConfig", () => {
  it.effect("reads the shared certificate credential, restores its line breaks, and keeps it redacted", () =>
    Effect.gen(function* () {
      const config = yield* parse(m365AppOnlyConfig, credentialEnvironment);

      assertInstanceOf(config.credential, M365CertificateCredential);
      expect(config.tenantId).toBe("tenant-0001");
      expect(config.clientId).toBe("client-0001");
      expect(config.credential.thumbprintSha256).toBe("AB12");
      expect(Redacted.value(config.credential.privateKey)).toBe("line-one\nline-two");
      expect(`${config.credential.privateKey}`).toBe("<redacted>");
      expect(`${config.credential.privateKey}`).not.toContain("line-one");
    })
  );

  it.effect("fails when the private key is absent", () =>
    Effect.gen(function* () {
      const { CLOUD_M365_DOCKET_CERT_PRIVATE_KEY: _dropped, ...withoutKey } = credentialEnvironment;

      assertInstanceOf(yield* Effect.flip(parse(m365AppOnlyConfig, withoutKey)), Config.ConfigError);
    })
  );
});

describe("boxCredentialConfig", () => {
  it.effect("prefers the client credentials grant with an enterprise subject", () =>
    Effect.gen(function* () {
      const credential = yield* parse(boxCredentialConfig, {
        ...boxClientPair,
        DMS_BOX_ENTERPRISE_ID: "enterprise-0001",
        DMS_BOX_USER_ID: "user-0001",
        CLOUD_BOX_TOKEN: "placeholder-token",
      });

      assertInstanceOf(credential, BoxCcgConfig);
      assertSome(credential.enterpriseId, "enterprise-0001");
      expect(`${credential.clientSecret}`).toBe("<redacted>");
    })
  );

  it.effect("accepts a user subject when no enterprise is set", () =>
    Effect.gen(function* () {
      const credential = yield* parse(boxCredentialConfig, { ...boxClientPair, DMS_BOX_USER_ID: "user-0001" });

      assertInstanceOf(credential, BoxCcgConfig);
      assertSome(credential.userId, "user-0001");
    })
  );

  it.effect("falls back to the developer token and fails when nothing is set", () =>
    Effect.gen(function* () {
      const credential = yield* parse(boxCredentialConfig, { ...boxClientPair, CLOUD_BOX_TOKEN: "placeholder-token" });
      const missing = yield* Effect.flip(parse(boxCredentialConfig, {}));

      assertInstanceOf(credential, BoxDeveloperTokenConfig);
      expect(`${credential.token}`).toBe("<redacted>");
      assertInstanceOf(missing, Config.ConfigError);
    })
  );
});
