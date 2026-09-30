import { fileURLToPath } from "node:url";
import {
  checkEffectSchemaInventoryPrompts,
  compactEffectSchemaInventoryPreview,
  diffEffectSchemaInventoryFiles,
  digestEffectSchemaInventoryJsonl,
  EffectSchemaInventoryDrift,
  EffectSchemaInventoryFile,
  EffectSchemaInventoryFixturePath,
  EffectSchemaInventoryGraftContext,
  EffectSchemaInventoryGraftEntry,
  EffectSchemaInventoryModule,
  EffectSchemaInventoryModules,
  EffectSchemaInventoryPinAbsentError,
  EffectSchemaInventoryPromptRoot,
  EffectSchemaInventoryReceipt,
  EffectSchemaInventoryReferenceMissingError,
  EffectSchemaInventoryRendered,
  EffectSchemaInventoryRequest,
  EffectSchemaInventoryRow,
  EffectSchemaInventorySource,
  effectSchemaInventoryRequestFromFlags,
  encodeEffectSchemaInventoryRowJson,
  extractEffectSchemaInventory,
  findEffectSchemaInventoryModule,
  formatEffectSchemaInventoryDrift,
  generateEffectSchemaInventory,
  generateEffectSchemaInventoryPrompt,
  makeEffectSchemaInventoryCommandForTesting,
  parseEffectSchemaInventoryPin,
  readEffectSchemaInventoryFixture,
  readEffectSchemaInventoryIndexHeader,
  renderEffectSchemaInventoryJsonl,
  renderEffectSchemaInventoryPrompt,
  runEffectSchemaInventory,
  writeEffectSchemaInventoryFixture,
} from "@beep/repo-cli/commands/Lint";
import { Sha256Hex } from "@beep/schema/Sha256";
import { A, Str } from "@beep/utils";
import { NodeServices } from "@effect/platform-node";
import { it, vi } from "@effect/vitest";
import { assertFalse, assertInclude, assertNone, assertTrue, deepStrictEqual, strictEqual } from "@effect/vitest/utils";
import { Clock, Config, Effect, Fiber, FileSystem, HashMap, Layer, Order, Path, PlatformError, Ref } from "effect";
import * as Bool from "effect/Boolean";
import { Command } from "effect/cli";
import * as O from "effect/Option";
import { ChildProcess, ChildProcessSpawner } from "effect/process";
import * as TestClock from "effect/testing/TestClock";
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

const demoGraft = EffectSchemaInventoryGraftContext.make({
  head: PIN,
  workingTreeMatchesPin: true,
  entries: [
    EffectSchemaInventoryGraftEntry.make({
      name: "a",
      kind: "function",
      span: "L13-L17",
      signature: O.none(),
      summary: O.some("Formats | values."),
    }),
  ],
});

const emptyReceipt = EffectSchemaInventoryReceipt.make({
  pin: PIN,
  parser: "6.0.2",
  digest: Sha256Hex.make("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"),
  modules: 0,
  rows: 0,
  bytes: 0,
  internalRows: 0,
  deprecatedRows: 0,
  bareStarDeclarationsOmitted: 0,
});

const renderedFiles = (files: ReadonlyArray<readonly [string, string]>) =>
  EffectSchemaInventoryRendered.make({
    receipt: emptyReceipt,
    files: A.map(files, ([name, content]) => EffectSchemaInventoryFile.make({ name, content })),
  });

// Only `effect/Schema` has content, so a generation has rows without a real reference clone.
const fakePinnedText = (file: string): string =>
  file === "packages/effect/src/Schema.ts" ? "export const a = 1\n" : "";

const fakeSource = (
  overrides: Partial<EffectSchemaInventorySourceShape>,
  reads: Ref.Ref<number>,
  pinnedText: (file: string) => string = fakePinnedText
): EffectSchemaInventorySourceShape => ({
  readPin: Effect.succeed(PIN),
  verifyPin: Effect.fn("EffectSchemaInventoryTest.verifyPin")(() => Effect.void),
  readPinned: Effect.fn("EffectSchemaInventoryTest.readPinned")((_pin, file) =>
    Ref.update(reads, (count) => count + 1).pipe(Effect.as(pinnedText(file)))
  ),
  graftContext: Effect.fn("EffectSchemaInventoryTest.graftContext")(() => Effect.succeed(demoGraft)),
  ...overrides,
});

