import { effectiveCap, FleetPhase, PoolName, PoolSettings, productionConfig } from "@beep/infra-ci-runners/Config";
import {
  FleetPoolCapsProjection,
  fleetPoolCapsGeneratedPath,
  productionFleetPoolCapsModule,
  projectFleetPoolCaps,
  renderFleetPoolCapsModule,
} from "@beep/infra-ci-runners/FleetPoolCaps";
import * as BunServices from "@effect/platform-bun/BunServices";
import { describe, expect, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const decodeProjection = S.decodeUnknownEffect(S.fromJsonString(FleetPoolCapsProjection));

const committedModule = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  return yield* fs.readFileString(path.resolve(import.meta.dirname, "../../../../..", fleetPoolCapsGeneratedPath));
});

const objectLiteralAsJson = (literal: string): string =>
  Str.replace(/,(\s*[}\]])/gu, "$1")(Str.replace(/(\w+):/gu, '"$1":')(literal));

const projectionOf = (text: string) => {
  const start = Str.indexOf("= {")(text);
  const end = Str.lastIndexOf(" as const;")(text);
  return decodeProjection(
    O.match(O.all([start, end]), {
      onNone: () => "",
      onSome: ([from, to]) => objectLiteralAsJson(Str.slice(from + 2, to)(text)),
    })
  );
};

describe("FleetPoolCaps", () => {
  it.layer(BunServices.layer)((it) => {
    it.effect("the committed generated module equals the production rendering", () =>
      Effect.gen(function* () {
        const text = yield* committedModule;
        expect(text).toBe(productionFleetPoolCapsModule());
      })
    );

    it.effect("the committed projection equals the production configuration for each pool and phase", () =>
      Effect.gen(function* () {
        const text = yield* committedModule;
        const projection = yield* projectionOf(text);
        expect(projection.phase).toBe(productionConfig.phase);
        for (const pool of PoolName.literals) {
          const settings = PoolSettings.make(productionConfig[pool]);
          const projected = A.findFirst(projection.pools, (entry) => entry.pool === pool);
          expect(O.map(projected, (entry) => entry.label)).toEqual(O.some(settings.label));
          for (const phase of FleetPhase.literals) {
            expect(O.map(projected, (entry) => entry[phase])).toEqual(O.some(effectiveCap(settings, phase)));
          }
        }
        expect(A.length(projection.pools)).toBe(A.length(PoolName.literals));
      })
    );
  });

  it("renders a changed cap into a different module", () => {
    const raised = projectFleetPoolCaps({
      ...productionConfig,
      heavy: { ...productionConfig.heavy, maximumCount: 3 },
    });
    expect(raised.pools[0]?.primary).toBe(3);
    expect(renderFleetPoolCapsModule(raised)).not.toBe(productionFleetPoolCapsModule());
  });
});
