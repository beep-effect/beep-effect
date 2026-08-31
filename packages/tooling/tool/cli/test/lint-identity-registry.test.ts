import { lintCommand } from "@beep/repo-cli";
import {
  LAB_COMPOSERS_END_MARKER,
  LAB_COMPOSERS_START_MARKER,
  LAB_EXPORTS_END_MARKER,
  LAB_EXPORTS_START_MARKER,
  LabIdentitySegment,
} from "@beep/repo-cli/commands/CreatePackage/internal/LabIdentitySegment";
import { TSMorphServiceLive } from "@beep/repo-utils";
import { FsUtilsLive } from "@beep/repo-utils/FsUtils";
import { UnknownFromJsonString } from "@beep/schema/Unknown";
import { provideScopedLayer } from "@beep/test-utils";
import { A, Str } from "@beep/utils";
import { NodeServices } from "@effect/platform-node";
import { Effect, FileSystem, Layer, Path } from "effect";
import * as P from "effect/Predicate";
import * as TestConsole from "effect/testing/TestConsole";
import { Command } from "effect/unstable/cli";
import { describe, expect, it } from "vitest";
import { expectReportedExit, withTempWorkingDirectory } from "./support/CommandTest.ts";

const runLintCommand = Command.runWith(lintCommand, { version: "0.0.0" });
const encodeJson = UnknownFromJsonString.encodeUnknownSync;

const testLayer = Layer.mergeAll(
  NodeServices.layer,
  TestConsole.layer,
  FsUtilsLive.pipe(Layer.provide(NodeServices.layer)),
  TSMorphServiceLive.pipe(Layer.provide(NodeServices.layer))
);

const IDENTITY_REGISTRY_PATH = "packages/identity/src/packages.ts";
const LINT_TIMEOUT = 20_000;

const registryContentFor = (slugs: ReadonlyArray<string>, labSlugs: ReadonlyArray<string> = []): string =>
  A.join(
    [
      "const composers = $I.compose(",
      A.join(
        A.map(slugs, (slug) => `  "${slug}"`),
        ",\n"
      ),
      ");",
      "",
      LAB_COMPOSERS_START_MARKER,
      LabIdentitySegment.renderLabComposersRegion(labSlugs),
      LAB_COMPOSERS_END_MARKER,
      "",
      ...A.map(slugs, (slug) => `export const $${Str.pascalCase(slug)}Id = composers.$${Str.pascalCase(slug)}Id;`),
      "",
      LAB_EXPORTS_START_MARKER,
      ...(A.isReadonlyArrayEmpty(labSlugs)
        ? A.empty<string>()
        : A.of(LabIdentitySegment.renderLabExportsRegion(labSlugs))),
      LAB_EXPORTS_END_MARKER,
      "",
    ],
    "\n"
  );

