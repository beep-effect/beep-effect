import {
  AttributeKey,
  AttributeKeyName,
  InstrumentDeclarations,
  PackageName,
  SpanInstrument,
  SpanName,
} from "@beep/observability/catalog";
import {
  buildCatalog,
  familySpanCounts,
  HarvestedSpan,
  harvestedSpanInstrument,
  harvestedSpans,
  harvestSourceFile,
  InstrumentationCatalog,
  InstrumentationCatalogDocument,
  InstrumentationCatalogLive,
  InstrumentationCatalogShard,
  packageFamilyOfPath,
  renderShardText,
  SpanHarvest,
  SpanSite,
  STANDARD_SECTION,
  STANDARD_SECTION_BEGIN,
  STANDARD_SECTION_END,
  shardCatalog,
  shardPath,
  spliceStandardSection,
} from "@beep/repo-cli/commands/Observability";
import { FsUtilsLive } from "@beep/repo-utils/FsUtils";
import { PosixPath } from "@beep/schema/PosixPath";
import { describe, expect, it, layer } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Str from "effect/String";
import { Project } from "ts-morph";
import { dynamicSpans, literalSpans } from "./fixtures/observability-catalog/sources.ts";
import { NodeTestLayer, withTempWorkingDirectory, writeProjectFile } from "./support/CommandTest.ts";

const pkgA = PackageName.make("@beep/a");
const pkgB = PackageName.make("@beep/b");

const harvestFixture = (
  source: string,
  file = "packages/drivers/fixture/src/Fixture.ts",
  owner = pkgA
): SpanHarvest => {
  const project = new Project({ useInMemoryFileSystem: true });
  return harvestSourceFile(project.createSourceFile("Fixture.ts", source), PosixPath.make(file), owner);
};

const site = (name: string, owner: PackageName, file = "packages/drivers/fixture/src/Fixture.ts"): SpanSite =>
  SpanSite.make({
    name,
    owner,
    family: packageFamilyOfPath(file),
    file: PosixPath.make(file),
    line: 1,
    callee: "Effect.fn",
  });

const harvestOf = (sites: ReadonlyArray<SpanSite>): SpanHarvest => SpanHarvest.make({ sites, findings: [] });

describe("packageFamilyOfPath", () => {
  it("derives every family from the path", () => {
    expect(
      A.map(
        [
          "packages/documents/server/src/A.ts",
          "packages/shared/domain/src/A.ts",
          "packages/foundation/capability/observability/src/A.ts",
          "packages/drivers/box/src/A.ts",
          "packages/tooling/tool/cli/src/A.ts",
          "packages/_internal/db-admin/src/A.ts",
          "packages/ecosystem/effect-drizzle/src/A.ts",
          "apps/professional-desktop/src/A.ts",
          "apps/labs/semantica/src/A.ts",
        ],
        packageFamilyOfPath
      )
    ).toEqual(["slice", "slice", "foundation", "driver", "tooling", "tooling", "ecosystem", "app", "lab"]);
  });
});

