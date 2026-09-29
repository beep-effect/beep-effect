import {
  literalKitFacetsRule,
  planSchemaParityCodemodFile,
  renderSchemaParityCodemodEdits,
  runSchemaParityCodemod,
  SchemaParityCodemodEdit,
  SchemaParityCodemodFileOutcome,
  SchemaParityCodemodOptions,
  SchemaParityCodemodRule,
  SchemaParityCodemodRuleContext,
  SchemaParityCodemodRulePlan,
} from "@beep/repo-cli/test/Lint";
import { FsUtilsLive } from "@beep/repo-utils/FsUtils";
import { A } from "@beep/utils";
import { NodeServices } from "@effect/platform-node";
import { assert, describe, it, layer } from "@effect/vitest";
import { Effect, FileSystem, Layer, Path } from "effect";
import * as TestConsole from "effect/testing/TestConsole";
import { Project, ts } from "ts-morph";

const KIT_MODULE = "packages/foundation/modeling/schema/src/LiteralKit/LiteralKit.schema.ts";
const STATICS_MODULE = "packages/foundation/modeling/schema/src/SchemaUtils/withLiteralKitStatics.ts";
const FIXTURE_MODULE = "packages/example/src/fixture.ts";
const KIT_IMPORT = '"../../foundation/modeling/schema/src/LiteralKit/LiteralKit.schema.ts"';
const STATICS_IMPORT = '"../../foundation/modeling/schema/src/SchemaUtils/withLiteralKitStatics.ts"';

// A pre-trim LiteralKit surface at the owner module path: the rule resolves
// facets by declaration module, so the stub stands in for the real kit.
const KIT_STUB = `type LiteralValue = string | number | boolean;
export type Literals = readonly [LiteralValue, ...Array<LiteralValue>];
type LiteralToKey<L extends LiteralValue> = L extends boolean
  ? L extends true ? "true" : "false"
  : L extends number ? \`number\${L}\` : L & string;
export interface HashSet<A> { readonly value: A }
export interface LiteralKit<L extends Literals> {
  readonly literals: L;
  readonly Options: L;
  readonly HashSet: HashSet<L[number]>;
  readonly Enum: { readonly [K in L[number] as LiteralToKey<K>]: K };
  readonly thunk: { readonly [K in L[number] as LiteralToKey<K>]: () => K };
  pick<const L2 extends ReadonlyArray<L[number]>>(literals: L2): { readonly literals: L2 };
  pickOptions<S extends readonly [L[number], ...Array<L[number]>]>(subset: S): S;
  omitOptions<S extends readonly [L[number], ...Array<L[number]>]>(
    subset: S
  ): readonly [Exclude<L[number], S[number]>, ...Array<Exclude<L[number], S[number]>>];
}
export declare function LiteralKit<const L extends Literals>(literals: L): LiteralKit<L>;
export declare function brand<S extends object>(schema: S): { readonly branded: S };
`;

const STATICS_STUB = `import type { LiteralKit, Literals } from "../LiteralKit/LiteralKit.schema.ts";
export declare function withLiteralKitStatics<const L extends Literals>(
  kit: LiteralKit<L>
): <S extends object>(schema: S) => S & Pick<LiteralKit<L>, "Options" | "HashSet" | "Enum" | "thunk" | "pickOptions">;
`;

const compilerOptions = {
  strict: true,
  target: ts.ScriptTarget.ES2022,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  allowImportingTsExtensions: true,
  noEmit: true,
};

const makeProject = (extraFiles: ReadonlyArray<readonly [string, string]> = []): Project => {
  const project = new Project({ useInMemoryFileSystem: true, compilerOptions });
  project.createSourceFile(`/repo/${KIT_MODULE}`, KIT_STUB);
  project.createSourceFile(`/repo/${STATICS_MODULE}`, STATICS_STUB);
  A.forEach(extraFiles, ([filePath, text]) => void project.createSourceFile(`/repo/${filePath}`, text));
  return project;
};

const planFixture = (
  text: string,
  extraFiles: ReadonlyArray<readonly [string, string]> = [],
  rules: ReadonlyArray<SchemaParityCodemodRule> = [literalKitFacetsRule]
): SchemaParityCodemodFileOutcome => {
  const project = makeProject(extraFiles);
  const sourceFile = project.createSourceFile(`/repo/${FIXTURE_MODULE}`, text);
  return planSchemaParityCodemodFile(sourceFile, rules, FIXTURE_MODULE);
};

