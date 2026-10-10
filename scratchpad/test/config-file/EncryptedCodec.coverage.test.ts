import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { ConfigEncryptionError } from "../../effected/config-file/EncryptedCodec.ts";

it.effect("encryption errors identify the failing phase", () => Effect.sync(() => {
  assert.strictEqual(ConfigEncryptionError.make({ phase: "encrypt", cause: "backend unavailable" }).message, "Config encryption failed during encrypt");
}));
