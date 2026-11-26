/**
 * Which package manager drives this workspace, and how we work that out.
 *
 * **Details**
 *
 * `PackageManagerName` is structurally identical to `@beep/lockfiles`'
 * `LockfileFormat` and assigns freely to it — which is exactly what
 * `LockfileReader` relies on. They are kept as separate names because they are
 * separate concepts (which PM runs the repo vs. which lockfile grammar to
 * parse), and because `@beep/package-json` already exports a
 * `PackageManager` class for the corepack `pnpm@10.33.0` field.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoWorkspacesId } from "@beep/identity/packages";
import { PackageManager } from "@beep/package-json";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { dual } from "effect/Function";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { WorkspaceManifestError } from "./WorkspacePackage.ts";

const $I = $RepoWorkspacesId.create("PackageManagerName");

const JsonValue = S.fromJsonString(S.Unknown);

class PackageManagerDetectorDefect extends S.TaggedError<
  PackageManagerDetectorDefect,
  { readonly brand: unique symbol }
>($I`PackageManagerDetectorDefect`)(
  "PackageManagerDetectorDefect",
  {
    message: S.String,
  },
  $I.annoteError<PackageManagerDetectorDefect>("PackageManagerDetectorDefect", {
    description: "An invalid manifest value or unstubbed package manager detector.",
  })
) {}

/**
 * **Example** (Validate supported manager names)
 *
 * ```ts
 * import { PackageManagerName } from "@beep/repo-workspaces/PackageManagerName";
 * import * as S from "effect/Schema";
 *
 * console.log(S.is(PackageManagerName)("pnpm")) // true
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const PackageManagerName = LiteralKit(["npm", "pnpm", "yarn", "bun"]).pipe(
  $I.annoteSchema("PackageManagerName", { description: "The four package managers this package understands." })
);

/**
 * The decoded type of {@link (PackageManagerName:variable)}: `"npm" | "pnpm" | "yarn" | "bun"`.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type PackageManagerName = typeof PackageManagerName.Type;

/**
 * **Details**
 *
 * One vocabulary serves both halves of the detection contract: the failure path
 * reports every member as `PackageManagerDetectionError.checked`, and the
 * success path reports the one that fired as
 * `DetectedPackageManager.evidence`. A closed literal union rather than
 * free text, so a consumer logging *why* a workspace was classified asserts
 * against the kit's vocabulary instead of re-deriving the probe with its own
 * filesystem reads.
 *
 * The `package.json#…` spellings name manifest *fields*; the rest are marker
 * files at the workspace root.
 *
 * **Example** (Recognize a declaration marker)
 *
 * ```ts
 * import { PackageManagerEvidence } from "@beep/repo-workspaces/PackageManagerName";
 * import * as S from "effect/Schema";
 *
 * console.log(S.is(PackageManagerEvidence)("package.json#packageManager")) // true
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const PackageManagerEvidence = LiteralKit([
  "pnpm-workspace.yaml",
  "bun.lock",
  "bun.lockb",
  "yarn.lock",
  "package.json#workspaces",
  "pnpm-lock.yaml",
  "package-lock.json",
  "package.json#devEngines.packageManager",
  "package.json#packageManager",
]).pipe(
  $I.annoteSchema("PackageManagerEvidence", {
    description: "The markers PackageManagerDetector probes, in the priority order it probes them.",
  })
);

/**
 * The decoded type of {@link (PackageManagerEvidence:variable)}: the marker
 * that decided a detection.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type PackageManagerEvidence = typeof PackageManagerEvidence.Type;

/**
 * **Details**
 *
 * `version` is `Option.none()` unless a manifest field naming the *same* manager
 * that was detected also carries a version — a `packageManager: "yarn@4"` in a
 * pnpm workspace tells us nothing about pnpm's version, so it is not reported as
 * one. The two fields consulted are the corepack top-level `packageManager` and
 * `devEngines.packageManager`; see {@link PackageManagerDetector} for the
 * precedence between them.
 *
 * `evidence` is the rung of the priority order that decided the **name** — the
 * verdict's provenance, in the same vocabulary the failure path reports as
 * `PackageManagerDetectionError.checked`. For the bun and yarn rungs the
 * lockfile is the recorded signal even though the rung is a conjunction (the
 * lockfile *plus* a manifest field naming the manager): the manifest field alone
 * would have resolved in the declaration tier, so the lockfile is what this rung
 * added. The version's provenance is deliberately not carried — it follows the
 * two-field precedence above, which is a rule, not a probe.
 *
 * **Example** (Construct a detection with workspace evidence)
 *
 * ```ts
 * import { DetectedPackageManager } from "@beep/repo-workspaces/PackageManagerName";
 * import * as O from "effect/Option";
 *
 * const detected = DetectedPackageManager.make({
 *   name: "pnpm",
 *   version: O.none(),
 *   runtime: "node",
 *   evidence: "pnpm-workspace.yaml",
 * });
 *
 * console.log(detected.evidence) // pnpm-workspace.yaml
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class DetectedPackageManager extends S.Opaque<DetectedPackageManager, { readonly brand: unique symbol }>()(
  S.Struct({
    /** The detected manager. */
    name: PackageManagerName.pipe(
      $I.annoteKey("DetectedPackageManager.name", { description: "The detected manager." })
    ),
    /** Its version, when a manifest field agrees on the manager and carries one. */
    version: S.Option(S.String).pipe(
      $I.annoteKey("DetectedPackageManager.version", {
        description: "Its version, when a manifest field agrees on the manager and carries one.",
      })
    ),
    /** The JavaScript runtime the manager implies. */
    runtime: S.Literals(["node", "bun"]).pipe(
      $I.annoteKey("DetectedPackageManager.runtime", { description: "The JavaScript runtime the manager implies." })
    ),
    /** The rung of the priority order that decided the name. */
    evidence: PackageManagerEvidence.pipe(
      $I.annoteKey("DetectedPackageManager.evidence", {
        description: "The rung of the priority order that decided the name.",
      })
    ),
  }).pipe(
    $I.annoteSchema("DetectedPackageManager", {
      description: "The outcome of package-manager detection at a workspace root.",
    })
  )
) {}

