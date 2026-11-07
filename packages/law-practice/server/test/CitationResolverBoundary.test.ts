import {
  CitationFrozenEditions,
  makeCitationFrozenEditions,
} from "@beep/law-practice-server/internal/Citation/FrozenEditions";
import { makeCitationResolverBoundary } from "@beep/law-practice-server/internal/Citation/RegisteredResolver";
import { it } from "@beep/test-runner";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import * as BunFileSystem from "@effect/platform-bun/BunFileSystem";
import { expect } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { CitationCallbackObservation, prepareCallbackObservation } from "./CitationCallbackSession.fixtures.ts";
import { loadCitationFrozenEditionFixtures } from "./CitationFrozenEditions.fixtures.ts";
import type { CitationEngineFailure } from "@beep/law-practice-use-cases/server";

const context = Effect.fn("ResolverBoundaryTest.context")((name: string) =>
  prepareCallbackObservation(
    CitationCallbackObservation.make({
      name,
      kinds: ["case", "id"],
      pages: {},
      bindings: {},
      events: [],
      outcome: { status: "value", groups: [] },
    })
  )
);
it.layer(Layer.merge(BunCrypto.layer, BunFileSystem.layer))("registered resolver method boundary", (it) => {
  it.effect("retains complete resolution/receipt results and closes actual work/evidence refusals", () =>
    Effect.gen(function* () {
      const fixtures = yield* loadCitationFrozenEditionFixtures();
      const frozen = yield* makeCitationFrozenEditions(fixtures.bundle);
      const resolver = yield* makeCitationResolverBoundary().pipe(
        Effect.provideService(CitationFrozenEditions, frozen)
      );
      const input = yield* context("resolver-boundary");
      const invocation = resolver.resolve(input);
      const closed: Effect.Effect<Effect.Success<typeof invocation>, CitationEngineFailure> = invocation;
      const before = yield* closed;
      expect(before.document.mentions).toHaveLength(2);
      expect(before.document.authorities).toHaveLength(1);
      const limited = yield* resolver
        .resolve({ ...input, limits: { ...input.limits, resolutionIterations: 1 } })
        .pipe(Effect.flip);
      expect(limited).toMatchObject({
        _tag: "CitationSafetyLimitExceeded",
        operation: "resolve",
        limit: "resolutionIterations",
      });
      const other = yield* context("other-resolver-source");
      const mismatch = yield* resolver.resolve({ ...input, verifiedSource: other.verifiedSource }).pipe(Effect.flip);
      expect(mismatch).toMatchObject({
        _tag: "CitationPrerequisiteError",
        operation: "resolve",
        dependency: "source-evidence",
      });
      const after = yield* resolver.resolve(input);
      expect(after.receipt).toEqual(before.receipt);
      expect(after.resourceBindings).toEqual(before.resourceBindings);
    })
  );
});
