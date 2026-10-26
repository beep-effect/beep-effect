import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { ActionOutputs } from "@beep/github-actions/ActionOutputs";
import { Secret } from "@beep/github-actions/Secret";
import { assert, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Effect from "effect/Effect";
import * as Redacted from "effect/Redacted";
import * as S from "effect/Schema";

const runs = { arbitrary: fcRuns(100) };
it.effect.prop(
  "child handoff preserves secret bytes and masks before returning",
  [Arbitrary.schema(S.String)],
  ([plaintext]) =>
    Effect.gen(function* () {
      const events: Array<string> = [];
      const env = yield* Secret.forChildEnv({ TOKEN: Redacted.make(plaintext) }).pipe(
        Effect.provideService(
          ActionOutputs,
          ActionOutputs.makeTest({
            setSecret: (secret) =>
              Effect.sync(() => {
                events.push(secret);
              }),
          })
        )
      );
      assert.deepStrictEqual(events, [plaintext]);
      assert.deepStrictEqual(env, { TOKEN: plaintext });
      const adopted = yield* Secret.adopt("TOKEN").pipe(
        Effect.provideService(
          ConfigProvider.ConfigProvider,
          ConfigProvider.make(() => Effect.succeed(ConfigProvider.makeValue(plaintext)))
        )
      );
      assert.strictEqual(Redacted.value(adopted), plaintext);
    }),
  runs
);
