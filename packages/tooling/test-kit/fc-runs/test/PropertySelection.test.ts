import {
  isPlainRegistrationLine,
  moduleGraphRunsPropertiesInline,
  plainRegistrationLines,
  relativeImportCandidates,
  relativeImportSpecifiers,
  runsPropertiesInline,
} from "@beep/fc-runs/PropertySelection";
import { describe, expect, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as Str from "effect/String";

describe("isPlainRegistrationLine", () => {
  it("recognises plain registrations and their non-property modifiers", () => {
    const plain = [
      'it("decodes", () => {',
      '  it.effect("decodes", () =>',
      '    it.live("spawns", () =>',
      'it.scoped("opens", () =>',
      'it.effect.scopedLive("x", () =>',
      'test("x", () => {',
      'it.concurrent("x", async () => {',
      'it.sequential("x", () => {',
      'it.fails("x", () => {',
      'it.effect.skip("x", () =>',
      'it.effect.skipIf(isWindows)("x", () =>',
      'it.runIf(process.platform === "linux")("x", () => {',
      'it.effect.each([["a", 1], ["b", 2]])("x %s", ([name]) =>',
      'it.for(cases)("x $name", (c) => {',
      "it.effect(",
    ];
    expect(A.filter(plain, (line) => !isPlainRegistrationLine(line))).toEqual([]);
  });

  it("never treats a .prop registration as plain", () => {
    const property = [
      'it.prop("law", [arb], (input) => {',
      '  it.effect.prop("law", [arb], (input) =>',
      'it.effect.prop.skipIf(isWindows)("law", [arb], f)',
      'it.effect("mentions it.effect.prop( in its name", () =>',
      'prop("law", [arb], f)',
    ];
    expect(A.filter(property, isPlainRegistrationLine)).toEqual([]);
  });

  it("keeps every shape it cannot positively recognise", () => {
    const unknown = [
      'layerIt.effect("x", () =>',
      'caseFor("x", input)',
      '  "decodes the receipt",',
      ')("continuation", () =>',
      'it.effect.skipIf(!hasBun())("x", () =>',
      'it.effect.each(cases.map((c) => c.name))("x", f)',
      'describe("suite", () => {',
      'return it.effect("x", () =>',
      "const it = makeIt()",
      "",
    ];
    expect(A.filter(unknown, isPlainRegistrationLine)).toEqual([]);
  });
});

describe("plainRegistrationLines", () => {
  it("returns 1-based line numbers of plain registrations only", () => {
    const source = A.join(
      [
        'describe("suite", () => {',
        '  it.effect("plain", () => Effect.void)',
        '  it.effect.prop("law", [arb], f, { arbitrary: fcRuns(20) })',
        "  it.effect(",
        '    "multi-line plain",',
        "    () => Effect.void",
        "  )",
        "})",
      ],
      "\r\n"
    );
    expect(plainRegistrationLines(source)).toEqual([2, 4]);
  });
});

describe("runsPropertiesInline", () => {
  it("matches every inline execution marker", () => {
    const markers = [
      'import * as FastCheck from "effect/testing/FastCheck"',
      'import fc from "fast-check"',
      "yield* assertSchemaArbitraryDecodesToSelf(Schema)",
      "yield* Arbitrary.checkEffect(arb, f)",
      "const samples = yield* Arbitrary.sampleEffect(arb, { count: 3 })",
      'import * as Arbitrary from "effect/unstable/arbitrary/Arbitrary"',
      "fc.assert(fc.property(arb, f))",
      "fc.sample(arb, 5)",
    ];
    expect(A.filter(markers, (source) => !runsPropertiesInline(source))).toEqual([]);
  });

  it("admits fcRuns only as the arbitrary option of a .prop registration", () => {
    expect(runsPropertiesInline('it.effect.prop("law", [arb], f, { arbitrary: fcRuns(20) })')).toBe(false);
    expect(runsPropertiesInline("it.prop('law', [arb], f, { arbitrary : fcRunsCapped(5) })")).toBe(false);
    expect(runsPropertiesInline('import { fcRuns } from "@beep/fc-runs"')).toBe(false);
    expect(runsPropertiesInline("yield* runLaw(arb, fcRuns(10))")).toBe(true);
    expect(runsPropertiesInline("ctx.expect.assertions(fcRuns(10).runs)")).toBe(true);
    expect(
      runsPropertiesInline(
        A.join(["it.effect.prop('a', [arb], f, { arbitrary: fcRuns(20) })", "helper(fcRunsCapped(3))"], "\n")
      )
    ).toBe(true);
  });

  it("leaves a plain .prop file and an Arbitrary.schema derivation non-inline", () => {
    expect(runsPropertiesInline('const arb = Arbitrary.schema(S.String)\nit.prop("law", [arb], f)')).toBe(false);
  });
});

describe("relative imports", () => {
  it("lists relative specifiers once, in source order", () => {
    const source = A.join(
      [
        'import { a } from "./support/A.ts";',
        "import { b } from '../b';",
        'import * as S from "effect/Schema";',
        'export * from "./support/A.ts";',
        'const lazy = await import("./lazy.ts");',
        'import "./side-effect.ts";',
      ],
      "\n"
    );
    expect(relativeImportSpecifiers(source)).toEqual(["./support/A.ts", "../b", "./lazy.ts", "./side-effect.ts"]);
  });

  it("expands specifiers to the repository's resolution candidates", () => {
    expect(relativeImportCandidates("./A.ts")).toEqual(["./A.ts", "./A.tsx"]);
    expect(relativeImportCandidates("./A.js")).toEqual(["./A.js"]);
    expect(relativeImportCandidates("../A")).toEqual(["../A", "../A.ts", "../A.tsx", "../A/index.ts"]);
  });
});

describe("moduleGraphRunsPropertiesInline", () => {
  const graph = (files: Record<string, string>) => ({
    read: (path: string) => R.get(files, path),
    // The fixture paths are flat: `/t/<name>`.
    resolve: (_importer: string, specifier: string) =>
      A.map(relativeImportCandidates(specifier), (candidate) => `/t/${Str.replace(/^\.{1,2}\//, "")(candidate)}`),
  });

  it("is false for a graph of plain registrations and .prop options", () => {
    const { read, resolve } = graph({
      "/t/a.test.ts": 'import { fixture } from "./fixture"\nit.effect.prop("law", [arb], f, { arbitrary: fcRuns(9) })',
      "/t/fixture.ts": 'import { deeper } from "./deeper.ts"\nexport const fixture = 1',
      "/t/deeper.ts": "export const deeper = 2",
    });
    expect(
      moduleGraphRunsPropertiesInline({ entry: "/t/a.test.ts", readSource: read, resolveCandidates: resolve })
    ).toBe(false);
  });

  it("detects an inline helper through relative imports, transitively", () => {
    const { read, resolve } = graph({
      "/t/a.test.ts": 'import { law } from "./support.ts"\nit.effect("a", () => law)',
      "/t/support.ts": 'export { law } from "./law"',
      "/t/law.tsx": "export const law = Arbitrary.checkEffect(arb, f, fcRuns(5))",
    });
    expect(
      moduleGraphRunsPropertiesInline({ entry: "/t/a.test.ts", readSource: read, resolveCandidates: resolve })
    ).toBe(true);
  });

  it("terminates on import cycles", () => {
    const { read, resolve } = graph({
      "/t/a.test.ts": 'import "./b.ts"',
      "/t/b.ts": 'import "./a.test.ts"',
    });
    expect(
      moduleGraphRunsPropertiesInline({ entry: "/t/a.test.ts", readSource: read, resolveCandidates: resolve })
    ).toBe(false);
  });

  it("keeps an unreadable entry and ignores an unresolvable import", () => {
    const { read, resolve } = graph({ "/t/a.test.ts": 'import data from "./missing.json"' });
    expect(
      moduleGraphRunsPropertiesInline({ entry: "/t/gone.test.ts", readSource: read, resolveCandidates: resolve })
    ).toBe(true);
    expect(
      moduleGraphRunsPropertiesInline({ entry: "/t/a.test.ts", readSource: read, resolveCandidates: resolve })
    ).toBe(false);
    expect(O.isNone(read("/t/missing.json"))).toBe(true);
  });
});
