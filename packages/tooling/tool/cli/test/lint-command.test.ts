import { lintCommand } from "@beep/repo-cli";
import { TSMorphServiceLive } from "@beep/repo-utils";
import { FsUtilsLive } from "@beep/repo-utils/FsUtils";
import { provideScopedLayer } from "@beep/test-utils";
import { NodeServices } from "@effect/platform-node";
import { Effect, FileSystem, Layer, Path } from "effect";
import * as S from "effect/Schema";
import * as TestConsole from "effect/testing/TestConsole";
import { Command } from "effect/unstable/cli";
import { describe, expect, it } from "vitest";
import { expectReportedExit, withTempWorkingDirectory } from "./support/CommandTest.ts";

const runLintCommand = Command.runWith(lintCommand, { version: "0.0.0" });
const encodeJson = S.encodeUnknownSync(S.UnknownFromJsonString);

const testLayer = Layer.mergeAll(
  NodeServices.layer,
  TestConsole.layer,
  FsUtilsLive.pipe(Layer.provide(NodeServices.layer)),
  TSMorphServiceLive.pipe(Layer.provide(NodeServices.layer))
);

const writePackage = Effect.fn(function* (packageDir: string, packageName: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;

  yield* fs.makeDirectory(path.join(packageDir, "src"), { recursive: true });
  yield* fs.writeFileString(
    path.join(packageDir, "package.json"),
    `${encodeJson({
      name: packageName,
      version: "0.0.0",
      type: "module",
    })}\n`
  );
});

const writeSchemaFirstFileFixture = Effect.fn("writeSchemaFirstFileFixture")(function* (
  relativePath: string,
  sourceLines: ReadonlyArray<string>
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;

  yield* fs.writeFileString(
    "package.json",
    `${encodeJson({
      name: "@beep/test-root",
      private: true,
      type: "module",
      workspaces: ["packages/*"],
    })}\n`
  );
  yield* fs.writeFileString("tsconfig.json", `${encodeJson({ compilerOptions: {} })}\n`);
  yield* fs.makeDirectory(path.dirname(relativePath), { recursive: true });
  yield* fs.writeFileString(relativePath, sourceLines.join("\n"));
});

const writeSchemaFirstSourceFixture = Effect.fn("writeSchemaFirstSourceFixture")(function* (
  sourceLines: ReadonlyArray<string>
) {
  yield* writeSchemaFirstFileFixture("packages/example/src/Example.ts", sourceLines);
});

const writePrecisionAuditInventory = Effect.fn("writePrecisionAuditInventory")(function* (
  status: "advisory" | "exception",
  reason: string
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;

  yield* fs.makeDirectory("standards");
  yield* fs.writeFileString(
    path.join("standards", "schema-first.inventory.jsonc"),
    `${encodeJson({
      version: 1,
      generatedOn: "2026-06-08",
      scope: ["apps/**/*.{ts,tsx}", "packages/**/*.{ts,tsx}", "infra/**/*.ts"],
      entries: [
        {
          file: "packages/example/src/Example.ts",
          symbol: "Contact.email",
          kind: "schema-policy-advisory",
          status,
          ruleId: "SFV4-precision-audit",
          line: 3,
          owner: "@beep/example",
          reason,
        },
      ],
    })}\n`
  );
});

const runSchemaFirstAndExpectNoErrors = Effect.fn("runSchemaFirstAndExpectNoErrors")(function* () {
  yield* runLintCommand(["schema-first"]);
  const errorLines = yield* TestConsole.errorLines;
  expect(errorLines).toEqual([]);
});

