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
import { dual, flow } from "effect/Function";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as P from "effect/Predicate";
import * as Ref from "effect/Ref";
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

    // What the lint says to run for a release or a `since` the change against `ref` contradicts.
    const releaseRemedy = (ref: string) =>
      `Merge ${ref} if it is not merged yet, set every \`since\` reported as since-misstated, then run \`bun run beep identity registry --write --base ${ref}\`.`;
    const sinceRemedy = (ref: string) =>
      `Merge ${ref} if it is not merged yet, set that \`since\` in its shard under ${layout.shards} to the release of the change, then run \`bun run beep identity registry --write --base ${ref}\`.`;
    const REPORT_CODE = "@beep/widget/Old/Report";
    const REPORT_IRI = "http://purl.org/spar/fabio/Report";
    const NAMESPACE_REMEDY =
      "Restore the namespace's shard, or retire it by hand: `identity deprecate` retires terms only.";
    // A writer's refusal of the new Report binding at `since` when the change is `release`.
    const writerSince = (since: string, release: string) =>
      `${layout.snapshot} [since-misstated] Against the base ref: The new binding of ${REPORT_IRI} to ${REPORT_CODE} records since ${since}; the change is release ${release}. Set that \`since\` in its shard under ${layout.shards} to the release of the change, then run the same command again.`;
    // Run a writer that refuses, and answer what it reported.
    const refusedLines = Effect.fn("LintIdentityRegistryTest.refusedLines")(function* (args: ReadonlyArray<string>) {
      const before = yield* TestConsole.errorLines;
      const refused = yield* Effect.exit(runIdentityCommand(args));
      expectReportedExit(refused);
      const after = yield* TestConsole.errorLines;
      return A.drop(after, before.length);
    });

    const commitAll = Effect.fn("LintIdentityRegistryTest.commitAll")(function* (message: string) {
      const git = yield* Git;
      const root = yield* Effect.sync(() => process.cwd());
      yield* gitFixture(root);
      yield* git.commit(root, message, { noVerify: true, noGpgSign: true });
      return yield* git.revParse(root, "HEAD");
    });
    // Make `commit` the default base: the fixture's origin/main.
    const setOriginMain = Effect.fn("LintIdentityRegistryTest.setOriginMain")(function* (commit: string) {
      const fs = yield* FileSystem.FileSystem;
      yield* fs.makeDirectory(".git/refs/remotes/origin", { recursive: true });
      yield* fs.writeFileString(".git/refs/remotes/origin/main", `${commit}\n`);
    });
    const expectRelease = Effect.fn("LintIdentityRegistryTest.expectRelease")(function* (release: string) {
      const fs = yield* FileSystem.FileSystem;
      const snapshot = yield* Effect.map(fs.readFileString(layout.snapshot), decodeSnapshotText);
      expect(snapshot.release).toBe(release);
    });
    const setRelease = Effect.fn("LintIdentityRegistryTest.setRelease")(function* (from: string, to: string) {
      const fs = yield* FileSystem.FileSystem;
      const text = yield* fs.readFileString(layout.snapshot);
      yield* fs.writeFileString(layout.snapshot, Str.replace(`"release": "${from}"`, `"release": "${to}"`)(text));
    });
    // The findings the lint reports against `args`, without the count header.
    const lintFindings = Effect.fn("LintIdentityRegistryTest.lintFindings")(function* (args: ReadonlyArray<string>) {
      const before = yield* TestConsole.errorLines;
      const refused = yield* Effect.exit(runLintCommand(["identity-registry", ...args]));
      expectReportedExit(refused);
      const after = yield* TestConsole.errorLines;
      return A.drop(after, before.length + 1);
    });

    it.effect(
      "L0-3 releases a change once, however many commands it is made with",
      () =>
        Effect.andThen(
          temporaryWorkingDirectory,
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            const base = yield* commitRegistryFixture(fabioShard(["Note", "Report", "TechnicalReport"]));
            yield* setOriginMain(base);

            // Additions, one write each: one minor release.
            yield* fs.writeFileString(fabioPath, fabioShard(["Article", "Note", "Report", "TechnicalReport"]));
            yield* runIdentityCommand(["registry", "--write"]);
            yield* expectRelease("1.1.0");
            yield* commitAll("first addition");
            yield* fs.writeFileString(
              fabioPath,
              fabioShard(["Article", "Note", "Report", "TechnicalReport", "Thesis"])
            );
            yield* runIdentityCommand(["registry", "--write"]);
            yield* expectRelease("1.1.0");
            yield* runLintCommand(["identity-registry"]);
            yield* commitAll("second addition");

            // A deprecation makes the whole change a major; a second one is in that major already.
            yield* runIdentityCommand(["deprecate", "fabio:TechnicalReport", "--replacement", "fabio:Report"]);
            yield* expectRelease("2.0.0");
            yield* commitAll("first deprecation");
            yield* runIdentityCommand(["deprecate", "fabio:Note"]);
            yield* expectRelease("2.0.0");
            const snapshot = yield* Effect.map(fs.readFileString(layout.snapshot), decodeSnapshotText);
            expect(A.map(snapshot.deprecations, (row): string => row.since)).toStrictEqual(["2.0.0", "2.0.0"]);
            yield* runLintCommand(["identity-registry"]);
            yield* runIdentityCommand(["registry", "--check"]);

            // Writing again, against the default base or the same base by name, changes nothing.
            const written = yield* fs.readFileString(layout.snapshot);
            yield* runIdentityCommand(["registry", "--write"]);
            yield* runIdentityCommand(["registry", "--write", "--base", base]);
            const logLines = yield* TestConsole.logLines;
            expect(A.takeRight(logLines, 2)).toStrictEqual([
              "[identity:registry] up to date.",
              "[identity:registry] up to date.",
            ]);
            const rewritten = yield* fs.readFileString(layout.snapshot);
            expect(rewritten).toBe(written);
          })
        ).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make)),
      LINT_TIMEOUT
    );

    it.effect(
      "L0-3 an addition whose change becomes a major moves with it, as the writer says",
      () =>
        Effect.andThen(
          temporaryWorkingDirectory,
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            const base = yield* commitRegistryFixture(fabioShard(["Note", "Report"]));
            yield* setOriginMain(base);
            yield* fs.writeFileString(
              fabioPath,
              fabioShard(["Note", "Report"], [{ code: REPORT_CODE, local: "Report", since: "1.1.0" }])
            );
            yield* runIdentityCommand(["registry", "--write"]);
            yield* runLintCommand(["identity-registry"]);
            const shard = yield* fs.readFileString(fabioPath);
            const snapshot = yield* fs.readFileString(layout.snapshot);

            // The deprecation makes the change a major, so the writer refuses the binding it leaves at the minor and
            // writes nothing; the same command runs again once the binding records the major.
            const refused = yield* refusedLines(["deprecate", "fabio:Note"]);
            expect(refused).toContain(writerSince("1.1.0", "2.0.0"));
            const unedited = yield* Effect.forEach([fabioPath, layout.snapshot], (file) => fs.readFileString(file), {
              concurrency: 1,
            });
            expect(unedited).toStrictEqual([shard, snapshot]);
            yield* fs.writeFileString(fabioPath, Str.replace('"since": "1.1.0"', '"since": "2.0.0"')(shard));
            yield* runIdentityCommand(["deprecate", "fabio:Note"]);
            yield* expectRelease("2.0.0");
            yield* runLintCommand(["identity-registry"]);

            // A rebind of the new binding keeps its since; the release stays that of the change.
            yield* fs.rename(WIDGET_OLD_MODULE, WIDGET_NEW_MODULE);
            yield* runIdentityCommand(["rebind", "@beep/widget/Old", "@beep/widget/New"]);
            yield* expectRelease("2.0.0");
            yield* runLintCommand(["identity-registry"]);
          })
        ).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make)),
      LINT_TIMEOUT
    );

    it.effect(
      "L0-3 refuses a release above the change, and regenerating or --fix repairs it",
      () =>
        Effect.andThen(
          temporaryWorkingDirectory,
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            const base = yield* commitRegistryFixture(fabioShard(["Report"]));
            yield* fs.writeFileString(fabioPath, fabioShard(["Report", "Thesis"]));
            yield* runIdentityCommand(["registry", "--write", "--base", base]);

            yield* setRelease("1.1.0", "1.2.0");
            yield* runIdentityCommand(["registry", "--check"]);
            const overstated = yield* lintFindings(["--base", base]);
            expect(overstated).toStrictEqual([
              `${layout.snapshot} [release-overstated] Against the base ref: The snapshot is released as 1.2.0; its change to release 1.0.0 calls for 1.1.0. ${releaseRemedy(base)}`,
            ]);
            yield* runIdentityCommand(["registry", "--write", "--base", base]);
            yield* expectRelease("1.1.0");
            yield* runLintCommand(["identity-registry", "--base", base]);

            // --fix regenerates against the lint's own base.
            yield* setRelease("1.1.0", "1.2.0");
            yield* runLintCommand(["identity-registry", "--fix", "--base", base]);
            yield* expectRelease("1.1.0");
          })
        ).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make)),
      LINT_TIMEOUT
    );

    it.effect(
      "L0-3 refuses a release wound back below its base, and regenerating repairs it",
      () =>
        Effect.andThen(
          temporaryWorkingDirectory,
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            const base = yield* commitRegistryFixture(fabioShard(["Report"]));
            yield* fs.writeFileString(fabioPath, fabioShard(["Report", "Thesis"]));
            yield* runIdentityCommand(["registry", "--write", "--base", base]);
            yield* setRelease("1.1.0", "0.9.0");
            const regressed = yield* lintFindings(["--base", base]);
            expect(regressed).toStrictEqual([
              `${layout.snapshot} [release-regressed] Against the base ref: The snapshot release goes back from 1.0.0 to 0.9.0. ${releaseRemedy(base)}`,
            ]);
            yield* runIdentityCommand(["registry", "--write", "--base", base]);
            yield* expectRelease("1.1.0");
            yield* runLintCommand(["identity-registry", "--base", base]);
          })
        ).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make)),
      LINT_TIMEOUT
    );

    it.effect(
      "L0-3 the writer refuses a since above its change and says to set it",
      () =>
        Effect.andThen(
          temporaryWorkingDirectory,
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            const base = yield* commitRegistryFixture(fabioShard(["Report"]));
            const boundAt = (since: string) => fabioShard(["Report"], [{ code: REPORT_CODE, local: "Report", since }]);
            yield* fs.writeFileString(fabioPath, boundAt("3.0.0"));
            const refused = yield* refusedLines(["registry", "--write", "--base", base]);
            expect(refused).toContain(writerSince("3.0.0", "1.1.0"));
            yield* expectRelease("1.0.0");

            // The lint names the same row, with the release the regeneration would have overstated.
            const findings = yield* lintFindings(["--base", base]);
            expect(findings).toContain(
              `${layout.snapshot} [since-misstated] Against the base ref: The new binding of ${REPORT_IRI} to ${REPORT_CODE} records since 3.0.0; the change is release 1.1.0. ${sinceRemedy(base)}`
            );
            yield* fs.writeFileString(fabioPath, boundAt("1.1.0"));
            yield* runIdentityCommand(["registry", "--write", "--base", base]);
            yield* expectRelease("1.1.0");
            yield* runLintCommand(["identity-registry", "--base", base]);
          })
        ).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make)),
      LINT_TIMEOUT
    );

    it.effect(
      "L0-3 tells a layer exactly what to run once its parent's release is the base",
      () =>
        Effect.andThen(
          temporaryWorkingDirectory,
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            const main = yield* commitRegistryFixture(fabioShard(["Note", "Report", "TechnicalReport"]));
            yield* setOriginMain(main);
            yield* runIdentityCommand(["deprecate", "fabio:TechnicalReport"]);
            const parent = yield* commitAll("the parent layer");

            // Until the parent merges, the stack is one change against main: both layers are release 2.0.0.
            yield* runIdentityCommand(["deprecate", "fabio:Note"]);
            yield* runLintCommand(["identity-registry"]);
            yield* expectRelease("2.0.0");
            yield* commitAll("the layer");

            yield* setOriginMain(parent);
            const findings = yield* lintFindings([]);

            const step = "Merge origin/main if it is not merged yet, set";
            const write = "then run `bun run beep identity registry --write`.";
            expect(findings).toStrictEqual([
              `${layout.snapshot} [since-misstated] Against the base ref: The new deprecation of http://purl.org/spar/fabio/Note records since 2.0.0; the change is release 3.0.0. ${step} that \`since\` in its shard under ${layout.shards} to the release of the change, ${write}`,
              `${layout.snapshot} [release-regressed] Against the base ref: The snapshot changes the rows of release 2.0.0 but is released as 2.0.0; the change calls for 3.0.0. ${step} every \`since\` reported as since-misstated, ${write}`,
            ]);
            const shard = yield* fs.readFileString(fabioPath);
            yield* fs.writeFileString(
              fabioPath,
              Str.replace('fabio/Note",\n      "since": "2.0.0"', 'fabio/Note",\n      "since": "3.0.0"')(shard)
            );
            yield* runIdentityCommand(["registry", "--write"]);
            yield* expectRelease("3.0.0");
            yield* runLintCommand(["identity-registry"]);
          })
        ).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make)),
      LINT_TIMEOUT
    );

    it.effect(
      "L0-3 keeps the release of a layer whose base publishes no term set, and drops an unpublished row as the writer says",
      () =>
        Effect.andThen(
          temporaryWorkingDirectory,
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            yield* writeWorkspaceFixture({ registrySlugs: ["identity", "widget"] });
            yield* fs.writeFileString(WIDGET_OLD_MODULE, "export const report = 1;\n");
            const main = yield* commitAll("no registry");
            yield* setOriginMain(main);
            yield* fs.makeDirectory(layout.shards, { recursive: true });
            const bound = (terms: ReadonlyArray<string>) =>
              fabioShard(terms, [{ code: REPORT_CODE, local: "Report", since: "2.0.0" }]);
            yield* fs.writeFileString(fabioPath, bound(["Report"]));
            yield* runIdentityCommand(["registry", "--write"]);
            yield* expectRelease("2.0.0");
            yield* runIdentityCommand(["registry", "--write"]);
            yield* expectRelease("2.0.0");
            yield* runLintCommand(["identity-registry"]);

            // The registry is unreleased, so an addition keeps the release; the writer still refuses to drop a row
            // of the committed snapshot, which is all it has.
            yield* fs.writeFileString(fabioPath, bound(["Draft", "Report"]));
            yield* runIdentityCommand(["registry", "--write"]);
            yield* expectRelease("2.0.0");
            yield* fs.writeFileString(fabioPath, bound(["Report"]));
            const refused = yield* Effect.exit(runIdentityCommand(["registry", "--write"]));
            expectReportedExit(refused);
            const errorLines = yield* TestConsole.errorLines;
            expect(errorLines).toContainEqual(
              expect.stringContaining(
                `If no branch published it either, remove ${layout.snapshot} and run \`bun run beep identity registry --write\`.`
              )
            );
            yield* fs.remove(layout.snapshot);
            yield* runIdentityCommand(["registry", "--write"]);
            yield* expectRelease("2.0.0");
            yield* runLintCommand(["identity-registry"]);
          })
        ).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make)),
      LINT_TIMEOUT
    );

    it.effect(
      "L0-3 counts two deprecations of a layer whose base publishes no term set as no further release",
      () =>
        Effect.andThen(
          temporaryWorkingDirectory,
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            yield* writeWorkspaceFixture({ registrySlugs: ["identity", "widget"] });
            yield* fs.writeFileString(WIDGET_OLD_MODULE, "export const report = 1;\n");
            const main = yield* commitAll("no registry");
            yield* setOriginMain(main);
            yield* fs.makeDirectory(layout.shards, { recursive: true });
            yield* fs.writeFileString(
              fabioPath,
              fabioShard(["Note", "Report", "Thesis"], [{ code: REPORT_CODE, local: "Report", since: "2.0.0" }])
            );
            yield* runIdentityCommand(["registry", "--write"]);
            yield* expectRelease("2.0.0");

            yield* runIdentityCommand(["deprecate", "fabio:Note", "--replacement", "fabio:Report"]);
            yield* expectRelease("2.0.0");
            yield* runIdentityCommand(["deprecate", "fabio:Thesis"]);
            yield* expectRelease("2.0.0");
            const retired = yield* Effect.map(fs.readFileString(layout.snapshot), decodeSnapshotText);
            expect(A.map(retired.deprecations, (row) => [row.term, row.since])).toStrictEqual([
              ["http://purl.org/spar/fabio/Note", "2.0.0"],
              ["http://purl.org/spar/fabio/Thesis", "2.0.0"],
            ]);
            yield* runIdentityCommand(["registry", "--check"]);
            yield* runLintCommand(["identity-registry"]);
          })
        ).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make)),
      LINT_TIMEOUT
    );

    it.effect(
      "L0-3 the writers refuse a base whose snapshot does not decode, and repair a committed one from its base",
      () =>
        Effect.andThen(
          temporaryWorkingDirectory,
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            const base = yield* commitRegistryFixture(fabioShard(["Note", "Report"]));
            const snapshot = yield* fs.readFileString(layout.snapshot);
            yield* fs.writeFileString(layout.snapshot, "{}");
            const broken = yield* commitAll("a broken snapshot");

            const edit = yield* Effect.exit(runIdentityCommand(["deprecate", "fabio:Note", "--base", broken]));
            expectReportedExit(edit);
            const write = yield* Effect.exit(runIdentityCommand(["registry", "--write", "--base", broken]));
            expectReportedExit(write);
            const errorLines = yield* TestConsole.errorLines;
            const undecodable = expect.stringContaining(
              `${layout.snapshot} [registry-generated-drift] The base ref's snapshot does not decode:`
            );
            expect(errorLines).toStrictEqual([undecodable, "[identity:registry] found 1 finding(s).", undecodable]);

            // The writer's refusal of a removed term the base published names the base's remedy.
            yield* fs.writeFileString(fabioPath, fabioShard(["Report"]));
            const removed = yield* Effect.exit(runIdentityCommand(["registry", "--write", "--base", base]));
            expectReportedExit(removed);
            const removedLines = yield* TestConsole.errorLines;
            expect(removedLines).toContain(
              `${layout.snapshot} [registry-snapshot-break] Against the base ref: http://purl.org/spar/fabio/Note is removed without a deprecation. Restore the IRI, or retire it with \`bun run beep identity deprecate\`, the only writer of a term's deprecation.`
            );
            yield* fs.writeFileString(fabioPath, fabioShard(["Note", "Report"]));
            yield* runIdentityCommand(["registry", "--write", "--base", base]);
            const repaired = yield* fs.readFileString(layout.snapshot);
            expect(repaired).toBe(snapshot);
          })
        ).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make)),
      LINT_TIMEOUT
    );

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
              `${layout.snapshot} [term-removed-without-deprecation] Against the base ref: http://purl.org/spar/fabio/TechnicalReport is removed without a deprecation. Restore the IRI, or retire it with \`bun run beep identity deprecate\`, the only writer of a term's deprecation.`
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

    // The same checkout with its @beep/identity directory at another path; the base still has it at the first.
    const MOVED_IDENTITY = "packages/identity2";
    const movedLayout = RegistryLayout.of(MOVED_IDENTITY);
    const REMOVED_TECHNICAL_REPORT =
      "[term-removed-without-deprecation] Against the base ref: http://purl.org/spar/fabio/TechnicalReport is removed without a deprecation.";

    it.effect(
      "L0-3 finds the base snapshot where the base has it, so moving the identity package hides no removal",
      () =>
        Effect.andThen(
          temporaryWorkingDirectory,
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            const base = yield* commitRegistryFixture(fabioShard(["Report", "TechnicalReport"]));
            yield* fs.rename("packages/identity", MOVED_IDENTITY);

            // A move that keeps the registry publishes what the base published.
            yield* runLintCommand(["identity-registry", "--base", base]);
            const moved = yield* TestConsole.logLines;
            expect(A.takeRight(moved, 2)).toStrictEqual([
              `[lint:identity-registry] the base ${base} has its term snapshot at ${layout.snapshot}; this checkout has it at ${movedLayout.snapshot}.`,
              expect.stringContaining("[lint:identity-registry] OK:"),
            ]);

            // The move drops a term and regenerates the snapshot from nothing.
            yield* fs.writeFileString(`${movedLayout.shards}/fabio.json`, fabioShard(["Report"]));
            yield* fs.remove(movedLayout.snapshot);
            yield* runIdentityCommand(["registry", "--write"]);
            const removed = yield* Effect.exit(runLintCommand(["identity-registry", "--base", base]));
            expectReportedExit(removed);
            const removedLines = yield* TestConsole.errorLines;
            expect(removedLines).toContainEqual(
              expect.stringContaining(`${movedLayout.snapshot} ${REMOVED_TECHNICAL_REPORT}`)
            );

            // A release understated with the move is repaired against the base, wherever the base has its snapshot.
            yield* fs.writeFileString(
              `${movedLayout.shards}/fabio.json`,
              fabioShard(["Report", "TechnicalReport", "Thesis"])
            );
            yield* fs.remove(movedLayout.snapshot);
            yield* runIdentityCommand(["registry", "--write"]);
            const understated = yield* Effect.exit(runLintCommand(["identity-registry", "--base", base]));
            expectReportedExit(understated);
            const understatedLines = yield* TestConsole.errorLines;
            expect(understatedLines).toContain(
              `${movedLayout.snapshot} [release-regressed] Against the base ref: The snapshot changes the rows of release 1.0.0 but is released as 1.0.0; the change calls for 1.1.0. ${releaseRemedy(base)}`
            );
            yield* runIdentityCommand(["registry", "--write", "--base", base]);
            yield* runLintCommand(["identity-registry", "--base", base]);
          })
        ).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make)),
      LINT_TIMEOUT
    );

    it.effect(
      "L0-3 reports every term of a registry deleted together with a move of the identity package",
      () =>
        Effect.andThen(
          temporaryWorkingDirectory,
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            const base = yield* commitRegistryFixture(fabioShard(["Report", "TechnicalReport"]));
            yield* fs.rename("packages/identity", MOVED_IDENTITY);
            yield* fs.remove(`${MOVED_IDENTITY}/registry`, { recursive: true });
            yield* fs.remove(`${MOVED_IDENTITY}/src/internal/generated`, { recursive: true });

            const deleted = yield* Effect.exit(runLintCommand(["identity-registry", "--base", base]));

            expectReportedExit(deleted);
            const errorLines = yield* TestConsole.errorLines;
            const removals = A.filter(
              errorLines,
              (line) => P.isString(line) && Str.includes("[term-removed-without-deprecation]")(line)
            );
            expect(removals).toStrictEqual([
              expect.stringContaining("http://purl.org/spar/fabio/Report is removed without a deprecation."),
              expect.stringContaining(`${movedLayout.snapshot} ${REMOVED_TECHNICAL_REPORT}`),
              expect.stringContaining('Namespace "fabio" (http://purl.org/spar/fabio/) is removed'),
            ]);
          })
        ).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make)),
      LINT_TIMEOUT
    );

    it.effect(
      "L0-3 reads no other package's snapshot as the base, and refuses a base with two identity packages to choose from",
      () =>
        Effect.andThen(
          temporaryWorkingDirectory,
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            const git = yield* Git;
            yield* commitRegistryFixture(fabioShard(["Report", "TechnicalReport"]));
            const root = yield* Effect.sync(() => process.cwd());
            const commitAll = Effect.fnUntraced(function* (message: string) {
              yield* gitFixture(root);
              yield* git.commit(root, message, { noVerify: true, noGpgSign: true });
              return yield* git.revParse(root, "HEAD");
            });
            const snapshot = yield* fs.readFileString(layout.snapshot);
            const copyLayout = RegistryLayout.of("fixtures/copy");
            const copyNamed = Effect.fnUntraced(function* (name: string) {
              yield* fs.makeDirectory("fixtures/copy/registry", { recursive: true });
              yield* fs.writeFileString("fixtures/copy/package.json", `${encodeJson({ name })}\n`);
              yield* fs.writeFileString(copyLayout.snapshot, snapshot);
            });

            // The only snapshot of this base sits beside another package's manifest.
            yield* copyNamed("@beep/copy");
            yield* fs.remove(layout.snapshot);
            const foreign = yield* commitAll("a snapshot of another package");
            yield* fs.writeFileString(layout.snapshot, snapshot);
            yield* runLintCommand(["identity-registry", "--base", foreign]);
            const logLines = yield* TestConsole.logLines;
            expect(logLines).toContain(
              `[lint:identity-registry] the base ${foreign} has no @beep/identity term snapshot; the term-stability base is the empty snapshot.`
            );

            // Two identity packages at the base: the one at this checkout's path is the base.
            yield* copyNamed("@beep/identity");
            const twice = yield* commitAll("two identity packages");
            yield* fs.writeFileString(fabioPath, fabioShard(["Report"]));
            yield* fs.remove(layout.snapshot);
            yield* runIdentityCommand(["registry", "--write"]);
            const removed = yield* Effect.exit(runLintCommand(["identity-registry", "--base", twice]));
            expectReportedExit(removed);

            // After a move neither is, so the base is refused instead of guessed.
            yield* fs.rename("packages/identity", MOVED_IDENTITY);
            const error = yield* Effect.flip(runLintCommand(["identity-registry", "--base", twice]));
            expect(error).toMatchObject({
              _tag: "IdentityRegistryGeneratorError",
              message: `The base ${twice} has more than one @beep/identity term snapshot (${copyLayout.snapshot}, ${layout.snapshot}) and none at ${movedLayout.snapshot}, so the published term set is unknown.`,
            });
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
      "L0-3 the release and since remedies repair a change regenerated from nothing",
      () =>
        Effect.andThen(
          temporaryWorkingDirectory,
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            const base = yield* commitRegistryFixture(fabioShard(["Report"]));
            const boundAt = (since: string) =>
              fabioShard(["Report", "Thesis"], [{ code: REPORT_CODE, local: "Report", since }]);

            // The branch regenerated its change from nothing, so its snapshot holds the new rows at the base's release.
            yield* fs.writeFileString(fabioPath, boundAt("1.0.0"));
            yield* fs.remove(layout.snapshot);
            yield* runIdentityCommand(["registry", "--write"]);
            yield* commitAll("change on top of the base");

            const findings = yield* lintFindings(["--base", base]);

            const since = `${layout.snapshot} [since-misstated] Against the base ref: The new binding of ${REPORT_IRI} to ${REPORT_CODE} records since 1.0.0; the change is release 1.1.0. ${sinceRemedy(base)}`;
            expect(findings).toStrictEqual([
              since,
              `${layout.snapshot} [release-regressed] Against the base ref: The snapshot changes the rows of release 1.0.0 but is released as 1.0.0; the change calls for 1.1.0. ${releaseRemedy(base)}`,
            ]);

            // Regenerating against the base would repair the release, but only a shard edit repairs the row, so the
            // writer refuses until the row records the release of the change.
            const refused = yield* refusedLines(["registry", "--write", "--base", base]);
            expect(refused).toContain(writerSince("1.0.0", "1.1.0"));
            yield* expectRelease("1.0.0");

            // The base is merged already (it is the parent commit); the remedy's other steps.
            yield* fs.writeFileString(fabioPath, boundAt("1.1.0"));
            yield* runIdentityCommand(["registry", "--write", "--base", base]);
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
              `[lint:identity-registry] the base ${unpublished} has no @beep/identity term snapshot; the term-stability base is the empty snapshot.`
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

    it.effect(
      "L0-3 a rebind judges only the codes it moves, and refuses ends under one another",
      () =>
        Effect.andThen(
          temporaryWorkingDirectory,
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            // The Note binding already dangles under the target; the move leaves it alone.
            const danglingNote = "@beep/widget/New/Sub/Note";
            yield* commitRegistryFixture(
              fabioShard(
                ["Note", "Report"],
                [
                  { code: danglingNote, local: "Note", since: "1.0.0" },
                  { code: REPORT_CODE, local: "Report", since: "1.0.0" },
                ]
              )
            );

            // A move under itself would match the codes it moved, so a retry could not finish it.
            const nested = yield* Effect.exit(
              runIdentityCommand(["rebind", "@beep/widget/Old", "@beep/widget/Old/Sub"])
            );
            expectReportedExit(nested);
            const nestedLines = yield* TestConsole.errorLines;
            expect(nestedLines).toContainEqual(
              expect.stringContaining("@beep/widget/Old -> @beep/widget/Old/Sub [nested-move]")
            );

            yield* fs.rename(WIDGET_OLD_MODULE, WIDGET_NEW_MODULE);
            yield* runIdentityCommand(["rebind", "@beep/widget/Old", "@beep/widget/New"]);
            const rebound = yield* fs.readFileString(fabioPath);
            expect(rebound).toContain('"code": "@beep/widget/New/Report"');
            expect(rebound).toContain(`"code": "${danglingNote}"`);
          })
        ).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make)),
      LINT_TIMEOUT
    );

    it.effect(
      "L0-3 a namespace is retired by hand, as the writer's remedy says",
      () =>
        Effect.andThen(
          temporaryWorkingDirectory,
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            const skosPath = `${layout.shards}/skos.json`;
            const skos = (deprecations: ReadonlyArray<unknown>) =>
              renderRegistryJson({
                namespace: { prefix: "skos", iri: "http://www.w3.org/2004/02/skos/core#" },
                terms: ["prefLabel"],
                bindings: [],
                deprecations,
              });
            yield* fs.makeDirectory(layout.shards, { recursive: true });
            yield* fs.writeFileString(skosPath, skos([]));
            const base = yield* commitRegistryFixture(fabioShard(["Report"]));
            yield* fs.remove(fabioPath);

            const refused = yield* refusedLines(["registry", "--write", "--base", base]);
            expect(refused).toContainEqual(
              expect.stringContaining(
                `Namespace "fabio" (http://purl.org/spar/fabio/) is removed without a deprecation of its IRI. ${NAMESPACE_REMEDY}`
              )
            );

            // Every IRI the shard published is deprecated in a remaining shard, the namespace IRI with them.
            yield* fs.writeFileString(
              skosPath,
              skos([
                { term: "http://purl.org/spar/fabio/", since: "2.0.0" },
                { term: REPORT_IRI, since: "2.0.0" },
              ])
            );
            yield* runIdentityCommand(["registry", "--write", "--base", base]);
            yield* expectRelease("2.0.0");
            yield* runLintCommand(["identity-registry", "--base", base]);
          })
        ).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make)),
      LINT_TIMEOUT
    );

    it.effect(
      "L0-3 --fix writes nothing over a base whose snapshot does not decode",
      () =>
        Effect.andThen(
          temporaryWorkingDirectory,
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            yield* commitRegistryFixture(fabioShard(["Report"]));
            const snapshot = yield* fs.readFileString(layout.snapshot);
            const data = yield* fs.readFileString(layout.data);
            yield* fs.writeFileString(layout.snapshot, "{}");
            const broken = yield* commitAll("a broken snapshot");
            yield* fs.writeFileString(layout.snapshot, snapshot);
            yield* fs.writeFileString(fabioPath, fabioShard(["Report", "Thesis"]));

            const findings = yield* lintFindings(["--fix", "--base", broken]);

            expect(findings).toContainEqual(
              expect.stringContaining(
                `${layout.snapshot} [registry-generated-drift] The base ref's snapshot does not decode:`
              )
            );
            const unwritten = yield* Effect.forEach([layout.snapshot, layout.data], (file) => fs.readFileString(file), {
              concurrency: 1,
            });
            expect(unwritten).toStrictEqual([snapshot, data]);
          })
        ).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make)),
      LINT_TIMEOUT
    );

    it.effect(
      "L0-3 reports a term snapshot left without its registry, over a base that publishes none",
      () =>
        Effect.andThen(
          temporaryWorkingDirectory,
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            yield* writeWorkspaceFixture({ registrySlugs: ["identity", "widget"] });
            const main = yield* commitAll("no registry");
            yield* fs.makeDirectory("packages/identity/registry", { recursive: true });
            yield* fs.writeFileString(layout.snapshot, "{}\n");

            const findings = yield* lintFindings(["--base", main]);

            expect(findings).toStrictEqual([
              `${layout.snapshot} [registry-generated-drift] The term snapshot has no registry: there is no shard under ${layout.shards} and no ${layout.data}. Restore the registry, or remove the snapshot with it.`,
            ]);
            yield* fs.remove(layout.snapshot);
            yield* runLintCommand(["identity-registry", "--base", main]);
          })
        ).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make)),
      LINT_TIMEOUT
    );

    it.effect(
      "L0-3 compares the base with the snapshot of the same shards the drift check read",
      () =>
        Effect.andThen(
          temporaryWorkingDirectory,
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            const base = yield* commitRegistryFixture(fabioShard(["Report", "TechnicalReport"]));
            // The removal regenerated from nothing passes --check; only the base comparison sees it.
            yield* fs.writeFileString(fabioPath, fabioShard(["Report"]));
            yield* fs.remove(layout.snapshot);
            yield* runIdentityCommand(["registry", "--write"]);
            const reads = yield* Ref.make(0);
            // A shard that changes after the first read: any later read sees a shard that does not decode.
            const changing = FileSystem.FileSystem.of({
              ...fs,
              readFileString: Effect.fn("LintIdentityRegistryTest.changingRead")(function* (path, encoding) {
                if (!Str.endsWith("fabio.json")(path)) {
                  return yield* fs.readFileString(path, encoding);
                }
                const count = yield* Ref.getAndUpdate(reads, (seen) => seen + 1);
                return count === 0 ? yield* fs.readFileString(path, encoding) : "not json";
              }),
            });

            const findings = yield* lintFindings(["--base", base]).pipe(
              Effect.provideService(FileSystem.FileSystem, changing)
            );

            const readCount = yield* Ref.get(reads);
            expect(readCount).toBe(1);
            expect(findings).toContainEqual(expect.stringContaining(`${layout.snapshot} ${REMOVED_TECHNICAL_REPORT}`));
          })
        ).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make)),
      LINT_TIMEOUT
    );

    it.effect(
      "L0-3 reads an explicit base at the commit its ref names when the run starts",
      () =>
        Effect.andThen(
          temporaryWorkingDirectory,
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            const git = yield* Git;
            const first = yield* commitRegistryFixture(fabioShard(["Report"]));
            yield* fs.writeFileString(fabioPath, fabioShard(["Report", "Thesis"]));
            yield* runIdentityCommand(["registry", "--write"]);
            const second = yield* commitAll("an addition");
            // The checkout is the first commit's registry again; the ref names that commit.
            yield* fs.writeFileString(fabioPath, fabioShard(["Report"]));
            yield* runIdentityCommand(["registry", "--write", "--base", first]);
            yield* fs.writeFileString(".git/refs/heads/release-base", `${first}\n`);
            // The ref moves to the second commit as soon as the base tree has been listed.
            const moving = Git.of({
              ...git,
              lsTree: dual(
                (args) => P.isString(args[1]),
                (cwd: string, ref: string, options?: { readonly fullTree?: boolean }) =>
                  Effect.tap(git.lsTree(cwd, ref, options), () =>
                    Effect.orDie(fs.writeFileString(".git/refs/heads/release-base", `${second}\n`))
                  )
              ),
            });

            yield* runLintCommand(["identity-registry", "--base", "release-base"]).pipe(
              Effect.provideService(Git, moving)
            );

            const logLines = yield* TestConsole.logLines;
            expect(A.takeRight(logLines, 1)).toStrictEqual([expect.stringContaining("[lint:identity-registry] OK:")]);
            const moved = yield* fs.readFileString(".git/refs/heads/release-base");
            expect(moved).toBe(`${second}\n`);
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
