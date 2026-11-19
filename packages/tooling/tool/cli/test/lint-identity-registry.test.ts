import { Git } from "@beep/git/Git";
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
import { it } from "@beep/test-runner";
import { A, Str } from "@beep/utils";
import { NodeCrypto, NodeServices } from "@effect/platform-node";
import { describe, expect } from "@effect/vitest";
import * as Console from "effect/Console";
import * as Command from "effect/cli/Command";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { flow } from "effect/Function";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as P from "effect/Predicate";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as TestConsole from "effect/testing/TestConsole";
import { expectReportedExit, temporaryWorkingDirectory } from "./support/CommandTest.ts";

// `Git` rides beside the platform services: repo-cli's typed git readers take it from the context (W1a).
const gitLayer = Git.layer.pipe(Layer.provide(NodeServices.layer));

const runLintCommand = Command.runWith(lintCommand, { version: "0.0.0" });
const encodeJson = flow(S.encodeUnknownResult(S.fromJsonString(S.Unknown)), Result.getOrThrow);

const testLayer = Layer.provideMerge(
  Git.layer,
  Layer.mergeAll(
    NodeServices.layer,
    NodeCrypto.layer,
    FsUtilsLive.pipe(Layer.provide(Layer.mergeAll(NodeServices.layer, NodeCrypto.layer, gitLayer))),
    TSMorphServiceLive.pipe(Layer.provide(Layer.mergeAll(NodeServices.layer, NodeCrypto.layer, gitLayer)))
  )
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
      ...A.map(
        slugs,
        (slug) =>
          `export const $${Str.pascalCase(slug)}Id: Identity.IdentityComposer<"@beep/${slug}"> = /*#__PURE__*/ $I.create("${slug}");`
      ),
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
      A.join(options.widgetSourceLines, "\n")
    );
  }

  if (options.widgetRootFileLines !== undefined) {
    yield* fs.writeFileString(path.join("packages", "widget", "Tool.ts"), A.join(options.widgetRootFileLines, "\n"));
  }
});

