import {
  CatalogSnapshot,
  catalogModelsById,
  diffSnapshots,
  ModelsCatalog,
  ModelsCatalogLive,
  ModelsLedger,
  ModelsLedgerLive,
  mergeLayers,
} from "@beep/repo-cli/commands/Models";
import { NodeCrypto, NodeServices } from "@effect/platform-node";
import { expect, layer } from "@effect/vitest";
import { assertNone, assertSome, strictEqual } from "@effect/vitest/utils";
import { Effect, FileSystem, HashMap, Layer, Option as O, Path } from "effect";
import * as A from "effect/Array";
import { FixtureCatalogSources, readFixtureLayers } from "./helpers/models-fixtures.ts";

const platform = Layer.mergeAll(NodeServices.layer, NodeCrypto.layer);
const models = Layer.mergeAll(ModelsCatalogLive, ModelsLedgerLive, FixtureCatalogSources).pipe(Layer.provide(platform));

layer(Layer.mergeAll(platform, models))((it) => {
  it.effect("merges layers into origin, provider, and availability", () =>
    Effect.gen(function* () {
      const fixtures = yield* readFixtureLayers();
      const models = catalogModelsById(
        mergeLayers({
          upstream: O.some(fixtures.upstream),
          codex: O.some(fixtures.codex),
          grok: O.some(fixtures.grok),
          cursor: O.some(fixtures.cursor),
          proxy: O.some(fixtures.proxy),
        })
      );

      const model = (id: string) => O.getOrThrow(HashMap.get(models, id as never));

      const astra = model("gpt-6-astra");
      strictEqual(astra.origin, "router-for-me");
      assertSome(astra.provider, "codex-pro");
      strictEqual(astra.availability.codexCli, true);
      // `/v1/models` omitted astra on 2026-09-22; that must weaken proxy
      // availability without touching existence.
      strictEqual(astra.availability.proxy, false);

      // A Cursor seat id exists in no upstream section at all.
      const seat = model("composer-2.5");
      strictEqual(seat.origin, "cursor-agent");
      assertNone(seat.provider);
      strictEqual(seat.availability.cursor, true);

      // A `hide` slug is a catalog member without being Codex availability.
      const reserve = model("gpt-reserve");
      strictEqual(reserve.availability.codexCli, false);

      // An upstream level this repo does not model is dropped, not fatal.
      const future = model("future-model-1");
      expect([...future.levels]).toEqual(["low"]);
    })
  );

  it.effect("records which overlays answered and degrades when one is absent", () =>
    Effect.gen(function* () {
      const catalog = yield* ModelsCatalog;
      const answered = yield* catalog.snapshot({ home: "/home/op", offline: false });
      expect([...answered.summary.sources]).toEqual([
        "router-for-me",
        "codex-cache",
        "grok-cache",
        "cursor-agent",
        "proxy-v1-models",
      ]);

      const offline = yield* catalog.snapshot({ home: "/home/op", offline: true });
      expect(offline.summary.sources).not.toContain("router-for-me");
      expect(offline.summary.modelCount).toBeLessThan(answered.summary.modelCount);
    })
  );

  it.effect("diffs added, removed, and levels-changed models", () =>
    Effect.gen(function* () {
      const catalog = yield* ModelsCatalog;
      const full = yield* catalog.snapshot({ home: "/home/op", offline: false });
      const reduced = CatalogSnapshot.make({
        summary: full.summary,
        models: A.filter(full.models, (model) => model.id !== "grok-4.7"),
      });

      const added = diffSnapshots(O.some(reduced), full);
      expect([...added.added]).toEqual(["grok-4.7"]);
      strictEqual(A.length(added.removed), 0);

      const removed = diffSnapshots(O.some(full), reduced);
      expect([...removed.removed]).toEqual(["grok-4.7"]);

      const relevelled = CatalogSnapshot.make({
        summary: full.summary,
        models: A.map(full.models, (model) =>
          model.id === "grok-4.6" ? ({ ...model, levels: ["low"] } as typeof model) : model
        ),
      });
      const levels = diffSnapshots(O.some(relevelled), full);
      strictEqual(A.length(levels.levelsChanged), 1);
      assertSome(
        O.map(A.head(levels.levelsChanged), (change): string => change.id),
        "grok-4.6"
      );
    })
  );

  it.effect("round-trips a snapshot through the home ledger", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const home = yield* fs.makeTempDirectoryScoped({
        directory: process.cwd(),
        prefix: ".models-ledger-test-",
      });
      const catalog = yield* ModelsCatalog;
      const ledger = yield* ModelsLedger;
      const snapshot = yield* catalog.snapshot({ home, offline: false });

      assertNone(yield* ledger.latest(home));

      const written = yield* ledger.record(home, snapshot);
      expect(written).toContain(path.join(home, ".local", "state", "beep", "models"));

      const restored = yield* ledger.latest(home);
      assertSome(
        O.map(restored, (entry) => entry.summary.contentSha256),
        snapshot.summary.contentSha256
      );
      strictEqual(
        O.getOrElse(
          O.map(restored, (entry) => A.length(entry.models)),
          () => -1
        ),
        A.length(snapshot.models)
      );

      // A second record of the same digest is a no-op that returns latest.json.
      strictEqual(
        yield* ledger.record(home, snapshot),
        path.join(home, ".local", "state", "beep", "models", "latest.json")
      );
    }).pipe(Effect.scoped)
  );
});
