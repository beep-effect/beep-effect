import { lintCommand } from "@beep/repo-cli";
import { TSMorphServiceLive } from "@beep/repo-utils";
import { FsUtilsLive } from "@beep/repo-utils/FsUtils";
import { UnknownFromJsonString } from "@beep/schema/Unknown";
import { provideScopedLayer } from "@beep/test-utils";
import { A, Str } from "@beep/utils";
import { NodeServices } from "@effect/platform-node";
import { Effect, FileSystem, Layer, Path, pipe } from "effect";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as TestConsole from "effect/testing/TestConsole";
import { Command } from "effect/unstable/cli";
import { describe, expect, it } from "vitest";
import { expectReportedExit, withTempWorkingDirectory } from "./support/CommandTest.ts";

const runLintCommand = Command.runWith(lintCommand, { version: "0.0.0" });
const encodeJson = UnknownFromJsonString.encodeUnknownSync;
const deprecatedApiLintShards = [
  "apps/architecture-lab-proof",
  "apps/labs",
  "apps/oip-web",
  "apps/professional-desktop",
  "infra",
  "packages/_internal",
  "packages/agents",
  "packages/architecture-lab",
  "packages/drivers",
  "packages/ecosystem",
  "packages/epistemic/client",
  "packages/epistemic/config",
  "packages/epistemic/domain",
  "packages/epistemic/server",
  "packages/epistemic/tables",
  "packages/epistemic/ui",
  "packages/epistemic/use-cases",
  "packages/foundation/capability",
  "packages/foundation/modeling",
  "packages/foundation/primitive",
  "packages/foundation/ui-system",
  "packages/law-practice",
  "packages/shared",
  "packages/tooling/library",
  "packages/tooling/policy-pack",
  "packages/tooling/test-kit",
  "packages/tooling/tool",
  "packages/workspace",
];

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
  yield* fs.writeFileString("tsconfig.json", `${encodeJson({ compilerOptions: { strictNullChecks: true } })}\n`);
  yield* fs.makeDirectory(path.dirname(relativePath), { recursive: true });
  yield* fs.writeFileString(relativePath, sourceLines.join("\n"));
});

const writeSchemaFirstSourceFixture = Effect.fn("writeSchemaFirstSourceFixture")(function* (
  sourceLines: ReadonlyArray<string>
) {
  yield* writeSchemaFirstFileFixture("packages/example/src/Example.ts", sourceLines);
});

const writeDeprecatedApiLintFixture = Effect.fn("writeDeprecatedApiLintFixture")(function* (options?: {
  readonly failingShard?: string;
  readonly omitShard?: string;
}) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const failingShard = options?.failingShard;
  const shards = A.filter(deprecatedApiLintShards, (shard) => shard !== options?.omitShard);
  yield* Effect.forEach(shards, (shard) => fs.makeDirectory(shard, { recursive: true }), {
    concurrency: 4,
  });

  const eslintPath = path.join("node_modules", ".bin", "eslint");
  yield* fs.makeDirectory(path.dirname(eslintPath), { recursive: true });
  yield* fs.writeFileString(
    eslintPath,
    A.join(
      [
        "#!/usr/bin/env sh",
        ...(P.isUndefined(failingShard)
          ? A.empty<string>()
          : ['case "$*" in', `  *${failingShard}*) exit 7 ;;`, "esac"]),
        "exit 0",
        "",
      ],
      "\n"
    )
  );
  yield* fs.chmod(eslintPath, 0o755);
});

const argumentAfter = (line: string, argument: string): O.Option<string> => {
  const parts = Str.split(line, " ");
  return pipe(
    A.findFirstIndex(parts, Str.equivalence(argument)),
    O.flatMap((index) => A.get(parts, index + 1))
  );
};

