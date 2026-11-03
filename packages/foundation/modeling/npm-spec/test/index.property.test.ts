import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { CatalogResolver } from "@beep/npm-spec/CatalogResolver";
import { Default } from "@beep/npm-spec/index";
import { WorkspaceResolver } from "@beep/npm-spec/WorkspaceResolver";
import { describe, it } from "@effect/vitest";
import { assertNone } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";

const runs = { arbitrary: fcRuns(100) };

describe("npm entrypoint default layer properties", () => {
  it.layer(Default, { timeout: "30 seconds" })("composite default", (it) => {
    it.effect.prop(
      "both resolvers succeed with None for arbitrary packages and default or named catalogs",
      [Arbitrary.schema(S.String), Arbitrary.schema(S.String)],
      ([packageName, catalogName]) =>
        Effect.gen(function* () {
          const catalog = yield* CatalogResolver;
          const workspace = yield* WorkspaceResolver;
          const rangeOf1 = yield* catalog.rangeOf(packageName, O.none());
          assertNone(rangeOf1);
          const rangeOf2 = yield* catalog.rangeOf(packageName, O.some(catalogName));
          assertNone(rangeOf2);
          const versionOf3 = yield* workspace.versionOf(packageName);
          assertNone(versionOf3);
        }),
      runs
    );
  });
});
