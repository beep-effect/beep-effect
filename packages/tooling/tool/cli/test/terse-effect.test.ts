import { runTerseEffectRules, TerseEffectRulesOptions } from "@beep/repo-cli/test/Laws";
import { it } from "@beep/test-runner";
import { A } from "@beep/utils";
import { describe, expect } from "@effect/vitest";
import { Console, Effect } from "effect";
import * as TestConsole from "effect/testing/TestConsole";
import {
  NodeTestLayer,
  readProjectFile,
  temporaryWorkingDirectory,
  writeDefaultTsconfig,
  writeProjectFile,
} from "./support/CommandTest.ts";

const DemoSourcePath = "packages/demo/src/index.ts" as const;

type TerseEffectSummary = {
  readonly touchedFiles: number;
  readonly helpersSimplified: number;
  readonly thunkHelpersSimplified: number;
  readonly flowCandidatesDetected: number;
  readonly optionObjectCompactionCandidatesDetected: number;
  readonly conditionalOptionalObjectSpreadCandidatesDetected: number;
  readonly nestedOptionMatchCandidatesDetected: number;
  readonly nestedBoolMatchCandidatesDetected: number;
  readonly dualOverloadCandidatesDetected: number;
  readonly strictFailure: boolean;
  readonly changedFiles: ReadonlyArray<string>;
  readonly blockingFiles: ReadonlyArray<string>;
  readonly rewritableFiles: ReadonlyArray<string>;
  readonly informationalFiles: ReadonlyArray<string>;
  readonly blockingFindings: ReadonlyArray<string>;
  readonly rewritableFindings: ReadonlyArray<string>;
  readonly informationalFindings: ReadonlyArray<string>;
};

const writeDemoSource = (lines: ReadonlyArray<string>) => writeProjectFile(DemoSourcePath, A.join(lines, "\n"));

const runTerseRules = (write: boolean, strictCheck: boolean) =>
  runTerseEffectRules(
    TerseEffectRulesOptions.make({
      write,
      strictCheck,
      excludePaths: [],
    })
  );

const writeHelperWrapperFixture = writeDemoSource([
  'import * as A from "effect/Array";',
  "",
  "export const value = {",
  "  onNone: () => A.empty<string>(),",
  "  onSome: (reference) => A.make<string>(reference),",
  "};",
  "",
]);

const writeFlowThunkFixture = writeDemoSource([
  'import { pipe } from "effect";',
  'import * as O from "effect/Option";',
  'import { thunkUndefined } from "@beep/utils";',
  "",
  "declare const parse: (value: string) => O.Option<string>;",
  "declare const render: (value: O.Option<string>) => string;",
  "",
  "export const value = {",
  "  onNone: () => undefined,",
  "  parse: (input: string) => pipe(input, parse, render),",
  "};",
  "",
]);

const expectNoHelperFlowFindings = (summary: TerseEffectSummary) => {
  expect(summary.helpersSimplified).toBe(0);
  expect(summary.thunkHelpersSimplified).toBe(0);
  expect(summary.flowCandidatesDetected).toBe(0);
};

const expectNoCoreFindings = (summary: TerseEffectSummary) => {
  expectNoHelperFlowFindings(summary);
  expect(summary.optionObjectCompactionCandidatesDetected).toBe(0);
};

const expectCleanTerseSummary = (summary: TerseEffectSummary) => {
  expect(summary.touchedFiles).toBe(0);
  expectNoCoreFindings(summary);
  expect(summary.strictFailure).toBe(false);
  expect(summary.changedFiles).toEqual([]);
};

const expectStrictDemoChange = (summary: TerseEffectSummary) => {
  expect(summary.strictFailure).toBe(true);
  expect(summary.changedFiles).toEqual([DemoSourcePath]);
};

const expectFlowThunkFindings = (summary: TerseEffectSummary) => {
  expect(summary.blockingFiles).toEqual([DemoSourcePath]);
  expect(summary.rewritableFiles).toEqual([DemoSourcePath]);
  expect(summary.informationalFiles).toEqual([]);
  expect(summary.blockingFindings).toEqual(
    expect.arrayContaining([
      expect.stringMatching(/^packages\/demo\/src\/index\.ts:\d+:\d+ thunk-helper$/u),
      expect.stringMatching(/^packages\/demo\/src\/index\.ts:\d+:\d+ flow-candidate$/u),
    ])
  );
  expect(summary.rewritableFindings[0]).toMatch(/^packages\/demo\/src\/index\.ts:\d+:\d+ thunk-helper$/u);
  expect(summary.informationalFindings).toEqual([]);
};