describe("schema-first lint command", { concurrent: false }, () => {
  it(
    "reports redundant LiteralKit const assertions",
    () =>
      Effect.runPromise(
        withTempWorkingDirectory(
          Effect.gen(function* () {
            yield* writeSchemaFirstSourceFixture([
              'import { LiteralKit } from "@beep/schema";',
              'const Status = LiteralKit(["active", "inactive"] as const);',
              "void Status;",
              "",
            ]);

            const exit = yield* Effect.exit(runLintCommand(["schema-first"]));

            const errorLines = yield* TestConsole.errorLines;
            expectReportedExit(exit);
            expect(errorLines).toContain("[schema-first] redundant LiteralKit const assertions:");
            expect(errorLines).toContain(
              "- packages/example/src/Example.ts:2 arg1 [literal-kit-const-assertion] Inline LiteralKit array arguments do not need as const."
            );
            const structuredIssueLine =
              '[schema-first:issue] {"category":"schema-first-policy","ruleId":"literal-kit-const-assertion",' +
              '"severity":"error","file":"packages/example/src/Example.ts","line":2,"symbol":"LiteralKit",' +
              '"message":"Inline LiteralKit array arguments do not need as const.",' +
              '"remediation":"Remove the redundant as const assertion; LiteralKit already uses const type parameters."}';
            expect(errorLines).toContain(structuredIssueLine);
          })
        ).pipe(provideScopedLayer(testLayer))
      ),
    5_000
  );

  it(
    "accepts direct LiteralKit inline arrays without const assertions",
    () =>
      Effect.runPromise(
        withTempWorkingDirectory(
          Effect.gen(function* () {
            yield* writeSchemaFirstSourceFixture([
              'import { LiteralKit } from "@beep/schema";',
              'const Status = LiteralKit(["active", "inactive"]);',
              "void Status;",
              "",
            ]);

            yield* runSchemaFirstAndExpectNoErrors();
          })
        ).pipe(provideScopedLayer(testLayer))
      ),
    5_000
  );

  it(
    "reports untracked SFV4 numeric-domain advisories",
    () =>
      Effect.runPromise(
        withTempWorkingDirectory(
          Effect.gen(function* () {
            yield* writeSchemaFirstSourceFixture([
              'import * as S from "effect/Schema";',
              'export class WorkerOptions extends S.Class<WorkerOptions>("WorkerOptions")({',
              "  timeoutMs: S.Number,",
              "  accountId: S.Number,",
              "  retryCount: S.Int,",
              "}) {}",
              "",
            ]);

            const exit = yield* Effect.exit(runLintCommand(["schema-first"]));

            const errorLines = yield* TestConsole.errorLines;
            expectReportedExit(exit);
            expect(errorLines).toContain("[schema-first] untracked live findings:");
            expect(errorLines).toContain(
              '- packages/example/src/Example.ts :: WorkerOptions.timeoutMs [schema-policy-advisory] Broad numeric schema field "timeoutMs" should use S.Finite, S.Int, or a range check unless NaN and infinity are intentional.'
            );
            const structuredIssueLine =
              '[schema-first:issue] {"category":"schema-first-policy","ruleId":"SFV4-numeric-domain",' +
              '"severity":"warning","file":"packages/example/src/Example.ts","line":3,' +
              '"symbol":"WorkerOptions.timeoutMs",' +
              '"message":"Broad numeric schema field \\"timeoutMs\\" should use S.Finite, S.Int, or a range check unless NaN and infinity are intentional.",' +
              '"remediation":"Review the numeric domain and replace broad S.Number/S.NumberFromString with S.Finite, S.Int, or checks; then run bun run beep lint schema-first --write if the broad domain is intentional."}';
            expect(errorLines).toContain(structuredIssueLine);
          })
        ).pipe(provideScopedLayer(testLayer))
      ),
    5_000
  );

  it(
    "reports untracked SFV4 static-api discriminator switch advisories",
    () =>
      Effect.runPromise(
        withTempWorkingDirectory(
          Effect.gen(function* () {
            yield* writeSchemaFirstSourceFixture([
              'import * as S from "effect/Schema";',
              "const JobEvent = S.TaggedUnion({});",
              'export const render = (event: { readonly _tag: "Created" | "Failed"; readonly id?: string; readonly reason?: string }) => {',
              "  switch (event._tag) {",
              '    case "Created":',
              '      return event.id ?? "";',
              '    case "Failed":',
              '      return event.reason ?? "";',
              "  }",
              "};",
              "void JobEvent;",
              "",
            ]);

            const exit = yield* Effect.exit(runLintCommand(["schema-first"]));

            const errorLines = yield* TestConsole.errorLines;
            expectReportedExit(exit);
            expect(errorLines).toContain("[schema-first] untracked live findings:");
            expect(errorLines).toContain(
              '- packages/example/src/Example.ts :: render.switch(event._tag) [schema-policy-advisory] Schema-modeled discriminator switch "event._tag" should use schema-derived .match/.guards or LiteralKit.$match when semantics match.'
            );
            const structuredIssueLine =
              '[schema-first:issue] {"category":"schema-first-policy","ruleId":"SFV4-static-api",' +
              '"severity":"warning","file":"packages/example/src/Example.ts","line":4,' +
              '"symbol":"render.switch(event._tag)",' +
              '"message":"Schema-modeled discriminator switch \\"event._tag\\" should use schema-derived .match/.guards or LiteralKit.$match when semantics match.",' +
              '"remediation":"Prefer schema-derived .match/.guards/.cases or LiteralKit helpers, or run bun run beep lint schema-first --write with a justification when behavior intentionally differs."}';
            expect(errorLines).toContain(structuredIssueLine);
          })
        ).pipe(provideScopedLayer(testLayer))
      ),
    5_000
  );

  it(
    "reports untracked SFV4 precision-audit broad email advisories",
    () =>
      Effect.runPromise(
        withTempWorkingDirectory(
          Effect.gen(function* () {
            yield* writeSchemaFirstSourceFixture([
              'import * as S from "effect/Schema";',
              'export class Contact extends S.Class<Contact>("Contact")({',
              "  email: S.String,",
              "}) {}",
              "",
            ]);

            const exit = yield* Effect.exit(runLintCommand(["schema-first"]));

            const errorLines = yield* TestConsole.errorLines;
            expectReportedExit(exit);
            expect(errorLines).toContain("[schema-first] untracked live findings:");
            expect(errorLines).toContain(
              '- packages/example/src/Example.ts :: Contact.email [schema-policy-advisory] Broad string field "email" should use @beep/schema Email, a local precise email schema, or a documented external-protocol exception.'
            );
            const structuredIssueLine =
              '[schema-first:issue] {"category":"schema-first-policy","ruleId":"SFV4-precision-audit",' +
              '"severity":"warning","file":"packages/example/src/Example.ts","line":3,' +
              '"symbol":"Contact.email",' +
              '"message":"Broad string field \\"email\\" should use @beep/schema Email, a local precise email schema, or a documented external-protocol exception.",' +
              '"remediation":"Replace broad email S.String fields with @beep/schema Email or a local precise email schema; inventory only external protocol fields that intentionally allow non-email strings."}';
            expect(errorLines).toContain(structuredIssueLine);
          })
        ).pipe(provideScopedLayer(testLayer))
      ),
    5_000
  );

  it(
    "accepts precise email schemas without precision-audit advisories",
    () =>
      Effect.runPromise(
        withTempWorkingDirectory(
          Effect.gen(function* () {
            yield* writeSchemaFirstSourceFixture([
              'import { Email } from "@beep/schema";',
              'import * as S from "effect/Schema";',
              'export class Contact extends S.Class<Contact>("Contact")({',
              "  email: Email,",
              "}) {}",
              "",
            ]);

            yield* runSchemaFirstAndExpectNoErrors();
          })
        ).pipe(provideScopedLayer(testLayer))
      ),
    5_000
  );

  it(
    "reports untracked SFV4 fn-schema advisories for a .ts function (R17-2 still-fires case)",
    () =>
      Effect.runPromise(
        withTempWorkingDirectory(
          Effect.gen(function* () {
            yield* writeSchemaFirstSourceFixture([
              'import * as S from "effect/Schema";',
              'export class Widget extends S.Class<Widget>("Widget")({',
              "  id: S.String,",
              "}) {}",
              "export function updateWidget(input: { id: string; name: string }): void {}",
              "",
            ]);

            const exit = yield* Effect.exit(runLintCommand(["schema-first"]));

            const errorLines = yield* TestConsole.errorLines;
            expectReportedExit(exit);
            expect(errorLines).toContain("[schema-first] untracked live findings:");
            expect(errorLines).toContain(
              '- packages/example/src/Example.ts :: updateWidget [schema-policy-advisory] Exported function "updateWidget" carries inline object contracts in a schema-modeled file; model them with Fn({ input, output }) from @beep/schema or an S.Class so the contract is executable.'
            );
            const structuredIssueLine =
              '[schema-first:issue] {"category":"schema-first-policy","ruleId":"SFV4-fn-schema",' +
              '"severity":"warning","file":"packages/example/src/Example.ts","line":5,' +
              '"symbol":"updateWidget",' +
              '"message":"Exported function \\"updateWidget\\" carries inline object contracts in a schema-modeled file; model them with Fn({ input, output }) from @beep/schema or an S.Class so the contract is executable.",' +
              '"remediation":"Model inline object parameter/return contracts with Fn({ input, output }) from @beep/schema or an S.Class, or run bun run beep lint schema-first --write with a justification when the shape intentionally stays inline."}';
            expect(errorLines).toContain(structuredIssueLine);
          })
        ).pipe(provideScopedLayer(testLayer))
      ),
    5_000
  );

  it(
    "does not report SFV4 fn-schema advisories for a .tsx component (R17-2 newly-excluded case)",
    () =>
      Effect.runPromise(
        withTempWorkingDirectory(
          Effect.gen(function* () {
            yield* writeSchemaFirstFileFixture("packages/example/src/Example.tsx", [
              'import * as S from "effect/Schema";',
              'export class Widget extends S.Class<Widget>("Widget")({',
              "  id: S.String,",
              "}) {}",
              "export function UpdateWidgetDemo(input: { id: string; name: string }): void {}",
              "",
            ]);

            yield* runSchemaFirstAndExpectNoErrors();
          })
        ).pipe(provideScopedLayer(testLayer))
      ),
    5_000
  );

  it(
    "excludes inventoried precision-audit exceptions from active advisory counts",
    () =>
      Effect.runPromise(
        withTempWorkingDirectory(
          Effect.gen(function* () {
            yield* writeSchemaFirstSourceFixture([
              'import * as S from "effect/Schema";',
              'export class Contact extends S.Class<Contact>("Contact")({',
              "  email: S.String,",
              "}) {}",
              "",
            ]);
            yield* writePrecisionAuditInventory(
              "exception",
              "External protocol preserves raw email text before domain validation."
            );

            yield* runLintCommand(["schema-first"]);

            const logLines = yield* TestConsole.logLines;
            const errorLines = yield* TestConsole.errorLines;
            expect(logLines).toContain("[schema-first] sfv4_precision_audit_advisories=0");
            expect(errorLines).toEqual([]);
          })
        ).pipe(provideScopedLayer(testLayer))
      ),
    5_000
  );

  it(
    "blocks tracked active schema-first advisories",
    () =>
      Effect.runPromise(
        withTempWorkingDirectory(
          Effect.gen(function* () {
            yield* writeSchemaFirstSourceFixture([
              'import * as S from "effect/Schema";',
              'export class Contact extends S.Class<Contact>("Contact")({',
              "  email: S.String,",
              "}) {}",
              "",
            ]);
            yield* writePrecisionAuditInventory(
              "advisory",
              'Broad string field "email" should use @beep/schema Email, a local precise email schema, or a documented external-protocol exception.'
            );

            const exit = yield* Effect.exit(runLintCommand(["schema-first"]));

            const logLines = yield* TestConsole.logLines;
            const errorLines = yield* TestConsole.errorLines;
            expectReportedExit(exit);
            expect(logLines).toContain("[schema-first] sfv4_precision_audit_advisories=1");
            expect(errorLines).toContain("[schema-first] repo still contains advisory findings:");
            expect(errorLines).toContain(
              '- packages/example/src/Example.ts :: Contact.email [schema-policy-advisory] Broad string field "email" should use @beep/schema Email, a local precise email schema, or a documented external-protocol exception.'
            );
            const structuredIssueLine =
              '[schema-first:issue] {"category":"schema-first-policy","ruleId":"SFV4-precision-audit",' +
              '"severity":"warning","file":"packages/example/src/Example.ts","line":3,' +
              '"symbol":"Contact.email",' +
              '"message":"Broad string field \\"email\\" should use @beep/schema Email, a local precise email schema, or a documented external-protocol exception.",' +
              '"remediation":"Resolve the schema-first advisory or move the entry to exception with a documented reason."}';
            expect(errorLines).toContain(structuredIssueLine);
          })
        ).pipe(provideScopedLayer(testLayer))
      ),
    5_000
  );

  it(
    "reports untracked SFV4 arbitrary-tests static-only schema test advisories",
    () =>
      Effect.runPromise(
        withTempWorkingDirectory(
          Effect.gen(function* () {
            yield* writeSchemaFirstFileFixture("packages/example/test/Example.test.ts", [
              'import * as S from "effect/Schema";',
              "const Worker = S.Struct({ id: S.String, retryCount: S.Int });",
              "export const staticChecks = [",
              '  S.decodeUnknownEffect(Worker)({ id: "a", retryCount: 1 }),',
              '  S.decodeUnknownEffect(Worker)({ id: "b", retryCount: 2 }),',
              '  S.encodeEffect(Worker)({ id: "c", retryCount: 3 }),',
              "];",
              "",
            ]);

            const exit = yield* Effect.exit(runLintCommand(["schema-first"]));

            const errorLines = yield* TestConsole.errorLines;
            expectReportedExit(exit);
            expect(errorLines).toContain("[schema-first] untracked live findings:");
            expect(errorLines).toContain(
              "- packages/example/test/Example.test.ts :: schema-codec-tests [schema-policy-advisory] Schema-heavy test file has 3 Schema codec assertions but no schema-derived property coverage."
            );
            const structuredIssueLine =
              '[schema-first:issue] {"category":"schema-first-policy","ruleId":"SFV4-arbitrary-tests",' +
              '"severity":"warning","file":"packages/example/test/Example.test.ts","line":4,' +
              '"symbol":"schema-codec-tests",' +
              '"message":"Schema-heavy test file has 3 Schema codec assertions but no schema-derived property coverage.",' +
              '"remediation":"Add a focused property test using S.toArbitrary(sourceSchema) and fast-check, or keep the inventory entry when the file is intentionally golden/snapshot/regression-only coverage."}';
            expect(errorLines).toContain(structuredIssueLine);
          })
        ).pipe(provideScopedLayer(testLayer))
      ),
    5_000
  );

  it(
    "accepts schema-derived property tests without arbitrary-tests advisories",
    () =>
      Effect.runPromise(
        withTempWorkingDirectory(
          Effect.gen(function* () {
            yield* writeSchemaFirstFileFixture("packages/example/test/Example.test.ts", [
              'import * as fc from "fast-check";',
              'import * as S from "effect/Schema";',
              "const Worker = S.Struct({ id: S.String, retryCount: S.Int });",
              "const WorkerArbitrary = S.toArbitrary(Worker);",
              "export const staticChecks = [",
              '  S.decodeUnknownEffect(Worker)({ id: "a", retryCount: 1 }),',
              '  S.decodeUnknownEffect(Worker)({ id: "b", retryCount: 2 }),',
              '  S.encodeEffect(Worker)({ id: "c", retryCount: 3 }),',
              "];",
              "export const property = fc.property(WorkerArbitrary, (worker) => worker.retryCount === Math.trunc(worker.retryCount));",
              "",
            ]);

            yield* runSchemaFirstAndExpectNoErrors();
          })
        ).pipe(provideScopedLayer(testLayer))
      ),
    5_000
  );

  it(
    "does not treat a non-schema-derived fast-check property as arbitrary-tests coverage",
    () =>
      Effect.runPromise(
        withTempWorkingDirectory(
          Effect.gen(function* () {
            yield* writeSchemaFirstFileFixture("packages/example/test/Example.test.ts", [
              'import * as fc from "fast-check";',
              'import * as S from "effect/Schema";',
              "const Worker = S.Struct({ id: S.String, retryCount: S.Int });",
              "export const staticChecks = [",
              '  S.decodeUnknownEffect(Worker)({ id: "a", retryCount: 1 }),',
              '  S.decodeUnknownEffect(Worker)({ id: "b", retryCount: 2 }),',
              '  S.encodeEffect(Worker)({ id: "c", retryCount: 3 }),',
              "];",
              'export const property = fc.property(fc.string(), (id) => typeof id === "string");',
              "",
            ]);

            const exit = yield* Effect.exit(runLintCommand(["schema-first"]));

            const errorLines = yield* TestConsole.errorLines;
            expectReportedExit(exit);
            expect(errorLines).toContain(
              "- packages/example/test/Example.test.ts :: schema-codec-tests [schema-policy-advisory] Schema-heavy test file has 3 Schema codec assertions but no schema-derived property coverage."
            );
          })
        ).pipe(provideScopedLayer(testLayer))
      ),
    5_000
  );

  it(
    "counts class-local static codec calls toward the arbitrary-tests threshold",
    () =>
      Effect.runPromise(
        withTempWorkingDirectory(
          Effect.gen(function* () {
            yield* writeSchemaFirstFileFixture("packages/example/test/Example.test.ts", [
              'import * as S from "effect/Schema";',
              'class Worker extends S.Class<Worker>("Worker")({ id: S.String }) {',
              "  static readonly decodeUnknownSync = S.decodeUnknownSync(Worker);",
              "}",
              "export const staticChecks = [",
              '  Worker.decodeUnknownSync({ id: "a" }),',
              '  Worker.decodeUnknownSync({ id: "b" }),',
              '  Worker.decodeUnknownSync({ id: "c" }),',
              "];",
              "",
            ]);

            const exit = yield* Effect.exit(runLintCommand(["schema-first"]));

            const errorLines = yield* TestConsole.errorLines;
            expectReportedExit(exit);
            expect(errorLines).toContain(
              "- packages/example/test/Example.test.ts :: schema-codec-tests [schema-policy-advisory] Schema-heavy test file has 4 Schema codec assertions but no schema-derived property coverage."
            );
          })
        ).pipe(provideScopedLayer(testLayer))
      ),
    5_000
  );

  it(
    "reports SFV4 arbitrary-tests advisories for synchronous schema codec helpers",
    () =>
      Effect.runPromise(
        withTempWorkingDirectory(
          Effect.gen(function* () {
            yield* writeSchemaFirstFileFixture("packages/example/test/Sync.test.ts", [
              'import * as S from "effect/Schema";',
              "const Worker = S.Struct({ id: S.String, retryCount: S.Int });",
              "export const staticChecks = [",
              '  S.decodeUnknownSync(Worker)({ id: "a", retryCount: 1 }),',
              '  S.decodeSync(Worker)({ id: "b", retryCount: 2 }),',
              '  S.encodeSync(Worker)({ id: "c", retryCount: 3 }),',
              "];",
              "",
            ]);

            const exit = yield* Effect.exit(runLintCommand(["schema-first"]));

            const errorLines = yield* TestConsole.errorLines;
            expectReportedExit(exit);
            expect(errorLines).toContain(
              "- packages/example/test/Sync.test.ts :: schema-codec-tests [schema-policy-advisory] Schema-heavy test file has 3 Schema codec assertions but no schema-derived property coverage."
            );
            const structuredIssueLine =
              '[schema-first:issue] {"category":"schema-first-policy","ruleId":"SFV4-arbitrary-tests",' +
              '"severity":"warning","file":"packages/example/test/Sync.test.ts","line":4,' +
              '"symbol":"schema-codec-tests",' +
              '"message":"Schema-heavy test file has 3 Schema codec assertions but no schema-derived property coverage.",' +
              '"remediation":"Add a focused property test using S.toArbitrary(sourceSchema) and fast-check, or keep the inventory entry when the file is intentionally golden/snapshot/regression-only coverage."}';
            expect(errorLines).toContain(structuredIssueLine);
          })
        ).pipe(provideScopedLayer(testLayer))
      ),
    5_000
  );

  it(
    "accepts schema-derived static match usage without static-api advisories",
    () =>
      Effect.runPromise(
        withTempWorkingDirectory(
          Effect.gen(function* () {
            yield* writeSchemaFirstSourceFixture([
              'import * as S from "effect/Schema";',
              "const JobEvent = S.TaggedUnion({});",
              "export const render = (event: unknown) =>",
              "  JobEvent.match(event, {",
              '    Created: () => "created",',
              '    Failed: () => "failed",',
              "  });",
              "",
            ]);

            yield* runSchemaFirstAndExpectNoErrors();
          })
        ).pipe(provideScopedLayer(testLayer))
      ),
    5_000
  );

  it(
    "reports untracked SFV4 equivalence manual equals advisories",
    () =>
      Effect.runPromise(
        withTempWorkingDirectory(
          Effect.gen(function* () {
            yield* writeSchemaFirstSourceFixture([
              'import * as S from "effect/Schema";',
              'export class Worker extends S.Class<Worker>("Worker")({',
              "  id: S.String,",
              "  name: S.String,",
              "}) {}",
              "export const equals = (left: Worker, right: Worker) => left.id === right.id && left.name === right.name;",
              "",
            ]);

            const exit = yield* Effect.exit(runLintCommand(["schema-first"]));

            const errorLines = yield* TestConsole.errorLines;
            expectReportedExit(exit);
            expect(errorLines).toContain("[schema-first] untracked live findings:");
            expect(errorLines).toContain(
              '- packages/example/src/Example.ts :: equals [schema-policy-advisory] Exported schema-modeled equality helper "equals" should derive from S.toEquivalence(schema) unless comparison intentionally differs from schema semantics.'
            );
            const structuredIssueLine =
              '[schema-first:issue] {"category":"schema-first-policy","ruleId":"SFV4-equivalence",' +
              '"severity":"warning","file":"packages/example/src/Example.ts","line":6,' +
              '"symbol":"equals",' +
              '"message":"Exported schema-modeled equality helper \\"equals\\" should derive from S.toEquivalence(schema) unless comparison intentionally differs from schema semantics.",' +
              '"remediation":"Derive comparison from S.toEquivalence(schema) or SchemaUtils.toEquivalence(schema); use S.overrideToEquivalence only when schema semantics intentionally differ."}';
            expect(errorLines).toContain(structuredIssueLine);
          })
        ).pipe(provideScopedLayer(testLayer))
      ),
    5_000
  );

  it(
    "accepts schema-derived equivalence helpers without equivalence advisories",
    () =>
      Effect.runPromise(
        withTempWorkingDirectory(
          Effect.gen(function* () {
            yield* writeSchemaFirstSourceFixture([
              'import * as S from "effect/Schema";',
              'export class Worker extends S.Class<Worker>("Worker")({',
              "  id: S.String,",
              "  name: S.String,",
              "}) {}",
              "export const equals = S.toEquivalence(Worker);",
              "",
            ]);

            yield* runSchemaFirstAndExpectNoErrors();
          })
        ).pipe(provideScopedLayer(testLayer))
      ),
    5_000
  );

  it(
    "reports untracked SFV4 boundary-codec JSON.parse advisories",
    () =>
      Effect.runPromise(
        withTempWorkingDirectory(
          Effect.gen(function* () {
            yield* writeSchemaFirstSourceFixture([
              "export const parseConfig = (text: string) => {",
              "  return JSON.parse(text);",
              "};",
              "",
            ]);

            const exit = yield* Effect.exit(runLintCommand(["schema-first"]));

            const errorLines = yield* TestConsole.errorLines;
            expectReportedExit(exit);
            expect(errorLines).toContain("[schema-first] untracked live findings:");
            expect(errorLines).toContain(
              "- packages/example/src/Example.ts :: parseConfig.JSON.parse [schema-policy-advisory] Direct JSON.parse boundary should use S.UnknownFromJsonString or S.fromJsonString(schema) so parsing and validation stay schema-owned."
            );
            const structuredIssueLine =
              '[schema-first:issue] {"category":"schema-first-policy","ruleId":"SFV4-boundary-codec",' +
              '"severity":"warning","file":"packages/example/src/Example.ts","line":2,' +
              '"symbol":"parseConfig.JSON.parse",' +
              '"message":"Direct JSON.parse boundary should use S.UnknownFromJsonString or S.fromJsonString(schema) so parsing and validation stay schema-owned.",' +
              '"remediation":"Replace direct JSON.parse with S.UnknownFromJsonString or S.fromJsonString(schema) plus an Effect/Result/Option decoder, or inventory the exception when the protocol is intentionally non-standard."}';
            expect(errorLines).toContain(structuredIssueLine);
          })
        ).pipe(provideScopedLayer(testLayer))
      ),
    5_000
  );

  it(
    "accepts schema JSON codecs without boundary-codec advisories",
    () =>
      Effect.runPromise(
        withTempWorkingDirectory(
          Effect.gen(function* () {
            yield* writeSchemaFirstSourceFixture([
              'import * as S from "effect/Schema";',
              "export const decodeConfig = S.decodeUnknownEffect(S.UnknownFromJsonString);",
              "",
            ]);

            yield* runSchemaFirstAndExpectNoErrors();
          })
        ).pipe(provideScopedLayer(testLayer))
      ),
    5_000
  );

  it(
    "reports untracked SFV4 defaults parameter object advisories",
    () =>
      Effect.runPromise(
        withTempWorkingDirectory(
          Effect.gen(function* () {
            yield* writeSchemaFirstSourceFixture([
              'import * as S from "effect/Schema";',
              'export class WorkerOptions extends S.Class<WorkerOptions>("WorkerOptions")({',
              "  timeoutMs: S.Finite,",
              "}) {}",
              "export const runWorker = (params = { timeoutMs: 5000 }) => params.timeoutMs;",
              "",
            ]);

            const exit = yield* Effect.exit(runLintCommand(["schema-first"]));

            const errorLines = yield* TestConsole.errorLines;
            expectReportedExit(exit);
            expect(errorLines).toContain("[schema-first] untracked live findings:");
            expect(errorLines).toContain(
              '- packages/example/src/Example.ts :: runWorker.params [schema-policy-advisory] Parameter default object for "params" should move fallback values into schema defaults so construction, decoding, and tests share one source of truth.'
            );
            const structuredIssueLine =
              '[schema-first:issue] {"category":"schema-first-policy","ruleId":"SFV4-defaults",' +
              '"severity":"warning","file":"packages/example/src/Example.ts","line":5,' +
              '"symbol":"runWorker.params",' +
              '"message":"Parameter default object for \\"params\\" should move fallback values into schema defaults so construction, decoding, and tests share one source of truth.",' +
              '"remediation":"Move option/request fallback values into schema fields with S.withConstructorDefault, S.withDecodingDefault*, or SchemaUtils.withKeyDefaults; inventory the exception only when the fallback intentionally differs from schema construction semantics."}';
            expect(errorLines).toContain(structuredIssueLine);
          })
        ).pipe(provideScopedLayer(testLayer))
      ),
    5_000
  );

  it(
    "accepts schema-owned constructor defaults without defaults advisories",
    () =>
      Effect.runPromise(
        withTempWorkingDirectory(
          Effect.gen(function* () {
            yield* writeSchemaFirstSourceFixture([
              'import { Effect } from "effect";',
              'import * as S from "effect/Schema";',
              'export class WorkerOptions extends S.Class<WorkerOptions>("WorkerOptions")({',
              "  timeoutMs: S.Finite.pipe(S.withConstructorDefault(Effect.succeed(5000))),",
              "}) {}",
              "export const runWorker = (params = WorkerOptions.make({})) => params.timeoutMs;",
              "",
            ]);

            yield* runSchemaFirstAndExpectNoErrors();
          })
        ).pipe(provideScopedLayer(testLayer))
      ),
    5_000
  );

  it(
    "writes SFV4 numeric-domain advisories to the schema-first inventory",
    () =>
      Effect.runPromise(
        withTempWorkingDirectory(
          Effect.gen(function* () {
            yield* writeSchemaFirstSourceFixture([
              'import * as S from "effect/Schema";',
              'export class WorkerOptions extends S.Class<WorkerOptions>("WorkerOptions")({',
              "  timeoutMs: S.Number,",
              "  retryCount: S.Int,",
              "}) {}",
              "",
            ]);

            const fs = yield* FileSystem.FileSystem;
            const path = yield* Path.Path;

            yield* fs.makeDirectory("standards");
            const exit = yield* Effect.exit(runLintCommand(["schema-first", "--write"]));

            const inventory = yield* fs.readFileString(path.join("standards", "schema-first.inventory.jsonc"));
            const errorLines = yield* TestConsole.errorLines;
            expectReportedExit(exit);
            expect(errorLines).toContain("[schema-first] untracked live findings:");
            expect(errorLines).toContain("[schema-first] repo still contains advisory findings:");
            expect(inventory).toContain('"ruleId": "SFV4-numeric-domain"');
            expect(inventory).toContain('"symbol": "WorkerOptions.timeoutMs"');
            expect(inventory).not.toContain("retryCount");
          })
        ).pipe(provideScopedLayer(testLayer))
      ),
    5_000
  );

  it(
    "does not suppress S.Struct candidates when a same-named field variable feeds an unrelated class",
    () =>
      Effect.runPromise(
        withTempWorkingDirectory(
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            const path = yield* Path.Path;
            const exampleSourceDir = path.join("packages", "example", "src");
            const workspaceFiles: ReadonlyArray<readonly [string, string]> = [
              [
                "package.json",
                `${encodeJson({
                  name: "@beep/test-root",
                  private: true,
                  type: "module",
                  workspaces: ["packages/*"],
                })}\n`,
              ],
              ["tsconfig.json", `${encodeJson({ compilerOptions: {} })}\n`],
            ];

            yield* Effect.forEach(workspaceFiles, ([filePath, contents]) => fs.writeFileString(filePath, contents), {
              discard: true,
            });
            yield* fs.makeDirectory(exampleSourceDir, { recursive: true });
            yield* fs.writeFileString(
              path.join(exampleSourceDir, "Example.ts"),
              [
                'import * as S from "effect/Schema";',
                "const buildClass = () => {",
                "  const fields = { id: S.String };",
                '  return S.Class<any>("Worker")(fields);',
                "};",
                "const fields = S.Struct({ id: S.String });",
                "void buildClass;",
                "void fields;",
                "",
              ].join("\n")
            );

            const exit = yield* Effect.exit(runLintCommand(["schema-first"]));

            const errorLines = yield* TestConsole.errorLines;
            expectReportedExit(exit);
            expect(errorLines).toContain("[schema-first] untracked live findings:");
            expect(errorLines).toContain(
              "- packages/example/src/Example.ts :: fields [object-struct-schema] Object schema should prefer an annotated S.Class over S.Struct."
            );
          })
        ).pipe(provideScopedLayer(testLayer))
      ),
    5_000
  );
});

