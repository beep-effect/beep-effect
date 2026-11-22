import { Git } from "@beep/git/Git";
import { TermSnapshot } from "@beep/identity/Term";
import { lintCommand } from "@beep/repo-cli";
import {
  LAB_COMPOSERS_END_MARKER,
  LAB_COMPOSERS_START_MARKER,
  LAB_EXPORTS_END_MARKER,
  LAB_EXPORTS_START_MARKER,
  LabIdentitySegment,
} from "@beep/repo-cli/commands/CreatePackage/internal/LabIdentitySegment";
import { identityCommand } from "@beep/repo-cli/commands/Identity";
import { RegistryLayout, renderRegistryJson } from "@beep/repo-cli/commands/Identity/Registry";
import { TSMorphServiceLive } from "@beep/repo-utils";
import { FsUtilsLive } from "@beep/repo-utils/FsUtils";
import { it } from "@beep/test-runner";
import { A, Str } from "@beep/utils";
import { NodeCrypto, NodeServices } from "@effect/platform-node";
import { describe, expect } from "@effect/vitest";
import { assertNone } from "@effect/vitest/utils";
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
import { expectReportedExit, gitFixture, temporaryWorkingDirectory } from "./support/CommandTest.ts";

// `Git` rides beside the platform services: repo-cli's typed git readers take it from the context (W1a).
const gitLayer = Git.layer.pipe(Layer.provide(NodeServices.layer));