it.layer(testLayer, { concurrent: false, timeout: "20 seconds" })((it) => {
  describe("identity-registry lint command", { concurrent: false }, () => {
    it.effect(
      "passes when every workspace package is registered and no local roots exist",
      () =>
        Effect.andThen(
          temporaryWorkingDirectory,
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
        ).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make)),
      LINT_TIMEOUT
    );

    it.effect(
      "reports composer and export registrations with no live workspace owner",
      () =>
        Effect.andThen(
          temporaryWorkingDirectory,
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
        ).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make)),
      LINT_TIMEOUT
    );

    it.effect(
      "reports registry exports that are not a pure $I.create leaf over their own slug",
      () =>
        Effect.andThen(
          temporaryWorkingDirectory,
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            yield* writeWorkspaceFixture({ registrySlugs: ["identity", "widget", "gadget"] });
            const registryContent = yield* fs.readFileString(IDENTITY_REGISTRY_PATH);
            const drifted = Str.replace(
              'export const $GadgetId: Identity.IdentityComposer<"@beep/gadget"> = /*#__PURE__*/ $I.create("gadget");',
              "export const $GadgetId = composers.$GadgetId;"
            )(Str.replace('= /*#__PURE__*/ $I.create("widget");', '= $I.create("widgets");')(registryContent));
            yield* fs.writeFileString(IDENTITY_REGISTRY_PATH, drifted);

            const exit = yield* Effect.exit(runLintCommand(["identity-registry"]));

            expectReportedExit(exit);
            const errorLines = yield* TestConsole.errorLines;
            const leafRow = (subject: string) =>
              A.findFirst(
                errorLines,
                (line): line is string =>
                  P.isString(line) && Str.startsWith(`${subject} [registry-leaf-mismatch]`)(line)
              );
            const widgetRow = O.getOrThrow(leafRow("@beep/widget"));
            expect(widgetRow).toContain('literal does not equal its slug "widget"');
            expect(widgetRow).toContain("lacks /*#__PURE__*/");
            const gadgetRow = O.getOrThrow(leafRow("@beep/gadget"));
            expect(gadgetRow).toContain('its initializer is not `$I.create("gadget")`');
            expect(gadgetRow).toContain('it is not typed `Identity.IdentityComposer<"@beep/gadget">`');
            expect(O.isNone(leafRow("@beep/identity"))).toBe(true);
          })
        ).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make)),
      LINT_TIMEOUT
    );

    it.effect(
      "reports untyped accessor-named exports that read a shared composer object",
      () =>
        Effect.andThen(
          temporaryWorkingDirectory,
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            yield* writeWorkspaceFixture({ registrySlugs: ["identity", "widget", "gadget"] });
            const registryContent = yield* fs.readFileString(IDENTITY_REGISTRY_PATH);
            const reverted = Str.replace(
              'export const $GadgetId: Identity.IdentityComposer<"@beep/gadget"> = /*#__PURE__*/ $I.create("gadget");',
              "export const $GadgetId = generatedComposers.$GadgetId;"
            )(
              Str.replace(
                'export const $WidgetId: Identity.IdentityComposer<"@beep/widget"> = /*#__PURE__*/ $I.create("widget");',
                "export const $WidgetId = RepoPkgs.$WidgetId;"
              )(registryContent)
            );
            yield* fs.writeFileString(IDENTITY_REGISTRY_PATH, reverted);

            const exit = yield* Effect.exit(runLintCommand(["identity-registry"]));

            expectReportedExit(exit);
            const errorLines = yield* TestConsole.errorLines;
            const leafRow = (subject: string) =>
              A.findFirst(
                errorLines,
                (line): line is string =>
                  P.isString(line) && Str.startsWith(`${subject} [registry-leaf-mismatch]`)(line)
              );
            const gadgetRow = O.getOrThrow(leafRow("@beep/gadget"));
            expect(gadgetRow).toContain('its initializer is not `$I.create("gadget")`');
            expect(gadgetRow).toContain('it is not typed `Identity.IdentityComposer<"@beep/gadget">`');
            const widgetRow = O.getOrThrow(leafRow("@beep/widget"));
            expect(widgetRow).toContain('its initializer is not `$I.create("widget")`');
            expect(widgetRow).toContain('it is not typed `Identity.IdentityComposer<"@beep/widget">`');
            expect(O.isNone(leafRow("@beep/identity"))).toBe(true);
          })
        ).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make)),
      LINT_TIMEOUT
    );

    it.effect(
      "reports an export-only orphan whose compose slug is already gone",
      () =>
        Effect.andThen(
          temporaryWorkingDirectory,
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            yield* writeWorkspaceFixture({ registrySlugs: ["identity", "widget"] });
            const registryContent = yield* fs.readFileString(IDENTITY_REGISTRY_PATH);
            yield* fs.writeFileString(
              IDENTITY_REGISTRY_PATH,
              Str.concat(
                registryContent,
                'export const $GhostId: Identity.IdentityComposer<"@beep/ghost"> = /*#__PURE__*/ $I.create("ghost");\n'
              )
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
        ).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make)),
      LINT_TIMEOUT
    );

    it.effect(
      "reports workspace packages missing from the registry",
      () =>
        Effect.andThen(
          temporaryWorkingDirectory,
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
        ).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make)),
      LINT_TIMEOUT
    );

    it.effect(
      "reports local root composers built from the identity make export",
      () =>
        Effect.andThen(
          temporaryWorkingDirectory,
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
        ).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make)),
      LINT_TIMEOUT
    );

    it.effect(
      "registers missing workspace packages with --fix",
      () =>
        Effect.andThen(
          temporaryWorkingDirectory,
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
        ).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make)),
      LINT_TIMEOUT
    );

    it.effect(
      "passes when a live lab is registered in the generated labs segment",
      () =>
        Effect.andThen(
          temporaryWorkingDirectory,
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
        ).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make)),
      LINT_TIMEOUT
    );

    it.effect(
      "reports a live lab registered in the flat group as misplaced",
      () =>
        Effect.andThen(
          temporaryWorkingDirectory,
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
        ).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make)),
      LINT_TIMEOUT
    );

    it.effect(
      "reports an unregistered lab as missing from both the registry and the labs segment",
      () =>
        Effect.andThen(
          temporaryWorkingDirectory,
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
        ).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make)),
      LINT_TIMEOUT
    );

    it.effect(
      "reports a labs segment entry with no live lab as extra alongside the orphan check",
      () =>
        Effect.andThen(
          temporaryWorkingDirectory,
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
        ).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make)),
      LINT_TIMEOUT
    );

    it.effect(
      "reports a live non-lab workspace inside the labs segment as extra without an orphan",
      () =>
        Effect.andThen(
          temporaryWorkingDirectory,
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
        ).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make)),
      LINT_TIMEOUT
    );

    it.effect(
      "registers a missing lab and prunes a ghost from the labs segment with --fix",
      () =>
        Effect.andThen(
          temporaryWorkingDirectory,
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
        ).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make)),
      LINT_TIMEOUT
    );

    it.effect(
      "consolidates a misplaced lab into the generated labs segment with --fix",
      () =>
        Effect.andThen(
          temporaryWorkingDirectory,
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
        ).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make)),
      LINT_TIMEOUT
    );

    it.effect(
      "fails with the substrate remediation when the labs segment markers are missing",
      () =>
        Effect.andThen(
          temporaryWorkingDirectory,
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            yield* writeWorkspaceFixture({ registrySlugs: ["identity", "widget"] });
            yield* fs.writeFileString(
              IDENTITY_REGISTRY_PATH,
              A.join(
                [
                  'const composers = $I.compose("identity", "widget");',
                  'export const $IdentityId: Identity.IdentityComposer<"@beep/identity"> = /*#__PURE__*/ $I.create("identity");',
                  'export const $WidgetId: Identity.IdentityComposer<"@beep/widget"> = /*#__PURE__*/ $I.create("widget");',
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
        ).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make)),
      LINT_TIMEOUT
    );
  });

  // goals/prunable-product-leaves, seam 1b: a registration whose workspace the checkout pruned or
  // owns is skipped and counted; every other ownerless registration still fails.
  describe("identity-registry lint in a trimmed checkout", { concurrent: false }, () => {
    const declare = Effect.fnUntraced(function* (declaration: unknown) {
      const fs = yield* FileSystem.FileSystem;
      yield* fs.makeDirectory("standards", { recursive: true });
      yield* fs.writeFileString("standards/checkout-prune.jsonc", `${encodeJson(declaration)}\n`);
    });
    const lintOutcome = Effect.gen(function* () {
      const exit = yield* Effect.exit(runLintCommand(["identity-registry"]));
      const logLines = yield* TestConsole.logLines;
      const errorLines = yield* TestConsole.errorLines;
      return {
        passed: exit._tag === "Success",
        logLines: A.filter(logLines, P.isString),
        errorLines: A.filter(errorLines, P.isString),
      };
    });
    const orphanReported = (lines: ReadonlyArray<string>, slug: string) =>
      A.some(lines, (line) => Str.startsWith(`@beep/${slug} [orphan-registration]`)(line));

    it.effect(
      "skips and counts a registration whose declared workspace is gone, and a product leaf's",
      () =>
        Effect.andThen(
          temporaryWorkingDirectory,
          Effect.gen(function* () {
            // `box` is a product leaf (@beep/repo-cli-kit/ProductLeaves) this fixture never had.
            yield* writeWorkspaceFixture({ registrySlugs: ["identity", "widget", "retired-widget", "box"] });
            yield* declare({
              version: 1,
              prune: [{ path: "packages/retired-widget", why: "not shipped", packageName: "@beep/retired-widget" }],
            });

            const outcome = yield* lintOutcome;

            expect(outcome.passed).toBe(true);
            expect(outcome.logLines).toContain(
              "[lint:identity-registry] skipped 2 registration row(s) whose workspace is pruned from this checkout: workspace @beep/box, workspace @beep/retired-widget"
            );
          })
        ).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make)),
      LINT_TIMEOUT
    );

    it.effect(
      "still reports an ownerless registration nobody declared, or one a keep entry carves out",
      () =>
        Effect.andThen(
          temporaryWorkingDirectory,
          Effect.gen(function* () {
            yield* writeWorkspaceFixture({
              registrySlugs: ["identity", "widget", "retired-widget", "typo-widget", "box"],
            });
            yield* declare({
              version: 1,
              prune: [{ path: "packages/retired-widget", why: "not shipped", packageName: "@beep/retired-widget" }],
              keep: [
                { path: "packages/retired-widget", why: "the keep wins" },
                { path: "packages/drivers/box", why: "this checkout keeps box", packageName: "@beep/box" },
              ],
            });

            const outcome = yield* lintOutcome;

            expect(outcome.passed).toBe(false);
            expect(orphanReported(outcome.errorLines, "retired-widget")).toBe(true);
            expect(orphanReported(outcome.errorLines, "typo-widget")).toBe(true);
            // A missing product leaf under a keep entry fails like any missing workspace.
            expect(orphanReported(outcome.errorLines, "box")).toBe(true);
          })
        ).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make)),
      LINT_TIMEOUT
    );

    it.effect(
      "skips an owned workspace's registration although its directory remains, and only while it is owned",
      () =>
        Effect.andThen(
          temporaryWorkingDirectory,
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            // The checkout replaced @beep/replaced with its own package in the same directory.
            yield* writeWorkspaceFixture({
              registrySlugs: ["identity", "widget", "own", "replaced"],
              extraPackages: ["widget", "own"],
            });
            yield* fs.makeDirectory("packages/replaced/src", { recursive: true });

            const strict = yield* lintOutcome;
            expect(strict.passed).toBe(false);
            expect(orphanReported(strict.errorLines, "replaced")).toBe(true);

            yield* declare({
              version: 1,
              owned: [{ path: "packages/replaced", why: "replaced by this checkout", packageName: "@beep/replaced" }],
            });
            const owned = yield* lintOutcome;
            expect(owned.passed).toBe(true);
            expect(owned.logLines).toContain(
              "[lint:identity-registry] skipped 1 registration row(s) whose workspace is pruned from this checkout: workspace @beep/replaced"
            );
          })
        ).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make)),
      LINT_TIMEOUT
    );

    it.effect(
      "reads the declaration only for an ownerless row, and fails on an invalid one instead of reading it as empty",
      () =>
        Effect.andThen(
          temporaryWorkingDirectory,
          Effect.gen(function* () {
            yield* declare({ version: 1, prunes: [] });
            // A clean registry has nothing to judge, so it never reads the declaration.
            yield* writeWorkspaceFixture({ registrySlugs: ["identity", "widget"] });
            const clean = yield* lintOutcome;
            expect(clean.passed).toBe(true);

            yield* writeWorkspaceFixture({ registrySlugs: ["identity", "widget", "retired-widget"] });
            const invalid = yield* lintOutcome;
            expect(invalid.passed).toBe(false);
            // The invalid declaration fails the read; the orphan is not reported as if nothing were declared.
            expect(orphanReported(invalid.errorLines, "retired-widget")).toBe(false);
          })
        ).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make)),
      LINT_TIMEOUT
    );
  });
});