describe("package test import lint command", { concurrent: false }, () => {
  it(
    "reports same-package relative imports into src",
    () =>
      Effect.runPromise(
        withTempWorkingDirectory(
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            const path = yield* Path.Path;
            const packageDir = path.join("packages", "foundation", "modeling", "example");

            yield* writePackage(packageDir, "@beep/example");
            yield* fs.makeDirectory(path.join(packageDir, "test"), { recursive: true });
            yield* fs.writeFileString(
              path.join(packageDir, "test", "Example.test.ts"),
              `import { example } from "../src/index.ts";\nvoid example;\n`
            );

            const exit = yield* Effect.exit(runLintCommand(["package-test-imports"]));

            const errorLines = yield* TestConsole.errorLines;
            expectReportedExit(exit);
            expect(errorLines).toContain(
              "[check-package-test-imports] relative imports from package test/dtslint files into workspace src are not allowed. Use @beep/* package aliases."
            );
            expect(errorLines).toContain(
              "packages/foundation/modeling/example/test/Example.test.ts:1 ../src/index.ts -> @beep/example"
            );
          })
        ).pipe(provideScopedLayer(testLayer))
      ),
    5_000
  );

  it(
    "reports cross-package relative imports into src",
    () =>
      Effect.runPromise(
        withTempWorkingDirectory(
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            const path = yield* Path.Path;
            const producerDir = path.join("packages", "foundation", "modeling", "producer");
            const consumerDir = path.join("packages", "foundation", "modeling", "consumer");

            yield* writePackage(producerDir, "@beep/producer");
            yield* writePackage(consumerDir, "@beep/consumer");
            yield* fs.makeDirectory(path.join(consumerDir, "dtslint"), { recursive: true });
            yield* fs.writeFileString(
              path.join(consumerDir, "dtslint", "Consumer.tst.ts"),
              `import type { Producer } from "../../producer/src/Producer.ts";\ntype _ = Producer;\n`
            );

            const exit = yield* Effect.exit(runLintCommand(["package-test-imports"]));

            const errorLines = yield* TestConsole.errorLines;
            expectReportedExit(exit);
            expect(errorLines).toContain(
              "packages/foundation/modeling/consumer/dtslint/Consumer.tst.ts:1 ../../producer/src/Producer.ts -> @beep/producer/Producer"
            );
          })
        ).pipe(provideScopedLayer(testLayer))
      ),
    5_000
  );

  it(
    "allows relative imports to local test fixtures",
    () =>
      Effect.runPromise(
        withTempWorkingDirectory(
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            const path = yield* Path.Path;
            const packageDir = path.join("packages", "foundation", "modeling", "example");

            yield* writePackage(packageDir, "@beep/example");
            yield* fs.makeDirectory(path.join(packageDir, "test", "fixtures"), { recursive: true });
            yield* fs.writeFileString(
              path.join(packageDir, "test", "fixtures", "src-helper.ts"),
              "export const helper = 1;\n"
            );
            yield* fs.writeFileString(
              path.join(packageDir, "test", "Example.test.ts"),
              `import { helper } from "./fixtures/src-helper.ts";\nvoid helper;\n`
            );

            yield* runLintCommand(["package-test-imports"]);

            const logLines = yield* TestConsole.logLines;
            const errorLines = yield* TestConsole.errorLines;
            expect(logLines).toEqual([
              "[check-package-test-imports] OK: package test/dtslint imports use package aliases.",
            ]);
            expect(errorLines).toEqual([]);
          })
        ).pipe(provideScopedLayer(testLayer))
      ),
    5_000
  );

  it(
    "allows source test-kit files under src internal test directories",
    () =>
      Effect.runPromise(
        withTempWorkingDirectory(
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            const path = yield* Path.Path;
            const packageDir = path.join("packages", "foundation", "modeling", "example");

            yield* writePackage(packageDir, "@beep/example");
            yield* fs.makeDirectory(path.join(packageDir, "src", "internal", "test"), { recursive: true });
            yield* fs.writeFileString(
              path.join(packageDir, "src", "internal", "helper.ts"),
              "export const helper = 1;\n"
            );
            yield* fs.writeFileString(
              path.join(packageDir, "src", "internal", "test", "Example.test-kit.ts"),
              `import { helper } from "../helper.ts";\nvoid helper;\n`
            );

            yield* runLintCommand(["package-test-imports"]);

            const logLines = yield* TestConsole.logLines;
            const errorLines = yield* TestConsole.errorLines;
            expect(logLines).toEqual([
              "[check-package-test-imports] OK: package test/dtslint imports use package aliases.",
            ]);
            expect(errorLines).toEqual([]);
          })
        ).pipe(provideScopedLayer(testLayer))
      ),
    5_000
  );

  it(
    "allows internal package alias imports",
    () =>
      Effect.runPromise(
        withTempWorkingDirectory(
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            const path = yield* Path.Path;
            const packageDir = path.join("packages", "foundation", "modeling", "example");

            yield* writePackage(packageDir, "@beep/example");
            yield* fs.makeDirectory(path.join(packageDir, "test"), { recursive: true });
            yield* fs.writeFileString(
              path.join(packageDir, "test", "Example.test.ts"),
              `import { Hidden } from "@beep/example/internal/Hidden";\nvoid Hidden;\n`
            );

            yield* runLintCommand(["package-test-imports"]);

            const logLines = yield* TestConsole.logLines;
            const errorLines = yield* TestConsole.errorLines;
            expect(logLines).toEqual([
              "[check-package-test-imports] OK: package test/dtslint imports use package aliases.",
            ]);
            expect(errorLines).toEqual([]);
          })
        ).pipe(provideScopedLayer(testLayer))
      ),
    5_000
  );
});