describe("deprecated-apis lint command", { concurrent: false }, () => {
  it(
    "constructs unique content-cache shard commands at concurrency four",
    () =>
      Effect.runPromise(
        withTempWorkingDirectory(
          Effect.gen(function* () {
            yield* writeDeprecatedApiLintFixture();
            yield* runLintCommand(["deprecated-apis"]);

            const logLines = A.filter(yield* TestConsole.logLines, P.isString);
            const invocationLines = A.filter(
              logLines,
              (line) =>
                Str.startsWith("[lint:deprecated-apis] ")(line) && Str.includes(": ./node_modules/.bin/eslint ")(line)
            );
            const cacheLocations = A.getSomes(
              A.map(invocationLines, (line) => argumentAfter(line, "--cache-location"))
            );

            expect(logLines).toContain("[lint:deprecated-apis] running 28 shards with concurrency 4");
            expect(invocationLines).toHaveLength(28);
            expect(A.dedupe(cacheLocations)).toHaveLength(28);
            expect(A.every(invocationLines, (line) => Str.includes("--cache-strategy content")(line))).toBe(true);
            expect(
              A.every(cacheLocations, Str.startsWith("node_modules/.cache/eslint-deprecated-apis/.eslintcache-"))
            ).toBe(true);
          })
        ).pipe(provideScopedLayer(testLayer))
      ),
    10_000
  );

  it(
    "fails the aggregate when any shard exits nonzero",
    () =>
      Effect.runPromise(
        withTempWorkingDirectory(
          Effect.gen(function* () {
            yield* writeDeprecatedApiLintFixture({ failingShard: "packages/agents" });

            const exit = yield* Effect.exit(runLintCommand(["deprecated-apis"]));

            expectReportedExit(exit, 7);
            expect(A.filter(yield* TestConsole.logLines, P.isString)).not.toContain(
              "[lint:deprecated-apis] OK: no deprecated vendor API usage found."
            );
          })
        ).pipe(provideScopedLayer(testLayer))
      ),
    10_000
  );

  it(
    "skips the labs shard when the labs root is absent",
    () =>
      Effect.runPromise(
        withTempWorkingDirectory(
          Effect.gen(function* () {
            yield* writeDeprecatedApiLintFixture({ omitShard: "apps/labs" });
            yield* runLintCommand(["deprecated-apis"]);

            const logLines = A.filter(yield* TestConsole.logLines, P.isString);
            const invocationLines = A.filter(
              logLines,
              (line) =>
                Str.startsWith("[lint:deprecated-apis] ")(line) && Str.includes(": ./node_modules/.bin/eslint ")(line)
            );

            expect(logLines).toContain("[lint:deprecated-apis] skipping missing shard: apps/labs");
            expect(invocationLines).toHaveLength(27);
            expect(logLines).toContain("[lint:deprecated-apis] OK: no deprecated vendor API usage found.");
          })
        ).pipe(provideScopedLayer(testLayer))
      ),
    10_000
  );

  it(
    "passes --no-error-on-unmatched-pattern to the labs shard only",
    () =>
      Effect.runPromise(
        withTempWorkingDirectory(
          Effect.gen(function* () {
            yield* writeDeprecatedApiLintFixture();
            yield* runLintCommand(["deprecated-apis"]);

            const logLines = A.filter(yield* TestConsole.logLines, P.isString);
            const invocationLines = A.filter(
              logLines,
              (line) =>
                Str.startsWith("[lint:deprecated-apis] ")(line) && Str.includes(": ./node_modules/.bin/eslint ")(line)
            );
            const labsLines = A.filter(invocationLines, Str.startsWith("[lint:deprecated-apis] apps/labs: "));
            const flaggedLines = A.filter(invocationLines, Str.includes("--no-error-on-unmatched-pattern"));

            expect(labsLines).toHaveLength(1);
            expect(flaggedLines).toEqual(labsLines);
          })
        ).pipe(provideScopedLayer(testLayer))
      ),
    10_000
  );
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
      scope: ["apps/**/*.{ts,tsx}", "packages/**/*.{ts,tsx}", "infra/{src,test}/**/*.ts"],
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
              '"remediation":"Add a focused property test using S.toArbitrary(sourceSchema)(fc) and fast-check, or keep the inventory entry when the file is intentionally golden/snapshot/regression-only coverage."}';
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
              "const WorkerArbitrary = S.toArbitrary(Worker)(fc);",
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
              '"remediation":"Add a focused property test using S.toArbitrary(sourceSchema)(fc) and fast-check, or keep the inventory entry when the file is intentionally golden/snapshot/regression-only coverage."}';
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
    "reports S.TaggedError declarations without declared equivalence",
    () =>
      Effect.runPromise(
        withTempWorkingDirectory(
          Effect.gen(function* () {
            yield* writeSchemaFirstSourceFixture([
              'import * as S from "effect/Schema";',
              "export class WorkerError extends S.TaggedError<WorkerError>()(",
              '  "WorkerError",',
              "  { workerId: S.String },",
              '  { description: "Worker execution failed." }',
              ") {}",
              "",
            ]);

            const exit = yield* Effect.exit(runLintCommand(["schema-first"]));

            const logLines = yield* TestConsole.logLines;
            const errorLines = yield* TestConsole.errorLines;
            expectReportedExit(exit);
            expect(logLines).toContain("[schema-first] sfv4_tagged_error_equivalence_advisories=1");
            expect(errorLines).toContain("[schema-first] untracked live findings:");
            expect(errorLines).toContain(
              '- packages/example/src/Example.ts :: WorkerError [schema-policy-advisory] S.TaggedError declaration "WorkerError" must declare fields-only equivalence at the class declaration: pass $I.annoteError<WorkerError>(...) as its annotations (or a toEquivalence hook that adopts the declared struct equivalence). Otherwise declaration equivalence falls back to Equal.equals over Error runtime metadata, causing seed-dependent property flakes.'
            );
            const structuredIssueLine =
              '[schema-first:issue] {"category":"schema-first-policy","ruleId":"SFV4-tagged-error-equivalence",' +
              '"severity":"warning","file":"packages/example/src/Example.ts","line":2,' +
              '"symbol":"WorkerError",' +
              '"message":"S.TaggedError declaration \\"WorkerError\\" must declare fields-only equivalence at the class declaration: pass $I.annoteError<WorkerError>(...) as its annotations (or a toEquivalence hook that adopts the declared struct equivalence). Otherwise declaration equivalence falls back to Equal.equals over Error runtime metadata, causing seed-dependent property flakes.",' +
              '"remediation":"Annotate the class with $I.annoteError<Self>(...) so it adopts the declared struct equivalence; opaque causes use Defect from @beep/schema, which declares its own always-equal equivalence."}';
            expect(errorLines).toContain(structuredIssueLine);
          })
        ).pipe(provideScopedLayer(testLayer))
      ),
    5_000
  );

  it(
    "reports named effect/Schema TaggedError imports without declared equivalence",
    () =>
      Effect.runPromise(
        withTempWorkingDirectory(
          Effect.gen(function* () {
            yield* writeSchemaFirstFileFixture("packages/ecosystem/effect-drizzle/src/Example.ts", [
              'import { String as StringSchema, TaggedError } from "effect/Schema";',
              "export class WorkerError extends TaggedError<WorkerError>()(",
              '  "WorkerError",',
              "  { workerId: StringSchema },",
              '  { description: "Worker execution failed." }',
              ") {}",
              "",
            ]);

            const exit = yield* Effect.exit(runLintCommand(["schema-first"]));

            const logLines = yield* TestConsole.logLines;
            const errorLines = yield* TestConsole.errorLines;
            expectReportedExit(exit);
            expect(logLines).toContain("[schema-first] sfv4_tagged_error_equivalence_advisories=1");
            expect(errorLines).toContain(
              '- packages/ecosystem/effect-drizzle/src/Example.ts :: WorkerError [schema-policy-advisory] S.TaggedError declaration "WorkerError" must declare fields-only equivalence at the class declaration: pass $I.annoteError<WorkerError>(...) as its annotations (or a toEquivalence hook that adopts the declared struct equivalence). Otherwise declaration equivalence falls back to Equal.equals over Error runtime metadata, causing seed-dependent property flakes.'
            );
          })
        ).pipe(provideScopedLayer(testLayer))
      ),
    5_000
  );

  it(
    "ignores unrelated local TaggedError factories",
    () =>
      Effect.runPromise(
        withTempWorkingDirectory(
          Effect.gen(function* () {
            yield* writeSchemaFirstSourceFixture([
              "const TaggedError = <Self>() => (_tag: string, _fields: unknown) => class {};",
              'class LocalError extends TaggedError<LocalError>()("LocalError", {}) {}',
              "void LocalError;",
              "",
            ]);

            yield* runSchemaFirstAndExpectNoErrors();
          })
        ).pipe(provideScopedLayer(testLayer))
      ),
    5_000
  );

  it(
    "accepts direct and annoteClass tagged-error equivalence annotations",
    () =>
      Effect.runPromise(
        withTempWorkingDirectory(
          Effect.gen(function* () {
            yield* writeSchemaFirstSourceFixture([
              'import * as S from "effect/Schema";',
              "const sameWorkerError = (_self: WorkerError, _that: WorkerError): boolean => true;",
              "export class WorkerError extends S.TaggedError<WorkerError>()(",
              '  "WorkerError",',
              "  { workerId: S.String },",
              '  { description: "Worker execution failed.", toEquivalence: () => sameWorkerError }',
              ") {}",
              "const sameTaskError = (_self: TaskError, _that: TaskError): boolean => true;",
              "const taskErrorAnnotations = { toEquivalence: () => sameTaskError };",
              "class TaskError extends S.TaggedError<TaskError>()(",
              '  "TaskError",',
              "  { taskId: S.String },",
              '  $I.annoteClass("TaskError", taskErrorAnnotations)',
              ") {}",
              "void TaskError;",
              "",
            ]);

            yield* runSchemaFirstAndExpectNoErrors();
          })
        ).pipe(provideScopedLayer(testLayer))
      ),
    5_000
  );

  it(
    "accepts annoteError tagged-error annotations",
    () =>
      Effect.runPromise(
        withTempWorkingDirectory(
          Effect.gen(function* () {
            yield* writeSchemaFirstSourceFixture([
              'import * as S from "effect/Schema";',
              "export class WorkerError extends S.TaggedError<WorkerError>()(",
              '  "WorkerError",',
              "  { workerId: S.String },",
              '  $I.annoteError<WorkerError>("WorkerError", { description: "Worker execution failed." })',
              ") {}",
              "",
            ]);

            yield* runSchemaFirstAndExpectNoErrors();
          })
        ).pipe(provideScopedLayer(testLayer))
      ),
    5_000
  );

  it(
    "preserves existing tagged-error exceptions without excepting new write findings",
    () =>
      Effect.runPromise(
        withTempWorkingDirectory(
          Effect.gen(function* () {
            yield* writeSchemaFirstSourceFixture([
              'import * as S from "effect/Schema";',
              "export class ExistingError extends S.TaggedError<ExistingError>()(",
              '  "ExistingError",',
              "  { workerId: S.String },",
              '  { description: "Existing documented failure." }',
              ") {}",
              "export class WorkerError extends S.TaggedError<WorkerError>()(",
              '  "WorkerError",',
              "  { workerId: S.String },",
              '  { description: "Worker execution failed." }',
              ") {}",
              "",
            ]);

            const fs = yield* FileSystem.FileSystem;
            yield* fs.makeDirectory("standards");
            yield* fs.writeFileString(
              "standards/schema-first.inventory.jsonc",
              `${encodeJson({
                version: 1,
                generatedOn: "2026-06-08",
                scope: ["apps/**/*.{ts,tsx}", "packages/**/*.{ts,tsx}", "infra/{src,test}/**/*.ts"],
                entries: [
                  {
                    file: "packages/example/src/Example.ts",
                    symbol: "ExistingError",
                    kind: "schema-policy-advisory",
                    status: "exception",
                    ruleId: "SFV4-tagged-error-equivalence",
                    line: 2,
                    owner: "@beep/example",
                    reason: "Existing documented exception.",
                  },
                ],
              })}\n`
            );

            const exit = yield* Effect.exit(runLintCommand(["schema-first", "--write"]));
            expectReportedExit(exit);

            const inventory = yield* fs.readFileString("standards/schema-first.inventory.jsonc");
            expect(inventory).toContain(
              '"symbol": "ExistingError",\n      "kind": "schema-policy-advisory",\n      "status": "exception"'
            );
            expect(inventory).toContain(
              '"symbol": "WorkerError",\n      "kind": "schema-policy-advisory",\n      "status": "advisory"'
            );
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
              "- packages/example/src/Example.ts :: parseConfig.JSON.parse [schema-policy-advisory] Direct JSON.parse boundary should use S.fromJsonString(schema) so parsing and validation stay schema-owned."
            );
            const structuredIssueLine =
              '[schema-first:issue] {"category":"schema-first-policy","ruleId":"SFV4-boundary-codec",' +
              '"severity":"warning","file":"packages/example/src/Example.ts","line":2,' +
              '"symbol":"parseConfig.JSON.parse",' +
              '"message":"Direct JSON.parse boundary should use S.fromJsonString(schema) so parsing and validation stay schema-owned.",' +
              '"remediation":"Replace direct JSON.parse with S.fromJsonString(schema) plus an Effect/Result/Option decoder, or inventory the exception when the protocol is intentionally non-standard."}';
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
              "const UnknownFromJsonString = S.fromJsonString(S.Unknown);",
              "export const decodeConfig = S.decodeUnknownEffect(UnknownFromJsonString);",
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
    "filters generic and wholly runtime declarations before inventory comparison",
    () =>
      Effect.runPromise(
        withTempWorkingDirectory(
          Effect.gen(function* () {
            yield* writeSchemaFirstSourceFixture([
              "interface BaseData { readonly inheritedId: string }",
              "interface GenericBase<Value> { readonly value: Value }",
              "interface AstNode { readonly type: string }",
              "declare namespace O {",
              '  type Option<Value> = { readonly _tag: "None" } | { readonly _tag: "Some"; readonly value: Value };',
              "}",
              "declare namespace pulumi { type Input<Value> = Value | Promise<Value> }",
              "export interface Generic<Value> { readonly value: Value }",
              "export interface GenericDerived<Value extends string = string> extends GenericBase<Value> {}",
              "export type GenericAlias<Value = string> = { readonly value: Value };",
              "export type PureAlias = { readonly id: string };",
              "export type RuntimeAlias = { readonly node: AstNode; readonly visit: () => void };",
              "export interface RuntimeOnly {",
              "  readonly layer: Layer.Layer<never>;",
              "  readonly run: (input: string) => Effect.Effect<void>;",
              "}",
              "interface D3Only extends d3.SimulationNodeDatum {}",
              "export { D3Only };",
              "export interface D3Mixed extends d3.SimulationNodeDatum { readonly id: string }",
              "export interface OptionalRuntimeOnly {",
              "  readonly signal?: AbortSignal;",
              "  readonly secret?: pulumi.Input<string>;",
              "}",
              "export interface RpcRuntimeOnly {",
              '  readonly client: RpcClient.Protocol["Service"];',
              "  readonly incoming: Stream.Stream<string>;",
              "  readonly notify: { (value: string): Effect.Effect<void> };",
              "}",
              "export type AstTraversal = {",
              "  readonly object: O.Option<AstNode>;",
              "  readonly property: AstNode | null;",
              "};",
              "export interface RuntimeContainers {",
              "  readonly array: ReadonlyArray<AstNode>;",
              "  readonly mutableArray: AstNode[];",
              "  readonly tuple: readonly [AstNode];",
              "  readonly set: ReadonlySet<AstNode>;",
              "}",
              "export interface PrimitiveContainers {",
              "  readonly array: ReadonlyArray<string>;",
              "  readonly mutableArray: number[];",
              "  readonly tuple: readonly [string, number];",
              "  readonly map: ReadonlyMap<string, number>;",
              "}",
              "export type RuntimeRecord = { readonly values: Readonly<Record<string, AstNode>> };",
              "export type PrimitiveRecord = { readonly values: Readonly<Record<string, string>> };",
              "export interface MixedContract {",
              "  readonly id: string;",
              "  readonly run: () => Effect.Effect<void>;",
              "}",
              "export interface CallableOnly { (): void }",
              "export interface CallableMixed { (): void; readonly id: string }",
              "export interface ConstructOnly { new (): RuntimeOnly }",
              "export interface ConstructMixed { new (): RuntimeOnly; readonly id: string }",
              "export interface UnionMixed { readonly state: string | AbortSignal }",
              "export interface NestedMixed {",
              "  readonly state: { readonly id: string; readonly signal: AbortSignal };",
              "}",
              "export interface ImmutableCollections {",
              "  readonly map: HashMap.HashMap<string, string>;",
              "  readonly set: HashSet.HashSet<string>;",
              "}",
              "declare function makePayload(): { readonly id: string };",
              "export interface ReturnTypePayload { readonly payload: ReturnType<typeof makePayload> }",
              "class SchemaFlags { readonly enabled!: boolean }",
              "export interface InheritedMixed extends SchemaFlags { readonly run: () => Effect.Effect<void> }",
              "export interface DerivedData extends BaseData {}",
              "export interface BinaryPayload { readonly bytes: Uint8Array }",
              "export interface JournalPayload { readonly entry: EventJournal.Entry }",
              "export interface SuccessPayload { readonly success: Effect.Success<string, Error> }",
              "export interface ResultPayload { readonly result: OperationResult }",
              "export interface SchemaOwned { readonly id: string }",
              'export const SchemaOwned: SchemaOwned = Field({ id: "schema" });',
              "",
            ]);

            const fs = yield* FileSystem.FileSystem;
            const path = yield* Path.Path;
            yield* fs.makeDirectory("standards");
            const exit = yield* Effect.exit(runLintCommand(["schema-first", "--write"]));
            const inventory = yield* fs.readFileString(path.join("standards", "schema-first.inventory.jsonc"));

            expectReportedExit(exit);
            expect(inventory).toContain('"symbol": "MixedContract"');
            expect(inventory).toContain('"symbol": "D3Mixed"');
            expect(inventory).toContain('"symbol": "CallableMixed"');
            expect(inventory).toContain('"symbol": "ConstructMixed"');
            expect(inventory).toContain('"symbol": "UnionMixed"');
            expect(inventory).toContain('"symbol": "NestedMixed"');
            expect(inventory).toContain('"symbol": "ImmutableCollections"');
            expect(inventory).toContain('"symbol": "ReturnTypePayload"');
            expect(inventory).toContain('"symbol": "InheritedMixed"');
            expect(inventory).toContain('"symbol": "PrimitiveContainers"');
            expect(inventory).toContain('"symbol": "PrimitiveRecord"');
            expect(inventory).toContain('"symbol": "DerivedData"');
            expect(inventory).toContain('"symbol": "BinaryPayload"');
            expect(inventory).toContain('"symbol": "JournalPayload"');
            expect(inventory).toContain('"symbol": "SuccessPayload"');
            expect(inventory).toContain('"symbol": "ResultPayload"');
            expect(inventory).toContain('"symbol": "PureAlias"');
            expect(inventory).not.toContain('"symbol": "Generic"');
            expect(inventory).not.toContain('"symbol": "GenericDerived"');
            expect(inventory).not.toContain('"symbol": "GenericAlias"');
            expect(inventory).not.toContain('"symbol": "CallableOnly"');
            expect(inventory).not.toContain('"symbol": "ConstructOnly"');
            expect(inventory).not.toContain('"symbol": "OptionalRuntimeOnly"');
            expect(inventory).not.toContain('"symbol": "RpcRuntimeOnly"');
            expect(inventory).not.toContain('"symbol": "AstTraversal"');
            expect(inventory).not.toContain('"symbol": "RuntimeContainers"');
            expect(inventory).not.toContain('"symbol": "RuntimeRecord"');
            expect(inventory).not.toContain('"symbol": "RuntimeOnly"');
            expect(inventory).not.toContain('"symbol": "D3Only"');
            expect(inventory).not.toContain('"symbol": "RuntimeAlias"');
            expect(inventory).not.toContain('"symbol": "SchemaOwned"');
          })
        ).pipe(provideScopedLayer(testLayer))
      ),
    5_000
  );

  it(
    "limits normalization advisories to exported schema-boundary helpers",
    () =>
      Effect.runPromise(
        withTempWorkingDirectory(
          Effect.gen(function* () {
            yield* writeSchemaFirstSourceFixture([
              'import * as S from "effect/Schema";',
              "const Model = S.Struct({ value: S.String });",
              "const privateToken = (value: string): string => value.toLowerCase();",
              "const unrelated = (value: string): string => value.trim();",
              "const normalizeValue = (input: unknown): string =>",
              "  S.decodeUnknownSync(Model)(input).value.trim();",
              "class Normalizer {",
              "  public normalize(input: unknown): string {",
              "    return S.decodeUnknownSync(Model)(input).value.toUpperCase();",
              "  }",
              "  private privateNormalize(input: unknown): string {",
              "    return S.decodeUnknownSync(Model)(input).value.toLowerCase();",
              "  }",
              "  protected protectedNormalize(input: unknown): string {",
              "    return S.decodeUnknownSync(Model)(input).value.trim();",
              "  }",
              "}",
              "export { Normalizer, normalizeValue, unrelated };",
              "void privateToken;",
              "",
            ]);

            const fs = yield* FileSystem.FileSystem;
            const path = yield* Path.Path;
            yield* fs.makeDirectory("standards");
            const exit = yield* Effect.exit(runLintCommand(["schema-first", "--write"]));
            const inventory = yield* fs.readFileString(path.join("standards", "schema-first.inventory.jsonc"));

            expectReportedExit(exit);
            expect(inventory).toContain('"symbol": "normalizeValue.trim"');
            expect(inventory).toContain('"symbol": "Normalizer.toUpperCase"');
            expect(inventory).not.toContain("privateToken.toLowerCase");
            expect(inventory).not.toContain("unrelated.trim");
            expect(inventory).not.toContain("privateNormalize");
            expect(inventory).not.toContain("protectedNormalize");
            expect(inventory).not.toContain("Normalizer.toLowerCase");
          })
        ).pipe(provideScopedLayer(testLayer))
      ),
    5_000
  );

  it(
    "omits render contracts without hiding pure data declared in TSX",
    () =>
      Effect.runPromise(
        withTempWorkingDirectory(
          Effect.gen(function* () {
            yield* writeSchemaFirstFileFixture("packages/example/src/Example.tsx", [
              "export interface WidgetProps {",
              "  readonly label: string;",
              "  readonly children: React.ReactNode;",
              "}",
              "export type PanelProps = { readonly title: string };",
              "export interface DataPayload { readonly id: string }",
              "",
            ]);
            const fs = yield* FileSystem.FileSystem;
            yield* fs.writeFileString(
              "packages/example/src/ReactProps.ts",
              [
                'import type React from "react";',
                "export type RendererProps = {",
                "  readonly title: string;",
                "  readonly component: React.FunctionComponent;",
                "};",
                "",
              ].join("\n")
            );

            yield* fs.makeDirectory("standards");
            const exit = yield* Effect.exit(runLintCommand(["schema-first", "--write"]));
            const inventory = yield* fs.readFileString("standards/schema-first.inventory.jsonc");

            expectReportedExit(exit);
            expect(inventory).toContain('"symbol": "DataPayload"');
            expect(inventory).not.toContain('"symbol": "WidgetProps"');
            expect(inventory).not.toContain('"symbol": "PanelProps"');
            expect(inventory).not.toContain('"symbol": "RendererProps"');
          })
        ).pipe(provideScopedLayer(testLayer))
      ),
    5_000
  );

  it(
    "recognizes local export lists for declarations, schema companions, structs, and functions",
    () =>
      Effect.runPromise(
        withTempWorkingDirectory(
          Effect.gen(function* () {
            yield* writeSchemaFirstSourceFixture([
              'import * as S from "effect/Schema";',
              "interface ListedData { readonly id: string }",
              "type ListedAlias = { readonly id: string };",
              "interface AliasedData { readonly id: string }",
              "export default interface DefaultData { readonly id: string }",
              "interface ListedSchemaOwned { readonly id: string }",
              'class ListedSchemaOwned extends S.Class<ListedSchemaOwned>("ListedSchemaOwned")({',
              "  id: S.String,",
              "}) {}",
              "const ListedStruct = S.Struct({ id: S.String });",
              "const AliasedStruct = S.Struct({ id: S.String });",
              "function listedFunction(input: { readonly id: string }): void { void input; }",
              "function aliasedFunction(input: { readonly id: string }): void { void input; }",
              "const listedArrow = (input: { readonly id: string }): void => { void input; };",
              "export {",
              "  AliasedData as PublicData,",
              "  AliasedStruct as PublicStruct,",
              "  ListedAlias,",
              "  ListedData,",
              "  ListedSchemaOwned,",
              "  ListedStruct,",
              "  aliasedFunction as publicFunction,",
              "  listedArrow,",
              "  listedFunction,",
              "};",
              "",
            ]);

            const fs = yield* FileSystem.FileSystem;
            yield* fs.makeDirectory("standards");
            const exit = yield* Effect.exit(runLintCommand(["schema-first", "--write"]));
            const inventory = yield* fs.readFileString("standards/schema-first.inventory.jsonc");

            expectReportedExit(exit);
            expect(inventory).toContain('"symbol": "ListedData"');
            expect(inventory).toContain('"symbol": "ListedAlias"');
            expect(inventory).toContain('"symbol": "AliasedData"');
            expect(inventory).toContain('"symbol": "DefaultData"');
            expect(inventory).toContain('"symbol": "ListedStruct"');
            expect(inventory).toContain('"symbol": "AliasedStruct"');
            expect(inventory).toContain('"symbol": "listedFunction"');
            expect(inventory).toContain('"symbol": "aliasedFunction"');
            expect(inventory).toContain('"symbol": "listedArrow"');
            expect(inventory).not.toContain('"symbol": "ListedSchemaOwned"');
          })
        ).pipe(provideScopedLayer(testLayer))
      ),
    5_000
  );

  it(
    "recognizes anonymous direct default exports with stable fallback symbols",
    () =>
      Effect.runPromise(
        withTempWorkingDirectory(
          Effect.gen(function* () {
            yield* writeSchemaFirstFileFixture("packages/example/src/DefaultInterface.ts", [
              "export default interface { readonly id: string }",
              "",
            ]);
            const fs = yield* FileSystem.FileSystem;
            yield* fs.writeFileString(
              "packages/example/src/DefaultFunction.ts",
              [
                'import * as S from "effect/Schema";',
                "const Model = S.Struct({ id: S.String });",
                "export default function(input: { readonly id: string }): void { void input; }",
                "void Model;",
                "",
              ].join("\n")
            );
            yield* fs.writeFileString(
              "packages/example/src/DefaultArrow.ts",
              [
                'import * as S from "effect/Schema";',
                "const Model = S.Struct({ id: S.String });",
                "export default (input: { readonly id: string }): void => { void input; };",
                "void Model;",
                "",
              ].join("\n")
            );
            yield* fs.writeFileString(
              "packages/example/src/DefaultStruct.ts",
              ['import * as S from "effect/Schema";', "export default S.Struct({ id: S.String });", ""].join("\n")
            );

            yield* fs.makeDirectory("standards");
            const exit = yield* Effect.exit(runLintCommand(["schema-first", "--write"]));
            const inventory = yield* fs.readFileString("standards/schema-first.inventory.jsonc");

            expectReportedExit(exit);
            expect(inventory.match(/"symbol": "default@\d+"/g)).toHaveLength(4);
            expect(inventory).not.toContain('"symbol": ""');
          })
        ).pipe(provideScopedLayer(testLayer))
      ),
    5_000
  );

  it(
    "inventories only exported top-level plain S.Struct object models",
    () =>
      Effect.runPromise(
        withTempWorkingDirectory(
          Effect.gen(function* () {
            yield* writeSchemaFirstSourceFixture([
              'import * as S from "effect/Schema";',
              "const fields = { id: S.String };",
              "const internal = S.Struct({ id: S.String });",
              "const nested = S.Struct({ child: S.Struct({ id: S.String }) });",
              "const dynamic = S.Struct(fields);",
              "const spread = S.Struct({ ...fields });",
              "export const build = () => S.Struct({ id: S.String });",
              "export const PublicModel = S.Struct({ id: S.String });",
              "void internal;",
              "void nested;",
              "void dynamic;",
              "void spread;",
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
            expect(inventory).toContain('"symbol": "PublicModel"');
            expect(inventory).not.toContain('"symbol": "internal"');
            expect(inventory).not.toContain('"symbol": "nested"');
            expect(inventory).not.toContain('"symbol": "dynamic"');
            expect(inventory).not.toContain('"symbol": "spread"');
            expect(inventory).not.toContain('"symbol": "build"');
          })
        ).pipe(provideScopedLayer(testLayer))
      ),
    5_000
  );
});

describe("package test import lint command", { concurrent: false }, () => {
  it("rejects conflicting and out-of-package scan scopes", () =>
    Effect.runPromise(
      withTempWorkingDirectory(
        Effect.gen(function* () {
          const conflicting = yield* Effect.exit(
            runLintCommand([
              "package-test-imports",
              "--include",
              "packages/example/test/Example.test.ts",
              "--include-root",
              "packages/example",
            ])
          );
          const outside = yield* Effect.exit(runLintCommand(["package-test-imports", "--include-root", "standards"]));

          expectReportedExit(conflicting);
          expectReportedExit(outside);
        })
      ).pipe(provideScopedLayer(testLayer))
    ));

  it(
    "scopes the scan to one package root",
    () =>
      Effect.runPromise(
        withTempWorkingDirectory(
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            const path = yield* Path.Path;
            const selected = path.join("packages", "foundation", "modeling", "selected");
            const ignored = path.join("packages", "foundation", "modeling", "ignored");

            yield* writePackage(selected, "@beep/selected");
            yield* writePackage(ignored, "@beep/ignored");
            yield* fs.makeDirectory(path.join(ignored, "test"), { recursive: true });
            yield* fs.writeFileString(
              path.join(ignored, "test", "Ignored.test.ts"),
              `import { ignored } from "../src/index.ts";\nvoid ignored;\n`
            );

            yield* runLintCommand(["package-test-imports", "--include-root", selected]);

            expect(yield* TestConsole.logLines).toEqual([
              "[check-package-test-imports] OK: package test imports use package aliases.",
            ]);
            expect(yield* TestConsole.errorLines).toEqual([]);
          })
        ).pipe(provideScopedLayer(testLayer))
      ),
    5_000
  );

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
              "[check-package-test-imports] relative imports from package test files into workspace src are not allowed. Use @beep/* package aliases."
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
            expect(logLines).toEqual(["[check-package-test-imports] OK: package test imports use package aliases."]);
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
            expect(logLines).toEqual(["[check-package-test-imports] OK: package test imports use package aliases."]);
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
            expect(logLines).toEqual(["[check-package-test-imports] OK: package test imports use package aliases."]);
            expect(errorLines).toEqual([]);
          })
        ).pipe(provideScopedLayer(testLayer))
      ),
    5_000
  );
});

