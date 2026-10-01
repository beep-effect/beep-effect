import { CacheProducerBundle } from "@beep/repo-cli/commands/Cache";
import { validateCacheProducerBundle } from "@beep/repo-cli/test/Cache";
import { describe, it } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import { Effect } from "effect";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { input, pilot, protocol } from "./helpers/cache-producer-bundle-fixture.ts";
import { executionInput } from "./helpers/cache-protocol-fixture.ts";
import { signedPilotInput } from "./helpers/cache-signed-pilot-fixture.ts";

const decode = S.decodeUnknownEffect(CacheProducerBundle);
const validate = (value: unknown) =>
  decode(value).pipe(
    Effect.flatMap((bundle) => validateCacheProducerBundle(bundle, bundle.protocol.observation.client)),
    Effect.result
  );

describe("complete producer bundle", () => {
  it.effect("accepts both complete matrices with persistent issuer denial", () =>
    Effect.gen(function* () {
      assertTrue(Result.isSuccess(yield* validate(input)));
    })
  );
  it.effect("rejects incomplete conformance and inconsistent native identities", () =>
    Effect.gen(function* () {
      for (const changed of [
        { ...protocol, failures: [] },
        { ...protocol, events: [] },
        { ...protocol, bunSha256: executionInput.bunSha256 },
        { ...protocol, observation: { ...protocol.observation, channel: "canary" } },
      ])
        assertTrue(Result.isFailure(yield* validate({ ...input, protocol: changed })));
    })
  );
  it.effect("requires persistent issuer protection for every remote reader", () =>
    Effect.gen(function* () {
      assertTrue(Result.isFailure(yield* validate({ ...input, pilot: signedPilotInput })));
      assertTrue(
        Result.isFailure(yield* validate({ ...input, pilot: { ...pilot, mutations: signedPilotInput.mutations } }))
      );
      assertTrue(
        Result.isFailure(yield* validate({ ...input, pilot: { ...pilot, shadows: signedPilotInput.shadows } }))
      );
    })
  );
  it.effect("rejects an independently approved protocol client mismatch", () =>
    Effect.gen(function* () {
      const bundle = yield* decode(input);
      assertTrue(
        Result.isFailure(
          yield* validateCacheProducerBundle(bundle, {
            ...bundle.protocol.observation.client,
            namespace: "another-approval",
          }).pipe(Effect.result)
        )
      );
    })
  );
});