const plannedText = (outcome: SchemaParityCodemodFileOutcome): string => {
  assert.strictEqual(outcome._tag, "Planned");
  return SchemaParityCodemodFileOutcome.guards.Planned(outcome) ? outcome.nextText : "";
};

const kitImport = `import { LiteralKit } from ${KIT_IMPORT};\n`;
const statusDeclaration = 'export const Status = LiteralKit(["draft", "live", "gone"]);\n';
const kitHeader = `${kitImport}${statusDeclaration}`;

describe("schema-parity codemod edits", () => {
  it("renders insertions and replacements in plan order", () => {
    const text = "Status.HashSet";
    const rendered = renderSchemaParityCodemodEdits(text, 0, text.length, [
      SchemaParityCodemodEdit.make({ start: 0, end: 0, text: "HashSet.fromIterable(" }),
      SchemaParityCodemodEdit.make({ start: 7, end: 14, text: "literals" }),
      SchemaParityCodemodEdit.make({ start: 14, end: 14, text: ")" }),
    ]);
    assert.strictEqual(rendered, "HashSet.fromIterable(Status.literals)");
  });
});

describe("literal-kit-facets rule", () => {
  it("rewrites Options to the upstream literals member", () => {
    const outcome = planFixture(`${kitHeader}export const all = Status.Options;\n`);
    assert.strictEqual(plannedText(outcome), `${kitHeader}export const all = Status.literals;\n`);
  });

  it("rewrites pickOptions to pick(...).literals", () => {
    const outcome = planFixture(`${kitHeader}export const open = Status.pickOptions(["draft", "live"]);\n`);
    assert.strictEqual(
      plannedText(outcome),
      `${kitHeader}export const open = Status.pick(["draft", "live"]).literals;\n`
    );
  });

  it("rewrites omitOptions to an ordered pick of the complement", () => {
    const outcome = planFixture(`${kitHeader}export const closed = Status.omitOptions(["live"]);\n`);
    assert.strictEqual(
      plannedText(outcome),
      `${kitHeader}export const closed = Status.pick(["draft", "gone"]).literals;\n`
    );
  });

  it("lets an omitOptions complement consume the sites inside its argument", () => {
    const header = `${kitHeader}const Closed = LiteralKit(["gone"]);\n`;
    const outcome = planFixture(`${header}export const open = Status.omitOptions(Closed.Options);\n`);
    assert.strictEqual(plannedText(outcome), `${header}export const open = Status.pick(["draft", "live"]).literals;\n`);
  });

  it("rewrites HashSet to a call-site HashSet.fromIterable and adds a namespace import", () => {
    const outcome = planFixture(`${kitHeader}export const set = Status.HashSet;\n`);
    assert.strictEqual(
      plannedText(outcome),
      `${kitImport}import * as HashSet from "effect/HashSet";\n\n${statusDeclaration}export const set = HashSet.fromIterable(Status.literals);\n`
    );
  });

  it("adds HashSet to an existing named effect import", () => {
    const header = `import { Effect } from "effect";\n${kitHeader}`;
    const outcome = planFixture(`${header}export const set = [Effect, Status.HashSet];\n`);
    assert.strictEqual(
      plannedText(outcome),
      `import { Effect, HashSet } from "effect";\n${kitHeader}export const set = [Effect, HashSet.fromIterable(Status.literals)];\n`
    );
  });

  it("rewrites thunk members to F.constant over Enum and invoked thunks to Enum", () => {
    const outcome = planFixture(
      `${kitHeader}export const a = Status.thunk.draft;\nexport const b = Status.thunk["live"];\nexport const c = Status.thunk.gone();\n`
    );
    assert.strictEqual(
      plannedText(outcome),
      `${kitImport}import * as F from "effect/Function";\n\n${statusDeclaration}export const a = F.constant(Status.Enum.draft);\nexport const b = F.constant(Status.Enum["live"]);\nexport const c = Status.Enum.gone;\n`
    );
  });

  it("reuses an existing effect/Function named import for constant", () => {
    const header = `import { dual } from "effect/Function";\n${kitHeader}`;
    const outcome = planFixture(`${header}export const a = [dual, Status.thunk.draft];\n`);
    assert.strictEqual(
      plannedText(outcome),
      `import { dual, constant } from "effect/Function";\n${kitHeader}export const a = [dual, constant(Status.Enum.draft)];\n`
    );
  });

  it("reads decorated schemas through their same-module base kit", () => {
    const text = `import { brand, LiteralKit } from ${KIT_IMPORT};
import { withLiteralKitStatics } from ${STATICS_IMPORT};
const StatusBase = LiteralKit(["draft", "live"]);
export const Status = withLiteralKitStatics(StatusBase)(brand(StatusBase));
export const all = Status.Options;
export const draft = Status.thunk.draft;
`;
    const outcome = planFixture(text);
    const next = plannedText(outcome);
    assert.include(next, "export const all = StatusBase.literals;");
    assert.include(next, "export const draft = F.constant(Status.Enum.draft);");
  });

  it("imports a cross-module decorated base from the receiver's module", () => {
    const owner: readonly [string, string] = [
      "packages/example/src/owner.ts",
      `import { brand, LiteralKit } from ${KIT_IMPORT};
import { withLiteralKitStatics } from ${STATICS_IMPORT};
export const ModeBase = LiteralKit(["fast", "slow"]);
export const Mode = withLiteralKitStatics(ModeBase)(brand(ModeBase));
`,
    ];
    const outcome = planFixture(`import { Mode } from "./owner.ts";\nexport const modes = Mode.Options;\n`, [owner]);
    assert.strictEqual(
      plannedText(outcome),
      `import { Mode, ModeBase } from "./owner.ts";\nexport const modes = ModeBase.literals;\n`
    );
  });

  it("reports decorated receivers whose base kit cannot be reached as residue", () => {
    const residueReasons = (outcome: SchemaParityCodemodFileOutcome): ReadonlyArray<string> =>
      SchemaParityCodemodFileOutcome.guards.Planned(outcome)
        ? A.map(outcome.plan.residue, (entry) => entry.reason)
        : [];
    const owner = (body: string): readonly [string, string] => [
      "packages/example/src/owner.ts",
      `import { brand, LiteralKit } from ${KIT_IMPORT};
import { withLiteralKitStatics } from ${STATICS_IMPORT};
${body}`,
    ];
    const readMode = 'import { Mode } from "./owner.ts";\nexport const modes = Mode.Options;\n';

    assert.deepStrictEqual(
      residueReasons(
        planFixture(readMode, [
          owner(
            'const ModeBase = LiteralKit(["fast", "slow"]);\nexport const Mode = withLiteralKitStatics(ModeBase)(brand(ModeBase));\n'
          ),
        ])
      ),
      ["decorated-base-not-exported"]
    );
    assert.deepStrictEqual(
      residueReasons(
        planFixture(readMode, [
          owner(
            'export const Mode = withLiteralKitStatics(LiteralKit(["fast", "slow"]))(brand(LiteralKit(["fast", "slow"])));\n'
          ),
        ])
      ),
      ["decorated-base-not-identifier"]
    );
    assert.deepStrictEqual(
      residueReasons(
        planFixture(readMode, [owner('export declare const Mode: Pick<LiteralKit<readonly ["fast"]>, "Options">;\n')])
      ),
      ["receiver-without-literals"]
    );
    assert.deepStrictEqual(
      residueReasons(
        planFixture(`${readMode}const ModeBase = 1;\nexport const other = ModeBase;\n`, [
          owner(
            'export const ModeBase = LiteralKit(["fast", "slow"]);\nexport const Mode = withLiteralKitStatics(ModeBase)(brand(ModeBase));\n'
          ),
        ])
      ),
      ["decorated-base-name-conflict"]
    );
  });

  it("never rewrites same-named members owned by other modules", () => {
    const outcome = planFixture(
      `const bag = { Options: [1], HashSet: 2, thunk: { a: () => 1 } };\nexport const x = [bag.Options, bag.HashSet, bag.thunk.a];\n`
    );
    assert.strictEqual(outcome._tag, "Unchanged");
  });

  it("reports whole-object thunk reads as residue and leaves the text alone", () => {
    const text = `${kitHeader}export const thunks = Status.thunk;\n`;
    const outcome = planFixture(text);
    assert.strictEqual(plannedText(outcome), text);
    const reasons = SchemaParityCodemodFileOutcome.guards.Planned(outcome)
      ? A.map(outcome.plan.residue, (entry) => entry.reason)
      : [];
    assert.deepStrictEqual(reasons, ["thunk-used-as-value"]);
  });

  it("quarantines a file whose rule planning throws", () => {
    const throwing = SchemaParityCodemodRule.make({
      ...literalKitFacetsRule,
      plan: () => {
        throw new Error("boom");
      },
    });
    const outcome = planFixture(`${kitHeader}export const all = Status.Options;\n`, [], [throwing]);
    assert.strictEqual(outcome._tag, "Quarantined");
  });

  it("quarantines overlapping edits instead of guessing an order", () => {
    const overlapping = SchemaParityCodemodRule.make({
      ...literalKitFacetsRule,
      plan: () =>
        SchemaParityCodemodRulePlan.make({
          edits: [
            SchemaParityCodemodEdit.make({ start: 0, end: 5, text: "a" }),
            SchemaParityCodemodEdit.make({ start: 3, end: 8, text: "b" }),
          ],
          sites: literalKitFacetsRule.plan(
            makeProject().createSourceFile(
              `/repo/${FIXTURE_MODULE}`,
              `${kitHeader}export const all = Status.Options;\n`
            ),
            SchemaParityCodemodRuleContext.make({ filePath: FIXTURE_MODULE })
          ).sites,
        }),
    });
    const outcome = planFixture(`${kitHeader}export const all = Status.Options;\n`, [], [overlapping]);
    assert.strictEqual(outcome._tag, "Quarantined");
  });
});

