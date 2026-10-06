import { loadOutboxConfig, OUTBOX_DEFAULT_MAX_ATTACHMENT_BYTES } from "@beep/m365-mcp";
import { it } from "@beep/test-runner";
import { assert, describe } from "@effect/vitest";
import { ConfigProvider, Effect } from "effect";
import * as Str from "effect/String";

const credentials = {
  M365_OUTBOX_CERT_PRIVATE_KEY: "fixture-private-key",
  M365_OUTBOX_CERT_THUMBPRINT_SHA256: "AB12",
  M365_OUTBOX_CLIENT_ID: "client-id",
  M365_OUTBOX_MAILBOX: "mailbox@example.test",
  M365_OUTBOX_TENANT_ID: "tenant-id",
};

const load = (env: Readonly<Record<string, string>>) =>
  loadOutboxConfig().pipe(
    Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromEnv({ env: { ...env } }))
  );

const failureMessage = (env: Readonly<Record<string, string>>) =>
  load(env).pipe(
    Effect.flip,
    Effect.map((error) => error.message)
  );

describe("@beep/m365-mcp outbox configuration", () => {
  it.effect(
    "defaults to the single staging root and the XDG audit directory",
    Effect.fnUntraced(function* () {
      const config = yield* load({ ...credentials, HOME: "/home/fixture", XDG_DATA_HOME: "/data/fixture" });

      assert.deepStrictEqual(config.attachments.roots, ["/data/fixture/beep/m365-outbox/attachments"]);
      assert.isTrue(config.attachments.createMissingRoots);
      assert.strictEqual(config.attachments.maxAttachmentBytes, OUTBOX_DEFAULT_MAX_ATTACHMENT_BYTES);
      assert.strictEqual(config.attachments.maxAttachments, 20);
      assert.strictEqual(config.auditDirectory, "/home/fixture/.local/state/beep/m365-outbox/audit");
      assert.strictEqual(config.mailbox, "mailbox@example.test");
    })
  );

  it.effect(
    "takes configured roots, limits and audit directory as given and never creates a configured root",
    Effect.fnUntraced(function* () {
      const config = yield* load({
        ...credentials,
        M365_OUTBOX_ATTACHMENT_ROOTS: "/srv/one: /srv/two",
        M365_OUTBOX_AUDIT_DIR: "/var/audit",
        M365_OUTBOX_MAX_ATTACHMENT_BYTES: "1024",
        M365_OUTBOX_MAX_ATTACHMENTS: "3",
        M365_OUTBOX_MAX_MESSAGE_ATTACHMENT_BYTES: "2048",
      });

      assert.deepStrictEqual(config.attachments.roots, ["/srv/one", "/srv/two"]);
      assert.isFalse(config.attachments.createMissingRoots);
      assert.deepStrictEqual(
        [
          config.attachments.maxAttachmentBytes,
          config.attachments.maxAttachments,
          config.attachments.maxMessageAttachmentBytes,
        ],
        [1024, 3, 2048]
      );
      assert.strictEqual(config.auditDirectory, "/var/audit");
    })
  );

  it.effect(
    "names the missing or unresolved setting and never its value",
    Effect.fnUntraced(function* () {
      const { M365_OUTBOX_TENANT_ID: _tenant, ...withoutTenant } = credentials;
      const missing = yield* failureMessage({ ...withoutTenant, HOME: "/home/fixture" });
      const unresolved = yield* failureMessage({
        ...credentials,
        HOME: "/home/fixture",
        M365_OUTBOX_CERT_PRIVATE_KEY: "op://vault/item/field",
      });

      assert.isTrue(Str.startsWith("M365_OUTBOX_TENANT_ID is not set")(missing));
      assert.isTrue(Str.startsWith("M365_OUTBOX_CERT_PRIVATE_KEY is an unresolved 1Password reference")(unresolved));
      assert.notInclude(unresolved, "vault/item");
    })
  );

  it.effect(
    "rejects relative roots, non-positive limits and a mailbox that is not one path segment",
    Effect.fnUntraced(function* () {
      const base = { ...credentials, HOME: "/home/fixture" };
      const relative = yield* failureMessage({ ...base, M365_OUTBOX_ATTACHMENT_ROOTS: "/srv/one:staging" });
      const zero = yield* failureMessage({ ...base, M365_OUTBOX_MAX_ATTACHMENTS: "0" });
      const words = yield* failureMessage({ ...base, M365_OUTBOX_MAX_ATTACHMENT_BYTES: "lots" });
      const mailbox = yield* failureMessage({ ...base, M365_OUTBOX_MAILBOX: "../other" });

      assert.include(relative, "M365_OUTBOX_ATTACHMENT_ROOTS must list absolute directories");
      assert.include(zero, "positive whole numbers");
      assert.include(words, "M365_OUTBOX_MAX_ATTACHMENT_BYTES must be a whole number");
      assert.include(mailbox, "M365_OUTBOX_MAILBOX must be a mailbox address or user id");
    })
  );
});