describe("harvestSourceFile", () => {
  it("records literal and const-bound span names with their callee", () => {
    const harvest = harvestFixture(literalSpans);
    expect(A.map(harvest.sites, ({ name, callee }) => `${callee} ${name}`)).toEqual([
      "Effect.fn Parcels.read",
      "Effect.fnUntraced Parcels.write",
      "Effect.withSpan Parcels.list",
      "Effect.withSpan db.query",
      "Effect.withSpan Parcels.count",
    ]);
    expect(harvest.findings).toEqual([]);
    expect(A.map(harvest.sites, ({ owner, family }) => `${owner} ${family}`)).toEqual(A.replicate("@beep/a driver", 5));
  });

  it("resolves aliased effect/Effect namespace and named imports", () => {
    const harvest = harvestFixture(
      A.join(
        [
          'import * as Eff from "effect/Effect";',
          'import { withSpan as span, fnUntraced } from "effect/Effect";',
          'const read = Eff.fn("Parcels.read")(function* () {});',
          'const write = fnUntraced("Parcels.write")(function* () {});',
          'const list = span(Eff.void, "Parcels.list");',
          'const other = Other.fn("Parcels.ignored");',
        ],
        "\n"
      )
    );
    expect(A.map(harvest.sites, ({ name, callee }) => `${callee} ${name}`)).toEqual([
      "Effect.fn Parcels.read",
      "Effect.fnUntraced Parcels.write",
      "Effect.withSpan Parcels.list",
    ]);
  });

  it("reports interpolated names and non-literal names as findings", () => {
    const harvest = harvestFixture(dynamicSpans);
    expect(harvest.sites).toEqual([]);
    expect(A.map(harvest.findings, ({ kind, text }) => `${kind} ${text}`)).toEqual([
      "interpolated `box.${method}`",
      "non-literal name",
      "interpolated `${prefix}.execute`",
    ]);
  });
});

describe("harvestedSpans", () => {
  it("collapses repeated sites per owner and flags conformance", () => {
    const rows = harvestedSpans(
      harvestOf([
        site("db.query", pkgA),
        site("Parcels.read", pkgB),
        site("db.query", pkgA),
        site("Parcels.read", pkgA),
      ])
    );
    expect(A.map(rows, ({ name, owner, conforms }) => `${name} ${owner} ${conforms}`)).toEqual([
      "Parcels.read @beep/a true",
      "Parcels.read @beep/b true",
      "db.query @beep/a false",
    ]);
  });

  it("turns a non-conforming row into a harvested span instrument", () => {
    const row = HarvestedSpan.make({ name: "db.query", owner: pkgA, family: "driver", conforms: false });
    assertSome(
      O.map(harvestedSpanInstrument(row), ({ origin, conforms, protocol }) => ({ origin, conforms, protocol })),
      { origin: "harvested", conforms: false, protocol: false }
    );
  });
});

describe("buildCatalog", () => {
  it("passes when names are unique and declarations merge", () => {
    const build = buildCatalog(harvestOf([site("Parcels.read", pkgA), site("db.query", pkgA)]), [
      InstrumentDeclarations.make({}),
    ]);
    expect(build.conflicts).toEqual([]);
    expect(build.document.spans.length).toBe(2);
  });

  it("reports a cross-package duplicate name", () => {
    const build = buildCatalog(harvestOf([site("Parcels.read", pkgA), site("Parcels.read", pkgB)]), []);
    expect(build.conflicts).toEqual(["span Parcels.read is declared by @beep/a, @beep/b"]);
  });

  it("lets a declared span carry attributes for its harvested name", () => {
    const key = AttributeKeyName.make("beep.desktop.operation");
    const declarations = InstrumentDeclarations.make({
      attributes: [
        AttributeKey.make({
          key,
          type: "string",
          signals: ["span"],
          cardinality: "static",
          minTier: "shape-only",
          owner: pkgA,
          description: "Operation.",
        }),
      ],
      instruments: [
        SpanInstrument.make({
          name: SpanName.make("Parcels.read"),
          owner: pkgA,
          family: "driver",
          attributes: [key],
          minTier: "shape-only",
          description: "Reads parcels.",
          kind: "internal",
        }),
      ],
    });
    const build = buildCatalog(harvestOf([site("Parcels.read", pkgA)]), [declarations]);
    expect(build.conflicts).toEqual([]);
    expect(build.document.instruments.length).toBe(1);
  });
});

