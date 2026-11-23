import { basicCredentialFromPair, InvalidBasicAuthUsernameError } from "@beep/npm-spec/RegistryCredential";
import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Base64 from "effect/encoding/Base64";
import * as Redacted from "effect/Redacted";

describe("basicCredentialFromPair", () => {
  it.effect("encodes user:password as base64 behind Redacted", () =>
    Effect.gen(function* () {
      const credential = yield* basicCredentialFromPair("alice", Redacted.make("s3cret"));
      assert.strictEqual(credential.kind, "basic");
      assert.strictEqual(Redacted.value(credential.encoded), Base64.encode("alice:s3cret"));
    })
  );

  it.effect("data-last form encodes the same credential", () =>
    Effect.gen(function* () {
      const credential = yield* basicCredentialFromPair(Redacted.make("s3cret"))("alice");
      assert.strictEqual(Redacted.value(credential.encoded), Base64.encode("alice:s3cret"));
    })
  );

  it.effect("refuses a username containing a colon, which basic auth cannot split back", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(basicCredentialFromPair("al:ice", Redacted.make("s3cret")));
      assert.instanceOf(error, InvalidBasicAuthUsernameError);
      assert.strictEqual(error.message, "A basic-auth username cannot contain a colon");
    })
  );
});
