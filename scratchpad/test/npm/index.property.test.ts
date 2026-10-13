import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { describe, it } from "@effect/vitest";
import { assertNone } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { CatalogResolver, Default, WorkspaceResolver } from "../../effected/npm/index.ts";

const runs = { arbitrary: fcRuns(100) };

describe("npm entrypoint default layer properties", () => {
  it.layer(Default, { timeout: "30 seconds" })("composite default", (it) => {
    it.effect.prop(
      "both resolvers succeed with None for arbitrary packages and default or named catalogs",
      [Arbitrary.schema(S.String), Arbitrary.schema(S.String)],
      ([packageName, catalogName]) => Effect.gen(function* () {
        const catalog = yield* CatalogResolver;
        const workspace = yield* WorkspaceResolver;
        assertNone(yield* catalog.rangeOf(packageName, O.none()));
        assertNone(yield* catalog.rangeOf(packageName, O.some(catalogName)));
        assertNone(yield* workspace.versionOf(packageName));
      }),
      runs,
    );
  });
});
