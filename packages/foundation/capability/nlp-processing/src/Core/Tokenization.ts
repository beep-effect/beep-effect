/**
 * Tokenization service contract.
 *
 * @since 0.0.0
 * @packageDocumentation
 */

import { $NlpProcessingId } from "@beep/identity";
import { Context, Effect } from "effect";
import * as S from "effect/Schema";
import type { Document, DocumentId } from "@beep/nlp/Core/Document";
import type { Sentence } from "@beep/nlp/Core/Sentence";
import type { Token } from "@beep/nlp/Core/Token";

const $I = $NlpProcessingId.create("Core/Tokenization");

type TokenizationShape = {
  readonly tokenize: (text: string) => Effect.Effect<ReadonlyArray<Token>, TokenizationError>;
  readonly sentences: (text: string) => Effect.Effect<ReadonlyArray<Sentence>, TokenizationError>;
  readonly document: (text: string, id?: DocumentId | string) => Effect.Effect<Document, TokenizationError>;
  readonly tokenCount: (text: string) => Effect.Effect<number, TokenizationError>;
};

/**
 * Tokenization error.
 *
 * **Example** (Make tokenization error)
 *
 * ```ts
 * import { TokenizationError } from "@beep/nlp-processing/Core/Tokenization"
 *
 * const error = TokenizationError.make({
 *   operation: "tokenize",
 *   cause: new Error("tokenizer unavailable")
 * })
 * console.log(error.operation) // "tokenize"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class TokenizationError extends S.TaggedError<TokenizationError>($I`TokenizationError`)(
  "TokenizationError",
  {
    cause: S.Defect({ includeStack: true }),
    operation: S.String,
  },
  $I.annote("TokenizationError", {
    description: "Failure raised by an NLP tokenization service.",
  })
) {}

/**
 * Tokenization service.
 *
 * **Example** (Log service key)
 *
 * ```ts
 * import { Tokenization } from "@beep/nlp-processing/Core/Tokenization"
 *
 * console.log(Tokenization.key)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class Tokenization extends Context.Service<Tokenization, TokenizationShape>()($I`Tokenization`) {}

/**
 * Tokenize text into tokens using the configured service.
 *
 * **Example** (Provide mock tokenize service)
 *
 * ```ts
 * import { Chunk, Effect } from "effect"
 * import * as O from "effect/Option"
 * import { Document, DocumentId } from "@beep/nlp/Core/Document"
 * import { Tokenization, tokenize } from "@beep/nlp-processing/Core/Tokenization"
 *
 * const service = Tokenization.of({
 *   tokenize: () => Effect.succeed([]),
 *   sentences: () => Effect.succeed([]),
 *   document: (text) =>
 *     Effect.succeed(Document.make({
 *       id: DocumentId.make("doc-001"),
 *       text,
 *       tokens: Chunk.empty(),
 *       sentences: Chunk.empty(),
 *       sentiment: O.none()
 *     })),
 *   tokenCount: () => Effect.succeed(0)
 * })
 * const program = Effect.provideService(tokenize("typed effects"), Tokenization, service)
 * Effect.runPromise(program).then((tokens) => console.log(tokens.length)) // 0
 * ```
 *
 * @effects Requires a {@link Tokenization} service and executes that service's
 * tokenizer effect for the supplied text.
 * @category getters
 * @since 0.0.0
 */
export const tokenize = Effect.fn("Nlp.Core.Tokenization.tokenize")(function* (text: string) {
  const tokenization = yield* Tokenization;
  return yield* tokenization.tokenize(text);
});

