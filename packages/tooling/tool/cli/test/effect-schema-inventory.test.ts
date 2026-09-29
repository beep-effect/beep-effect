import { fileURLToPath } from "node:url";
import {
  compactEffectSchemaInventoryPreview,
  diffEffectSchemaInventoryFiles,
  digestEffectSchemaInventoryJsonl,
  EffectSchemaInventoryFile,
  EffectSchemaInventoryGraftContext,
  EffectSchemaInventoryModule,
  EffectSchemaInventoryModules,
  EffectSchemaInventoryPinAbsentError,
  EffectSchemaInventoryReferenceMissingError,
  EffectSchemaInventoryRequest,
  EffectSchemaInventoryRow,
  EffectSchemaInventorySource,
  effectSchemaInventoryRequestFromFlags,
  extractEffectSchemaInventory,
  generateEffectSchemaInventory,
  parseEffectSchemaInventoryPin,
  readEffectSchemaInventoryIndexHeader,
  renderEffectSchemaInventoryJsonl,
  renderEffectSchemaInventoryPrompt,
  runEffectSchemaInventory,
} from "@beep/repo-cli/commands/Lint";
import { A, Str } from "@beep/utils";
import { NodeServices } from "@effect/platform-node";
import { it } from "@effect/vitest";
import { assertFalse, assertInclude, assertTrue, deepStrictEqual, strictEqual } from "@effect/vitest/utils";
import { Effect, FileSystem, HashMap, Path, Ref } from "effect";
import * as O from "effect/Option";
import type { EffectSchemaInventorySourceShape } from "@beep/repo-cli/commands/Lint";

const repositoryRoot = fileURLToPath(new URL("../../../../..", import.meta.url));
const PIN = "df77fff9396fe31de72d1947ecb5b74f8cee89e1";
const ABSENT_PIN = "0000000000000000000000000000000000000000";
const snapshotManifest = (pin: string) => `{"catalog":{"effect":"https://pkg.pr.new/Effect-TS/effect/effect@${pin}"}}`;

const demoModule = EffectSchemaInventoryModule.make({
  file: "packages/effect/src/Demo.ts",
  module: "effect/Demo",
  slug: "effect-Demo",
  importable: true,
});
const otherModule = EffectSchemaInventoryModule.make({
  file: "packages/effect/src/Other.ts",
  module: "effect/Other",
  slug: "effect-Other",
  importable: false,
});

const demoSource = `/**
 * Formats a value.
 *
 * **Example** (Format)
 *
 * \`\`\`ts
 * a(1)
 * \`\`\`
 *
 * @category formatting
 * @since 1.0.0
 */
export function a(x: string): string
export function a(x: number): string
export function a(x: unknown): string {
  return \`\${x}\`
}
/**
 * Internal shape.
 *
 * @internal
 */
export interface I {
  readonly p: string
  m(): void
  (x: number): string
}
export class C {
  private hidden = 1
  readonly shown = 2
  constructor() {}
}
export const { d, e: [f] } = make()
const local = 1
export {
  /** Aliased local. */
  local as aliased
}
export * as N from "./Other.ts"
export declare namespace NS {
  export type T = string
  export interface U {
    readonly q: number
  }
}
export { x } from "./elsewhere.ts"
export * from "./star.ts"
`;

const extractDemo = extractEffectSchemaInventory(PIN, [
  [demoModule, demoSource],
  [otherModule, "export const other = 1\n"],
]);

const rowOf = (rows: ReadonlyArray<EffectSchemaInventoryRow>, symbol: string, kind: string) =>
  A.findFirst(rows, (row) => row.symbol === symbol && row.kind === kind);

const makeRow = (fields: { readonly line: number; readonly symbol: string; readonly hasExample: boolean }) =>
  EffectSchemaInventoryRow.make({
    sha: PIN,
    module: demoModule.module,
    file: demoModule.file,
    line: fields.line,
    symbol: fields.symbol,
    kind: "function",
    category: O.none(),
    since: O.none(),
    deprecated: false,
    internal: false,
    summary: "",
    hasExample: fields.hasExample,
    signature: "",
    overloads: 0,
    importable: true,
  });

const unavailableGraft = EffectSchemaInventoryGraftContext.cases.unavailable.make({ reason: "graft is not on PATH" });

