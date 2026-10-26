import { ActionOutputs } from "@beep/github-actions/ActionOutputs";
import { Secret } from "@beep/github-actions/Secret";
import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Redacted from "effect/Redacted";

it.effect("signing masks before returning the key", () =>
  Effect.gen(function* () {
    const masked: Array<string> = [];
    const value = yield* Secret.forSigning(Redacted.make("signing-key")).pipe(
      Effect.provideService(
        ActionOutputs,
        ActionOutputs.makeTest({
          setSecret: (secret) =>
            Effect.sync(() => {
              masked.push(secret);
            }),
        })
      )
    );
    assert.strictEqual(value, "signing-key");
    assert.deepStrictEqual(masked, ["signing-key"]);
  })
);
