import {
  CatalogSnapshot,
  CodexModelsCache,
  catalogModelsById,
  diffSnapshots,
  ModelsCatalog,
  ModelsCatalogLive,
  ModelsCatalogSources,
  ModelsCatalogSourcesLive,
  ModelsLedger,
  ModelsLedgerLive,
  mergeLayers,
  parseCursorModelLines,
  UpstreamCatalog,
} from "@beep/repo-cli/commands/Models";
import { fcRuns } from "@beep/test-utils";
import { NodeCrypto, NodeServices } from "@effect/platform-node";
import { expect, layer } from "@effect/vitest";
import { assertNone, assertSome, strictEqual } from "@effect/vitest/utils";
import { Effect, FileSystem, HashMap, Layer, Option as O, Path } from "effect";
import * as A from "effect/Array";
import * as S from "effect/Schema";
import * as FetchHttpClient from "effect/unstable/http/FetchHttpClient";
import { FixtureCatalogSources, readFixtureLayers } from "./helpers/models-fixtures.ts";

const platform = Layer.mergeAll(NodeServices.layer, NodeCrypto.layer);
const models = Layer.mergeAll(ModelsCatalogLive, ModelsLedgerLive, FixtureCatalogSources).pipe(Layer.provide(platform));

layer(Layer.mergeAll(platform, models), { timeout: "30 seconds" })((it) => {
  it.effect.prop(
    "preserves schema-derived upstream and Codex payloads through round trips",
    [UpstreamCatalog, CodexModelsCache],
    Effect.fnUntraced(function* ([upstream, codex]) {
      expect(
        yield* S.decodeUnknownEffect(UpstreamCatalog)(yield* S.encodeUnknownEffect(UpstreamCatalog)(upstream))
      ).toEqual(upstream);
      expect(
        yield* S.decodeUnknownEffect(CodexModelsCache)(yield* S.encodeUnknownEffect(CodexModelsCache)(codex))
      ).toEqual(codex);
    }),
    { arbitrary: fcRuns(16) }
  );

  it.effect("round trips unknown upstream and Codex fields, including nested reasoning metadata", () =>
    Effect.gen(function* () {
      const upstream = {
        "new-provider": [
          {
            id: "new-model",
            native_capabilities: { audio: true },
            thinking: { levels: ["future-effort"], future_budget: 42 },
          },
        ],
      };
      const cache = {
        identity: { synthetic: true },
        models: [
          {
            slug: "new-model",
            context_window: 900000,
            future_field: ["retained"],
            supported_reasoning_levels: [{ effort: "future-effort", future_metadata: 42 }],
          },
        ],
      };
      expect(
        yield* S.encodeUnknownEffect(UpstreamCatalog)(yield* S.decodeUnknownEffect(UpstreamCatalog)(upstream))
      ).toEqual(upstream);
      expect(
        yield* S.encodeUnknownEffect(CodexModelsCache)(yield* S.decodeUnknownEffect(CodexModelsCache)(cache))
      ).toEqual(cache);
    })
  );

  it("keeps Cursor seats without interpreting headings and usage tips as models", () => {
    expect(
      parseCursorModelLines(
        [
          "Available models",
          "",
          "auto - Auto (default)",
          "gpt-6-astra - Astra",
          "composer-2.5 - Composer 2.5",
          "",
          "Tip: use --model <id> to switch.",
        ].join("\n")
      )
    ).toEqual(["auto", "gpt-6-astra", "composer-2.5"]);
  });

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
      expect(astra.codexLevels).toContain("ultra");
      expect(astra.upstreamLevels).not.toContain("ultra");

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
      expect(future.upstreamLevels).toHaveLength(2);
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

// The live sources layer over real platform services: every source is absent,
// so each reader answers `none` without a network call or a spawned process.
const liveSources = ModelsCatalogSourcesLive.pipe(Layer.provide(Layer.mergeAll(platform, FetchHttpClient.layer)));

layer(Layer.mergeAll(platform, liveSources), { timeout: "30 seconds" })((it) => {
  it.effect("answers none for an absent codex cache, grok cache, and proxy token", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const sources = yield* ModelsCatalogSources;
      const home = yield* fs.makeTempDirectoryScoped({ prefix: "models-live-sources-" });

      assertNone(yield* sources.readCodexCache(home));
      assertNone(yield* sources.readGrokCache(home));
      assertNone(yield* sources.listProxyModels("http://127.0.0.1:1", path.join(home, "client-token")));
    })
  );
});