/**
 * @category type-level
 * @since 0.0.0
 */
export declare namespace DetectedPackageManager {
  /**
   * The plain, unbranded encoded shape of a {@link DetectedPackageManager}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof DetectedPackageManager.Encoded;
}

const ManagerHint = S.Struct({
  name: S.String.pipe($I.annoteKey("ManagerHint.name", { description: "The manager name declared by the manifest." })),
  version: S.Option(S.String).pipe(
    $I.annoteKey("ManagerHint.version", { description: "The exact parsed version, or none when absent or invalid." })
  ),
}).pipe(
  $I.annoteSchema("ManagerHint", {
    description: "A normalized manifest manager hint whose invalid version does not discard its name.",
  })
);

type ManagerHint = typeof ManagerHint.Type;

interface Hints {
  readonly corepack: O.Option<ManagerHint>;
  readonly devEngines: O.Option<ManagerHint>;
}

/**
 * Whether `value` is a non-null, non-array object — corepack's own shape test.
 *
 * **Example** (Validate a manifest object)
 *
 * ```ts
 * import { JsonObject } from "@beep/repo-workspaces/PackageManagerName";
 * import * as S from "effect/Schema";
 *
 * console.log(S.is(JsonObject)({ packageManager: "pnpm@10.33.0" })) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const JsonObject = S.Record(S.String, S.Unknown).pipe(
  $I.annoteSchema("JsonObject", {
    description: "A string-keyed object accepted as a manifest or policy, excluding null, arrays and functions.",
  })
);

/**
 * @category type-level
 * @since 0.0.0
 */
export type JsonObject = typeof JsonObject.Type;

/**
 * Whether a value satisfies the manifest-object schema.
 *
 * **Example** (Reject an array as a manifest object)
 *
 * ```ts
 * import { isPlainObject } from "@beep/repo-workspaces/PackageManagerName";
 *
 * console.log(isPlainObject([])) // false
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export const isPlainObject = S.is(JsonObject);

const exactVersionOf: {
  (name: string, version: string): O.Option<string>;
  (version: string): (name: string) => O.Option<string>;
} = dual(
  2,
  (name: string, version: string): O.Option<string> =>
    S.decodeOption(PackageManager.FromString)(`${name}@${version}`).pipe(O.map((pm) => pm.version))
);

const devEnginesHint = (manifest: Record<string, unknown>): O.Option<ManagerHint> => {
  const devEngines = manifest.devEngines;
  if (!isPlainObject(devEngines)) return O.none();

  const slot = devEngines.packageManager;
  if (!isPlainObject(slot)) return O.none();

  const name = slot.name;
  if (!P.isString(name) || name === "" || Str.includes("@")(name)) return O.none();

  const version = slot.version;
  return ManagerHint.makeOption({
    name,
    version: P.isString(version) && version !== "" ? exactVersionOf(name, version) : O.none<string>(),
  });
};

const corepackHint = (manifest: Record<string, unknown>): O.Option<ManagerHint> => {
  const raw = manifest.packageManager;
  if (!P.isString(raw)) return O.none();
  return S.decodeOption(PackageManager.FromString)(raw).pipe(
    O.map((pm) => ManagerHint.make({ name: pm.name, version: O.some(pm.version) }))
  );
};

/**
 * **Example** (Report the root and checked marker)
 *
 * ```ts
 * import { PackageManagerDetectionError } from "@beep/repo-workspaces/PackageManagerName";
 *
 * const error = PackageManagerDetectionError.make({
 *   root: "/repo",
 *   checked: ["pnpm-workspace.yaml"],
 * });
 *
 * console.log(error.message) // No package manager detected at /repo (checked pnpm-workspace.yaml)
 * ```
 *
 * @public
 * @category errors
 * @since 0.0.0
 */
export class PackageManagerDetectionError extends S.TaggedError<
  PackageManagerDetectionError,
  { readonly brand: unique symbol }
>($I`PackageManagerDetectionError`)(
  "PackageManagerDetectionError",
  {
    /** The workspace root that was probed. */
    root: S.String.pipe(
      $I.annoteKey("PackageManagerDetectionError.root", { description: "The workspace root that was probed." })
    ),
    /** The marker files probed, in the order they were probed. */
    checked: S.Array(S.String).pipe(
      $I.annoteKey("PackageManagerDetectionError.checked", {
        description: "The marker files probed, in the order they were probed.",
      })
    ),
  },
  $I.annoteError<PackageManagerDetectionError>("PackageManagerDetectionError", {
    description:
      "Raised when a directory carries no lockfile and no workspace configuration, so no package manager can be attributed to it.",
  })
) {
  /**
   * Renders the root and probed markers into a one-line message.
   *
   * **Example** (Read the detection failure message)
   *
   * ```ts
   * import { PackageManagerDetectionError } from "@beep/repo-workspaces/PackageManagerName";
   *
   * const error = PackageManagerDetectionError.make({
   *   root: "/repo",
   *   checked: ["pnpm-workspace.yaml"],
   * });
   *
   * console.log(error.message) // No package manager detected at /repo (checked pnpm-workspace.yaml)
   * ```
   *
   * @returns The one-line sentence a log or a thrown error shows.
   * @category getters
   * @since 0.0.0
   */
  override get message(): string {
    return `No package manager detected at ${this.root} (checked ${A.join(this.checked, ", ")})`;
  }
}

const MARKERS_IN_PRIORITY_ORDER = PackageManagerEvidence.literals;

/**
 * Every failure {@link PackageManagerDetector} can surface: no manager could be
 * attributed to the root, or the root's `package.json` exists but cannot be read
 * or parsed.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type PackageManagerDetectionFailure = PackageManagerDetectionError | WorkspaceManifestError;

/**
 * The {@link PackageManagerDetector} service shape.
 *
 * **Details**
 *
 * Exported so a consumer can type a bespoke double against the contract without
 * reaching into the class — the `WorkspaceDiscoveryShape` /
 * `PublishabilityDetectorShape` convention.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export interface PackageManagerDetectorShape {
  /**
   * Detect the package manager at a workspace root.
   *
   * **Example** (Compose a stubbed detection)
   *
   * ```ts
   * import { PackageManagerDetectionError, PackageManagerDetector } from "@beep/repo-workspaces/PackageManagerName";
   * import * as Effect from "effect/Effect";
   *
   * const detector = PackageManagerDetector.makeTest({
   *   detect: () => Effect.fail(PackageManagerDetectionError.make({
   *     root: "/repo",
   *     checked: [],
   *   })),
   * });
   *
   * console.log(Effect.isEffect(detector.detect("/repo"))) // true
   * ```
   *
   * @category queries
   * @since 0.0.0
   */
  readonly detect: (root: string) => Effect.Effect<DetectedPackageManager, PackageManagerDetectionFailure>;
}

