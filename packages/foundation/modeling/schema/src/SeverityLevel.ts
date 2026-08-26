/**
 * Shared generic severity domains.
 *
 * @since 0.0.0
 * @packageDocumentation
 */

import { $SchemaId } from "@beep/identity/packages";
import { LiteralKit } from "./LiteralKit/index.ts";

const $I = $SchemaId.create("SeverityLevel");

const SeverityLevelBase = LiteralKit(["low", "medium", "high", "critical"]);

/**
 * Generic four-level severity scale: `"low"`, `"medium"`, `"high"`, `"critical"`.
 *
 * **Example** (Decode high severity level)
 *
 * ```ts import.meta.vitest name="Decode high severity level"
 * import * as S from "effect/Schema"
 * import { SeverityLevel } from "@beep/schema/SeverityLevel"
 *
 * const level = S.decodeUnknownSync(SeverityLevel)("high")
 * level // => "high"
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const SeverityLevel = SeverityLevelBase.pipe(
  $I.annoteSchema("SeverityLevel", {
    description: "Generic four-level severity scale shared across beep packages.",
  })
);

/**
 * Type for {@link SeverityLevel}.
 *
 * **Example** (Type critical severity value)
 *
 * ```ts import.meta.vitest name="Type critical severity value"
 * import * as S from "effect/Schema"
 * import { SeverityLevel } from "@beep/schema/SeverityLevel"
 *
 * const severity: SeverityLevel = S.decodeUnknownSync(SeverityLevel)("critical")
 * severity // => "critical"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type SeverityLevel = typeof SeverityLevel.Type;
