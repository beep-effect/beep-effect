import { resolveLawsPackageScope, scanLawsPackage } from "@beep/repo-cli/commands/Laws/LawsPackage";
import {
  LawsPackageFinding,
  LawsPackageLaw,
  LawsPackageReport,
  LawsPackageScope,
} from "@beep/repo-cli/commands/Laws/LawsPackage.model";
import { FsUtilsLive, TSMorphServiceLive } from "@beep/repo-utils";
import { TSMorphService, TsMorphProjectInspectionRequest } from "@beep/repo-utils/TSMorph/index";
import { provideScopedLayer } from "@beep/test-utils";
import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { Effect, FileSystem, Layer, Path } from "effect";
import * as A from "effect/Array";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";

const platform = Layer.mergeAll(FsUtilsLive, TSMorphServiceLive).pipe(Layer.provideMerge(NodeServices.layer));
const providePlatform = provideScopedLayer(platform);
const write = Effect.fn("LawsPackageTest.write")(function* (root: string, name: string, text: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const target = path.join(root, name);
  yield* fs.makeDirectory(path.dirname(target), { recursive: true });
  yield* fs.writeFileString(target, text);
});
const fixture = Effect.fn("LawsPackageTest.fixture")(function* (directory: string, overlay: boolean) {
  const fs = yield* FileSystem.FileSystem;
  const root = yield* fs.makeTempDirectoryScoped({ prefix: "laws-package-" });
  yield* write(root, "tsconfig.json", '{"include":["unrelated/**/*.ts"]}');
  yield* write(root, "unrelated/root.ts", "export const rootOnly = new Set();");
  yield* write(root, `${directory}/package.json`, '{"name":"@beep/fixture","beep":{"kind":"lab"}}');
  yield* write(
    root,
    `${directory}/${overlay ? "tsconfig.test.json" : "tsconfig.json"}`,
    '{"include":["src","test","../../unrelated/**/*.ts"],"references":[]}'
  );
  yield* write(
    root,
    `${directory}/src/index.ts`,
    A.join(
      [
        'import * as A from "effect/Array";',
        'import { Effect } from "effect";',
        'import { value } from "../../upstream/src/index.ts";',
        "export const helper = { onNone: () => A.empty<string>() };",
        "export const native = new Set();",
        "export const grants = FrozenGrantSet.make([]);",
        "export const load = () => Effect.gen(function* () { return value; });",
      ],
      "\n"
    )
  );
  yield* write(root, `${directory}/test/index.test.ts`, 'import { load } from "../src/index.ts";');
  yield* write(root, "packages/upstream/package.json", '{"name":"@beep/upstream"}');
  yield* write(root, "packages/upstream/src/index.ts", "export const value = new Set();");
  return yield* resolveLawsPackageScope(root, directory);
});

const ScopeArbitrary = S.toArbitrary(LawsPackageScope)(fc);
const ReportArbitrary = S.toArbitrary(LawsPackageReport)(fc);
const FindingArbitrary = S.toArbitrary(LawsPackageFinding)(fc);
const LawArbitrary = S.toArbitrary(LawsPackageLaw)(fc);
const encodeScope = S.encodeEffect(S.fromJsonString(LawsPackageScope));
const decodeScope = S.decodeEffect(S.fromJsonString(LawsPackageScope));
const encodeReport = S.encodeEffect(S.fromJsonString(LawsPackageReport));
const decodeReport = S.decodeEffect(S.fromJsonString(LawsPackageReport));
const encodeFinding = S.encodeEffect(S.fromJsonString(LawsPackageFinding));
const decodeFinding = S.decodeEffect(S.fromJsonString(LawsPackageFinding));
const encodeLaw = S.encodeEffect(S.fromJsonString(LawsPackageLaw));
const decodeLaw = S.decodeEffect(S.fromJsonString(LawsPackageLaw));

