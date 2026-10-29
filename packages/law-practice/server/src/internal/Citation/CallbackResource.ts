/**
 * Callback resource data and closed failures; runtime references are operation-local.
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import { LiteralKit, Sha256Hex } from "@beep/schema";
import * as S from "effect/Schema";
import { CitationResourceIdentity } from "./ResourceIdentity.ts";

const $I = $LawPracticeServerId.create("internal/Citation/CallbackResource");
/**
 * Normalized adapter resource. Identity, truthiness and presentation are
 * independent. Unhashable falsy values may remain in prior-full state until
 * an operation actually attempts to hash them, as in the source.
 * @internal
 * @category models
 * @since 0.0.0
 */
export const CitationCallbackResource = S.TaggedUnion({
  None: {},
  Registered: { scope: Sha256Hex, slot: S.Natural, value: S.Json },
  Hashable: { identity: CitationResourceIdentity, truthy: S.Boolean, value: S.Json },
  Unhashable: { truthy: S.Boolean, value: S.Json },
}).pipe(
  $I.annoteSchema("CitationCallbackResource", {
    description:
      "Private adapter resource with explicit hashing and truth semantics; presentation is not an equality key.",
  })
);
/**
 * Schema-derived normalized resource.
 * @internal
 * @category models
 * @since 0.0.0
 */
export type CitationCallbackResource = typeof CitationCallbackResource.Type;
const Reason = LiteralKit([
  "invalid-input",
  "evidence-failed",
  "limit-exceeded",
  "callback-failed",
  "identity-failed",
  "unhashable-resource",
]).pipe(
  $I.annoteSchema("Reason", { description: "Finite private callback-session failure reasons without caller values." })
);
/**
 * Private redacted callback/session failure.
 * @internal
 * @category errors
 * @since 0.0.0
 */
export class CitationCallbackFailure extends S.TaggedError<CitationCallbackFailure, { readonly brand: unique symbol }>(
  $I`CitationCallbackFailure`
)(
  "CitationCallbackFailure",
  { reason: Reason },
  $I.annoteError<CitationCallbackFailure>("CitationCallbackFailure", {
    description: "Callback resolution failed without resource presentation, source text or nested causes.",
  })
) {}
