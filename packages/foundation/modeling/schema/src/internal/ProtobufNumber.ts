/**
 * Shared protobuf number base domain for the Float and Double scalar schemas.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as SchemaTransformation from "effect/SchemaTransformation";
import { $SchemaId } from "./SchemaId.ts";

const $I = $SchemaId.create("internal/ProtobufNumber");

const isJsNumber = P.isNumber;

const ProtobufNumberGenerationSource = S.Union([S.Finite, S.Literals(["NaN", "Infinity", "-Infinity"])]);

/**
 * Opaque number declaration accepting every IEEE-754 value protobuf allows.
 *
 * **Details**
 *
 * Protobuf float and double scalars intentionally include `NaN` and the
 * infinities, so the base domain is a declaration with a constructive
 * generation link over finite numbers or the three special-value literals
 * rather than the finite-only Schema number surface.
 *
 * @internal
 * @category schemas
 * @since 0.0.0
 */
export const ProtobufNumber = S.declare(isJsNumber)
  .annotate({
    toCodecArbitrary: () =>
      S.link<number>()(
        ProtobufNumberGenerationSource,
        SchemaTransformation.transform({
          decode: (value): number => (isJsNumber(value) ? value : globalThis.Number(value)),
          encode: (value): number | "NaN" | "Infinity" | "-Infinity" =>
            globalThis.Number.isFinite(value) ? value : (globalThis.String(value) as "NaN" | "Infinity" | "-Infinity"),
        })
      ),
  })
  .pipe(
    $I.annoteSchema("ProtobufNumber", {
      description: "A JavaScript number, including IEEE-754 special values accepted by protobuf.",
      title: "Protobuf Number",
    })
  );