/**
 * Split text into sentences using the configured service.
 *
 * **Example** (Provide mock sentences service)
 *
 * ```ts
 * import { Chunk, Effect } from "effect"
 * import * as O from "effect/Option"
 * import { Document, DocumentId } from "@beep/nlp/Core/Document"
 * import { Tokenization, sentences } from "@beep/nlp-processing/Core/Tokenization"
 *
 * const service = Tokenization.of({
 *   tokenize: () => Effect.succeed([]),
 *   sentences: () => Effect.succeed([]),
 *   document: (text) =>
 *     Effect.succeed(Document.make({
 *       id: DocumentId.make("doc-001"),
 *       text,
 *       tokens: Chunk.empty(),
 *       sentences: Chunk.empty(),
 *       sentiment: O.none()
 *     })),
 *   tokenCount: () => Effect.succeed(0)
 * })
 * const program = Effect.provideService(sentences("Effect works."), Tokenization, service)
 * Effect.runPromise(program).then((sentences) => console.log(sentences.length)) // 0
 * ```
 *
 * @effects Requires a {@link Tokenization} service and executes that service's
 * sentence-splitting effect for the supplied text.
 * @category getters
 * @since 0.0.0
 */
export const sentences = Effect.fn("Nlp.Core.Tokenization.sentences")(function* (text: string) {
  const tokenization = yield* Tokenization;
  return yield* tokenization.sentences(text);
});

/**
 * Build a document using the configured service.
 *
 * **Example** (Build document with mock)
 *
 * ```ts
 * import { Chunk, Effect } from "effect"
 * import * as O from "effect/Option"
 * import { Document, DocumentId } from "@beep/nlp/Core/Document"
 * import { Tokenization, tokenizeToDocument } from "@beep/nlp-processing/Core/Tokenization"
 *
 * const service = Tokenization.of({
 *   tokenize: () => Effect.succeed([]),
 *   sentences: () => Effect.succeed([]),
 *   document: (text, id = "doc-001") =>
 *     Effect.succeed(Document.make({
 *       id: DocumentId.make(id),
 *       text,
 *       tokens: Chunk.empty(),
 *       sentences: Chunk.empty(),
 *       sentiment: O.none()
 *     })),
 *   tokenCount: () => Effect.succeed(0)
 * })
 * const program = Effect.map(
 *   Effect.provideService(tokenizeToDocument("Effect works.", "doc-001"), Tokenization, service),
 *   (document) => document.id
 * )
 * Effect.runPromise(program).then(console.log) // "doc-001"
 * ```
 *
 * @effects Requires a {@link Tokenization} service and executes that service's
 * document-building effect for the supplied text and optional id.
 * @category getters
 * @since 0.0.0
 */
export const tokenizeToDocument = Effect.fn("Nlp.Core.Tokenization.tokenizeToDocument")(function* (
  text: string,
  id?: DocumentId | string
) {
  const tokenization = yield* Tokenization;
  return yield* tokenization.document(text, id);
});

/**
 * Count tokens using the configured service.
 *
 * **Example** (Count tokens with mock)
 *
 * ```ts
 * import { Chunk, Effect } from "effect"
 * import * as O from "effect/Option"
 * import { Document, DocumentId } from "@beep/nlp/Core/Document"
 * import { Tokenization, tokenCount } from "@beep/nlp-processing/Core/Tokenization"
 *
 * const service = Tokenization.of({
 *   tokenize: () => Effect.succeed([]),
 *   sentences: () => Effect.succeed([]),
 *   document: (text) =>
 *     Effect.succeed(Document.make({
 *       id: DocumentId.make("doc-001"),
 *       text,
 *       tokens: Chunk.empty(),
 *       sentences: Chunk.empty(),
 *       sentiment: O.none()
 *     })),
 *   tokenCount: (text) => Effect.succeed(text.split(" ").length)
 * })
 * const program = Effect.provideService(tokenCount("typed effects"), Tokenization, service)
 * Effect.runPromise(program).then(console.log) // 2
 * ```
 *
 * @effects Requires a {@link Tokenization} service and executes that service's
 * counting effect for the supplied text.
 * @category getters
 * @since 0.0.0
 */
export const tokenCount = Effect.fn("Nlp.Core.Tokenization.tokenCount")(function* (text: string) {
  const tokenization = yield* Tokenization;
  return yield* tokenization.tokenCount(text);
});