const writeWorkspaceFixture = Effect.fn("writeWorkspaceFixture")(function* (options: {
  readonly registrySlugs: ReadonlyArray<string>;
  readonly registryLabSlugs?: ReadonlyArray<string>;
  readonly labPackages?: ReadonlyArray<string>;
  readonly extraPackages?: ReadonlyArray<string>;
  readonly widgetSourceLines?: ReadonlyArray<string>;
  readonly widgetRootFileLines?: ReadonlyArray<string>;
}) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;

  yield* fs.writeFileString("bun.lock", "");
  yield* fs.writeFileString(
    "package.json",
    `${encodeJson({
      name: "fixture-root",
      private: true,
      type: "module",
      workspaces: ["packages/*", "apps/labs/*"],
    })}\n`
  );

  for (const labSlug of options.labPackages ?? A.empty<string>()) {
    yield* fs.makeDirectory(path.join("apps", "labs", labSlug), { recursive: true });
    yield* fs.writeFileString(
      path.join("apps", "labs", labSlug, "package.json"),
      `${encodeJson({ name: `@beep/${labSlug}`, version: "0.0.0", type: "module" })}\n`
    );
  }

  yield* fs.makeDirectory(path.join("packages", "identity", "src"), { recursive: true });
  yield* fs.writeFileString(
    path.join("packages", "identity", "package.json"),
    `${encodeJson({ name: "@beep/identity", version: "0.0.0", type: "module" })}\n`
  );
  yield* fs.writeFileString(
    path.join("packages", "identity", "tsconfig.json"),
    `${encodeJson({ compilerOptions: {} })}\n`
  );
  yield* fs.writeFileString(
    IDENTITY_REGISTRY_PATH,
    registryContentFor(options.registrySlugs, options.registryLabSlugs ?? A.empty<string>())
  );

  for (const packageSlug of options.extraPackages ?? ["widget"]) {
    yield* fs.makeDirectory(path.join("packages", packageSlug, "src"), { recursive: true });
    yield* fs.writeFileString(
      path.join("packages", packageSlug, "package.json"),
      `${encodeJson({ name: `@beep/${packageSlug}`, version: "0.0.0", type: "module" })}\n`
    );
  }

  if (options.widgetSourceLines !== undefined) {
    yield* fs.writeFileString(
      path.join("packages", "widget", "src", "Widget.ts"),
      options.widgetSourceLines.join("\n")
    );
  }

  if (options.widgetRootFileLines !== undefined) {
    yield* fs.writeFileString(path.join("packages", "widget", "Tool.ts"), options.widgetRootFileLines.join("\n"));
  }
});