/**
 * Detects which package manager owns a workspace root.
 *
 * **Details**
 *
 * **Lockfile evidence is the primary signal** — it is what says which manager
 * actually ran. Priority, first match wins: a `pnpm-workspace.yaml` means pnpm;
 * a bun lockfile *plus* a manifest field naming bun means bun; a `yarn.lock`
 * *plus* a manifest field naming yarn means yarn; a root `package.json` with a
 * `workspaces` field falls back to npm.
 *
 * The manifest conjunction is deliberate: a stray `yarn.lock` in an npm repo is
 * common, and only a declared manager name disambiguates it.
 *
 * **Two manifest fields declare a manager, and they are not interchangeable.**
 * Corepack reads both, and this is the rule that falls out of how it treats
 * them:
 *
 * - `devEngines.packageManager.name` is authoritative for the **name**.
 *   Corepack *errors* when a top-level `packageManager` disagrees with it (per
 *   `devEngines.packageManager.onFail`), so where both are present and disagree,
 *   `devEngines` is the one to believe. When `devEngines` names a manager, the
 *   top-level field's name is not consulted as a disambiguator at all.
 * - The top-level `packageManager` is authoritative for the exact **version**:
 *   it is the field that carries the integrity hash. Where both name the same
 *   manager, its version wins; where it is absent, `devEngines.packageManager.version`
 *   supplies the version instead.
 *
 * A version is reported **only when the field it came from names the manager
 * that was actually detected**. A `packageManager: "yarn@4"` in a pnpm workspace
 * says nothing about pnpm's version, so no version is reported — and the same
 * discipline applies to `devEngines`.
 *
 * Malformed manifest *hints* are ignored rather than fatal, matching corepack: a
 * non-object or array `devEngines.packageManager`, a `name` containing `@`, or a
 * version that is not an exact version cannot turn a detectable workspace into a
 * detection failure. A manifest that exists but cannot be **read or parsed** is a
 * different thing entirely and fails with a `WorkspaceManifestError` — a corrupt
 * root manifest is a real problem, not a missing hint.
 *
 * **Example** (Compose detection through the service)
 *
 * ```ts
 * import { PackageManagerDetector } from "@beep/repo-workspaces/PackageManagerName";
 * import * as Effect from "effect/Effect";
 *
 * const program = Effect.flatMap(PackageManagerDetector, (detector) => detector.detect("/repo"));
 *
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @public
 * @category services
 * @since 0.0.0
 */