it.layer(NodeTestLayer, { concurrent: false, timeout: "5 seconds" })((it) => {
  describe("terse effect laws", () => {
    it.effect("exempts ecosystem members in full and explicit include scans", () =>
      Effect.andThen(
        temporaryWorkingDirectory,
        Effect.gen(function* () {
          yield* writeDefaultTsconfig;
          const source = A.join(
            [
              'import * as A from "effect/Array";',
              "",
              "export const values = { onNone: () => A.empty<string>() };",
              "",
            ],
            "\n"
          );
          yield* writeProjectFile("packages/ecosystem/member/src/index.ts", source);
          yield* writeProjectFile(DemoSourcePath, source);

          const fullSummary = yield* runTerseRules(false, true);
          expect(fullSummary.changedFiles).toEqual([DemoSourcePath]);
          expect(fullSummary.strictFailure).toBe(true);

          const explicitSummary = yield* runTerseEffectRules(
            TerseEffectRulesOptions.make({
              write: false,
              strictCheck: true,
              excludePaths: [],
              includePaths: ["packages/ecosystem/member/src/index.ts"],
            })
          );
          expect(explicitSummary.changedFiles).toEqual([]);
          expect(explicitSummary.strictFailure).toBe(false);
        })
      ).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );

    it.effect("reports helper simplifications in dry-run check mode without rewriting files", () =>
      Effect.andThen(
        temporaryWorkingDirectory,
        Effect.gen(function* () {
          yield* writeDefaultTsconfig;
          yield* writeHelperWrapperFixture;

          const summary = yield* runTerseRules(false, true);
          const source = yield* readProjectFile(DemoSourcePath);

          expect(summary.touchedFiles).toBe(1);
          expect(summary.helpersSimplified).toBe(2);
          expect(summary.thunkHelpersSimplified).toBe(0);
          expect(summary.flowCandidatesDetected).toBe(0);
          expect(summary.optionObjectCompactionCandidatesDetected).toBe(0);
          expect(summary.strictFailure).toBe(true);
          expect(summary.changedFiles).toEqual([DemoSourcePath]);
          expect(source).toContain("onNone: () => A.empty<string>()");
          expect(source).toContain("onSome: (reference) => A.make<string>(reference)");
        })
      ).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );

    it.effect("rewrites supported helper wrappers in write mode", () =>
      Effect.andThen(
        temporaryWorkingDirectory,
        Effect.gen(function* () {
          yield* writeDefaultTsconfig;
          yield* writeHelperWrapperFixture;

          const summary = yield* runTerseRules(true, false);
          const source = yield* readProjectFile(DemoSourcePath);

          expect(summary.touchedFiles).toBe(1);
          expect(summary.helpersSimplified).toBe(2);
          expect(summary.thunkHelpersSimplified).toBe(0);
          expect(summary.flowCandidatesDetected).toBe(0);
          expect(summary.optionObjectCompactionCandidatesDetected).toBe(0);
          expect(summary.strictFailure).toBe(false);
          expect(source).toContain("onNone: A.empty<string>");
          expect(source).toContain("onSome: A.of<string>");
        })
      ).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );

    it.effect("leaves bare nullary generic constructor thunks alone in check and write modes", () =>
      Effect.andThen(
        temporaryWorkingDirectory,
        Effect.gen(function* () {
          yield* writeDefaultTsconfig;
          const source = A.join(
            [
              'import * as A from "effect/Array";',
              'import * as O from "effect/Option";',
              "",
              "export const values = {",
              "  onNone: () => A.empty<string>(),",
              "  onNoneTyped: () => O.none<string>(),",
              "  onSomeTyped: (value) => O.some<string>(value),",
              "  onEmpty: () => O.none(),",
              "  onBare: () => A.empty(),",
              "  onRef: (value) => O.some(value),",
              "};",
              "",
            ],
            "\n"
          );
          yield* writeProjectFile(DemoSourcePath, source);

          const checkSummary = yield* runTerseRules(false, true);
          expect(checkSummary.helpersSimplified).toBe(3);
          expect(checkSummary.blockingFindings).toEqual(
            A.make(
              expect.stringMatching(/^packages\/demo\/src\/index\.ts:\d+:\d+ helper-ref$/u),
              expect.stringMatching(/^packages\/demo\/src\/index\.ts:\d+:\d+ helper-ref$/u),
              expect.stringMatching(/^packages\/demo\/src\/index\.ts:\d+:\d+ helper-ref$/u)
            )
          );

          const writeSummary = yield* runTerseRules(true, false);
          const rewritten = yield* readProjectFile(DemoSourcePath);
          expect(writeSummary.helpersSimplified).toBe(3);
          expect(rewritten).toContain("onNone: A.empty<string>");
          expect(rewritten).toContain("onNoneTyped: O.none<string>");
          expect(rewritten).toContain("onSomeTyped: O.some<string>");
          expect(rewritten).toContain("onEmpty: () => O.none()");
          expect(rewritten).toContain("onBare: () => A.empty()");
          expect(rewritten).toContain("onRef: (value) => O.some(value)");
        })
      ).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );

    it.effect("leaves already-terse code unchanged", () =>
      Effect.andThen(
        temporaryWorkingDirectory,
        Effect.gen(function* () {
          yield* writeDefaultTsconfig;
          yield* writeProjectFile(
            DemoSourcePath,
            A.join(
              [
                'import * as A from "effect/Array";',
                "",
                "export const value = {",
                "  onNone: A.empty<string>,",
                "  onSome: A.of,",
                "};",
                "",
              ],
              "\n"
            )
          );

          const summary = yield* runTerseRules(false, true);

          expectCleanTerseSummary(summary);
        })
      ).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );

    it.effect("detects flow candidates and shared thunk helpers in dry-run mode", () =>
      Effect.andThen(
        temporaryWorkingDirectory,
        Effect.gen(function* () {
          yield* writeDefaultTsconfig;
          yield* writeFlowThunkFixture;

          const summary = yield* runTerseRules(false, true);
          const source = yield* readProjectFile(DemoSourcePath);

          expect(summary.touchedFiles).toBe(1);
          expect(summary.helpersSimplified).toBe(0);
          expect(summary.thunkHelpersSimplified).toBe(1);
          expect(summary.flowCandidatesDetected).toBe(1);
          expect(summary.optionObjectCompactionCandidatesDetected).toBe(0);
          expect(summary.strictFailure).toBe(true);
          expectFlowThunkFindings(summary);
          expect(source).toContain("onNone: () => undefined");
          expect(source).toContain("parse: (input: string) => pipe(input, parse, render)");
        })
      ).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );

    it.effect("rewrites shared thunk helper cases while keeping flow-only candidates blocking", () =>
      Effect.andThen(
        temporaryWorkingDirectory,
        Effect.gen(function* () {
          yield* writeDefaultTsconfig;
          yield* writeFlowThunkFixture;

          const summary = yield* runTerseRules(true, false);
          const source = yield* readProjectFile(DemoSourcePath);

          expect(summary.touchedFiles).toBe(1);
          expect(summary.helpersSimplified).toBe(0);
          expect(summary.thunkHelpersSimplified).toBe(1);
          expect(summary.flowCandidatesDetected).toBe(1);
          expect(summary.optionObjectCompactionCandidatesDetected).toBe(0);
          expect(summary.strictFailure).toBe(false);
          expectFlowThunkFindings(summary);
          expect(source).toContain("onNone: thunkUndefined");
          expect(source).toContain("parse: (input: string) => pipe(input, parse, render)");
        })
      ).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );

    it.effect("ignores type-only thunk imports when checking shared helper availability", () =>
      Effect.andThen(
        temporaryWorkingDirectory,
        Effect.gen(function* () {
          yield* writeDefaultTsconfig;
          yield* writeProjectFile(
            DemoSourcePath,
            A.join(
              [
                'import { type thunkUndefined, thunk0 } from "@beep/utils";',
                "",
                "export const keep = thunk0;",
                "export const value = { onNone: () => undefined };",
                "",
              ],
              "\n"
            )
          );

          const summary = yield* runTerseRules(false, true);

          expectCleanTerseSummary(summary);
        })
      ).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );

    it.effect("reports whole-object Option match compaction candidates without rewriting files", () =>
      Effect.andThen(
        temporaryWorkingDirectory,
        Effect.gen(function* () {
          yield* writeDefaultTsconfig;
          yield* writeProjectFile(
            DemoSourcePath,
            A.join(
              [
                'import { pipe } from "effect";',
                'import * as O from "effect/Option";',
                "",
                "declare const maybeParse: O.Option<(input: string) => unknown>;",
                "",
                "export const runtime = pipe(",
                "  maybeParse,",
                "  O.match({",
                "    onNone: () => ({}),",
                "    onSome: (parse) => ({",
                "      Bun: {",
                "        YAML: { parse },",
                "      },",
                "    }),",
                "  })",
                ");",
                "",
              ],
              "\n"
            )
          );

          const summary = yield* runTerseRules(false, true);
          const source = yield* readProjectFile(DemoSourcePath);

          expect(summary.touchedFiles).toBe(1);
          expectNoHelperFlowFindings(summary);
          expect(summary.optionObjectCompactionCandidatesDetected).toBe(1);
          expectStrictDemoChange(summary);
          expect(source).toContain("onNone: () => ({})");
        })
      ).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );

    it.effect("reports object-spread Option match compaction candidates", () =>
      Effect.andThen(
        temporaryWorkingDirectory,
        Effect.gen(function* () {
          yield* writeDefaultTsconfig;
          yield* writeProjectFile(
            DemoSourcePath,
            A.join(
              [
                'import * as O from "effect/Option";',
                "",
                "declare const selector: O.Option<string>;",
                "",
                "export const options = {",
                "  verbose: true,",
                "  ...O.match(selector, {",
                "    onNone: () => ({}),",
                "    onSome: (packageName) => ({ package: packageName }),",
                "  }),",
                "};",
                "",
              ],
              "\n"
            )
          );

          const summary = yield* runTerseRules(false, true);

          expect(summary.touchedFiles).toBe(1);
          expect(summary.optionObjectCompactionCandidatesDetected).toBe(1);
          expectStrictDemoChange(summary);
        })
      ).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );

    it.effect("reports conditional optional object spread candidates", () =>
      Effect.andThen(
        temporaryWorkingDirectory,
        Effect.gen(function* () {
          yield* writeDefaultTsconfig;
          yield* writeProjectFile(
            DemoSourcePath,
            A.join(
              [
                "declare const name: string | undefined;",
                "declare const bucketName: string | undefined;",
                "",
                "export const options = {",
                "  verbose: true,",
                "  ...(name === undefined ? {} : { name }),",
                "  ...(bucketName !== undefined ? { lockTableName: `${bucketName}-locks` } : {}),",
                "};",
                "",
              ],
              "\n"
            )
          );

          const summary = yield* runTerseRules(false, true);

          expect(summary.touchedFiles).toBe(1);
          expect(summary.optionObjectCompactionCandidatesDetected).toBe(0);
          expect(summary.conditionalOptionalObjectSpreadCandidatesDetected).toBe(2);
          expectStrictDemoChange(summary);
        })
      ).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );

    it.effect("ignores JSX prop spreads and non-object optional spreads", () =>
      Effect.andThen(
        temporaryWorkingDirectory,
        Effect.gen(function* () {
          yield* writeDefaultTsconfig;
          yield* writeProjectFile(
            DemoSourcePath,
            A.join(
              [
                "declare const id: string | undefined;",
                "declare const imageName: string;",
                "declare const templateId: string | undefined;",
                "",
                "export const ids = [",
                "  ...(id === undefined ? [] : [id]),",
                "];",
                "export const selector = {",
                "  ...(templateId === undefined ? { imageName } : { templateId }),",
                "};",
                "",
              ],
              "\n"
            )
          );
          yield* writeProjectFile(
            "packages/demo/src/view.tsx",
            A.join(
              [
                "declare const value: string | undefined;",
                "",
                "export const view = <input {...(value !== undefined ? { value } : {})} />;",
                "",
              ],
              "\n"
            )
          );

          const summary = yield* runTerseRules(false, true);

          expect(summary.touchedFiles).toBe(0);
          expect(summary.conditionalOptionalObjectSpreadCandidatesDetected).toBe(0);
          expect(summary.strictFailure).toBe(false);
        })
      ).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );

    it.effect("reports nested Option and Bool match candidates", () =>
      Effect.andThen(
        temporaryWorkingDirectory,
        Effect.gen(function* () {
          yield* writeDefaultTsconfig;
          yield* writeProjectFile(
            DemoSourcePath,
            A.join(
              [
                'import * as Bool from "effect/Boolean";',
                'import * as O from "effect/Option";',
                "",
                "declare const enabled: boolean;",
                "declare const maybeFallback: O.Option<string>;",
                "declare const maybeName: O.Option<string>;",
                "declare const verified: boolean;",
                "",
                "export const label = O.match(maybeName, {",
                '  onNone: () => O.match(maybeFallback, { onNone: () => "missing", onSome: (fallback) => fallback }),',
                "  onSome: (name) => name,",
                "});",
                "",
                "export const status = Bool.match(enabled, {",
                '  onFalse: () => "disabled",',
                '  onTrue: () => Bool.match(verified, { onFalse: () => "pending", onTrue: () => "ready" }),',
                "});",
                "",
              ],
              "\n"
            )
          );

          const summary = yield* runTerseRules(false, true);

          expect(summary.touchedFiles).toBe(1);
          expectNoCoreFindings(summary);
          expect(summary.nestedOptionMatchCandidatesDetected).toBe(1);
          expect(summary.nestedBoolMatchCandidatesDetected).toBe(1);
          expect(summary.dualOverloadCandidatesDetected).toBe(0);
          expectStrictDemoChange(summary);
        })
      ).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );

    it.effect("reports explicit dual-overload helper candidates", () =>
      Effect.andThen(
        temporaryWorkingDirectory,
        Effect.gen(function* () {
          yield* writeDefaultTsconfig;
          yield* writeProjectFile(
            DemoSourcePath,
            A.join(
              [
                "type PackageOptions = Readonly<{ packageName: string }>;",
                "",
                "export function withPackage(packageName: string, options: PackageOptions): PackageOptions;",
                "export function withPackage(packageName: string): (options: PackageOptions) => PackageOptions;",
                "export function withPackage(",
                "  packageName: string,",
                "  options?: PackageOptions",
                "): PackageOptions | ((options: PackageOptions) => PackageOptions) {",
                "  if (options === undefined) {",
                "    return (self) => ({ ...self, packageName });",
                "  }",
                "",
                "  return { ...options, packageName };",
                "}",
                "",
                "export function literal(first: string, ...rest: ReadonlyArray<string>): ReadonlyArray<string>;",
                "export function literal(values: ReadonlyArray<string>): ReadonlyArray<string>;",
                "export function literal(",
                "  firstOrValues: string | ReadonlyArray<string>,",
                "  ...rest: ReadonlyArray<string>",
                "): ReadonlyArray<string> {",
                '  return typeof firstOrValues === "string" ? [firstOrValues, ...rest] : firstOrValues;',
                "}",
                "",
              ],
              "\n"
            )
          );

          const summary = yield* runTerseRules(false, true);

          expect(summary.touchedFiles).toBe(1);
          expectNoCoreFindings(summary);
          expect(summary.nestedOptionMatchCandidatesDetected).toBe(0);
          expect(summary.nestedBoolMatchCandidatesDetected).toBe(0);
          expect(summary.dualOverloadCandidatesDetected).toBe(1);
          expectStrictDemoChange(summary);
        })
      ).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );

    it.effect("does not enforce broad nested ternary or if shapes", () =>
      Effect.andThen(
        temporaryWorkingDirectory,
        Effect.gen(function* () {
          yield* writeDefaultTsconfig;
          yield* writeProjectFile(
            DemoSourcePath,
            A.join(
              [
                "export const nestedTernary = (first: boolean, second: boolean): string =>",
                '  first ? (second ? "both" : "first") : "neither";',
                "",
                "export function nestedIf(first: boolean, second: boolean): string {",
                "  if (first) {",
                "    if (second) {",
                '      return "both";',
                "    }",
                "",
                '    return "first";',
                "  }",
                "",
                '  return "neither";',
                "}",
                "",
              ],
              "\n"
            )
          );

          const summary = yield* runTerseRules(false, true);

          expectCleanTerseSummary(summary);
          expect(summary.nestedOptionMatchCandidatesDetected).toBe(0);
          expect(summary.nestedBoolMatchCandidatesDetected).toBe(0);
          expect(summary.dualOverloadCandidatesDetected).toBe(0);
        })
      ).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );

    it.effect("ignores clean Option object helpers and schema-boundary Option helpers", () =>
      Effect.andThen(
        temporaryWorkingDirectory,
        Effect.gen(function* () {
          yield* writeDefaultTsconfig;
          yield* writeProjectFile(
            DemoSourcePath,
            A.join(
              [
                'import * as O from "effect/Option";',
                'import * as R from "effect/Record";',
                'import * as S from "effect/Schema";',
                "",
                "declare const selector: O.Option<string>;",
                "",
                "export const options = R.getSomes({ package: selector });",
                'export class Input extends S.Class<Input>("Input")({',
                "  package: S.OptionFromOptionalKey(S.String),",
                "}) {}",
                "",
              ],
              "\n"
            )
          );

          const summary = yield* runTerseRules(false, true);

          expectCleanTerseSummary(summary);
        })
      ).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );
  });
});