const branchModule = EffectSchemaInventoryModule.make({
  file: "packages/effect/src/Branches.ts",
  module: "effect/Branches",
  slug: "effect-Branches",
  importable: true,
});

const branchSource = `export const typed: number = 1
export const arrow = (x: number): number => x
export const fn = function named(x: string) { return x }
export const plain = 1
export class K {
  static readonly s = 1
  get g(): string { return "" }
  set g(value: string) {}
  m(): void {}
  [key: string]: unknown
}
export type Callable = { (x: number): string; (x: string): string; readonly p: number }
export enum E { A, B }
const hidden = 2
export { hidden as renamed }
export interface WithIndex { [key: string]: number; new (x: number): WithIndex }
const shown = 3
export { shown }
export interface Dup { readonly a: number } export declare namespace Dup { export type T = string }
`;

const provenanceBranchModule = EffectSchemaInventoryModule.make({
  file: "packages/effect/src/internal/Branches.ts",
  module: "effect/internal/Branches",
  slug: "effect-internal-Branches",
  importable: false,
});

const promptBranchSource = `/**
 * Old formatter.
 *
 * @deprecated use a
 */
export function old(x: string): string
export function old(x: unknown): string {
  return ""
}
const shared = 1
export {
  /** Shared value. */
  shared,
  /** Same value, second name. */
  shared as sharedAlias
}
`;

const enableModule = O.getOrThrow(findEffectSchemaInventoryModule("effect/schema/SchemaJITCompiler/enable"));