describe("package-local law project", { concurrent: false }, () => {
  it("round trips the Laws domain schemas", () =>
    fc.assert(
      fc.asyncProperty(ScopeArbitrary, ReportArbitrary, FindingArbitrary, LawArbitrary, (scope, report, finding, law) =>
        Effect.runPromise(
          Effect.gen(function* () {
            expect(yield* encodeScope(scope).pipe(Effect.flatMap(decodeScope))).toEqual(scope);
            expect(yield* encodeReport(report).pipe(Effect.flatMap(decodeReport))).toEqual(report);
            expect(yield* encodeFinding(finding).pipe(Effect.flatMap(decodeFinding))).toEqual(finding);
            expect(yield* encodeLaw(law).pipe(Effect.flatMap(decodeLaw))).toEqual(law);
          })
        )
      ),
      { numRuns: 30 }
    ));

  it.effect(
    "finds one violation per law with no root or dependency preload",
    Effect.fnUntraced(function* () {
      const scope = yield* fixture("packages/fixture", true);
      const report = yield* scanLawsPackage(scope);
      expect(report.projectSourceFileCount).toBe(2);
      expect(A.map(report.findings, (finding) => [finding.law, finding.findingCount])).toEqual([
        ["terse-effect", 1],
        ["native-runtime", 1],
        ["frozen-grant-set", 1],
        ["effect-fn", 1],
        ["package-test-imports", 1],
      ]);
      expect(report.findings[0]?.advisory).toBe(true);
      expect(report.findings[0]?.strictFailure).toBe(false);
      expect(A.every(A.drop(report.findings, 1), (finding) => finding.strictFailure)).toBe(true);
      expect(
        A.join(
          A.flatMap(report.findings, (finding) => finding.diagnostics),
          "\n"
        )
      ).not.toContain("rootOnly");
      const service = yield* TSMorphService;
      const request = yield* TsMorphProjectInspectionRequest.packageSyntax(scope.repoRoot, scope.overlayPath, []);
      const actualCount = yield* service.inspectProject(request, ({ project }) => project.getSourceFiles().length);
      expect(actualCount).toBe(2);
      const preloaded = TsMorphProjectInspectionRequest.make({ ...request, loadTsconfigFiles: true });
      expect(yield* service.inspectProject(preloaded, ({ project }) => project.getSourceFiles().length)).toBe(3);
      expect(yield* service.inspectProject(request, ({ project }) => project.getSourceFiles().length)).toBe(2);
    }, providePlatform)
  );

  for (const directory of ["apps/demo", "apps/labs/demo", "infra"]) {
    it.effect(
      `omits package test imports for ${directory}`,
      Effect.fnUntraced(function* () {
        const scope = yield* fixture(directory, true);
        const report = yield* scanLawsPackage(scope);
        expect(report.projectSourceFileCount).toBe(2);
        expect(A.map(report.findings, (finding) => finding.law)).toEqual(
          LawsPackageLaw.omitOptions(["package-test-imports"])
        );
      }, providePlatform)
    );
  }

  it.effect(
    "uses a package config when the test overlay is absent and adds root-owned TSX",
    Effect.fnUntraced(function* () {
      const scope = yield* fixture("packages/fixture", false);
      yield* write(scope.repoRoot, "packages/fixture/setup.tsx", "export const setup = FrozenGrantSet.make([]);");
      const report = yield* scanLawsPackage(scope);
      expect(scope.overlayPath).toBe("packages/fixture/tsconfig.json");
      expect(report.projectSourceFileCount).toBe(3);
      expect(A.findFirst(report.findings, (finding) => finding.law === "frozen-grant-set")).toMatchObject({
        value: { findingCount: 2 },
      });
    }, providePlatform)
  );

  it.effect(
    "preserves law exclusions while package-test-imports checks every owner's manifest",
    Effect.fnUntraced(function* () {
      const scope = yield* fixture("packages/ecosystem/fixture", true);
      yield* write(
        scope.repoRoot,
        `${scope.packageDir}/test/index.test.ts`,
        'import { value } from "../../../upstream/src/index.ts";'
      );
      const report = yield* scanLawsPackage(scope);
      expect(A.map(report.findings, (finding) => finding.findingCount)).toEqual([0, 0, 1, 1, 1]);
      expect(report.findings[4]?.diagnostics[0]).toContain("@beep/upstream");
    }, providePlatform)
  );

  it.effect(
    "skips the four syntax laws but retains test-import ownership for an empty package",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "laws-empty-" });
      yield* write(root, "packages/empty/package.json", '{"name":"@beep/empty"}');
      const scope = yield* resolveLawsPackageScope(root, "packages/empty");
      expect(yield* scanLawsPackage(scope)).toEqual(
        LawsPackageReport.make({
          projectSourceFileCount: 0,
          findings: [
            LawsPackageFinding.make({
              law: "package-test-imports",
              findingCount: 0,
              advisory: false,
              strictFailure: false,
              diagnostics: [],
            }),
          ],
        })
      );
    }, providePlatform)
  );

  it.effect(
    "reports an empty non-packages directory with no findings at all",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "laws-empty-app-" });
      yield* write(root, "apps/empty/package.json", '{"name":"@beep/empty-app"}');
      const scope = yield* resolveLawsPackageScope(root, "apps/empty");
      expect(yield* scanLawsPackage(scope)).toEqual(
        LawsPackageReport.make({ projectSourceFileCount: 0, findings: [] })
      );
    }, providePlatform)
  );
});
