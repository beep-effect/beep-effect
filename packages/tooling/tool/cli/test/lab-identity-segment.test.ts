import { CreatePackageIdentityRegistration } from "@beep/repo-cli/commands/CreatePackage/internal/IdentityRegistration";
import {
  LAB_COMPOSERS_END_MARKER,
  LAB_COMPOSERS_START_MARKER,
  LAB_EXPORTS_END_MARKER,
  LAB_EXPORTS_START_MARKER,
  LabIdentitySegment,
} from "@beep/repo-cli/commands/CreatePackage/internal/LabIdentitySegment";
import { FsUtilsLive } from "@beep/repo-utils/FsUtils";
import { UnknownFromJsonString } from "@beep/schema/Unknown";
import { provideScopedLayer } from "@beep/test-utils";
import { A, Str } from "@beep/utils";
import { NodeServices } from "@effect/platform-node";
import { Effect, FileSystem, Layer, Path, Result } from "effect";
import * as O from "effect/Option";
import { describe, expect, it } from "vitest";
import { withTempWorkingDirectory } from "./support/CommandTest.ts";

const encodeJson = UnknownFromJsonString.encodeUnknownSync;

const segmentLayer = Layer.mergeAll(NodeServices.layer, FsUtilsLive.pipe(Layer.provide(NodeServices.layer)));

const IDENTITY_REGISTRY_PATH = "packages/identity/src/packages.ts";
const AUTHORED_TAIL_ANCHOR = "// authored tail";

const registryWithRegions = (
  composerRegionLines: ReadonlyArray<string>,
  exportRegionLines: ReadonlyArray<string>
): string =>
  A.join(
    [
      'const generatedComposers = $I.compose("identity", "widget");',
      "",
      LAB_COMPOSERS_START_MARKER,
      ...composerRegionLines,
      LAB_COMPOSERS_END_MARKER,
      "",
      "const composers = {",
      "  ...generatedComposers,",
      "  ...generatedLabComposers,",
      "};",
      "",
      "export const $IdentityId = composers.$IdentityId;",
      "export const $WidgetId = composers.$WidgetId;",
      "",
      LAB_EXPORTS_START_MARKER,
      ...exportRegionLines,
      LAB_EXPORTS_END_MARKER,
      "",
      AUTHORED_TAIL_ANCHOR,
      "export const registryHelpers = buildRegistryHelpers();",
      "",
    ],
    "\n"
  );