const localGroupsSource = `/** Formats a value. */
function f(x: string): string
function f(x: number): string
function f(x: unknown): string {
  return \`\${x}\`
}
/** Shape of X. */
type X = { readonly n: number }
/** Value of X. */
const X = { n: 1 }
export {
  /** Exported formatter. */
  f,
  /** Exported X. */
  X
}
`;

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
      // Every module file plus INDEX.md; no prompt directory exists, so no prompt drift.
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
      const graft = yield* Effect.flip(live.graftContext(ABSENT_PIN, "packages/effect/src/Nope.ts"));
      strictEqual(graft._tag, "EffectSchemaInventoryGraftUnavailableError");
      assertFalse(Str.includes(linked)(graft.message), "graft failures never carry the checkout path");
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
        graft: demoGraft,
      });
      assertInclude(prompt, "export function a(x: unknown): string {\n  return `${x}`\n}");
      assertInclude(prompt, "**Example** (Format)");
      assertInclude(prompt, "````ts\n/**\n * Formats a value.");
      assertInclude(prompt, "const local = 1");
      assertInclude(prompt, "hashes to the same blob as the pin, so the spans line up with the inlined source");
      assertInclude(prompt, "| L13-L17 | function | `a` | Formats \\| values. |");
      const drifting = yield* renderEffectSchemaInventoryPrompt({
        module: demoModule,
        pin: PIN,
        rows,
        source: demoSource,
        graft: EffectSchemaInventoryGraftContext.make({ ...demoGraft, workingTreeMatchesPin: false }),
      });
      assertInclude(drifting, "working-tree context whose spans and summaries may drift");
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
            graft: demoGraft,
          })
        );
      const unresolved = yield* render([makeRow({ line: 999, symbol: "ghost", hasExample: false })]);
      assertInclude(unresolved.message, "ghost@999");
      const noExample = yield* render([makeRow({ line: 28, symbol: "C", hasExample: true })]);
      assertInclude(noExample.message, "hasExample");
    })
  );
  it.effect(
    "extracts signatures, kinds, and overload counts for every declaration shape",
    Effect.fnUntraced(function* () {
      const extraction = yield* extractEffectSchemaInventory(PIN, [[branchModule, branchSource]]);
      const rows = O.getOrThrow(A.head(extraction.modules)).rows;
      const row = (symbol: string, kind: string) => O.getOrThrow(rowOf(rows, symbol, kind));
      strictEqual(row("typed", "const").signature, "const typed: number");
      strictEqual(row("arrow", "const").signature, "const arrow = (x: number): number =>");
      strictEqual(row("fn", "const").signature, "const fn = function named(x: string)");
      strictEqual(row("plain", "const").signature, "const plain: <inferred; see source>");
      strictEqual(row("K", "class").signature, "export class K");
      strictEqual(row("K.s", "property").signature, "static readonly s = 1");
      strictEqual(row("K.g", "accessor").signature, "get g(): string");
      strictEqual(row("K.m", "method").signature, "m(): void");
      strictEqual(row("K.m", "method").overloads, 0);
      strictEqual(row("K.<index>", "property").signature, "[key: string]: unknown");
      strictEqual(row("Callable", "type").overloads, 2);
      strictEqual(row("Callable.<call>", "call").overloads, 2);
      strictEqual(row("Callable.p", "property").signature, "readonly p: number");
      strictEqual(row("E", "property").signature, "export enum E { A, B }");
      strictEqual(row("E.B", "property").signature, "B");
      strictEqual(row("renamed", "const").signature, "const hidden: <inferred; see source>");
      strictEqual(row("renamed", "const").line, 14);
      strictEqual(row("WithIndex.<new>", "constructor").overloads, 1);
      strictEqual(row("WithIndex.<index>", "property").signature, "[key: string]: number;");
      strictEqual(row("shown", "const").signature, "const shown: <inferred; see source>");
      strictEqual(row("Dup", "interface").line, row("Dup", "namespace").line);
      strictEqual(row("Dup.T", "type").signature, "export type T = string");
      strictEqual(rows.length, 24);
    })
  );

  it.effect(
    "refuses to generate an inventory with zero rows",
    Effect.fnUntraced(function* () {
      const reads = yield* Ref.make(0);
      const failure = yield* Effect.flip(
        generateEffectSchemaInventory().pipe(
          Effect.provideService(
            EffectSchemaInventorySource,
            fakeSource({}, reads, () => "")
          )
        )
      );
      strictEqual(failure._tag, "EffectSchemaInventoryError");
      assertInclude(failure.message, "0 rows");
    })
  );

  it.effect(
    "swaps a staged fixture into place, keeping hand-maintained and foreign files",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "effect-schema-inventory-write-" });
      const directory = path.join(root, EffectSchemaInventoryFixturePath);
      const parent = path.dirname(directory);
      const listing = (target: string) => Effect.map(fs.readDirectory(target), A.sort(Order.String));
      const leftovers = Effect.map(fs.readDirectory(parent), A.filter(Str.startsWith(".inventory-")));
      yield* fs.makeDirectory(directory, { recursive: true });
      yield* fs.writeFileString(path.join(directory, "README.md"), "contract\n");
      const ownedLine = yield* encodeEffectSchemaInventoryRowJson(
        makeRow({ line: 1, symbol: "old", hasExample: false })
      );
      yield* fs.writeFileString(path.join(directory, "effect-Old.jsonl"), `${ownedLine}\n`);
      yield* fs.writeFileString(path.join(directory, "notes.jsonl"), "{}\n");

      yield* writeEffectSchemaInventoryFixture(
        root,
        renderedFiles([
          ["effect-Demo.jsonl", "x\n"],
          ["INDEX.md", "# index\n"],
        ])
      );
      deepStrictEqual(yield* listing(directory), ["INDEX.md", "README.md", "effect-Demo.jsonl", "notes.jsonl"]);
      strictEqual(yield* fs.readFileString(path.join(directory, "README.md")), "contract\n");
      deepStrictEqual(yield* leftovers, []);

      // ".." resolves to the staging parent, so the second write fails before the swap.
      const failure = yield* Effect.flip(
        writeEffectSchemaInventoryFixture(
          root,
          renderedFiles([
            ["effect-Demo.jsonl", "y\n"],
            ["..", "z"],
          ])
        )
      );
      strictEqual(failure._tag, "EffectSchemaInventoryError");
      strictEqual(yield* fs.readFileString(path.join(directory, "effect-Demo.jsonl")), "x\n");
      deepStrictEqual(yield* leftovers, []);
    })
  );

  it.effect(
    "restores the previous fixture when the staged one cannot take its place",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "effect-schema-inventory-swap-" });
      const directory = path.join(root, EffectSchemaInventoryFixturePath);
      const parent = path.dirname(directory);
      // Only the staged directory's move into place fails; moving the previous copy back succeeds.
      const refused = PlatformError.systemError({
        _tag: "PermissionDenied",
        module: "FileSystem",
        method: "rename",
        pathOrDescriptor: directory,
      });
      const write = Effect.flip(writeEffectSchemaInventoryFixture(root, renderedFiles([["INDEX.md", "# new\n"]]))).pipe(
        Effect.provideService(FileSystem.FileSystem, {
          ...fs,
          rename: (from, to) =>
            to === directory && !Str.endsWith("-previous")(from) ? Effect.fail(refused) : fs.rename(from, to),
        })
      );

      assertInclude((yield* write).message, "Unable to move the staged fixture into");
      deepStrictEqual(yield* fs.readDirectory(parent), []);

      yield* fs.makeDirectory(directory);
      yield* fs.writeFileString(path.join(directory, "INDEX.md"), "# old\n");
      assertInclude((yield* write).message, "Unable to move the staged fixture into");
      deepStrictEqual(yield* fs.readDirectory(parent), [path.basename(directory)]);
      deepStrictEqual(yield* fs.readDirectory(directory), ["INDEX.md"]);
      strictEqual(yield* fs.readFileString(path.join(directory, "INDEX.md")), "# old\n");
    })
  );

  it.effect(
    "fails instead of reading an unlistable fixture directory as empty",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "effect-schema-inventory-unlistable-" });
      const directory = path.join(root, EffectSchemaInventoryFixturePath);
      yield* fs.makeDirectory(path.dirname(directory), { recursive: true });
      yield* fs.writeFileString(directory, "not a directory\n");
      const read = yield* Effect.flip(readEffectSchemaInventoryFixture(root));
      assertInclude(read.message, "Unable to list");
      const write = yield* Effect.flip(
        writeEffectSchemaInventoryFixture(root, renderedFiles([["INDEX.md", "# index\n"]]))
      );
      assertInclude(write.message, "Unable to list");
      strictEqual(yield* fs.readFileString(directory), "not a directory\n");
    })
  );

  it.effect(
    "verifies committed prompts outside their graft section and ignores hand-written files",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const extraction = yield* extractDemo;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "effect-schema-inventory-prompts-" });
      const directory = path.join(root, EffectSchemaInventoryPromptRoot);
      const file = path.join(directory, "effect-Demo.md");
      const rows = O.getOrThrow(A.head(extraction.modules)).rows;
      const prompt = yield* renderEffectSchemaInventoryPrompt({
        module: demoModule,
        pin: PIN,
        rows,
        source: demoSource,
        graft: demoGraft,
      });
      const check = checkEffectSchemaInventoryPrompts(root, PIN, extraction.modules, [
        [demoModule, demoSource],
        [otherModule, "export const other = 1\n"],
      ]);
      deepStrictEqual(yield* check, []);
      yield* fs.makeDirectory(directory, { recursive: true });
      yield* fs.writeFileString(path.join(directory, "notes.md"), "hand-written\n");
      yield* fs.writeFileString(file, prompt);
      deepStrictEqual(yield* check, []);
      yield* fs.writeFileString(file, Str.replace("Formats \\| values.", "Graft wording moved.")(prompt));
      deepStrictEqual(yield* check, []);
      yield* fs.writeFileString(file, Str.replace("return `${x}`", "return x")(prompt));
      const drift = yield* check;
      strictEqual(drift.length, 1);
      const stale = O.getOrThrow(A.head(drift));
      assertTrue(stale._tag === "stale");
      strictEqual(stale.file, `${EffectSchemaInventoryPromptRoot}/effect-Demo.md`);
    })
  );
  it.effect(
    "rejects a module list that names one file twice",
    Effect.fnUntraced(function* () {
      const failure = yield* Effect.flip(
        extractEffectSchemaInventory(PIN, [
          [demoModule, demoSource],
          [demoModule, demoSource],
        ])
      );
      assertInclude(failure.message, "Duplicate file");
    })
  );

  it("looks modules up by import path", () => {
    strictEqual(enableModule.slug, "effect-schema-SchemaJITCompiler-enable");
    assertNone(findEffectSchemaInventoryModule("effect/Nope"));
  });

  it.effect(
    "renders deprecated, overloaded, and provenance-only rows and shared export locals once",
    Effect.fnUntraced(function* () {
      const extraction = yield* extractEffectSchemaInventory(PIN, [[provenanceBranchModule, promptBranchSource]]);
      const rows = O.getOrThrow(A.head(extraction.modules)).rows;
      const graft = EffectSchemaInventoryGraftContext.make({
        head: PIN,
        workingTreeMatchesPin: true,
        entries: [
          EffectSchemaInventoryGraftEntry.make({
            name: "old",
            kind: "function",
            span: "L6-L10",
            signature: O.none(),
            summary: O.none(),
          }),
        ],
      });
      const prompt = yield* renderEffectSchemaInventoryPrompt({
        module: provenanceBranchModule,
        pin: PIN,
        rows,
        source: promptBranchSource,
        graft,
      });
      assertInclude(prompt, "provenance only: Effect's exports map nulls this path");
      assertInclude(prompt, "1 overload signature, deprecated, not importable");
      assertInclude(prompt, "| L6-L10 | function | `old` |  |");
      assertInclude(prompt, 'export function old(x: unknown): string {\n  return ""\n}');
      strictEqual(A.length(Str.split(prompt, "const shared = 1")) - 1, 1);
      const foreign = yield* Effect.flip(
        renderEffectSchemaInventoryPrompt({
          module: provenanceBranchModule,
          pin: ABSENT_PIN,
          rows,
          source: promptBranchSource,
          graft,
        })
      );
      assertInclude(foreign.message, "must all read");
    })
  );

  it.effect(
    "reports a prompt without a graft section and fails when a prompt's module source is missing",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const extraction = yield* extractDemo;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "effect-schema-inventory-prompt-edges-" });
      const directory = path.join(root, EffectSchemaInventoryPromptRoot);
      yield* fs.makeDirectory(directory, { recursive: true });
      yield* fs.writeFileString(path.join(directory, "effect-Demo.md"), "# Lane prompt without sections\n");
      const drift = yield* checkEffectSchemaInventoryPrompts(root, PIN, extraction.modules, [[demoModule, demoSource]]);
      deepStrictEqual(
        A.map(drift, (entry) => entry._tag),
        ["stale"]
      );
      const missing = yield* Effect.flip(checkEffectSchemaInventoryPrompts(root, PIN, extraction.modules, []));
      assertInclude(missing.message, "No pinned source was read for effect/Demo");
    })
  );

  it.effect(
    "generates a prompt through the source service and refuses unsafe or stale inputs",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const reads = yield* Ref.make(0);
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "effect-schema-inventory-generate-" });
      const fixture = path.join(root, EffectSchemaInventoryFixturePath);
      yield* fs.makeDirectory(fixture, { recursive: true });
      yield* fs.writeFileString(path.join(fixture, "effect-schema-SchemaJITCompiler-enable.jsonl"), "");
      const staleLine = yield* encodeEffectSchemaInventoryRowJson(
        EffectSchemaInventoryRow.make({
          ...makeRow({ line: 1, symbol: "isIssue", hasExample: false }),
          sha: ABSENT_PIN,
          module: "effect/SchemaIssue",
          file: "packages/effect/src/SchemaIssue.ts",
        })
      );
      yield* fs.writeFileString(path.join(fixture, "effect-SchemaIssue.jsonl"), `${staleLine}\n`);
      const generate = (module: string, out: O.Option<string>) =>
        generateEffectSchemaInventoryPrompt(root, module, out).pipe(
          Effect.provideService(EffectSchemaInventorySource, fakeSource({}, reads))
        );

      const relative = yield* generate("effect/schema/SchemaJITCompiler/enable", O.some("prompts/enable.md"));
      strictEqual(relative.target, "prompts/enable.md");
      strictEqual(relative.rows, 0);
      assertInclude(
        yield* fs.readFileString(path.join(root, "prompts/enable.md")),
        "| Declarations | 0 top-level declarations"
      );
      const defaulted = yield* generate("effect/schema/SchemaJITCompiler/enable", O.none());
      strictEqual(defaulted.target, `${EffectSchemaInventoryPromptRoot}/effect-schema-SchemaJITCompiler-enable.md`);
      const outside = yield* fs.makeTempDirectoryScoped({ prefix: "effect-schema-inventory-outside-" });
      const absolute = yield* generate("effect/schema/SchemaJITCompiler/enable", O.some(path.join(outside, "p.md")));
      strictEqual(absolute.target, path.join(outside, "p.md"));

      assertInclude((yield* Effect.flip(generate("effect/Nope", O.none()))).message, "Unknown inventory module");
      assertInclude(
        (yield* Effect.flip(generate("effect/schema/SchemaJITCompiler/enable", O.some("../escape.md")))).message,
        "resolves outside the repository root"
      );
      assertInclude((yield* Effect.flip(generate("effect/SchemaIssue", O.none()))).message, "is not at inventoryPin");
      assertInclude(
        (yield* Effect.flip(generate("effect/schema/SchemaJITCompiler/enable", O.some(outside)))).message,
        "Unable to write"
      );
    })
  );

  it.effect(
    "runs the command handler for --check and --prompt through the flag parser",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const reads = yield* Ref.make(0);
      const run = Command.runWith(
        makeEffectSchemaInventoryCommandForTesting(Layer.succeed(EffectSchemaInventorySource, fakeSource({}, reads))),
        { version: "0.0.0" }
      );
      // The fake sources cannot reproduce the committed fixture, so --check reports drift without writing.
      const check = yield* Effect.flip(run(["--check"]));
      assertTrue(check._tag === "EffectSchemaInventoryDriftError");
      assertTrue(A.some(check.drift, (entry) => entry.file === "INDEX.md"));
      const out = path.join(yield* fs.makeTempDirectoryScoped({ prefix: "effect-schema-inventory-command-" }), "p.md");
      yield* run(["--prompt", "effect/schema/SchemaJITCompiler/enable", "--out", out]);
      assertInclude(yield* fs.readFileString(out), "# Lane prompt: `effect/schema/SchemaJITCompiler/enable`");
      const conflict = yield* Effect.flip(run(["--write", "--check"]));
      assertTrue(conflict._tag === "EffectSchemaInventoryError");
    })
  );
  it.effect(
    "inlines every declaration an export list names: all overloads and both sides of a type/value pair",
    Effect.fnUntraced(function* () {
      const extraction = yield* extractEffectSchemaInventory(PIN, [[demoModule, localGroupsSource]]);
      const rows = O.getOrThrow(A.head(extraction.modules)).rows;
      const prompt = yield* renderEffectSchemaInventoryPrompt({
        module: demoModule,
        pin: PIN,
        rows,
        source: localGroupsSource,
        graft: demoGraft,
      });
      assertInclude(
        prompt,
        "/** Formats a value. */\nfunction f(x: string): string\nfunction f(x: number): string\nfunction f(x: unknown): string {"
      );
      assertInclude(prompt, "/** Shape of X. */\ntype X = { readonly n: number }");
      assertInclude(prompt, "/** Value of X. */\nconst X = { n: 1 }");
      assertInclude(prompt, "/** Exported formatter. */");
      strictEqual(A.length(Str.split(prompt, "function f(x: string): string")) - 1, 1);
    })
  );
  it.effect(
    "writes a fixture, checks it clean, and writes a prompt through the run orchestration",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "effect-schema-inventory-run-" });
      const reads = yield* Ref.make(0);
      const driftingGraft = EffectSchemaInventoryGraftContext.make({ ...demoGraft, workingTreeMatchesPin: false });
      const run = (request: EffectSchemaInventoryRequest) =>
        runEffectSchemaInventory(root, request).pipe(
          Effect.provideService(
            EffectSchemaInventorySource,
            fakeSource(
              {
                graftContext: Effect.fn("EffectSchemaInventoryTest.driftingGraft")(() => Effect.succeed(driftingGraft)),
              },
              reads
            )
          )
        );
      yield* run(EffectSchemaInventoryRequest.cases.write.make({}));
      const directory = path.join(root, EffectSchemaInventoryFixturePath);
      strictEqual((yield* fs.readDirectory(directory)).length, EffectSchemaInventoryModules.length + 1);
      yield* run(EffectSchemaInventoryRequest.cases.check.make({}));
      yield* run(
        EffectSchemaInventoryRequest.cases.prompt.make({
          module: "effect/schema/SchemaJITCompiler/enable",
          out: O.some("prompts/enable.md"),
        })
      );
      assertInclude(yield* fs.readFileString(path.join(root, "prompts/enable.md")), "may drift");
    })
  );

  it("reports a stale line by its first differing column and past the end of a shorter file", () => {
    const [prefix] = diffEffectSchemaInventoryFiles(
      [EffectSchemaInventoryFile.make({ name: "a.jsonl", content: "abc\n" })],
      HashMap.make(["a.jsonl", "abcd\n"])
    );
    assertTrue(prefix?._tag === "stale");
    strictEqual(prefix.column, 4);
    const [longer] = diffEffectSchemaInventoryFiles(
      [EffectSchemaInventoryFile.make({ name: "a.jsonl", content: "a" })],
      HashMap.make(["a.jsonl", "a\nb"])
    );
    assertTrue(longer?._tag === "stale");
    strictEqual(longer.line, 2);
    strictEqual(longer.expected, "<end of file>");
    strictEqual(longer.actual, "b");
    strictEqual(
      formatEffectSchemaInventoryDrift(longer),
      "stale      a.jsonl:2:1\n  expected: <end of file>\n  actual:   b"
    );
    strictEqual(
      formatEffectSchemaInventoryDrift(EffectSchemaInventoryDrift.cases.unexpected.make({ file: "x.jsonl" })),
      "unexpected x.jsonl"
    );
    strictEqual(
      formatEffectSchemaInventoryDrift(EffectSchemaInventoryDrift.cases.missing.make({ file: "INDEX.md" })),
      "missing    INDEX.md"
    );
  });

  it.effect(
    "live source reads pinned bytes, refuses a non-git reference, and reports every graft failure",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
      const head = Str.trim(
        yield* spawner.string(ChildProcess.make("git", ["rev-parse", "HEAD"], { cwd: repositoryRoot }))
      );

      const unreadable = yield* fs.makeTempDirectoryScoped({ prefix: "effect-schema-inventory-unreadable-" });
      const noManifest = yield* Effect.flip((yield* EffectSchemaInventorySource.make(unreadable)).readPin);
      strictEqual(noManifest.specifier, "<unreadable>");

      const plain = yield* fs.makeTempDirectoryScoped({ prefix: "effect-schema-inventory-plain-" });
      yield* fs.makeDirectory(path.join(plain, ".repos", "effect"), { recursive: true });
      const notGit = yield* Effect.flip((yield* EffectSchemaInventorySource.make(plain)).verifyPin(PIN));
      assertInclude(notGit.message, "is not a git checkout");

      const linked = yield* fs.makeTempDirectoryScoped({ prefix: "effect-schema-inventory-live-" });
      yield* fs.makeDirectory(path.join(linked, ".repos"));
      yield* fs.symlink(repositoryRoot, path.join(linked, ".repos", "effect"));
      assertTrue(Layer.isLayer(EffectSchemaInventorySource.layer(linked)));
      const live = yield* EffectSchemaInventorySource.make(linked);
      yield* live.verifyPin(head);
      assertInclude(yield* live.readPinned(head, "package.json"), '"name": "@beep/root"');
      assertInclude(
        (yield* Effect.flip(live.readPinned(head, "missing-file.txt"))).message,
        "Unable to read missing-file.txt"
      );

      // A fake `graft` first on PATH makes every graft outcome deterministic, locally and hosted.
      const bin = yield* fs.makeTempDirectoryScoped({ prefix: "effect-schema-inventory-bin-" });
      const graft = path.join(bin, "graft");
      const ambientPath = yield* Config.String("PATH");
      const withPath = <A, E, R>(pathValue: string, effect: Effect.Effect<A, E, R>) =>
        Effect.acquireUseRelease(
          Effect.sync(() => vi.stubEnv("PATH", pathValue)),
          () => effect,
          () => Effect.sync(() => vi.unstubAllEnvs())
        );
      const withGraft = Effect.fnUntraced(function* (script: string) {
        yield* fs.writeFileString(graft, script);
        yield* fs.chmod(graft, 0o755);
        return yield* withPath(`${bin}:${ambientPath}`, Effect.result(live.graftContext(head, "package.json")));
      });
      const decoded = yield* withGraft(
        '#!/bin/sh\nprintf \'{"file":"%s","entries":[{"name":"x","kind":"const","span":"L1-L1"}]}\' "$4"\n'
      );
      assertTrue(decoded._tag === "Success");
      strictEqual(decoded.success.entries.length, 1);
      strictEqual(decoded.success.head, head);
      const exited = yield* withGraft("#!/bin/sh\necho boom >&2\nexit 3\n");
      assertTrue(exited._tag === "Failure");
      assertInclude(exited.failure.message, "exit 3: boom");
      const garbled = yield* withGraft("#!/bin/sh\necho nope\n");
      assertTrue(garbled._tag === "Failure");
      assertInclude(garbled.failure.message, "output did not decode");
      // A private TestClock passes the graft timeout only once the fake has started, so the timeout
      // arm ends the run (and kills the child) without moving the block's shared clock.
      const started = path.join(bin, "started");
      const clock = yield* TestClock.make();
      const pending = yield* Effect.forkChild(
        withGraft(`#!/bin/sh\n: > '${started}'\nexec sleep 30\n`).pipe(Effect.provideService(Clock.Clock, clock))
      );
      yield* Effect.repeat(fs.exists(started), { while: Bool.not });
      yield* clock.adjust("60 seconds");
      const timedOut = yield* Fiber.join(pending);
      assertTrue(timedOut._tag === "Failure");
      assertInclude(timedOut.failure.message, "timed out after");
      // Only git's own directory on PATH: git answers, and no `graft` can be found.
      const gitDirectory = path.dirname(
        Str.trim(yield* spawner.string(ChildProcess.make("sh", ["-c", "command -v git"], { cwd: repositoryRoot })))
      );
      const unrunnable = yield* withPath(gitDirectory, Effect.result(live.graftContext(head, "package.json")));
      assertTrue(unrunnable._tag === "Failure");
      assertInclude(unrunnable.failure.message, "could not run");
      const noGit = yield* withPath(bin, Effect.flip(live.graftContext(head, "package.json")));
      assertInclude(noGit.message, "git rev-parse");
    })
  );

  it.effect(
    "live source reads an unstatable reference as missing and refuses a HEAD that is not a SHA-1 id",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "effect-schema-inventory-reference-" });
      const reference = path.join(root, ".repos", "effect");
      yield* fs.makeDirectory(reference, { recursive: true });

      const denied = PlatformError.systemError({
        _tag: "PermissionDenied",
        module: "FileSystem",
        method: "exists",
        pathOrDescriptor: reference,
      });
      const unstatable = yield* EffectSchemaInventorySource.make(root).pipe(
        Effect.provideService(FileSystem.FileSystem, { ...fs, exists: () => Effect.fail(denied) })
      );
      const missing = yield* Effect.flip(unstatable.verifyPin(PIN));
      strictEqual(missing._tag, "EffectSchemaInventoryReferenceMissingError");
      assertInclude(missing.message, "is missing");

      // A SHA-256 repository names HEAD with 64 hex digits, which the pin schema rejects.
      const git = (args: ReadonlyArray<string>) => spawner.string(ChildProcess.make("git", args, { cwd: reference }));
      yield* git(["init", "-q", "--object-format=sha256"]);
      yield* git([
        "-c",
        "user.name=inventory",
        "-c",
        "user.email=inventory@example.invalid",
        "-c",
        "commit.gpgsign=false",
        "-c",
        "core.hooksPath=/dev/null",
        "commit",
        "-q",
        "--no-verify",
        "--allow-empty",
        "-m",
        "init",
      ]);
      const live = yield* EffectSchemaInventorySource.make(root);
      const failure = yield* Effect.flip(live.graftContext(PIN, "package.json"));
      assertTrue(Str.startsWith("git rev-parse HEAD: ")(failure.message));
    })
  );
});
