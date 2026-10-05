/**
 * OCCT geometry kernel service: build solids from a technical spec and project
 * them with exact hidden-line removal, orthographic or perspective.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { createRequire } from "node:module";
import { $OcctId } from "@beep/identity/packages";
import { A } from "@beep/utils";
import { Context, Effect, FileSystem, Layer, Path } from "effect";
import * as S from "effect/Schema";
import * as replicad from "replicad";
import opencascade from "replicad-opencascadejs";
import { buildCompound, project, summarize } from "./internal/kernel.ts";
import { OcctError } from "./Occt.errors.ts";
import { KernelInfo, ProjectionRequest, SolidSpec } from "./Occt.models.ts";
import type { OpenCascadeInstance } from "replicad-opencascadejs";
import type { EdgeSet, SolidSummary } from "./Occt.models.ts";

const $I = $OcctId.create("Occt.service");
const require = createRequire(import.meta.url);
const validateProjectionRequest = S.decodeUnknownEffect(S.toType(ProjectionRequest));
const validateSolidSpec = S.decodeUnknownEffect(S.toType(SolidSpec));
const PackageVersion = S.fromJsonString(S.Struct({ version: S.NonEmptyString }));
const decodePackageVersion = S.decodeUnknownEffect(PackageVersion);

/**
 * Runtime shape exposed by the {@link Occt} service.
 *
 * **Example** (Stub OcctShape service)
 *
 * ```ts
 * import type { OcctShape } from "@beep/occt"
 * import { Effect } from "effect"
 *
 * const service: OcctShape = {
 *   kernel: Effect.die("not implemented"),
 *   project: () => Effect.die("not implemented"),
 *   summarize: () => Effect.die("not implemented")
 * }
 * console.log(service)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export interface OcctShape {
  readonly kernel: Effect.Effect<KernelInfo, OcctError>;
  readonly project: (request: ProjectionRequest) => Effect.Effect<ReadonlyArray<EdgeSet>, OcctError>;
  readonly summarize: (solid: SolidSpec) => Effect.Effect<SolidSummary, OcctError>;
}

const hexOf = (bytes: ArrayBuffer): string =>
  A.join(
    A.map(Array.from(new Uint8Array(bytes)), (b) => b.toString(16).padStart(2, "0")),
    ""
  );

const sha256 = (bytes: Uint8Array): Effect.Effect<string> =>
  Effect.promise(() => crypto.subtle.digest("SHA-256", bytes as BufferSource)).pipe(Effect.map(hexOf));

const loadKernel = Effect.fn("Occt.loadKernel")(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const wasmPath = require.resolve("replicad-opencascadejs/wasm");
  const replicadPackageJson = path.join(path.dirname(require.resolve("replicad")), "..", "package.json");
  const [wasm, replicadVersion] = yield* Effect.all([
    fs.readFile(wasmPath),
    fs.readFileString(replicadPackageJson).pipe(Effect.flatMap(decodePackageVersion)),
  ]).pipe(Effect.mapError((cause) => OcctError.fromUnknown("kernel-init", "Could not read the kernel files.", cause)));
  const wasmSha256 = yield* sha256(wasm);
  const oc: OpenCascadeInstance = yield* Effect.tryPromise({
    try: () => opencascade({ wasmBinary: wasm }),
    catch: (cause) => OcctError.fromUnknown("kernel-init", "opencascade.js failed to initialise.", cause),
  });
  replicad.setOC(oc);
  const kernel = KernelInfo.make({
    replicadVersion: replicadVersion.version,
    variant: "single-thread",
    wasmSha256,
    wasmBytes: wasm.byteLength,
  });
  return { oc, kernel };
});

const makeService = Effect.fn("Occt.makeService")(function* () {
  const { oc, kernel } = yield* loadKernel();

  const build = (solid: SolidSpec) =>
    Effect.try({
      try: () => buildCompound(solid),
      catch: (cause) => OcctError.fromUnknown("solid-build", "The kernel could not build the solid.", cause),
    });

  const summarizeSolid = Effect.fn("Occt.summarize")(function* (rawSolid: SolidSpec) {
    const solid = yield* validateSolidSpec(rawSolid).pipe(
      Effect.mapError((cause) => OcctError.fromUnknown("invalid-request", "Invalid solid spec.", cause))
    );
    const built = yield* build(solid);
    return yield* Effect.try({
      try: () => summarize(built),
      catch: (cause) => OcctError.fromUnknown("solid-build", "The kernel could not measure the solid.", cause),
    });
  });

  const projectViews = Effect.fn("Occt.project")(function* (rawRequest: ProjectionRequest) {
    const request = yield* validateProjectionRequest(rawRequest).pipe(
      Effect.mapError((cause) => OcctError.fromUnknown("invalid-request", "Invalid projection request.", cause))
    );
    const built = yield* build(request.solid);
    return yield* Effect.forEach(request.cameras, (camera) =>
      Effect.try({
        try: () => project({ oc, compound: built.compound, camera, withHidden: request.withHidden }),
        catch: (cause) => OcctError.fromUnknown("projection", "Hidden-line removal failed.", cause),
      })
    );
  });

  return {
    kernel: Effect.succeed(kernel),
    project: projectViews,
    summarize: summarizeSolid,
  } satisfies OcctShape;
});

/**
 * Effect service for the OCCT geometry kernel.
 *
 * **Example** (Reference the Occt service)
 *
 * ```ts
 * import { Occt } from "@beep/occt"
 *
 * console.log(Occt)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class Occt extends Context.Service<Occt, OcctShape>()($I`Occt`) {
  /**
   * Build the kernel service layer.
   *
   * **Details**
   *
   * Building the layer reads and instantiates the opencascade.js WASM binary
   * once (about 23 MB, under 100 ms on a workstation) and records its
   * SHA-256 in {@link KernelInfo}. The kernel is a process-wide singleton:
   * replicad binds it globally, so provide this layer once per process.
   *
   * **Example** (Create the service layer)
   *
   * ```ts
   * import { Occt } from "@beep/occt"
   *
   * const layer = Occt.layer
   * console.log(layer)
   * ```
   *
   * @category layers
   * @since 0.0.0
   */
  static readonly layer: Layer.Layer<Occt, OcctError, FileSystem.FileSystem | Path.Path> = Layer.effect(
    Occt,
    Effect.map(makeService(), Occt.of)
  );
}