const BASELINE_FILE = "baseline.jsonc";

const blindSpotBaselineText = (input: {
  readonly findings: ReadonlyArray<{
    readonly package: string;
    readonly directory: string;
    readonly kind: string;
  }>;
  readonly notes?: Readonly<Record<string, string>>;
}): string =>
  `${encodeJson({
    schema_version: 1,
    command: "bun run beep lint package-test-typecheck",
    regeneration_command: "bun run beep lint package-test-typecheck --write-baseline",
    comparison: "fail-on-growth: every blind-spot package must already be listed in the committed baseline",
    new_package_handling: "New packages are compliant by construction.",
    notes: input.notes ?? {},
    check: {
      total_findings: A.length(input.findings),
      missing_test_tsconfig: A.length(A.filter(input.findings, (f) => f.kind === "missing-test-tsconfig")),
      unwired_test_tsconfig: A.length(A.filter(input.findings, (f) => f.kind === "unwired-test-tsconfig")),
    },
    findings: input.findings,
  })}\n`;

const writeTestTypecheckPackage = Effect.fn("writeTestTypecheckPackage")(function* (input: {
  readonly directory: string;
  readonly name: string;
  readonly scripts: Readonly<Record<string, string>>;
  readonly tsconfigs: ReadonlyArray<{ readonly fileName: string; readonly include: ReadonlyArray<string> }>;
}) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;

  yield* fs.makeDirectory(path.join(input.directory, "src"), { recursive: true });
  yield* fs.makeDirectory(path.join(input.directory, "test"), { recursive: true });
  yield* fs.writeFileString(
    path.join(input.directory, "package.json"),
    `${encodeJson({ name: input.name, version: "0.0.0", type: "module", scripts: input.scripts })}\n`
  );
  yield* fs.writeFileString(path.join(input.directory, "src", "index.ts"), "export const example = 1;\n");
  yield* fs.writeFileString(
    path.join(input.directory, "test", "Example.test.ts"),
    'import { example } from "@beep/example";\nvoid example;\n'
  );

  yield* Effect.forEach(
    input.tsconfigs,
    Effect.fnUntraced(function* (config) {
      yield* fs.writeFileString(
        path.join(input.directory, config.fileName),
        `${encodeJson({ include: config.include })}\n`
      );
    })
  );
});

