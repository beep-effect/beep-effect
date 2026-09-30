import { fileURLToPath } from "node:url";
import {
  decodeEffectSchemaInventoryRowJson,
  digestEffectSchemaInventoryJsonl,
  EffectSchemaInventoryFixturePath,
  EffectSchemaInventoryModuleRows,
  EffectSchemaInventoryModules,
  effectSchemaInventoryByteLength,
  effectSchemaInventoryJsonlName,
  encodeEffectSchemaInventoryRowJson,
  parseEffectSchemaInventoryPin,
  readEffectSchemaInventoryIndexHeader,
  renderEffectSchemaInventoryIndex,
} from "@beep/repo-cli/commands/Lint";
import { A, Str } from "@beep/utils";
import { NodeServices } from "@effect/platform-node";
import { it } from "@effect/vitest";
import { assertTrue, deepStrictEqual, strictEqual } from "@effect/vitest/utils";
import { Effect, FileSystem, HashSet, Order, Path } from "effect";

// Hosted verification of the committed schema inventory: reads only committed files, never
// `.repos/effect`, graft, or the network.
const repositoryRoot = fileURLToPath(new URL("../../../../..", import.meta.url));

const loadFixture = Effect.fnUntraced(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const directory = path.join(repositoryRoot, EffectSchemaInventoryFixturePath);
  const names = yield* fs.readDirectory(directory);
  const index = yield* fs.readFileString(path.join(directory, "INDEX.md"));
  const manifest = yield* fs.readFileString(path.join(repositoryRoot, "package.json"));
  const modules = yield* Effect.forEach(EffectSchemaInventoryModules, (module) =>
    Effect.map(fs.readFileString(path.join(directory, effectSchemaInventoryJsonlName(module.slug))), (body) => ({
      module,
      body,
      lines: A.filter(Str.split(body, "\n"), Str.isNonEmpty),
    }))
  );
  return { names, index, manifest, modules };
});

it.layer(NodeServices.layer, { timeout: "60 seconds" })("effect-schema-rc118 inventory fixture", (it) => {
  it.effect(
    "holds exactly one JSONL file per module-list entry",
    Effect.fnUntraced(function* () {
      const fixture = yield* loadFixture();
      const jsonl = A.sort(
        A.filter(fixture.names, (name) => Str.endsWith(".jsonl")(name)),
        Order.String
      );
      const expected = A.sort(
        A.map(EffectSchemaInventoryModules, (module) => effectSchemaInventoryJsonlName(module.slug)),
        Order.String
      );
      deepStrictEqual(jsonl, expected);
      assertTrue(A.contains(fixture.names, "README.md"), "The fixture keeps its schema-inventory/v1 contract");
    })
  );

  it.effect(
    "decodes every row, re-encodes it to the committed line, and matches its module-list entry",
    Effect.fnUntraced(function* () {
      const fixture = yield* loadFixture();
      for (const { module, body, lines } of fixture.modules) {
        assertTrue(Str.isEmpty(body) || Str.endsWith("\n")(body), `${module.slug} ends with a newline`);
        const rows = yield* Effect.forEach(lines, (line) => decodeEffectSchemaInventoryRowJson(line));
        const reencoded = yield* Effect.forEach(rows, (row) => encodeEffectSchemaInventoryRowJson(row));
        deepStrictEqual(reencoded, lines, `${module.slug} rows round-trip byte for byte`);
        for (const row of rows) {
          strictEqual(row.module, module.module);
          strictEqual(row.file, module.file);
          strictEqual(row.importable, module.importable);
        }
        const lineNumbers = A.map(rows, (row) => row.line);
        deepStrictEqual(lineNumbers, A.sort(lineNumbers, Order.Number), `${module.slug} rows follow source order`);
      }
    })
  );

  it.effect(
    "keeps (module, symbol, kind) identities unique",
    Effect.fnUntraced(function* () {
      const fixture = yield* loadFixture();
      const rows = yield* Effect.forEach(
        A.flatMap(fixture.modules, ({ lines }) => lines),
        (line) => decodeEffectSchemaInventoryRowJson(line)
      );
      const identities = HashSet.fromIterable(
        A.map(rows, (row) => `${row.module}\u0000${row.symbol}\u0000${row.kind}`)
      );
      strictEqual(HashSet.size(identities), rows.length);
    })
  );

  it.effect(
    "pins every row to the INDEX pin line and to the root package.json catalog",
    Effect.fnUntraced(function* () {
      const fixture = yield* loadFixture();
      const catalogPin = yield* parseEffectSchemaInventoryPin(fixture.manifest);
      const header = yield* readEffectSchemaInventoryIndexHeader(fixture.index);
      strictEqual(
        header.pin,
        catalogPin,
        "The Effect catalog pin moved: regenerate the fixture with `bun run beep lint effect-schema-inventory --write`."
      );
      const rows = yield* Effect.forEach(
        A.flatMap(fixture.modules, ({ lines }) => lines),
        (line) => decodeEffectSchemaInventoryRowJson(line)
      );
      assertTrue(A.isReadonlyArrayNonEmpty(rows), "The fixture carries rows");
      for (const row of rows) strictEqual(row.sha, catalogPin, `${row.module} ${row.symbol} is at the catalog pin`);
    })
  );

  it.effect(
    "records the JSONL digest and re-renders INDEX.md byte for byte from the committed rows",
    Effect.fnUntraced(function* () {
      const fixture = yield* loadFixture();
      const header = yield* readEffectSchemaInventoryIndexHeader(fixture.index);
      const digest = yield* digestEffectSchemaInventoryJsonl(A.map(fixture.modules, ({ body }) => body));
      strictEqual(digest, header.digest);
      const modules = yield* Effect.forEach(fixture.modules, ({ module, body, lines }) =>
        Effect.map(
          Effect.forEach(lines, (line) => decodeEffectSchemaInventoryRowJson(line)),
          (rows) =>
            [EffectSchemaInventoryModuleRows.make({ module, rows }), effectSchemaInventoryByteLength(body)] as const
        )
      );
      const rendered = renderEffectSchemaInventoryIndex({ pin: header.pin, parser: header.parser, digest, modules });
      strictEqual(rendered, fixture.index);
    })
  );
});
