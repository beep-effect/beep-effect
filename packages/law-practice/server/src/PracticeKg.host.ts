/**
 * Host-facing bundle context schemas and service tag.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $LawPracticeServerId } from "@beep/identity/packages";
import { Context } from "effect";
import * as S from "effect/Schema";
import { PracticeKgBundleManifest } from "./PracticeKg.schemas.ts";

const $I = $LawPracticeServerId.create("PracticeKg.host");

/**
 * Bundle metadata and optional corpus pointer supplied by the owning host.
 *
 * **Example** (Inspect bundleDir field)
 *
 * ```ts
 * import { PracticeKgBundleContext } from "@beep/law-practice-server"
 *
 * console.log(PracticeKgBundleContext.fields.bundleDir)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PracticeKgBundleContext extends S.Class<PracticeKgBundleContext>($I`PracticeKgBundleContext`)(
  {
    bundleDir: S.NonEmptyString,
    corpusRoot: S.optionalKey(S.NonEmptyString),
    manifest: PracticeKgBundleManifest,
  },
  $I.annote("PracticeKgBundleContext", {
    description: "Host-resolved bundle metadata and optional corpus content pointer.",
  })
) {}

/**
 * Context service carrying host-resolved practice KG bundle metadata.
 *
 * **Example** (Check service key type)
 *
 * ```ts
 * import { PracticeKgBundle } from "@beep/law-practice-server"
 *
 * console.log(typeof PracticeKgBundle.key) // "string"
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class PracticeKgBundle extends Context.Service<PracticeKgBundle, PracticeKgBundleContext>()(
  $I`PracticeKgBundle`
) {}
