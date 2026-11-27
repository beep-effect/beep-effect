import type * as S from "effect/Schema";

/**
 * Admit a value through its schema's `make`.
 *
 * **Gotchas**
 *
 * The one door an `SbomDocument` goes through on its way out of
 * `Sbom.generate`, and the only place `test/Sbom.admission.test.ts` can count
 * admission work: a schema's `make` memoizes itself as a non-configurable own
 * property on first read, so it cannot be wrapped once any test in a shared
 * worker has built a document. `admission` is a plain object so a test can
 * swap `admit` and restore it.
 *
 * **Example** (Admit a component)
 *
 * ```ts
 * import { admission } from "@beep/sbom/internal/admission"
 * import { Component } from "@beep/sbom/SbomDocument"
 *
 * const component = admission.admit(Component, { type: "library", name: "left-pad" })
 * console.log(component.name) // left-pad
 * ```
 *
 * @internal
 * @category constructors
 * @since 0.0.0
 */
export const admission = {
  admit: <Self extends S.Top>(schema: Self, input: Self["~type.make.in"]): Self["Type"] => schema.make(input),
};
