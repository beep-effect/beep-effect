import { pipe } from "effect";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as Str from "effect/String";
import type { VocabShape } from "@beep/identity";

export const registryPrefix: {
  (value: string): (vocab: VocabShape) => O.Option<string>;
  (vocab: VocabShape, value: string): O.Option<string>;
} = dual(
  2,
  (vocab: VocabShape, value: string): O.Option<string> =>
    pipe(
      value,
      Str.indexOf(":"),
      O.map((separator) => pipe(value, Str.slice(0, separator))),
      O.filter((prefix) => P.hasProperty(vocab, prefix))
    )
);