const TestLayer = Layer.mergeAll(
  NodeServices.layer,
  TestConsole.layer,
  FsUtilsLive.pipe(Layer.provide(NodeServices.layer))
);

layer(TestLayer, { timeout: "60 seconds" })("schema-parity codemod run", (it) => {
  it.effect("writes planned rewrites and reports per-facet counts", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "schema-parity-codemod-" });
      const write = Effect.fnUntraced(function* (relative: string, text: string) {
        yield* fs.makeDirectory(path.dirname(path.join(root, relative)), { recursive: true });
        yield* fs.writeFileString(path.join(root, relative), text);
      });
      yield* write(
        "tsconfig.json",
        '{ "compilerOptions": { "strict": true, "target": "ES2022", "module": "ESNext", "moduleResolution": "Bundler", "allowImportingTsExtensions": true, "noEmit": true } }\n'
      );
      yield* write(KIT_MODULE, KIT_STUB);
      yield* write(STATICS_MODULE, STATICS_STUB);
      yield* write(
        FIXTURE_MODULE,
        `${kitHeader}export const all = Status.Options;\nexport const one = Status.thunk.live();\n`
      );
      yield* write("packages/example/src/untouched.ts", "export const value = 1;\n");

      const report = yield* runSchemaParityCodemod(
        SchemaParityCodemodOptions.make({
          rules: ["literal-kit-facets"],
          paths: ["packages/example"],
          root,
          write: true,
          format: false,
        })
      );

      assert.strictEqual(report.mode, "write");
      assert.strictEqual(report.filesScanned, 2);
      assert.strictEqual(report.candidateFiles, 1);
      assert.deepStrictEqual(report.filesChanged, [FIXTURE_MODULE]);
      assert.deepStrictEqual(
        A.map(report.facetCounts, (count) => [count.facet, count.sites]),
        [
          ["Options", 1],
          ["thunk", 1],
        ]
      );
      assert.strictEqual(
        yield* fs.readFileString(path.join(root, FIXTURE_MODULE)),
        `${kitHeader}export const all = Status.literals;\nexport const one = Status.Enum.live;\n`
      );
    })
  );

  it.effect("leaves files untouched on a dry run", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "schema-parity-codemod-" });
      const original = `${kitHeader}export const all = Status.Options;\n`;
      yield* fs.makeDirectory(path.join(root, path.dirname(KIT_MODULE)), { recursive: true });
      yield* fs.makeDirectory(path.join(root, path.dirname(FIXTURE_MODULE)), { recursive: true });
      yield* fs.writeFileString(path.join(root, "tsconfig.json"), '{ "compilerOptions": { "strict": true } }\n');
      yield* fs.writeFileString(path.join(root, KIT_MODULE), KIT_STUB);
      yield* fs.writeFileString(path.join(root, FIXTURE_MODULE), original);

      const report = yield* runSchemaParityCodemod(
        SchemaParityCodemodOptions.make({ rules: ["literal-kit-facets"], paths: ["packages/example"], root })
      );

      assert.strictEqual(report.mode, "dry-run");
      assert.deepStrictEqual(report.filesChanged, [FIXTURE_MODULE]);
      assert.strictEqual(yield* fs.readFileString(path.join(root, FIXTURE_MODULE)), original);
    })
  );
});