const runLintCommand = Command.runWith(lintCommand, { version: "0.0.0" });
const runIdentityCommand = Command.runWith(identityCommand, { version: "0.0.0" });
const decodeSnapshotText = flow(S.decodeUnknownResult(S.fromJsonString(TermSnapshot)), Result.getOrThrow);
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
const WIDGET_LEAF_PATH = "packages/widget/src/internal/WidgetId.ts";
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
  readonly widgetLeafLines?: ReadonlyArray<string>;
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

  if (options.widgetLeafLines !== undefined) {
    yield* fs.makeDirectory(path.join("packages", "widget", "src", "internal"), { recursive: true });
    yield* fs.writeFileString(WIDGET_LEAF_PATH, A.join(options.widgetLeafLines, "\n"));
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
      "reports declared-term registry drift and regenerates it under --fix",
      () =>
        Effect.andThen(
          temporaryWorkingDirectory,
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            const layout = RegistryLayout.of("packages/identity");
            yield* writeWorkspaceFixture({ registrySlugs: ["identity", "widget"] });
            yield* fs.makeDirectory(layout.shards, { recursive: true });
            yield* fs.writeFileString(
              `${layout.shards}/fabio.json`,
              renderRegistryJson({
                namespace: { prefix: "fabio", iri: "http://purl.org/spar/fabio/" },
                terms: ["Report"],
                bindings: [],
                deprecations: [],
              })
            );

            const drifted = yield* Effect.exit(runLintCommand(["identity-registry"]));
            expectReportedExit(drifted);
            const errorLines = yield* TestConsole.errorLines;
            expect(errorLines).toContain(
              `${layout.snapshot} [registry-generated-drift] The generated artifact is missing. Run \`bun run beep identity registry --write\` to regenerate.`
            );

            yield* runLintCommand(["identity-registry", "--fix"]);
            const logLines = yield* TestConsole.logLines;
            expect(logLines).toContain(`[lint:identity-registry] regenerated ${layout.data}`);
            const snapshotText = yield* fs.readFileString(layout.snapshot);
            expect(snapshotText).toContain('"release": "1.0.0"');
            yield* runLintCommand(["identity-registry"]);

            yield* fs.writeFileString(
              `${layout.shards}/fab.json`,
              renderRegistryJson({
                namespace: { prefix: "fab", iri: "http://purl.org/spar/fabio/" },
                terms: [],
                bindings: [],
                deprecations: [],
              })
            );
            const conflicted = yield* Effect.exit(runLintCommand(["identity-registry", "--fix"]));
            expectReportedExit(conflicted);
            const conflictLines = yield* TestConsole.errorLines;
            expect(
              A.some(
                conflictLines,
                (line) => P.isString(line) && Str.startsWith(`${layout.shards} [registry-conflict]`)(line)
              )
            ).toBe(true);
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
            assertNone(leafRow("@beep/identity"));
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
            assertNone(leafRow("@beep/identity"));
          })
        ).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make)),
      LINT_TIMEOUT
    );

    it.effect(
      "reads an untyped leaf of a listed slug and a legacy read no slug matches as registry exports",
      () =>
        Effect.andThen(
          temporaryWorkingDirectory,
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            yield* writeWorkspaceFixture({ registrySlugs: ["identity", "widget", "gadget"] });
            const registryContent = yield* fs.readFileString(IDENTITY_REGISTRY_PATH);
            // An untyped leaf whose literal is a listed slug, an untyped vocabulary leaf over a segment no group
            // lists, and a legacy read whose name is the accessor of no listed slug.
            const untyped = Str.replace(
              'export const $WidgetId: Identity.IdentityComposer<"@beep/widget"> = /*#__PURE__*/ $I.create("widget");',
              'export const $WidgetId = /*#__PURE__*/ $I.create("widget");'
            )(registryContent);
            yield* fs.writeFileString(
              IDENTITY_REGISTRY_PATH,
              `${untyped}\nexport const $QaId = /*#__PURE__*/ $I.create("qa");\nexport const $OrphanThingId = composers.$OrphanThingId;\n`
            );

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
            expect(widgetRow).toContain('it is not typed `Identity.IdentityComposer<"@beep/widget">`');
            expect(widgetRow).not.toContain("its initializer is not");
            // The legacy read is attributed to the slug its own name spells.
            const orphanRow = O.getOrThrow(leafRow("@beep/orphan-thing"));
            expect(orphanRow).toContain('its initializer is not `$I.create("orphan-thing")`');
            assertNone(leafRow("@beep/qa"));
            assertNone(leafRow("@beep/gadget"));
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
      "passes a leaf package whose modules take the composer from its registry-free leaf",
      () =>
        Effect.andThen(
          temporaryWorkingDirectory,
          Effect.gen(function* () {
            yield* writeWorkspaceFixture({
              registrySlugs: ["identity", "widget"],
              widgetLeafLines: [
                'import { $BeepId } from "@beep/identity/Root";',
                'export const $WidgetId = /*#__PURE__*/ $BeepId.create("widget");',
                "",
              ],
              widgetSourceLines: [
                'import type { $WidgetId as RegistryWidgetId } from "@beep/identity/packages";',
                'import { $WidgetId } from "./internal/WidgetId.ts";',
                "export const probe: typeof RegistryWidgetId = $WidgetId;",
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
      "confines the registry-free root to package leaves over their own slug",
      () =>
        Effect.andThen(
          temporaryWorkingDirectory,
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            yield* writeWorkspaceFixture({
              registrySlugs: ["identity", "widget", "gadget"],
              extraPackages: ["widget", "gadget"],
              widgetLeafLines: [
                'import { $BeepId as Root } from "@beep/identity/Root";',
                'export const $WidgetId = /*#__PURE__*/ Root.create("widgets");',
                "",
              ],
              widgetSourceLines: ['import { $WidgetId } from "@beep/identity/packages";', "void $WidgetId;", ""],
              widgetRootFileLines: [
                'import { $BeepId } from "@beep/identity/Root";',
                'export const $ToolId = $BeepId.create("widget");',
                "",
              ],
            });
            yield* fs.writeFileString(
              "packages/gadget/src/Gadget.ts",
              A.join(
                [
                  'import * as Identity from "@beep/identity";',
                  'import { $BeepId as Barrel } from "@beep/identity";',
                  'export const $GadgetId = Identity.$BeepId.create("gadget");',
                  'export const $OtherId = Barrel.create("other");',
                  "",
                ],
                "\n"
              )
            );

            const exit = yield* Effect.exit(runLintCommand(["identity-registry"]));

            expectReportedExit(exit);
            const errorLines = yield* TestConsole.errorLines;
            const row = (prefix: string) =>
              A.findFirst(errorLines, (line): line is string => P.isString(line) && Str.startsWith(prefix)(line));
            expect(errorLines).toContain("[lint:identity-registry] found 5 violation(s).");
            expect(O.getOrThrow(row(`${WIDGET_LEAF_PATH}:1 [root-leaf-slug-mismatch]`))).toContain(
              'found `create("widgets")`'
            );
            expect(O.getOrThrow(row("packages/widget/src/Widget.ts:1 [leaf-package-registry-import]"))).toContain(
              '"@beep/identity/packages" loads the identity registry'
            );
            expect(O.getOrThrow(row("packages/widget/Tool.ts:1 [root-composer-outside-leaf]"))).toContain(
              `(${WIDGET_LEAF_PATH})`
            );
            expect(O.getOrThrow(row("packages/gadget/src/Gadget.ts:2 [root-composer-outside-leaf]"))).toContain(
              "(packages/gadget/src/internal/GadgetId.ts)"
            );
            expect(O.getOrThrow(row("packages/gadget/src/Gadget.ts:3 [root-composer-outside-leaf]"))).toContain(
              "(packages/gadget/src/internal/GadgetId.ts)"
            );
          })
        ).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make)),
      LINT_TIMEOUT
    );

    it.effect(
      "reads a leaf's create through a namespace import of the root and ignores its other calls",
      () =>
        Effect.andThen(
          temporaryWorkingDirectory,
          Effect.gen(function* () {
            yield* writeWorkspaceFixture({
              registrySlugs: ["identity", "widget"],
              widgetLeafLines: [
                'import * as Root from "@beep/identity/Root";',
                'export const $WidgetId = /*#__PURE__*/ Root.$BeepId.create("widget");',
                "export const isBuilt = Boolean($WidgetId);",
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
      "reports a leaf whose root create call has no slug",
      () =>
        Effect.andThen(
          temporaryWorkingDirectory,
          Effect.gen(function* () {
            yield* writeWorkspaceFixture({
              registrySlugs: ["identity", "widget"],
              widgetLeafLines: [
                'import { $BeepId } from "@beep/identity/Root";',
                "export const $WidgetId = /*#__PURE__*/ $BeepId.create();",
                "",
              ],
            });

            const exit = yield* Effect.exit(runLintCommand(["identity-registry"]));

            expectReportedExit(exit);
            const errorLines = yield* TestConsole.errorLines;
            expect(errorLines).toStrictEqual([
              "[lint:identity-registry] found 1 violation(s).",
              `${WIDGET_LEAF_PATH}:1 [root-leaf-slug-mismatch] A registry-free leaf holds exactly one \`$BeepId.create("widget")\` over its package's registry slug; found \`create()\`.`,
            ]);
          })
        ).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make)),
      LINT_TIMEOUT
    );

    it.effect(
      "reports a leaf with no root create call",
      () =>
        Effect.andThen(
          temporaryWorkingDirectory,
          Effect.gen(function* () {
            yield* writeWorkspaceFixture({
              registrySlugs: ["identity", "widget"],
              widgetLeafLines: ["export const $WidgetId = 1;", ""],
            });

            const exit = yield* Effect.exit(runLintCommand(["identity-registry"]));

            expectReportedExit(exit);
            const errorLines = yield* TestConsole.errorLines;
            expect(errorLines).toContain("[lint:identity-registry] found 1 violation(s).");
            expect(
              A.some(
                errorLines,
                (line) =>
                  P.isString(line) &&
                  Str.startsWith(`${WIDGET_LEAF_PATH}:1 [root-leaf-slug-mismatch]`)(line) &&
                  Str.endsWith("found none.")(line)
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

  // Law L0-3 at the gate: the head's regenerated snapshot keeps the base ref's published term set.
  describe("identity-registry lint against a base ref", { concurrent: false }, () => {
    const layout = RegistryLayout.of("packages/identity");
    const fabioPath = `${layout.shards}/fabio.json`;
    const WIDGET_OLD_MODULE = "packages/widget/src/Old.ts";
    const WIDGET_NEW_MODULE = "packages/widget/src/New.ts";
    const fabioShard = (terms: ReadonlyArray<string>, bindings: ReadonlyArray<unknown> = []) =>
      renderRegistryJson({
        namespace: { prefix: "fabio", iri: "http://purl.org/spar/fabio/" },
        terms,
        bindings,
        deprecations: [],
      });

    // A committed fixture checkout with the fabio shard and its generated artifacts; answers the base sha.
    const commitRegistryFixture = Effect.fn("LintIdentityRegistryTest.commitRegistryFixture")(function* (
      shard: string
    ) {
      const fs = yield* FileSystem.FileSystem;
      const git = yield* Git;
      yield* writeWorkspaceFixture({ registrySlugs: ["identity", "widget"] });
      yield* fs.writeFileString(WIDGET_OLD_MODULE, "export const report = 1;\n");
      yield* fs.makeDirectory(layout.shards, { recursive: true });
      yield* fs.writeFileString(fabioPath, shard);
      yield* runIdentityCommand(["registry", "--write"]);
      const root = yield* Effect.sync(() => process.cwd());
      yield* gitFixture(root);
      yield* git.commit(root, "base", { noVerify: true, noGpgSign: true });
      return yield* git.revParse(root, "HEAD");
    });

    it.effect(
      "L0-3 reports a term removed against the base ref and accepts its deprecation",
      () =>
        Effect.andThen(
          temporaryWorkingDirectory,
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            const base = yield* commitRegistryFixture(fabioShard(["Report", "TechnicalReport"]));
            const committedSnapshot = yield* fs.readFileString(layout.snapshot);

            // Removing the term and regenerating the snapshot from nothing hides the removal from --check.
            yield* fs.writeFileString(fabioPath, fabioShard(["Report"]));
            yield* fs.remove(layout.snapshot);
            yield* runIdentityCommand(["registry", "--write"]);
            const removed = yield* Effect.exit(runLintCommand(["identity-registry", "--base", base]));
            expectReportedExit(removed);
            const removedLines = yield* TestConsole.errorLines;
            expect(removedLines).toContain(
              `${layout.snapshot} [term-removed-without-deprecation] Against the base ref: http://purl.org/spar/fabio/TechnicalReport is removed without a deprecation. Restore the IRI, or retire it with \`bun run beep identity deprecate\`, the only writer of a deprecation.`
            );

            yield* fs.writeFileString(fabioPath, fabioShard(["Report", "TechnicalReport"]));
            yield* fs.writeFileString(layout.snapshot, committedSnapshot);
            yield* runIdentityCommand(["deprecate", "fabio:TechnicalReport", "--replacement", "fabio:Report"]);
            const deprecated = yield* fs.readFileString(fabioPath);
            expect(deprecated).toContain('"term": "http://purl.org/spar/fabio/TechnicalReport"');
            expect(deprecated).toContain('"since": "2.0.0"');
            const regenerated = yield* fs.readFileString(layout.snapshot);
            expect(regenerated).toContain('"release": "2.0.0"');
            yield* runLintCommand(["identity-registry", "--base", base]);
          })
        ).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make)),
      LINT_TIMEOUT
    );

    it.effect(
      "L0-3 reports every term of a deleted registry against a base that published it",
      () =>
        Effect.andThen(
          temporaryWorkingDirectory,
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            const git = yield* Git;
            const base = yield* commitRegistryFixture(fabioShard(["Report", "TechnicalReport"]));
            const root = yield* Effect.sync(() => process.cwd());
            yield* fs.remove("packages/identity/registry", { recursive: true });
            yield* fs.remove(layout.data);

            const deleted = yield* Effect.exit(runLintCommand(["identity-registry", "--base", base]));

            expectReportedExit(deleted);
            const errorLines = yield* TestConsole.errorLines;
            const removals = A.filter(
              errorLines,
              (line) => P.isString(line) && Str.includes("[term-removed-without-deprecation]")(line)
            );
            expect(removals).toStrictEqual([
              expect.stringContaining("http://purl.org/spar/fabio/Report is removed without a deprecation."),
              expect.stringContaining("http://purl.org/spar/fabio/TechnicalReport is removed without a deprecation."),
              expect.stringContaining('Namespace "fabio" (http://purl.org/spar/fabio/) is removed'),
            ]);

            // Keeping the snapshot file publishes nothing: the shards are the source.
            const snapshotOnly = yield* git.show(root, base, layout.snapshot);
            yield* fs.makeDirectory("packages/identity/registry", { recursive: true });
            yield* fs.writeFileString(
              layout.snapshot,
              O.getOrElse(snapshotOnly, () => "")
            );
            const kept = yield* Effect.exit(runLintCommand(["identity-registry", "--base", base]));
            expectReportedExit(kept);

            // --fix has nothing to regenerate from, and does not hide the removal.
            const fixed = yield* Effect.exit(runLintCommand(["identity-registry", "--fix", "--base", base]));
            expectReportedExit(fixed);
          })
        ).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make)),
      LINT_TIMEOUT
    );

    it.effect(
      "L0-3 passes a checkout with no registry over a base that published no term, and refuses a base it cannot read",
      () =>
        Effect.andThen(
          temporaryWorkingDirectory,
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            const git = yield* Git;
            yield* writeWorkspaceFixture({ registrySlugs: ["identity", "widget"] });
            const root = yield* Effect.sync(() => process.cwd());
            const commitAll = Effect.fnUntraced(function* (message: string) {
              yield* gitFixture(root);
              yield* git.commit(root, message, { noVerify: true, noGpgSign: true });
              return yield* git.revParse(root, "HEAD");
            });
            const unpublished = yield* commitAll("no registry");
            yield* fs.makeDirectory("packages/identity/registry", { recursive: true });
            yield* fs.writeFileString(layout.snapshot, "{}");
            const broken = yield* commitAll("broken snapshot");
            yield* fs.remove("packages/identity/registry", { recursive: true });

            yield* runLintCommand(["identity-registry", "--base", unpublished]);

            const refused = yield* Effect.exit(runLintCommand(["identity-registry", "--base", broken]));
            expectReportedExit(refused);
            const errorLines = yield* TestConsole.errorLines;
            expect(errorLines).toContainEqual(expect.stringContaining("The base ref's snapshot does not decode:"));
          })
        ).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make)),
      LINT_TIMEOUT
    );

    it.effect(
      "L0-3 the release remedy repairs an understated release that merging and regenerating does not",
      () =>
        Effect.andThen(
          temporaryWorkingDirectory,
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            const git = yield* Git;
            const base = yield* commitRegistryFixture(fabioShard(["Report"]));
            const root = yield* Effect.sync(() => process.cwd());
            const boundAt = (since: string) =>
              fabioShard(["Report", "Thesis"], [{ code: "@beep/widget/Old/Report", local: "Report", since }]);

            // The branch regenerated its change from nothing, so its snapshot holds the new rows at the base's release.
            yield* fs.writeFileString(fabioPath, boundAt("1.0.0"));
            yield* fs.remove(layout.snapshot);
            yield* runIdentityCommand(["registry", "--write"]);
            yield* gitFixture(root);
            yield* git.commit(root, "change on top of the base", { noVerify: true, noGpgSign: true });
            const understated = yield* Effect.exit(runLintCommand(["identity-registry", "--base", base]));
            expectReportedExit(understated);
            const errorLines = yield* TestConsole.errorLines;
            expect(errorLines).toContain(
              `${layout.snapshot} [release-regressed] Against the base ref: The snapshot changes the rows of release 1.0.0 but is released as 1.0.0; the change calls for 1.1.0. Merge the base ref if it is not merged yet, restore its snapshot with \`git restore --source <base> -- ${layout.snapshot}\` (remove the file when the base has none), set the \`since\` of every binding and deprecation the change adds to the release it calls for, then run \`bun run beep identity registry --write\`.`
            );

            // The base is merged already (it is the parent commit), so regenerating alone repairs nothing.
            yield* runIdentityCommand(["registry", "--write"]);
            const logLines = yield* TestConsole.logLines;
            expect(logLines).toContain("[identity:registry] up to date.");
            const regenerated = yield* Effect.exit(runLintCommand(["identity-registry", "--base", base]));
            expectReportedExit(regenerated);

            // The remedy's own steps.
            const baseSnapshot = yield* git.show(root, base, layout.snapshot);
            yield* fs.writeFileString(layout.snapshot, O.getOrThrow(baseSnapshot));
            yield* fs.writeFileString(fabioPath, boundAt("1.1.0"));
            yield* runIdentityCommand(["registry", "--write"]);
            const repaired = yield* Effect.map(fs.readFileString(layout.snapshot), decodeSnapshotText);
            expect(repaired.release).toBe("1.1.0");
            yield* runLintCommand(["identity-registry", "--base", base]);
          })
        ).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make)),
      LINT_TIMEOUT
    );

    it.effect(
      "L0-3 --fix removes a projection module that no shard targets",
      () =>
        Effect.andThen(
          temporaryWorkingDirectory,
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            const projection = "packages/test-runner/src/internal/generated/RegistryTerms.ts";
            yield* writeWorkspaceFixture({
              registrySlugs: ["identity", "widget", "test-runner"],
              extraPackages: ["widget", "test-runner"],
            });
            yield* fs.makeDirectory(layout.shards, { recursive: true });
            const fields = {
              namespace: { prefix: "fabio", iri: "http://purl.org/spar/fabio/" },
              terms: ["Report"],
              bindings: [],
              deprecations: [],
            };
            yield* fs.writeFileString(fabioPath, renderRegistryJson({ ...fields, projection: "@beep/test-runner" }));
            yield* runIdentityCommand(["registry", "--write"]);
            yield* fs.writeFileString(fabioPath, renderRegistryJson(fields));

            yield* runLintCommand(["identity-registry", "--fix"]);

            const logLines = yield* TestConsole.logLines;
            expect(logLines).toContain(`[lint:identity-registry] removed ${projection}`);
            const stale = yield* fs.exists(projection);
            expect(stale).toBe(false);
          })
        ).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make)),
      LINT_TIMEOUT
    );

    it.effect(
      "L0-3 falls back to the empty base and says so when the checkout has no origin/main",
      () =>
        Effect.andThen(
          temporaryWorkingDirectory,
          Effect.gen(function* () {
            yield* commitRegistryFixture(fabioShard(["Report"]));

            yield* runLintCommand(["identity-registry"]);

            const logLines = yield* TestConsole.logLines;
            expect(logLines).toContain(
              "[lint:identity-registry] no merge base with origin/main; the term-stability base is the empty snapshot."
            );
          })
        ).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make)),
      LINT_TIMEOUT
    );

    it.effect(
      "L0-3 reads a base with no snapshot as empty and says so, and refuses a base whose snapshot does not decode",
      () =>
        Effect.andThen(
          temporaryWorkingDirectory,
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            const git = yield* Git;
            yield* commitRegistryFixture(fabioShard(["Report"]));
            const snapshot = yield* fs.readFileString(layout.snapshot);
            const root = yield* Effect.sync(() => process.cwd());
            const commitAll = Effect.fnUntraced(function* (message: string) {
              yield* gitFixture(root);
              yield* git.commit(root, message, { noVerify: true, noGpgSign: true });
              return yield* git.revParse(root, "HEAD");
            });

            yield* fs.remove(layout.snapshot);
            const unpublished = yield* commitAll("base with no snapshot");
            yield* fs.writeFileString(layout.snapshot, "{}");
            const broken = yield* commitAll("base with a broken snapshot");
            yield* fs.writeFileString(layout.snapshot, snapshot);

            yield* runLintCommand(["identity-registry", "--base", unpublished]);
            const logLines = yield* TestConsole.logLines;
            expect(logLines).toContain(
              `[lint:identity-registry] the base ${unpublished} has no ${layout.snapshot}; the term-stability base is the empty snapshot.`
            );

            const refused = yield* Effect.exit(runLintCommand(["identity-registry", "--base", broken]));
            expectReportedExit(refused);
            const errorLines = yield* TestConsole.errorLines;
            expect(errorLines).toStrictEqual([
              "[lint:identity-registry] found 1 violation(s).",
              expect.stringContaining(
                `${layout.snapshot} [registry-generated-drift] The base ref's snapshot does not decode:`
              ),
            ]);
          })
        ).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make)),
      LINT_TIMEOUT
    );

    it.effect(
      "L0-3 renaming a bound module and rebinding it keeps the base ref's published term set",
      () =>
        Effect.andThen(
          temporaryWorkingDirectory,
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            const base = yield* commitRegistryFixture(
              fabioShard(["Report"], [{ code: "@beep/widget/Old/Report", local: "Report", since: "1.0.0" }])
            );
            const before = yield* Effect.map(fs.readFileString(layout.snapshot), decodeSnapshotText);

            const missing = yield* Effect.exit(runIdentityCommand(["rebind", "@beep/widget/Gone", "@beep/widget/New"]));
            expectReportedExit(missing);
            // The module rename comes first: a rebind onto a module the checkout lacks is refused.
            const dangling = yield* Effect.exit(runIdentityCommand(["rebind", "@beep/widget/Old", "@beep/widget/New"]));
            expectReportedExit(dangling);
            const refusedLines = yield* TestConsole.errorLines;
            expect(refusedLines).toContainEqual(
              expect.stringContaining("@beep/widget/New/Report [target-module-missing]")
            );
            const unmoved = yield* fs.readFileString(fabioPath);
            expect(unmoved).toContain('"code": "@beep/widget/Old/Report"');
            yield* fs.rename(WIDGET_OLD_MODULE, WIDGET_NEW_MODULE);
            const stale = yield* Effect.exit(runLintCommand(["identity-registry", "--base", base]));
            expectReportedExit(stale);
            const staleLines = yield* TestConsole.errorLines;
            expect(staleLines).toContainEqual(
              expect.stringContaining("[binding-dangling] The binding code @beep/widget/Old/Report names no module")
            );
            yield* runIdentityCommand(["rebind", "@beep/widget/Old", "@beep/widget/New"]);
            const rebound = yield* fs.readFileString(fabioPath);
            expect(rebound).toContain('"code": "@beep/widget/New/Report"');
            const after = yield* Effect.map(fs.readFileString(layout.snapshot), decodeSnapshotText);

            expect(after.terms).toStrictEqual(before.terms);
            expect(after.namespaces).toStrictEqual(before.namespaces);
            expect(after.deprecations).toStrictEqual(before.deprecations);
            expect(A.map(after.bindings, (binding) => binding.code)).toStrictEqual(["@beep/widget/New/Report"]);
            yield* runLintCommand(["identity-registry", "--base", base]);
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