describe("rendering", () => {
  const document = InstrumentationCatalogDocument.make({
    attributes: [],
    instruments: [],
    spans: harvestedSpans(harvestOf([site("db.query", pkgA), site("Parcels.read", pkgB), site("Box.list", pkgA)])),
  });

  it.effect("renders deterministic JSONC with one span per line per shard", () =>
    Effect.gen(function* () {
      const [shardA] = shardCatalog(document);
      expect(shardA?.package).toBe(pkgA);
      const shard =
        shardA ?? InstrumentationCatalogShard.make({ package: pkgA, attributes: [], instruments: [], spans: [] });
      const first = yield* renderShardText(shard);
      const second = yield* renderShardText(shard);
      expect(first).toBe(second);
      expect(first).toContain('  "package": "@beep/a",\n');
      expect(first).toContain(
        '    {"name":"Box.list","owner":"@beep/a","family":"driver","conforms":true},\n    {"name":"db.query","owner":"@beep/a","family":"driver","conforms":false}\n'
      );
      expect(first).not.toContain("Parcels.read");
    })
  );

  it("counts spans per family in family order", () => {
    expect(
      A.map(familySpanCounts(document.spans), ({ family, spans, conforming }) => `${family}:${spans}:${conforming}`)
    ).toEqual(["slice:0:0", "foundation:0:0", "driver:3:2", "tooling:0:0", "ecosystem:0:0", "app:0:0", "lab:0:0"]);
  });

  it("splices the count-free generated section between its markers", () => {
    expect(STANDARD_SECTION).not.toContain("| Family |");
    expect(Str.endsWith(STANDARD_SECTION_END)(STANDARD_SECTION)).toBe(true);
    const doc = `# Title\n\n${STANDARD_SECTION_BEGIN}\nold\n${STANDARD_SECTION_END}\n\nrest\n`;
    assertSome(spliceStandardSection(doc, STANDARD_SECTION), `# Title\n\n${STANDARD_SECTION}\n\nrest\n`);
    assertNone(spliceStandardSection("# no markers\n", STANDARD_SECTION));
  });
});

describe("shardCatalog", () => {
  const pkgC = PackageName.make("@beep/c");
  const attribute = AttributeKey.make({
    key: AttributeKeyName.make("beep.c.operation"),
    type: "string",
    signals: ["span"],
    cardinality: "static",
    minTier: "shape-only",
    owner: pkgC,
    description: "Operation.",
  });

  it("gives every owner of a span, attribute or instrument one shard, in package order", () => {
    const shards = shardCatalog(
      InstrumentationCatalogDocument.make({
        attributes: [attribute],
        instruments: [],
        spans: harvestedSpans(harvestOf([site("Parcels.read", pkgB), site("Box.list", pkgA)])),
      })
    );
    expect(A.map(shards, (shard) => shard.package)).toEqual([pkgA, pkgB, pkgC]);
    expect(A.map(shards, (shard) => shardPath(shard.package))).toEqual([
      "standards/instrumentation-catalog/@beep/a.generated.jsonc",
      "standards/instrumentation-catalog/@beep/b.generated.jsonc",
      "standards/instrumentation-catalog/@beep/c.generated.jsonc",
    ]);
    expect(shards[2]?.attributes).toEqual([attribute]);
    expect(shards[2]?.spans).toEqual([]);
  });

  it.effect("keeps span additions in different packages in disjoint files", () =>
    Effect.gen(function* () {
      const base = [site("Box.list", pkgA), site("Parcels.read", pkgB)];
      const render = Effect.fn(function* (sites: ReadonlyArray<SpanSite>) {
        const build = buildCatalog(harvestOf(sites), []);
        return yield* Effect.forEach(shardCatalog(build.document), (shard) =>
          Effect.map(renderShardText(shard), (text) => [shardPath(shard.package), text] as const)
        );
      });
      const changed = (
        before: ReadonlyArray<readonly [string, string]>,
        after: ReadonlyArray<readonly [string, string]>
      ) =>
        A.map(
          A.filter(
            after,
            ([file, text]) => !A.some(before, ([other, previous]) => other === file && previous === text)
          ),
          ([file]) => file
        );
      const main = yield* render(base);
      const left = yield* render([...base, site("Box.upload", pkgA)]);
      const right = yield* render([...base, site("Parcels.write", pkgB)]);
      const merged = yield* render([...base, site("Box.upload", pkgA), site("Parcels.write", pkgB)]);
      const leftFiles = changed(main, left);
      const rightFiles = changed(main, right);
      expect(leftFiles).toEqual(["standards/instrumentation-catalog/@beep/a.generated.jsonc"]);
      expect(rightFiles).toEqual(["standards/instrumentation-catalog/@beep/b.generated.jsonc"]);
      expect(merged).toEqual([
        A.findFirst(left, ([file]) => file === leftFiles[0]).pipe(O.getOrThrow),
        A.findFirst(right, ([file]) => file === rightFiles[0]).pipe(O.getOrThrow),
      ]);
    })
  );
});