export class PackageManagerDetector extends Context.Service<PackageManagerDetector, PackageManagerDetectorShape>()(
  $I`PackageManagerDetector`
) {
  /**
   * Builds the service over core `FileSystem` and `Path`.
   *
   * **Example** (Construct the filesystem-backed service effect)
   *
   * ```ts
   * import { PackageManagerDetector } from "@beep/repo-workspaces/PackageManagerName";
   * import * as Effect from "effect/Effect";
   *
   * console.log(Effect.isEffect(PackageManagerDetector.make)) // true
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  static readonly make: Effect.Effect<
    { readonly detect: (root: string) => Effect.Effect<DetectedPackageManager, PackageManagerDetectionFailure> },
    never,
    FileSystem.FileSystem | Path.Path
  > = Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;

    const has: {
      (root: string, file: string): Effect.Effect<boolean>;
      (file: string): (root: string) => Effect.Effect<boolean>;
    } = dual(
      2,
      (root: string, file: string): Effect.Effect<boolean> =>
        fs.exists(path.join(root, file)).pipe(Effect.orElseSucceed(() => false))
    );

    const manifestOf = Effect.fnUntraced(function* (
      root: string
    ): Effect.fn.Return<O.Option<Record<string, unknown>>, WorkspaceManifestError> {
      const packageJsonPath = path.join(root, "package.json");
      const exists = yield* fs.exists(packageJsonPath).pipe(Effect.orElseSucceed(() => false));
      if (!exists) return O.none<Record<string, unknown>>();

      const content = yield* fs
        .readFileString(packageJsonPath)
        .pipe(Effect.mapError((cause) => WorkspaceManifestError.make({ packageJsonPath, kind: "read", cause })));

      const parsed = yield* S.decodeEffect(JsonValue)(content).pipe(
        Effect.mapError((cause) => WorkspaceManifestError.make({ packageJsonPath, kind: "decode", cause }))
      );

      if (!isPlainObject(parsed)) {
        return yield* WorkspaceManifestError.make({
          packageJsonPath,
          kind: "decode",
          cause: PackageManagerDetectorDefect.make({ message: "package.json is not a JSON object" }),
        });
      }
      return O.some(parsed);
    });

    const declaredName = (hints: Hints): O.Option<string> =>
      O.map(
        O.orElse(hints.devEngines, () => hints.corepack),
        (hint) => hint.name
      );

    const namesManager: {
      (hints: Hints, name: PackageManagerName): boolean;
      (name: PackageManagerName): (hints: Hints) => boolean;
    } = dual(2, (hints: Hints, name: PackageManagerName): boolean => O.contains(declaredName(hints), name));

    const versionFor: {
      (hints: Hints, name: PackageManagerName): O.Option<string>;
      (name: PackageManagerName): (hints: Hints) => O.Option<string>;
    } = dual(2, (hints: Hints, name: PackageManagerName): O.Option<string> => {
      if (!namesManager(hints, name)) return O.none();
      const fromCorepack = O.flatMap(hints.corepack, (hint) => (hint.name === name ? hint.version : O.none<string>()));
      return O.orElse(fromCorepack, () => O.flatMap(hints.devEngines, (hint) => hint.version));
    });

    const detected = (hints: Hints, name: PackageManagerName, evidence: PackageManagerEvidence) =>
      DetectedPackageManager.make({
        name,
        version: versionFor(hints, name),
        runtime: name === "bun" ? "bun" : "node",
        evidence,
      });

    const markerRung = (
      root: string,
      hints: Hints,
      marker: PackageManagerEvidence,
      name: PackageManagerName,
      needsDeclaration: boolean
    ): Effect.Effect<O.Option<DetectedPackageManager>> =>
      needsDeclaration && !namesManager(hints, name)
        ? Effect.succeedNone
        : Effect.map(has(root, marker), (present) => (present ? O.some(detected(hints, name, marker)) : O.none()));

    const workspacesRung = (
      manifest: O.Option<Record<string, unknown>>,
      hints: Hints
    ): O.Option<DetectedPackageManager> =>
      O.map(
        O.filter(manifest, (fields) => P.isNotNullish(fields.workspaces)),
        () => detected(hints, "npm", "package.json#workspaces")
      );

    const declarationRung = (hints: Hints): O.Option<DetectedPackageManager> =>
      O.map(O.filter(declaredName(hints), S.is(PackageManagerName)), (name) =>
        detected(
          hints,
          name,
          O.isSome(hints.devEngines) ? "package.json#devEngines.packageManager" : "package.json#packageManager"
        )
      );

    const detect = Effect.fn("PackageManagerDetector.detect")(function* (root: string) {
      const manifest = yield* manifestOf(root);
      const hints: Hints = {
        devEngines: O.flatMap(manifest, devEnginesHint),
        corepack: O.flatMap(manifest, corepackHint),
      };

      const yarnLockWrittenMidDetection = markerRung(root, hints, "yarn.lock", "yarn", true);
      const rungs: ReadonlyArray<Effect.Effect<O.Option<DetectedPackageManager>>> = [
        markerRung(root, hints, "pnpm-workspace.yaml", "pnpm", false),
        markerRung(root, hints, "bun.lock", "bun", true),
        markerRung(root, hints, "bun.lockb", "bun", true),
        markerRung(root, hints, "yarn.lock", "yarn", true),
        Effect.sync(() => workspacesRung(manifest, hints)),
        markerRung(root, hints, "pnpm-lock.yaml", "pnpm", false),
        yarnLockWrittenMidDetection,
        markerRung(root, hints, "package-lock.json", "npm", false),
        Effect.sync(() => declarationRung(hints)),
      ];
      for (const rung of rungs) {
        const decided = yield* rung;
        if (O.isSome(decided)) return decided.value;
      }

      return yield* PackageManagerDetectionError.make({ root, checked: MARKERS_IN_PRIORITY_ORDER });
    });

    return {
      detect: (root: string) =>
        detect(root).pipe(Effect.provideService(FileSystem.FileSystem, fs), Effect.provideService(Path.Path, path)),
    };
  });

  /**
   * Provides the live detector over core `FileSystem` and `Path`.
   *
   * **Example** (Inspect the live detector layer)
   *
   * ```ts
   * import { PackageManagerDetector } from "@beep/repo-workspaces/PackageManagerName";
   * import * as Layer from "effect/Layer";
   *
   * console.log(Layer.isLayer(PackageManagerDetector.layer)) // true
   * ```
   *
   * @category layers
   * @since 0.0.0
   */
  static readonly layer: Layer.Layer<PackageManagerDetector, never, FileSystem.FileSystem | Path.Path> = Layer.effect(
    PackageManagerDetector,
    PackageManagerDetector.make
  );

  /**
   * The sanctioned in-memory double.
   *
   * **Gotchas**
   *
   * **`detect` has no honest default, so an unstubbed call dies** — the
   * `WorkspaceDiscovery.info` posture, for the same reason. A stand-in that
   * answered `"pnpm"` would hand a consumer a fact nothing established, and it
   * would contradict the very service it stands in for: the live detector's
   * defining property is that it refuses to guess when no evidence matches.
   * A double that guesses is worse than no double.
   *
   * Failing typed would be the subtler mistake: `PackageManagerDetectionError`
   * reads as a legitimate "no manager here" answer, so a consumer would branch
   * on it and proceed, never learning that the test simply forgot to stub.
   *
   * The defect is also not absorbed by `Effect.catch` or any typed-error
   * handler — deliberately, so code under test with a best-effort `catch`
   * around detection cannot make the mandatory stub look optional; the
   * unstubbed call still fails the test.
   *
   * **Example** (Stub pnpm detection with workspace evidence)
   *
   * ```ts
   * import { DetectedPackageManager, PackageManagerDetector } from "@beep/repo-workspaces/PackageManagerName";
   * import * as Effect from "effect/Effect";
   * import * as O from "effect/Option";
   *
   * const detector = PackageManagerDetector.makeTest({
   *   detect: () =>
   *     Effect.succeed(
   *       DetectedPackageManager.make({
   *         name: "pnpm",
   *         version: O.none(),
   *         runtime: "node",
   *         evidence: "pnpm-workspace.yaml",
   *       }),
   *     ),
   * });
   *
   * console.log(Effect.runSync(detector.detect("/repo")).name) // pnpm
   * ```
   *
   * @param overrides - Members to supply; anything omitted dies on use.
   * @category testing
   * @since 0.0.0
   */
  static readonly makeTest = (overrides: Partial<PackageManagerDetectorShape> = {}): PackageManagerDetectorShape => ({
    detect: () =>
      Effect.die(
        PackageManagerDetectorDefect.make({
          message:
            "PackageManagerDetector.makeTest: detect() was called but not stubbed — no honest default DetectedPackageManager exists for a test double; pass a `detect` override.",
        })
      ),
    ...overrides,
  });

  /**
   * {@link PackageManagerDetector.makeTest} behind `Layer.succeed`.
   *
   * **Gotchas**
   *
   * A parameterized layer factory mints a **fresh reference per call**, and
   * layers memoize by reference — bind the result to a `const` and reuse it
   * rather than calling `layerTest(...)` at each composition site.
   *
   * Pairs with `WorkspaceRoot.layerTest` and `WorkspaceDiscovery.layerTest` to
   * stand up the whole discovery path with no filesystem at all.
   *
   * **Example** (Provide a stubbed detector layer)
   *
   * ```ts
   * import { DetectedPackageManager, PackageManagerDetector } from "@beep/repo-workspaces/PackageManagerName";
   * import * as Effect from "effect/Effect";
   * import * as O from "effect/Option";
   *
   * const TestDetector = PackageManagerDetector.layerTest({
   *   detect: () => Effect.succeed(DetectedPackageManager.make({
   *     name: "bun",
   *     version: O.none(),
   *     runtime: "bun",
   *     evidence: "bun.lock",
   *   })),
   * });
   * const program = Effect.flatMap(PackageManagerDetector, (detector) => detector.detect("/repo"));
   * const detected = Effect.runSync(Effect.provide(program, TestDetector));
   *
   * console.log(detected.name) // bun
   * ```
   *
   * @category layers
   * @since 0.0.0
   */
  static readonly layerTest = (
    overrides: Partial<PackageManagerDetectorShape> = {}
  ): Layer.Layer<PackageManagerDetector> =>
    Layer.succeed(PackageManagerDetector, PackageManagerDetector.makeTest(overrides));
}
