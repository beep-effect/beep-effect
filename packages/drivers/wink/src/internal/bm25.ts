import { createRequire } from "node:module";
import * as O from "effect/Option";
import type { Token } from "@beep/nlp/Core/Token";
import type { BM25Norm } from "@beep/nlp/Core/Vectorization";

const require = createRequire(import.meta.url);

export type BM25Accessor<T> = (...args: ReadonlyArray<never>) => T;

export interface BM25VectorizerInstance {
  readonly doc: (index: number) => {
    readonly out: <T>(accessor: BM25Accessor<T>) => T;
  };
  readonly learn: (tokens: Array<string>) => void;
  readonly out: <T>(accessor: BM25Accessor<T>) => T;
  readonly vectorOf: (tokens: Array<string>) => Array<number>;
}

export interface BM25VectorizerWithBowInstance extends BM25VectorizerInstance {
  readonly bowOf: (tokens: Array<string>, processOov?: boolean) => Record<string, number>;
}

export type BM25VectorizerFactory<Instance extends BM25VectorizerInstance = BM25VectorizerInstance> = (config?: {
  readonly b?: number;
  readonly k?: number;
  readonly k1?: number;
  readonly norm?: BM25Norm;
}) => Instance;

export const loadBM25Vectorizer = <
  Instance extends BM25VectorizerInstance = BM25VectorizerInstance,
>(): BM25VectorizerFactory<Instance> => require("wink-nlp/utilities/bm25-vectorizer");

export const normalizeTokenText = (token: Token): string =>
  O.match(token.normal, {
    onNone: () => token.text,
    onSome: (normal) => normal ?? token.text,
  });
