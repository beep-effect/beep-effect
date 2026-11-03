/**
 * Opaque defect schema shared by repo-cli error causes.
 *
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */

import { SchemaUtils } from "@beep/schema";
import * as S from "effect/Schema";

/**
 * A thrown cause carried with its stack but excluded from identity.
 *
 * **Details**
 *
 * `S.Defect({ includeStack: true })` with an always-true equivalence: the
 * cause travels with the error, while `S.toEquivalence(ErrorClass)` compares
 * the declared diagnostic fields only. repo-cli's error classes share this one
 * composition instead of repeating it at every `cause` field, which keeps the
 * package's type-check instantiation count flat.
 *
 * **Gotchas**
 *
 * Keep the plain `.annotate({ identifier, description })` here: `$I.annoteSchema`
 * on this const costs +323 single-checker instantiations, which the
 * `@beep/repo-cli` check-census row rejects (effect-schema-parity decision
 * log, 2026-09-29).
 *
 * @category schemas
 * @since 0.0.0
 */
export const OpaqueDefect = S.Defect({ includeStack: true })
  .pipe(S.overrideToEquivalence(SchemaUtils.alwaysEquivalent))
  .annotate({
    identifier: "OpaqueDefect",
    description: "A thrown cause carried with its stack but excluded from identity.",
  });
