// Compile-only public codec contract, included by the package test type check.

import { BluebookFromFullCitation, BluebookTextFromBluebookCitation } from "@beep/law-practice-domain/values";
import { expectTypeOf } from "@effect/vitest";
import * as S from "effect/Schema";
import type { BluebookCitation, BluebookText, FullCitation } from "@beep/law-practice-domain/values";
import type * as Effect from "effect/Effect";

declare const citation: FullCitation.Type;
declare const bluebook: BluebookCitation;
declare const text: BluebookText;
const decoded = S.decodeEffect(BluebookFromFullCitation)(citation);
const encoded = S.encodeEffect(BluebookFromFullCitation)(bluebook);
const rendered = S.decodeEffect(BluebookTextFromBluebookCitation)(bluebook);
const parsed = S.encodeEffect(BluebookTextFromBluebookCitation)(text);
expectTypeOf<typeof BluebookFromFullCitation.Encoded>().toEqualTypeOf<FullCitation.Type>();
expectTypeOf(decoded).toEqualTypeOf<Effect.Effect<BluebookCitation, S.SchemaError>>();
expectTypeOf(encoded).toEqualTypeOf<Effect.Effect<FullCitation.Type, S.SchemaError>>();
expectTypeOf(rendered).toEqualTypeOf<Effect.Effect<BluebookText, S.SchemaError>>();
expectTypeOf(parsed).toEqualTypeOf<Effect.Effect<BluebookCitation, S.SchemaError>>();

/** Compile-only codec boundary witnesses.
 * @internal
 * @category testing
 * @since 0.0.0
 */
export type BluebookTypeContract =
  | typeof decoded
  | typeof encoded
  | typeof rendered
  | typeof parsed
  | typeof rejectedWire;
declare const wire: typeof FullCitation.Encoded;
// @ts-expect-error The encoded citation wire is not the decoded semantic input.
const rejectedWire = S.decodeEffect(BluebookFromFullCitation)(wire);