const serviceLayer = Layer.mergeAll(NodeTestLayer, FsUtilsLive.pipe(Layer.provide(NodeTestLayer)));
const exampleShard = "standards/instrumentation-catalog/@beep/example.generated.jsonc";
const orphanShard = "standards/instrumentation-catalog/@beep/gone.generated.jsonc";
const retiredCatalog = "standards/instrumentation-catalog.generated.jsonc";

const writeCatalogFixture = Effect.fn("ObservabilityCatalogTest.writeFixture")(function* () {
  yield* writeProjectFile("bun.lock", "");
  yield* writeProjectFile(
    "package.json",
    '{\n  "name": "@beep/test-root",\n  "private": true,\n  "workspaces": ["packages/drivers/*"]\n}\n'
  );
  yield* writeProjectFile(
    "packages/drivers/example/package.json",
    '{\n  "name": "@beep/example",\n  "version": "0.0.0",\n  "type": "module"\n}\n'
  );
  yield* writeProjectFile(
    "packages/drivers/example/src/Example.ts",
    'import * as Effect from "effect/Effect";\n\nexport const run = Effect.fn("Example.run")(function* () {});\n'
  );
  yield* writeProjectFile(
    "standards/architecture/12-observability.md",
    `# 12\n\n${STANDARD_SECTION_BEGIN}\n${STANDARD_SECTION_END}\n`
  );
});

const runCatalog = (mode: "write" | "check") =>
  Effect.flatMap(Layer.build(InstrumentationCatalogLive), (context) =>
    Context.get(context, InstrumentationCatalog).run(mode)
  );

layer(serviceLayer, { timeout: "60 seconds" })("InstrumentationCatalog.run", (it) => {
  it.effect(
    "reports orphaned shards and the retired catalog on check, and removes them on write",
    Effect.fn("ObservabilityCatalogTest.orphanedShards")(function* () {
      yield* withTempWorkingDirectory(
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          yield* writeCatalogFixture();
          const first = yield* runCatalog("write");
          expect(first.ok).toBe(true);
          const exists1 = yield* fs.exists(exampleShard);
          expect(exists1).toBe(true);

          yield* writeProjectFile(orphanShard, "// orphan\n{}\n");
          yield* writeProjectFile(retiredCatalog, "// retired\n{}\n");
          const checked = yield* runCatalog("check");
          expect(checked.ok).toBe(false);
          expect(A.map(checked.drifted, (file) => `${file.status} ${file.path}`)).toEqual([
            `orphaned ${retiredCatalog}`,
            `orphaned ${orphanShard}`,
          ]);
          const exists2 = yield* fs.exists(orphanShard);
          expect(exists2).toBe(true);

          const written = yield* runCatalog("write");
          expect(A.map(written.drifted, (file) => `${file.status} ${file.path}`)).toEqual([
            `removed ${retiredCatalog}`,
            `removed ${orphanShard}`,
          ]);
          const exists3 = yield* fs.exists(orphanShard);
          expect(exists3).toBe(false);
          const exists4 = yield* fs.exists(retiredCatalog);
          expect(exists4).toBe(false);

          const clean = yield* runCatalog("check");
          expect(clean.ok).toBe(true);
          expect(clean.drifted).toEqual([]);
          expect(clean.shards).toBe(1);
        })
      );
    })
  );
});