describe("identity-registry lint command", { concurrent: false }, () => {
  it(
    "passes when every workspace package is registered and no local roots exist",
    () =>
      Effect.runPromise(
        withTempWorkingDirectory(
          Effect.gen(function* () {
            yield* writeWorkspaceFixture({
              registrySlugs: ["identity", "widget"],
              widgetSourceLines: ['import { $WidgetId } from "@beep/identity/packages";', "void $WidgetId;", ""],
              widgetRootFileLines: [
                'import * as Identity from "@beep/identity";',
                '// A comment mentioning Identity.make("widget") must not trip the scan.',
                'export type WidgetComposer = Identity.IdentityComposer<"@beep/widget">;',
                "",
              ],
            });

            yield* runLintCommand(["identity-registry"]);

            const logLines = yield* TestConsole.logLines;
            expect(logLines).toContain(
              "[lint:identity-registry] OK: 2 workspace packages registered; 0 lab(s) in the generated labs segment; no orphan or local root composers."
            );
          })
        ).pipe(provideScopedLayer(testLayer))
      ),
    LINT_TIMEOUT
  );

  it(
    "reports composer and export registrations with no live workspace owner",
    () =>
      Effect.runPromise(
        withTempWorkingDirectory(
          Effect.gen(function* () {
            yield* writeWorkspaceFixture({ registrySlugs: ["identity", "widget", "retired-widget"] });

            const exit = yield* Effect.exit(runLintCommand(["identity-registry"]));

            expectReportedExit(exit);
            const errorLines = yield* TestConsole.errorLines;
            expect(
              A.some(
                errorLines,
                (line) => P.isString(line) && Str.startsWith("@beep/retired-widget [orphan-registration]")(line)
              )
            ).toBe(true);
          })
        ).pipe(provideScopedLayer(testLayer))
      ),
    LINT_TIMEOUT
  );

  it(
    "reports an export-only orphan whose compose slug is already gone",
    () =>
      Effect.runPromise(
        withTempWorkingDirectory(
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            yield* writeWorkspaceFixture({ registrySlugs: ["identity", "widget"] });
            const registryContent = yield* fs.readFileString(IDENTITY_REGISTRY_PATH);
            yield* fs.writeFileString(
              IDENTITY_REGISTRY_PATH,
              Str.concat(registryContent, "export const $GhostId = composers.$GhostId;\n")
            );

            const composeOnlyContent = yield* fs.readFileString(IDENTITY_REGISTRY_PATH);
            yield* fs.writeFileString(
              IDENTITY_REGISTRY_PATH,
              Str.replace('"widget"', '"widget",\n  "phantom"')(composeOnlyContent)
            );

            const exit = yield* Effect.exit(runLintCommand(["identity-registry"]));

            expectReportedExit(exit);
            const errorLines = yield* TestConsole.errorLines;
            expect(
              A.some(
                errorLines,
                (line) =>
                  P.isString(line) &&
                  Str.startsWith("@beep/ghost [orphan-registration]")(line) &&
                  !Str.includes("$I.compose(...)")(line)
              )
            ).toBe(true);
            expect(
              A.some(
                errorLines,
                (line) =>
                  P.isString(line) &&
                  Str.startsWith("@beep/phantom [orphan-registration]")(line) &&
                  Str.includes("$I.compose(...)")(line) &&
                  !Str.includes("export $")(line)
              )
            ).toBe(true);
          })
        ).pipe(provideScopedLayer(testLayer))
      ),
    LINT_TIMEOUT
  );

  it(
    "reports workspace packages missing from the registry",
    () =>
      Effect.runPromise(
        withTempWorkingDirectory(
          Effect.gen(function* () {
            yield* writeWorkspaceFixture({ registrySlugs: ["identity"] });

            const exit = yield* Effect.exit(runLintCommand(["identity-registry"]));

            expectReportedExit(exit);
            const errorLines = yield* TestConsole.errorLines;
            expect(errorLines).toContain("[lint:identity-registry] found 1 violation(s).");
            expect(
              A.some(
                errorLines,
                (line) => P.isString(line) && Str.startsWith("@beep/widget [missing-registration]")(line)
              )
            ).toBe(true);
          })
        ).pipe(provideScopedLayer(testLayer))
      ),
    LINT_TIMEOUT
  );

  it(
    "reports local root composers built from the identity make export",
    () =>
      Effect.runPromise(
        withTempWorkingDirectory(
          Effect.gen(function* () {
            yield* writeWorkspaceFixture({
              registrySlugs: ["identity", "widget"],
              widgetSourceLines: [
                'import { make as makeIdentity } from "@beep/identity";',
                'const { $WidgetId } = makeIdentity("widget");',
                "void $WidgetId;",
                "",
              ],
              widgetRootFileLines: [
                'import * as Identity from "@beep/identity";',
                'const { $WidgetId } = Identity.make("widget");',
                "void $WidgetId;",
                "",
              ],
            });

            const exit = yield* Effect.exit(runLintCommand(["identity-registry"]));

            expectReportedExit(exit);
            const errorLines = yield* TestConsole.errorLines;
            expect(
              A.some(
                errorLines,
                (line) =>
                  P.isString(line) && Str.startsWith("packages/widget/src/Widget.ts:1 [local-root-composer]")(line)
              )
            ).toBe(true);
            expect(
              A.some(
                errorLines,
                (line) => P.isString(line) && Str.startsWith("packages/widget/Tool.ts:2 [local-root-composer]")(line)
              )
            ).toBe(true);
          })
        ).pipe(provideScopedLayer(testLayer))
      ),
    LINT_TIMEOUT
  );

  it(
    "registers missing workspace packages with --fix",
    () =>
      Effect.runPromise(
        withTempWorkingDirectory(
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            yield* writeWorkspaceFixture({ registrySlugs: ["identity"] });

            yield* runLintCommand(["identity-registry", "--fix"]);

            const registryContent = yield* fs.readFileString(IDENTITY_REGISTRY_PATH);
            expect(registryContent).toContain('"widget"');
            expect(registryContent).toContain("export const $WidgetId");

            const logLines = yield* TestConsole.logLines;
            expect(A.some(logLines, (line) => P.isString(line) && Str.includes('registered "widget"')(line))).toBe(
              true
            );
          })
        ).pipe(provideScopedLayer(testLayer))
      ),
    LINT_TIMEOUT
  );

  it(
    "passes when a live lab is registered in the generated labs segment",
    () =>
      Effect.runPromise(
        withTempWorkingDirectory(
          Effect.gen(function* () {
            yield* writeWorkspaceFixture({
              registrySlugs: ["identity", "widget"],
              registryLabSlugs: ["probe-lab"],
              labPackages: ["probe-lab"],
            });

            yield* runLintCommand(["identity-registry"]);

            const logLines = yield* TestConsole.logLines;
            expect(logLines).toContain(
              "[lint:identity-registry] OK: 3 workspace packages registered; 1 lab(s) in the generated labs segment; no orphan or local root composers."
            );
          })
        ).pipe(provideScopedLayer(testLayer))
      ),
    LINT_TIMEOUT
  );

  it(
    "reports a live lab registered in the flat group as misplaced",
    () =>
      Effect.runPromise(
        withTempWorkingDirectory(
          Effect.gen(function* () {
            yield* writeWorkspaceFixture({
              registrySlugs: ["identity", "widget", "probe-lab"],
              labPackages: ["probe-lab"],
            });

            const exit = yield* Effect.exit(runLintCommand(["identity-registry"]));

            expectReportedExit(exit);
            const errorLines = yield* TestConsole.errorLines;
            expect(errorLines).toContain("[lint:identity-registry] found 1 violation(s).");
            expect(
              A.some(
                errorLines,
                (line) => P.isString(line) && Str.startsWith("@beep/probe-lab [labs-segment-misplaced]")(line)
              )
            ).toBe(true);
          })
        ).pipe(provideScopedLayer(testLayer))
      ),
    LINT_TIMEOUT
  );

  it(
    "reports an unregistered lab as missing from both the registry and the labs segment",
    () =>
      Effect.runPromise(
        withTempWorkingDirectory(
          Effect.gen(function* () {
            yield* writeWorkspaceFixture({
              registrySlugs: ["identity", "widget"],
              labPackages: ["probe-lab"],
            });

            const exit = yield* Effect.exit(runLintCommand(["identity-registry"]));

            expectReportedExit(exit);
            const errorLines = yield* TestConsole.errorLines;
            expect(
              A.some(
                errorLines,
                (line) => P.isString(line) && Str.startsWith("@beep/probe-lab [missing-registration]")(line)
              )
            ).toBe(true);
            expect(
              A.some(
                errorLines,
                (line) => P.isString(line) && Str.startsWith("@beep/probe-lab [labs-segment-missing]")(line)
              )
            ).toBe(true);
          })
        ).pipe(provideScopedLayer(testLayer))
      ),
    LINT_TIMEOUT
  );

  it(
    "reports a labs segment entry with no live lab as extra alongside the orphan check",
    () =>
      Effect.runPromise(
        withTempWorkingDirectory(
          Effect.gen(function* () {
            yield* writeWorkspaceFixture({
              registrySlugs: ["identity", "widget"],
              registryLabSlugs: ["ghost-lab"],
            });

            const exit = yield* Effect.exit(runLintCommand(["identity-registry"]));

            expectReportedExit(exit);
            const errorLines = yield* TestConsole.errorLines;
            expect(
              A.some(
                errorLines,
                (line) => P.isString(line) && Str.startsWith("@beep/ghost-lab [labs-segment-extra]")(line)
              )
            ).toBe(true);
            expect(
              A.some(
                errorLines,
                (line) => P.isString(line) && Str.startsWith("@beep/ghost-lab [orphan-registration]")(line)
              )
            ).toBe(true);
          })
        ).pipe(provideScopedLayer(testLayer))
      ),
    LINT_TIMEOUT
  );

  it(
    "reports a live non-lab workspace inside the labs segment as extra without an orphan",
    () =>
      Effect.runPromise(
        withTempWorkingDirectory(
          Effect.gen(function* () {
            yield* writeWorkspaceFixture({
              registrySlugs: ["identity"],
              registryLabSlugs: ["widget"],
            });

            const exit = yield* Effect.exit(runLintCommand(["identity-registry"]));

            expectReportedExit(exit);
            const errorLines = yield* TestConsole.errorLines;
            expect(errorLines).toContain("[lint:identity-registry] found 1 violation(s).");
            expect(
              A.some(
                errorLines,
                (line) => P.isString(line) && Str.startsWith("@beep/widget [labs-segment-extra]")(line)
              )
            ).toBe(true);
          })
        ).pipe(provideScopedLayer(testLayer))
      ),
    LINT_TIMEOUT
  );

  it(
    "registers a missing lab and prunes a ghost from the labs segment with --fix",
    () =>
      Effect.runPromise(
        withTempWorkingDirectory(
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            yield* writeWorkspaceFixture({
              registrySlugs: ["identity", "widget"],
              registryLabSlugs: ["ghost-lab"],
              labPackages: ["probe-lab"],
            });

            yield* runLintCommand(["identity-registry", "--fix"]);

            const registryContent = yield* fs.readFileString(IDENTITY_REGISTRY_PATH);
            expect(registryContent).toContain('"probe-lab"');
            expect(registryContent).toContain("export const $ProbeLabId");
            expect(Str.includes("ghost-lab")(registryContent)).toBe(false);

            const logLines = yield* TestConsole.logLines;
            expect(A.some(logLines, (line) => P.isString(line) && Str.includes('registered "probe-lab"')(line))).toBe(
              true
            );
            expect(
              A.some(
                logLines,
                (line) => P.isString(line) && Str.includes('removed "ghost-lab" from the generated labs segment')(line)
              )
            ).toBe(true);

            yield* runLintCommand(["identity-registry"]);
          })
        ).pipe(provideScopedLayer(testLayer))
      ),
    LINT_TIMEOUT
  );

  it(
    "consolidates a misplaced lab into the generated labs segment with --fix",
    () =>
      Effect.runPromise(
        withTempWorkingDirectory(
          Effect.gen(function* () {
            yield* writeWorkspaceFixture({
              registrySlugs: ["identity", "widget", "probe-lab"],
              labPackages: ["probe-lab"],
            });

            yield* runLintCommand(["identity-registry", "--fix"]);

            const state = yield* LabIdentitySegment.diffLabIdentitySegment(".");
            expect(state.expectedSlugs).toEqual(["probe-lab"]);
            expect(state.actualComposerSlugs).toEqual(["probe-lab"]);
            expect(state.actualExportSlugs).toEqual(["probe-lab"]);
            expect(state.misplacedSlugs).toEqual([]);

            const logLines = yield* TestConsole.logLines;
            expect(
              A.some(logLines, (line) => P.isString(line) && Str.includes('removed misplaced lab "probe-lab"')(line))
            ).toBe(true);

            yield* runLintCommand(["identity-registry"]);
          })
        ).pipe(provideScopedLayer(testLayer))
      ),
    LINT_TIMEOUT
  );

  it(
    "fails with the substrate remediation when the labs segment markers are missing",
    () =>
      Effect.runPromise(
        withTempWorkingDirectory(
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            yield* writeWorkspaceFixture({ registrySlugs: ["identity", "widget"] });
            yield* fs.writeFileString(
              IDENTITY_REGISTRY_PATH,
              A.join(
                [
                  'const composers = $I.compose("identity", "widget");',
                  "export const $IdentityId = composers.$IdentityId;",
                  "export const $WidgetId = composers.$WidgetId;",
                  "",
                ],
                "\n"
              )
            );

            const exit = yield* Effect.exit(runLintCommand(["identity-registry"]));

            expectReportedExit(exit);
            const errorLines = yield* TestConsole.errorLines;
            expect(
              A.some(
                errorLines,
                (line) =>
                  P.isString(line) &&
                  Str.includes("Generated labs marker")(line) &&
                  Str.includes("bun run beep lint identity-registry --fix")(line)
              )
            ).toBe(true);
          })
        ).pipe(provideScopedLayer(testLayer))
      ),
    LINT_TIMEOUT
  );
});