describe("package test-typecheck lint command", { concurrent: false }, () => {
  it(
    "reports a package whose check script never typechecks its test sources",
    () =>
      Effect.runPromise(
        withTempWorkingDirectory(
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;

            yield* writeTestTypecheckPackage({
              directory: "packages/example",
              name: "@beep/example",
              scripts: { check: "bun run beep:check", "beep:check": "tsgo -b tsconfig.json" },
              tsconfigs: [{ fileName: "tsconfig.json", include: ["src"] }],
            });
            yield* fs.writeFileString(BASELINE_FILE, blindSpotBaselineText({ findings: [] }));

            const exit = yield* Effect.exit(runLintCommand(["package-test-typecheck", "--baseline", BASELINE_FILE]));

            const errorLines = yield* TestConsole.errorLines;
            expectReportedExit(exit);
            expect(errorLines.join("\n")).toContain("  - @beep/example (packages/example) [missing-test-tsconfig]");
          })
        ).pipe(provideScopedLayer(testLayer))
      ),
    15_000
  );

  it(
    "accepts a package whose check script transitively runs a test-covering project",
    () =>
      Effect.runPromise(
        withTempWorkingDirectory(
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;

            yield* writeTestTypecheckPackage({
              directory: "packages/example",
              name: "@beep/example",
              scripts: {
                check: "bun run beep:check",
                "beep:check": "tsgo -b tsconfig.json && bun run beep:check:tests",
                "beep:check:tests": "tsgo -p tsconfig.test.json --noEmit",
              },
              tsconfigs: [
                { fileName: "tsconfig.json", include: ["src"] },
                { fileName: "tsconfig.test.json", include: ["src", "test"] },
              ],
            });
            yield* fs.writeFileString(BASELINE_FILE, blindSpotBaselineText({ findings: [] }));

            yield* runLintCommand(["package-test-typecheck", "--baseline", BASELINE_FILE]);

            const logLines = yield* TestConsole.logLines;
            expect(logLines).toEqual(["[package-test-typecheck] ok: current=0 baseline=0 introduced=0"]);
          })
        ).pipe(provideScopedLayer(testLayer))
      ),
    15_000
  );

  it(
    "reports a test-covering project the check script never runs",
    () =>
      Effect.runPromise(
        withTempWorkingDirectory(
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;

            yield* writeTestTypecheckPackage({
              directory: "packages/example",
              name: "@beep/example",
              scripts: {
                check: "bun run beep:check",
                "beep:check": "tsgo -b tsconfig.json",
                "beep:check:tests": "tsgo -p tsconfig.test.json --noEmit",
              },
              tsconfigs: [
                { fileName: "tsconfig.json", include: ["src"] },
                { fileName: "tsconfig.test.json", include: ["src", "test"] },
              ],
            });
            yield* fs.writeFileString(BASELINE_FILE, blindSpotBaselineText({ findings: [] }));

            const exit = yield* Effect.exit(runLintCommand(["package-test-typecheck", "--baseline", BASELINE_FILE]));

            const errorLines = yield* TestConsole.errorLines;
            expectReportedExit(exit);
            expect(errorLines.join("\n")).toContain("  - @beep/example (packages/example) [unwired-test-tsconfig]");
          })
        ).pipe(provideScopedLayer(testLayer))
      ),
    15_000
  );

  it(
    "does not treat compiler names echoed as script text as test typechecking",
    () =>
      Effect.runPromise(
        withTempWorkingDirectory(
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;

            yield* writeTestTypecheckPackage({
              directory: "packages/example",
              name: "@beep/example",
              scripts: {
                check: "bun run beep:check",
                "beep:check": 'echo "tsgo -p tsconfig.test.json --noEmit" && tsgo -b tsconfig.json',
              },
              tsconfigs: [
                { fileName: "tsconfig.json", include: ["src"] },
                { fileName: "tsconfig.test.json", include: ["src", "test"] },
              ],
            });
            yield* fs.writeFileString(BASELINE_FILE, blindSpotBaselineText({ findings: [] }));

            const exit = yield* Effect.exit(runLintCommand(["package-test-typecheck", "--baseline", BASELINE_FILE]));

            const errorLines = yield* TestConsole.errorLines;
            expectReportedExit(exit);
            expect(errorLines.join("\n")).toContain("  - @beep/example (packages/example) [unwired-test-tsconfig]");
          })
        ).pipe(provideScopedLayer(testLayer))
      ),
    15_000
  );

  it(
    "treats a baselined blind spot as green",
    () =>
      Effect.runPromise(
        withTempWorkingDirectory(
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;

            yield* writeTestTypecheckPackage({
              directory: "packages/example",
              name: "@beep/example",
              scripts: { check: "bun run beep:check", "beep:check": "tsgo -b tsconfig.json" },
              tsconfigs: [{ fileName: "tsconfig.json", include: ["src"] }],
            });
            yield* fs.writeFileString(
              BASELINE_FILE,
              blindSpotBaselineText({
                findings: [{ package: "@beep/example", directory: "packages/example", kind: "missing-test-tsconfig" }],
              })
            );

            yield* runLintCommand(["package-test-typecheck", "--baseline", BASELINE_FILE]);

            const logLines = yield* TestConsole.logLines;
            expect(logLines).toEqual(["[package-test-typecheck] ok: current=1 baseline=1 introduced=0"]);
          })
        ).pipe(provideScopedLayer(testLayer))
      ),
    15_000
  );

  it(
    "reports a tail-filtered include that leaves a sibling helper unselected",
    () =>
      Effect.runPromise(
        withTempWorkingDirectory(
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            const path = yield* Path.Path;

            // `test/**/*.test.ts` selects the test files but not the helper
            // sitting beside them, so the helper is never typechecked.
            yield* writeTestTypecheckPackage({
              directory: "packages/example",
              name: "@beep/example",
              scripts: {
                check: "bun run beep:check",
                "beep:check": "tsgo -b tsconfig.json && bun run beep:check:tests",
                "beep:check:tests": "tsgo -p tsconfig.test.json --noEmit",
              },
              tsconfigs: [
                { fileName: "tsconfig.json", include: ["src"] },
                { fileName: "tsconfig.test.json", include: ["src", "test/**/*.test.ts"] },
              ],
            });
            yield* fs.makeDirectory(path.join("packages", "example", "test", "support"), { recursive: true });
            yield* fs.writeFileString(
              path.join("packages", "example", "test", "support", "Helper.ts"),
              "export const helper = 1;\n"
            );
            yield* fs.writeFileString(BASELINE_FILE, blindSpotBaselineText({ findings: [] }));

            const exit = yield* Effect.exit(runLintCommand(["package-test-typecheck", "--baseline", BASELINE_FILE]));

            const errorLines = yield* TestConsole.errorLines;
            expectReportedExit(exit);
            expect(errorLines.join("\n")).toContain("  - @beep/example (packages/example) [missing-test-tsconfig]");
          })
        ).pipe(provideScopedLayer(testLayer))
      ),
    15_000
  );

  it(
    "accepts a tail-filtered include when it selects every test source",
    () =>
      Effect.runPromise(
        withTempWorkingDirectory(
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;

            // Same glob shape as the case above; here every test source is a
            // .test.ts file, so nothing is left unselected.
            yield* writeTestTypecheckPackage({
              directory: "packages/example",
              name: "@beep/example",
              scripts: {
                check: "bun run beep:check",
                "beep:check": "tsgo -b tsconfig.json && bun run beep:check:tests",
                "beep:check:tests": "tsgo -p tsconfig.test.json --noEmit",
              },
              tsconfigs: [
                { fileName: "tsconfig.json", include: ["src"] },
                { fileName: "tsconfig.test.json", include: ["src", "test/**/*.test.ts"] },
              ],
            });
            yield* fs.writeFileString(BASELINE_FILE, blindSpotBaselineText({ findings: [] }));

            yield* runLintCommand(["package-test-typecheck", "--baseline", BASELINE_FILE]);

            const logLines = yield* TestConsole.logLines;
            expect(logLines).toEqual(["[package-test-typecheck] ok: current=0 baseline=0 introduced=0"]);
          })
        ).pipe(provideScopedLayer(testLayer))
      ),
    15_000
  );

  it(
    "reports a one-level include because nested sources stay unselected",
    () =>
      Effect.runPromise(
        withTempWorkingDirectory(
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            const path = yield* Path.Path;

            yield* writeTestTypecheckPackage({
              directory: "packages/example",
              name: "@beep/example",
              scripts: {
                check: "bun run beep:check",
                "beep:check": "tsgo -b tsconfig.json && bun run beep:check:tests",
                "beep:check:tests": "tsgo -p tsconfig.test.json --noEmit",
              },
              tsconfigs: [
                { fileName: "tsconfig.json", include: ["src"] },
                { fileName: "tsconfig.test.json", include: ["src", "test/*.ts"] },
              ],
            });
            yield* fs.makeDirectory(path.join("packages", "example", "test", "unit"), { recursive: true });
            yield* fs.writeFileString(
              path.join("packages", "example", "test", "unit", "Nested.test.ts"),
              "export const nested = 1;\n"
            );
            yield* fs.writeFileString(BASELINE_FILE, blindSpotBaselineText({ findings: [] }));

            const exit = yield* Effect.exit(runLintCommand(["package-test-typecheck", "--baseline", BASELINE_FILE]));

            const errorLines = yield* TestConsole.errorLines;
            expectReportedExit(exit);
            expect(errorLines.join("\n")).toContain("  - @beep/example (packages/example) [missing-test-tsconfig]");
          })
        ).pipe(provideScopedLayer(testLayer))
      ),
    15_000
  );

  it(
    "accepts a bare test directory include as a recursive subtree",
    () =>
      Effect.runPromise(
        withTempWorkingDirectory(
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            const path = yield* Path.Path;

            yield* writeTestTypecheckPackage({
              directory: "packages/example",
              name: "@beep/example",
              scripts: {
                check: "bun run beep:check",
                "beep:check": "tsgo -b tsconfig.json && bun run beep:check:tests",
                "beep:check:tests": "tsgo -p tsconfig.test.json --noEmit",
              },
              tsconfigs: [
                { fileName: "tsconfig.json", include: ["src"] },
                { fileName: "tsconfig.test.json", include: ["src", "test"] },
              ],
            });
            yield* fs.makeDirectory(path.join("packages", "example", "test", "unit"), { recursive: true });
            yield* fs.writeFileString(
              path.join("packages", "example", "test", "unit", "Nested.test.ts"),
              "export const nested = 1;\n"
            );
            yield* fs.writeFileString(
              path.join("packages", "example", "test", "Helper.ts"),
              "export const helper = 1;\n"
            );
            yield* fs.writeFileString(BASELINE_FILE, blindSpotBaselineText({ findings: [] }));

            yield* runLintCommand(["package-test-typecheck", "--baseline", BASELINE_FILE]);

            const logLines = yield* TestConsole.logLines;
            expect(logLines).toEqual(["[package-test-typecheck] ok: current=0 baseline=0 introduced=0"]);
          })
        ).pipe(provideScopedLayer(testLayer))
      ),
    15_000
  );

  it(
    "honors exclude when deciding which test sources a project selects",
    () =>
      Effect.runPromise(
        withTempWorkingDirectory(
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            const path = yield* Path.Path;

            // `test` would cover everything, but the excluded helper is pulled
            // back out of the program, so no project typechecks it.
            yield* writeTestTypecheckPackage({
              directory: "packages/example",
              name: "@beep/example",
              scripts: {
                check: "bun run beep:check",
                "beep:check": "tsgo -b tsconfig.json && bun run beep:check:tests",
                "beep:check:tests": "tsgo -p tsconfig.test.json --noEmit",
              },
              tsconfigs: [{ fileName: "tsconfig.json", include: ["src"] }],
            });
            yield* fs.writeFileString(
              path.join("packages", "example", "test", "Helper.ts"),
              "export const helper = 1;\n"
            );
            yield* fs.writeFileString(
              path.join("packages", "example", "tsconfig.test.json"),
              `${encodeJson({ include: ["src", "test"], exclude: ["test/Helper.ts"] })}\n`
            );
            yield* fs.writeFileString(BASELINE_FILE, blindSpotBaselineText({ findings: [] }));

            const exit = yield* Effect.exit(runLintCommand(["package-test-typecheck", "--baseline", BASELINE_FILE]));

            const errorLines = yield* TestConsole.errorLines;
            expectReportedExit(exit);
            expect(errorLines.join("\n")).toContain("  - @beep/example (packages/example) [missing-test-tsconfig]");
          })
        ).pipe(provideScopedLayer(testLayer))
      ),
    15_000
  );

  it(
    "follows check-script delegation through bun run flags",
    () =>
      Effect.runPromise(
        withTempWorkingDirectory(
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;

            // --silent, --filter=<pkg>, and the two-token --cwd <path> form all
            // sit between `bun run` and the script name.
            yield* writeTestTypecheckPackage({
              directory: "packages/example",
              name: "@beep/example",
              scripts: {
                check: "bun run --silent beep:check",
                "beep:check": "tsgo -b tsconfig.json && bun run --cwd . --filter=@beep/example beep:check:tests",
                "beep:check:tests": "tsgo -p tsconfig.test.json --noEmit",
              },
              tsconfigs: [
                { fileName: "tsconfig.json", include: ["src"] },
                { fileName: "tsconfig.test.json", include: ["src", "test"] },
              ],
            });
            yield* fs.writeFileString(BASELINE_FILE, blindSpotBaselineText({ findings: [] }));

            yield* runLintCommand(["package-test-typecheck", "--baseline", BASELINE_FILE]);

            const logLines = yield* TestConsole.logLines;
            expect(logLines).toEqual(["[package-test-typecheck] ok: current=0 baseline=0 introduced=0"]);
          })
        ).pipe(provideScopedLayer(testLayer))
      ),
    15_000
  );

  it(
    "preserves hand-authored notes when rewriting the baseline",
    () =>
      Effect.runPromise(
        withTempWorkingDirectory(
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;

            yield* writeTestTypecheckPackage({
              directory: "packages/example",
              name: "@beep/example",
              scripts: { check: "bun run beep:check", "beep:check": "tsgo -b tsconfig.json" },
              tsconfigs: [{ fileName: "tsconfig.json", include: ["src"] }],
            });
            yield* fs.writeFileString(
              BASELINE_FILE,
              blindSpotBaselineText({ findings: [], notes: { "@beep/example": "Deferred deliberately." } })
            );

            yield* runLintCommand(["package-test-typecheck", "--baseline", BASELINE_FILE, "--write-baseline"]);

            const rewritten = yield* fs.readFileString(BASELINE_FILE);
            expect(rewritten).toContain('"@beep/example": "Deferred deliberately."');
            expect(rewritten).toContain('"kind": "missing-test-tsconfig"');
          })
        ).pipe(provideScopedLayer(testLayer))
      ),
    15_000
  );
});