const fakeSource = (
  overrides: Partial<EffectSchemaInventorySourceShape>,
  reads: Ref.Ref<number>
): EffectSchemaInventorySourceShape => ({
  readPin: Effect.succeed(PIN),
  verifyPin: Effect.fn("EffectSchemaInventoryTest.verifyPin")(() => Effect.void),
  readPinned: Effect.fn("EffectSchemaInventoryTest.readPinned")(() =>
    Ref.update(reads, (count) => count + 1).pipe(Effect.as(""))
  ),
  graftContext: Effect.fn("EffectSchemaInventoryTest.graftContext")(() => Effect.succeed(unavailableGraft)),
  ...overrides,
});

it.layer(NodeServices.layer, { timeout: "60 seconds" })("effect-schema-inventory", (it) => {
  it.effect(
    "reads the pin from a snapshot catalog and rejects anything else",
    Effect.fnUntraced(function* () {
      strictEqual(yield* parseEffectSchemaInventoryPin(snapshotManifest(PIN)), PIN);
      strictEqual(
        yield* parseEffectSchemaInventoryPin(
          `{"workspaces":{"catalog":{"effect":"https://pkg.pr.new/Effect-TS/effect/effect@${PIN}"}}}`
        ),
        PIN
      );
      const semver = yield* Effect.flip(parseEffectSchemaInventoryPin('{"catalog":{"effect":"4.0.0-rc.118"}}'));
      strictEqual(semver._tag, "EffectSchemaInventoryCatalogPinError");
      strictEqual(semver.specifier, "4.0.0-rc.118");
      const abbreviated = yield* Effect.flip(parseEffectSchemaInventoryPin(snapshotManifest("df77fff939")));
      strictEqual(abbreviated._tag, "EffectSchemaInventoryCatalogPinError");
      const missing = yield* Effect.flip(parseEffectSchemaInventoryPin('{"workspaces":["packages/*"]}'));
      strictEqual(missing.specifier, "<missing>");
      const broken = yield* Effect.flip(parseEffectSchemaInventoryPin("{"));
      strictEqual(broken._tag, "EffectSchemaInventoryCatalogPinError");
    })
  );

  it.effect(
    "digests the concatenated JSONL bytes",
    Effect.fnUntraced(function* () {
      strictEqual(
        yield* digestEffectSchemaInventoryJsonl([]),
        "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
      );
      strictEqual(
        yield* digestEffectSchemaInventoryJsonl(["a\n", "", "b\n"]),
        yield* digestEffectSchemaInventoryJsonl(["a\nb\n"])
      );
    })
  );

  it("collapses whitespace and truncates previews with an ellipsis", () => {
    strictEqual(compactEffectSchemaInventoryPreview("  a\n\t b  ", 300), "a b");
    strictEqual(compactEffectSchemaInventoryPreview("abcdef", 4), "abc…");
    strictEqual(compactEffectSchemaInventoryPreview(4)("abcd"), "abcd");
  });

  it.effect(
    "extracts declaration facets with the prototype's rules",
    Effect.fnUntraced(function* () {
      const extraction = yield* extractDemo;
      strictEqual(extraction.bareStarDeclarationsOmitted, 1);
      const rows = A.flatMap(extraction.modules, (entry) => entry.rows);
      const demoRows = O.getOrThrow(A.head(extraction.modules)).rows;
      deepStrictEqual(
        A.map(demoRows, (row) => `${row.line}:${row.symbol}:${row.kind}`),
        [
          "13:a:function",
          "23:I:interface",
          "24:I.p:property",
          "25:I.m:method",
          "26:I.<call>:call",
          "28:C:class",
          "30:C.shown:property",
          "31:C.<new>:constructor",
          "33:d:const",
          "33:f:const",
          "37:aliased:const",
          "39:N:namespace",
          "40:NS:namespace",
          "41:NS.T:type",
          "42:NS.U:interface",
          "46:x:re-export",
        ]
      );
      const a = O.getOrThrow(rowOf(rows, "a", "function"));
      strictEqual(a.overloads, 2);
      assertTrue(a.hasExample);
      deepStrictEqual(a.category, O.some("formatting"));
      deepStrictEqual(a.since, O.some("1.0.0"));
      strictEqual(a.summary, "Formats a value.");
      strictEqual(a.signature, "export function a(x: string): string");
      assertTrue(O.getOrThrow(rowOf(rows, "I", "interface")).internal);
      strictEqual(O.getOrThrow(rowOf(rows, "I.<call>", "call")).overloads, 1);
      strictEqual(O.getOrThrow(rowOf(rows, "d", "const")).signature, "const d: <inferred; see source>");
      strictEqual(O.getOrThrow(rowOf(rows, "aliased", "const")).summary, "Aliased local.");
      strictEqual(O.getOrThrow(rowOf(rows, "N", "namespace")).signature, 'export * as N from "./Other.ts"');
      assertFalse(O.getOrThrow(rowOf(rows, "other", "const")).importable);
    })
  );

  it.effect(
    "fails when a namespace re-export targets a module outside the list, or a source does not parse",
    Effect.fnUntraced(function* () {
      const outside = yield* Effect.flip(
        extractEffectSchemaInventory(PIN, [[demoModule, 'export * as Z from "./Missing.ts"\n']])
      );
      strictEqual(outside._tag, "EffectSchemaInventoryError");
      assertInclude(outside.message, "packages/effect/src/Missing.ts");
      const unparsable = yield* Effect.flip(extractEffectSchemaInventory(PIN, [[demoModule, "export const = ;\n"]]));
      assertInclude(unparsable.message, "Parse errors");
    })
  );

  it.effect(
    "renders JSONL that decodes back and reports missing, stale, and unexpected files",
    Effect.fnUntraced(function* () {
      const extraction = yield* extractDemo;
      const rows = O.getOrThrow(A.head(extraction.modules)).rows;
      const body = yield* renderEffectSchemaInventoryJsonl(rows);
      assertTrue(Str.endsWith("\n")(body));
      strictEqual(A.filter(Str.split(body, "\n"), Str.isNonEmpty).length, rows.length);
      strictEqual(yield* renderEffectSchemaInventoryJsonl([]), "");
      const drift = diffEffectSchemaInventoryFiles(
        [
          EffectSchemaInventoryFile.make({ name: "effect-Demo.jsonl", content: "same\nexpected line\n" }),
          EffectSchemaInventoryFile.make({ name: "INDEX.md", content: "# index\n" }),
        ],
        HashMap.make(["effect-Demo.jsonl", "same\nexpected lime\n"], ["effect-Old.jsonl", "{}\n"])
      );
      deepStrictEqual(
        A.map(drift, (entry) => entry._tag),
        ["stale", "missing", "unexpected"]
      );
      const stale = O.getOrThrow(A.head(drift));
      assertTrue(stale._tag === "stale");
      strictEqual(stale.line, 2);
      strictEqual(stale.column, 12);
      deepStrictEqual(diffEffectSchemaInventoryFiles([], HashMap.empty<string, string>()), []);
    })
  );

  it.effect(
    "rejects an index without its pin, parser, and digest lines",
    Effect.fnUntraced(function* () {
      const failure = yield* Effect.flip(readEffectSchemaInventoryIndexHeader("# Schema inventory index\n"));
      strictEqual(failure._tag, "EffectSchemaInventoryError");
    })
  );

  it.effect(
    "maps flags to one request",
    Effect.fnUntraced(function* () {
      const flags = { write: false, check: false, prompt: O.none<string>(), out: O.none<string>() };
      strictEqual((yield* effectSchemaInventoryRequestFromFlags(flags))._tag, "check");
      strictEqual((yield* effectSchemaInventoryRequestFromFlags({ ...flags, write: true }))._tag, "write");
      const prompt = yield* effectSchemaInventoryRequestFromFlags({ ...flags, prompt: O.some("effect/SchemaIssue") });
      assertTrue(EffectSchemaInventoryRequest.guards.prompt(prompt));
      const both = yield* Effect.flip(effectSchemaInventoryRequestFromFlags({ ...flags, write: true, check: true }));
      assertInclude(both.message, "Choose one");
      const strayOut = yield* Effect.flip(effectSchemaInventoryRequestFromFlags({ ...flags, out: O.some("x.md") }));
      assertInclude(strayOut.message, "--out");
    })
  );

  it.effect(
    "fails loud before reading any source when the reference is missing or lacks the pin",
    Effect.fnUntraced(function* () {
      const reads = yield* Ref.make(0);
      const missing = yield* Effect.flip(
        generateEffectSchemaInventory().pipe(
          Effect.provideService(
            EffectSchemaInventorySource,
            fakeSource(
              {
                verifyPin: Effect.fn("EffectSchemaInventoryTest.missingReference")(() =>
                  Effect.fail(EffectSchemaInventoryReferenceMissingError.new("/repo/.repos/effect", "missing"))
                ),
              },
              reads
            )
          )
        )
      );
      strictEqual(missing._tag, "EffectSchemaInventoryReferenceMissingError");
      const absent = yield* Effect.flip(
        generateEffectSchemaInventory().pipe(
          Effect.provideService(
            EffectSchemaInventorySource,
            fakeSource(
              {
                verifyPin: Effect.fn("EffectSchemaInventoryTest.absentPin")((pin) =>
                  Effect.fail(EffectSchemaInventoryPinAbsentError.new(pin, "/repo/.repos/effect", "not fetched"))
                ),
              },
              reads
            )
          )
        )
      );
      strictEqual(absent._tag, "EffectSchemaInventoryPinAbsentError");
      strictEqual(yield* Ref.get(reads), 0);
    })
  );

  it.effect(
    "check fails with every drifted file against an empty fixture and writes nothing",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "effect-schema-inventory-check-" });
      const reads = yield* Ref.make(0);
      const failure = yield* Effect.flip(
        runEffectSchemaInventory(root, EffectSchemaInventoryRequest.cases.check.make({})).pipe(
          Effect.provideService(EffectSchemaInventorySource, fakeSource({}, reads))
        )
      );
      assertTrue(failure._tag === "EffectSchemaInventoryDriftError");
      strictEqual(failure.drift.length, EffectSchemaInventoryModules.length + 1);
      assertTrue(A.every(failure.drift, (entry) => entry._tag === "missing"));
      strictEqual(yield* Ref.get(reads), EffectSchemaInventoryModules.length);
      deepStrictEqual(yield* fs.readDirectory(root), []);
    })
  );

  it.effect(
    "live source fails loud on a missing reference, an absent pin, and a non-snapshot catalog",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const verify = (root: string) =>
        Effect.flip(
          Effect.flatMap(EffectSchemaInventorySource.make(root), (source) =>
            Effect.flatMap(source.readPin, source.verifyPin)
          )
        );

      const bare = yield* fs.makeTempDirectoryScoped({ prefix: "effect-schema-inventory-bare-" });
      yield* fs.writeFileString(path.join(bare, "package.json"), snapshotManifest(PIN));
      strictEqual((yield* verify(bare))._tag, "EffectSchemaInventoryReferenceMissingError");

      const linked = yield* fs.makeTempDirectoryScoped({ prefix: "effect-schema-inventory-linked-" });
      yield* fs.writeFileString(path.join(linked, "package.json"), snapshotManifest(ABSENT_PIN));
      yield* fs.makeDirectory(path.join(linked, ".repos"));
      yield* fs.symlink(repositoryRoot, path.join(linked, ".repos", "effect"));
      const absent = yield* verify(linked);
      assertTrue(absent._tag === "EffectSchemaInventoryPinAbsentError");
      strictEqual(absent.pin, ABSENT_PIN);

      const semver = yield* fs.makeTempDirectoryScoped({ prefix: "effect-schema-inventory-semver-" });
      yield* fs.writeFileString(path.join(semver, "package.json"), '{"catalog":{"effect":"4.0.0-rc.118"}}');
      strictEqual((yield* verify(semver))._tag, "EffectSchemaInventoryCatalogPinError");

      const live = yield* EffectSchemaInventorySource.make(linked);
      const graft = yield* live.graftContext(ABSENT_PIN, "packages/effect/src/Nope.ts");
      assertTrue(graft._tag === "unavailable");
      assertFalse(Str.includes(linked)(graft.reason), "graft reasons never carry the checkout path");
    })
  );

  it.effect(
    "inlines each row's full declaration and JSDoc into the lane prompt",
    Effect.fnUntraced(function* () {
      const extraction = yield* extractDemo;
      const rows = O.getOrThrow(A.head(extraction.modules)).rows;
      const prompt = yield* renderEffectSchemaInventoryPrompt({
        module: demoModule,
        pin: PIN,
        rows,
        source: demoSource,
        graft: unavailableGraft,
      });
      assertInclude(prompt, "export function a(x: unknown): string {\n  return `${x}`\n}");
      assertInclude(prompt, "**Example** (Format)");
      assertInclude(prompt, "````ts\n/**\n * Formats a value.");
      assertInclude(prompt, "const local = 1");
      assertInclude(prompt, "Graft context is unavailable (graft is not on PATH)");
      assertFalse(Str.includes("/repo")(prompt));
    })
  );

  it.effect(
    "refuses a prompt that would ship only truncated row fields",
    Effect.fnUntraced(function* () {
      const render = (rows: ReadonlyArray<EffectSchemaInventoryRow>) =>
        Effect.flip(
          renderEffectSchemaInventoryPrompt({
            module: demoModule,
            pin: PIN,
            rows,
            source: demoSource,
            graft: unavailableGraft,
          })
        );
      const unresolved = yield* render([makeRow({ line: 999, symbol: "ghost", hasExample: false })]);
      assertInclude(unresolved.message, "ghost@999");
      const noExample = yield* render([makeRow({ line: 28, symbol: "C", hasExample: true })]);
      assertInclude(noExample.message, "hasExample");
    })
  );
});