const writeLabsFixture = Effect.fn("writeLabsFixture")(function* (options: {
  readonly labPackages: ReadonlyArray<string>;
  readonly registryContent: string;
  readonly extraPackages?: ReadonlyArray<string>;
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

  yield* fs.makeDirectory(path.join("packages", "identity", "src"), { recursive: true });
  yield* fs.writeFileString(
    path.join("packages", "identity", "package.json"),
    `${encodeJson({ name: "@beep/identity", version: "0.0.0", type: "module" })}\n`
  );
  yield* fs.writeFileString(IDENTITY_REGISTRY_PATH, options.registryContent);

  for (const packageSlug of options.extraPackages ?? []) {
    yield* fs.makeDirectory(path.join("packages", packageSlug), { recursive: true });
    yield* fs.writeFileString(
      path.join("packages", packageSlug, "package.json"),
      `${encodeJson({ name: `@beep/${packageSlug}`, version: "0.0.0", type: "module" })}\n`
    );
  }

  for (const labSlug of options.labPackages) {
    yield* fs.makeDirectory(path.join("apps", "labs", labSlug), { recursive: true });
    yield* fs.writeFileString(
      path.join("apps", "labs", labSlug, "package.json"),
      `${encodeJson({ name: `@beep/${labSlug}`, version: "0.0.0", type: "module" })}\n`
    );
  }
});

const markerIndex = (marker: string) => (content: string) => O.getOrThrow(Str.indexOf(marker)(content));

describe("lab identity segment", () => {
  it("renders the empty composer region as the empty-object state", () => {
    expect(LabIdentitySegment.renderLabComposersRegion([])).toBe("const generatedLabComposers = {};");
  });

  it("renders a short composer region sorted on one biome-canonical line", () => {
    expect(LabIdentitySegment.renderLabComposersRegion(["zeta-lab", "probe-lab"])).toBe(
      'const generatedLabComposers = $I.compose("probe-lab", "zeta-lab");'
    );
  });

  it("expands the composer region when the single-line form exceeds the line width", () => {
    const slugs = [
      "quite-long-lab-slug-alpha",
      "quite-long-lab-slug-bravo",
      "quite-long-lab-slug-charlie",
      "quite-long-lab-slug-delta",
    ];
    const rendered = LabIdentitySegment.renderLabComposersRegion(slugs);
    expect(Str.startsWith("const generatedLabComposers = $I.compose(\n")(rendered)).toBe(true);
    expect(rendered).toContain('  "quite-long-lab-slug-alpha",');
    expect(Str.endsWith('  "quite-long-lab-slug-delta"\n);')(rendered)).toBe(true);
  });

  it("renders the empty export region as an empty string", () => {
    expect(LabIdentitySegment.renderLabExportsRegion([])).toBe("");
  });

  it("renders export blocks sorted by slug through the typed export template", () => {
    const rendered = LabIdentitySegment.renderLabExportsRegion(["zeta-lab", "probe-lab"]);
    expect(rendered).toContain(CreatePackageIdentityRegistration.typedIdentityExportBlock("probe-lab"));
    expect(rendered).toContain("**Example** (Make package ID)");
    expect(rendered).toContain("console.log(id)");
    expect(rendered).not.toContain("void id");
    expect(rendered).toContain("@category configuration");
    expect(markerIndex("$ProbeLabId")(rendered)).toBeLessThan(markerIndex("$ZetaLabId")(rendered));
  });

  it("breaks over-wide export statements the way biome would", () => {
    const rendered = LabIdentitySegment.renderLabExportsRegion(["trustgraph-workbench"]);
    expect(rendered).toContain(
      'export const $TrustgraphWorkbenchId: Identity.IdentityComposer<"@beep/trustgraph-workbench"> =\n  composers.$TrustgraphWorkbenchId;'
    );
  });

  it("syncs a new lab into empty regions and is idempotent afterwards", () =>
    Effect.runPromise(
      withTempWorkingDirectory(
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          yield* writeLabsFixture({
            labPackages: ["probe-lab"],
            registryContent: registryWithRegions(["const generatedLabComposers = {};"], []),
          });

          const first = yield* LabIdentitySegment.syncLabIdentitySegment(".");
          const afterFirst = yield* fs.readFileString(IDENTITY_REGISTRY_PATH);

          expect(first.changed).toBe(true);
          expect(first.state.expectedSlugs).toEqual(["probe-lab"]);
          expect(first.state.actualComposerSlugs).toEqual(["probe-lab"]);
          expect(first.state.actualExportSlugs).toEqual(["probe-lab"]);
          expect(first.state.misplacedSlugs).toEqual([]);
          expect(afterFirst).toContain(LabIdentitySegment.renderLabComposersRegion(["probe-lab"]));
          expect(afterFirst).toContain(LabIdentitySegment.renderLabExportsRegion(["probe-lab"]));

          const second = yield* LabIdentitySegment.syncLabIdentitySegment(".");
          const afterSecond = yield* fs.readFileString(IDENTITY_REGISTRY_PATH);

          expect(second.changed).toBe(false);
          expect(afterSecond).toBe(afterFirst);
        })
      ).pipe(provideScopedLayer(segmentLayer))
    ));

  it("replaces the whole region in one pass and preserves authored text", () =>
    Effect.runPromise(
      withTempWorkingDirectory(
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          yield* writeLabsFixture({
            labPackages: ["probe-lab", "zeta-lab"],
            registryContent: registryWithRegions(
              ['const generatedLabComposers = $I.compose("zeta-lab", "ghost-lab");'],
              ["export const $GhostLabId = composers.$GhostLabId;"]
            ),
          });

          const before = yield* fs.readFileString(IDENTITY_REGISTRY_PATH);
          const result = yield* LabIdentitySegment.syncLabIdentitySegment(".");
          const after = yield* fs.readFileString(IDENTITY_REGISTRY_PATH);

          expect(result.changed).toBe(true);
          expect(after).toContain(LabIdentitySegment.renderLabComposersRegion(["probe-lab", "zeta-lab"]));
          expect(after).toContain(LabIdentitySegment.renderLabExportsRegion(["probe-lab", "zeta-lab"]));
          expect(Str.includes('"ghost-lab"')(after)).toBe(false);
          expect(Str.includes("$GhostLabId")(after)).toBe(false);

          const prefixOf = (content: string) => Str.slice(0, markerIndex(LAB_COMPOSERS_START_MARKER)(content))(content);
          const tailOf = (content: string) => Str.slice(markerIndex(AUTHORED_TAIL_ANCHOR)(content))(content);
          expect(prefixOf(after)).toBe(prefixOf(before));
          expect(tailOf(after)).toBe(tailOf(before));
        })
      ).pipe(provideScopedLayer(segmentLayer))
    ));

  it("fails with the substrate remediation when a marker is missing", () =>
    Effect.runPromise(
      withTempWorkingDirectory(
        Effect.gen(function* () {
          const withoutExportsStart = A.join(
            A.filter(
              Str.split(registryWithRegions(["const generatedLabComposers = {};"], []), "\n"),
              (line) => !Str.startsWith(LAB_EXPORTS_START_MARKER)(line)
            ),
            "\n"
          );
          yield* writeLabsFixture({ labPackages: [], registryContent: withoutExportsStart });

          const outcome = yield* Effect.result(LabIdentitySegment.syncLabIdentitySegment("."));

          expect(Result.isFailure(outcome)).toBe(true);
          if (Result.isFailure(outcome)) {
            expect(outcome.failure.message).toContain(LAB_EXPORTS_START_MARKER);
            expect(outcome.failure.message).toContain("is missing");
            expect(outcome.failure.message).toContain("bun run beep lint identity-registry --fix");
          }
        })
      ).pipe(provideScopedLayer(segmentLayer))
    ));

  it("fails when a marker appears more than once", () =>
    Effect.runPromise(
      withTempWorkingDirectory(
        Effect.gen(function* () {
          const duplicated = Str.concat(
            registryWithRegions(["const generatedLabComposers = {};"], []),
            `${LAB_COMPOSERS_START_MARKER}\n`
          );
          yield* writeLabsFixture({ labPackages: [], registryContent: duplicated });

          const outcome = yield* Effect.result(LabIdentitySegment.diffLabIdentitySegment("."));

          expect(Result.isFailure(outcome)).toBe(true);
          if (Result.isFailure(outcome)) {
            expect(outcome.failure.message).toContain(LAB_COMPOSERS_START_MARKER);
            expect(outcome.failure.message).toContain("appears more than once");
          }
        })
      ).pipe(provideScopedLayer(segmentLayer))
    ));

  it("reports live labs registered outside the generated regions as misplaced", () =>
    Effect.runPromise(
      withTempWorkingDirectory(
        Effect.gen(function* () {
          const misplacedRegistry = A.join(
            [
              'const generatedComposers = $I.compose("identity", "widget", "probe-lab");',
              "",
              LAB_COMPOSERS_START_MARKER,
              "const generatedLabComposers = {};",
              LAB_COMPOSERS_END_MARKER,
              "",
              "export const $IdentityId = composers.$IdentityId;",
              "export const $ProbeLabId = composers.$ProbeLabId;",
              "",
              LAB_EXPORTS_START_MARKER,
              LAB_EXPORTS_END_MARKER,
              "",
            ],
            "\n"
          );
          yield* writeLabsFixture({ labPackages: ["probe-lab"], registryContent: misplacedRegistry });

          const state = yield* LabIdentitySegment.diffLabIdentitySegment(".");

          expect(state.expectedSlugs).toEqual(["probe-lab"]);
          expect(state.actualComposerSlugs).toEqual([]);
          expect(state.actualExportSlugs).toEqual([]);
          expect(state.misplacedSlugs).toEqual(["probe-lab"]);
        })
      ).pipe(provideScopedLayer(segmentLayer))
    ));

  it("derives expected lab slugs from the labs workspace path only", () =>
    Effect.runPromise(
      withTempWorkingDirectory(
        Effect.gen(function* () {
          yield* writeLabsFixture({
            labPackages: ["probe"],
            extraPackages: ["widget"],
            registryContent: registryWithRegions(["const generatedLabComposers = {};"], []),
          });

          const slugs = yield* LabIdentitySegment.expectedLabSlugs(".");

          expect(slugs).toEqual(["probe"]);
        })
      ).pipe(provideScopedLayer(segmentLayer))
    ));
});
