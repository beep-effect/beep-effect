/**
 * Driver models for the OCCT kernel: the projection request and kernel
 * provenance. The geometry vocabulary itself (model, primitives, cameras,
 * segments, summaries) is the `@beep/technical-drawing` one, re-exported so a
 * caller can build requests from either package.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $OcctId } from "@beep/identity/packages";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import { Camera, ModelSpec } from "@beep/technical-drawing";
import { Effect } from "effect";
import * as S from "effect/Schema";

/**
 * Geometry vocabulary shared with `@beep/technical-drawing`.
 *
 * @since 0.0.0
 * @category models
 */
export {
  BoundingBox,
  Box,
  Camera,
  Cylinder,
  EdgeSet,
  LengthUnit,
  ModelSpec,
  ModelSummary,
  Part,
  PositiveLength,
  Primitive,
  Prism,
  Rotation,
  Segment2,
  Vec3,
} from "@beep/technical-drawing";

const $I = $OcctId.create("Occt.models");

/**
 * Request to project one model through one or more cameras.
 *
 * **Example** (Project a box from the front)
 *
 * ```ts
 * import { Box, Camera, ModelSpec, Part, ProjectionRequest } from "@beep/occt"
 *
 * const request = ProjectionRequest.make({
 *   solid: ModelSpec.make({ parts: [Part.make({ name: "b", add: [Box.make({ min: [0, 0, 0], max: [1, 1, 1] })] })] }),
 *   cameras: [Camera.make({ eye: [0, -1, 0], up: [0, 0, 1] })]
 * })
 * console.log(request.cameras.length)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ProjectionRequest extends S.Class<ProjectionRequest>($I`ProjectionRequest`)(
  {
    solid: ModelSpec.annotateKey({ description: "Model to project." }),
    cameras: S.Array(Camera)
      .check(
        S.isMinLength(1, {
          identifier: $I`ProjectionRequestCamerasCheck`,
          title: "Projection Cameras",
          description: "A projection request names at least one camera.",
          message: "Expected at least one camera",
        })
      )
      .annotateKey({ description: "Cameras, one view each, in order." }),
    withHidden: S.Boolean.pipe(
      S.withConstructorDefault(Effect.succeed(false)),
      S.withDecodingDefaultTypeKey(Effect.succeed(false)),
      S.annotateKey({ description: "Whether to also collect hidden edges. Defaults to false." })
    ),
  },
  $I.annote("ProjectionRequest", {
    description: "One model projected through one or more cameras.",
  })
) {}

const KernelVariantBase = LiteralKit(["single-thread"]);

/**
 * Kernel WASM build variant.
 *
 * **Example** (Read the variants)
 *
 * ```ts
 * import { KernelVariant } from "@beep/occt"
 *
 * console.log(KernelVariant.literals)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const KernelVariant = KernelVariantBase.pipe(
  $I.annoteSchema("KernelVariant", {
    description: "opencascade.js build variant loaded by the driver.",
  }),
  SchemaUtils.withLiteralKitStatics(KernelVariantBase)
);

/**
 * Type for {@link KernelVariant}.
 *
 * **Example** (Annotate a variant)
 *
 * ```ts
 * import type { KernelVariant } from "@beep/occt"
 *
 * const v: KernelVariant = "single-thread"
 * console.log(v)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type KernelVariant = typeof KernelVariant.Type;

/**
 * Provenance of the loaded kernel, for reproducibility manifests.
 *
 * **Example** (Make kernel info)
 *
 * ```ts
 * import { KernelInfo } from "@beep/occt"
 *
 * const info = KernelInfo.make({ replicadVersion: "1.1.0", variant: "single-thread", wasmSha256: "00", wasmBytes: 1 })
 * console.log(info.replicadVersion)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class KernelInfo extends S.Class<KernelInfo>($I`KernelInfo`)(
  {
    replicadVersion: S.NonEmptyString.annotateKey({ description: "Installed replicad package version." }),
    variant: KernelVariant.annotateKey({ description: "WASM build variant." }),
    wasmSha256: S.NonEmptyString.annotateKey({ description: "Lowercase hex SHA-256 of the loaded WASM binary." }),
    wasmBytes: S.Natural.annotateKey({ description: "Size of the loaded WASM binary in bytes." }),
  },
  $I.annote("KernelInfo", {
    description: "Version and binary hash of the loaded geometry kernel.",
  })
) {}
