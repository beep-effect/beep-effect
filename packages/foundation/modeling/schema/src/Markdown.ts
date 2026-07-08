/**
 * Markdown rendering and schema transforms.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $SchemaId } from "@beep/identity/packages";
import { Effect, flow, Result, SchemaGetter, SchemaIssue } from "effect";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import {
  getGlobalMarkdownRuntime,
  loadMarkdownGfmModule,
  loadMarkdownModule,
  makeParseMarkdownForSchema,
} from "./internal/markdown.ts";
import type * as R from "effect/Record";
import type { MarkdownParseResult } from "./internal/markdown.ts";

const $I = $SchemaId.create("Markdown");

type MarkdownRenderOptions = R.ReadonlyRecord<string, unknown>;
type MarkdownHtmlRender = (content: string, options?: undefined | MarkdownRenderOptions) => unknown;

const MarkdownBrand = S.String.pipe(S.brand("Markdown"));
const defaultMarkdownRenderOptions = { tagFilter: true } satisfies MarkdownRenderOptions;

const encodeUnsupported = (value: unknown): Effect.Effect<string, SchemaIssue.Issue> =>
  Effect.fail(
    new SchemaIssue.InvalidValue(O.some(value), {
      message: "Encoding HTML output back into Markdown text is not supported by MarkdownTextToHtml.",
    })
  );

const invalidMarkdownInput: {
  (content: string, message: string): SchemaIssue.InvalidValue;
  (message: string): (content: string) => SchemaIssue.InvalidValue;
} = dual(
  2,
  (content: string, message: string): SchemaIssue.InvalidValue =>
    new SchemaIssue.InvalidValue(O.some(content), {
      message,
    })
);

const getMarkdownHtmlRender = (): O.Option<MarkdownHtmlRender> => {
  const bunRuntime = Reflect.get(globalThis, "Bun");
  const markdown = P.isObject(bunRuntime) ? Reflect.get(bunRuntime, "markdown") : undefined;
  const html = P.isObject(markdown) ? Reflect.get(markdown, "html") : undefined;
  if (P.isFunction(html)) {
    const renderMarkdownHtml: MarkdownHtmlRender = (content, options) => html(content, options);
    return O.some(renderMarkdownHtml);
  }
  return O.none();
};

const makeRenderMarkdownHtml = (options?: undefined | MarkdownRenderOptions) => {
  const renderOptions = { ...defaultMarkdownRenderOptions, ...options };

  return Effect.fn("Markdown.renderMarkdownHtml")(function* (content: string) {
    const renderMarkdownHtml = yield* O.match(getMarkdownHtmlRender(), {
      onNone: () =>
        Effect.fail(invalidMarkdownInput(content, "Bun.markdown.html is unavailable in the current runtime.")),
      onSome: Effect.succeed,
    });
    const rendered = yield* Effect.try({
      try: () => renderMarkdownHtml(content, renderOptions),
      catch: (cause) =>
        invalidMarkdownInput(
          content,
          P.isError(cause) ? `Invalid Markdown input (${cause.message}).` : "Invalid Markdown input."
        ),
    });

    return yield* S.decodeUnknownEffect(S.String)(rendered).pipe(
      Effect.mapError(() => invalidMarkdownInput(content, "Invalid Markdown input (Expected HTML string output)."))
    );
  });
};

const parseMarkdownText = (content: string): MarkdownParseResult =>
  makeParseMarkdownForSchema(getGlobalMarkdownRuntime(), loadMarkdownModule, {
    loadMarkdownGfm: loadMarkdownGfmModule,
  })(content);

const decodeMarkdownParseResult = (
  content: string
): ((result: MarkdownParseResult) => Effect.Effect<string, SchemaIssue.InvalidValue>) =>
  Result.match({
    onSuccess: () => Effect.succeed(content),
    onFailure: (message) => Effect.fail(invalidMarkdownInput(content, message)),
  });

const decodeMarkdownText = Effect.fn("Markdown.decodeMarkdownText")(function* (content: string) {
  yield* decodeMarkdownParseResult(content)(parseMarkdownText(content));

  return content;
});

/**
 * Branded schema for Markdown document strings accepted by the active parser.
 *
 * Validation uses `Bun.markdown.html` when Bun is available. In runtimes without
 * Bun, it falls back to the platform-agnostic `micromark` parser with GFM
 * extensions. Markdown is intentionally permissive, so plain text and empty
 * strings are valid when the active parser accepts them.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { Markdown } from "@beep/schema/Markdown"
 *
 * const document = S.decodeUnknownSync(Markdown)("# Hello")
 * console.log(document)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const Markdown = S.String.pipe(
  S.decodeTo(MarkdownBrand, {
    decode: SchemaGetter.transformOrFail(decodeMarkdownText),
    encode: SchemaGetter.transform((content: string): string => content),
  }),
  $I.annoteSchema("Markdown", {
    description:
      "A Markdown document string accepted by Bun Markdown or the platform-agnostic micromark GFM fallback parser.",
  })
);

/**
 * Branded Markdown document string type extracted from {@link Markdown}.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { Markdown } from "@beep/schema/Markdown"
 *
 * const document: Markdown = S.decodeUnknownSync(Markdown)("# Hello")
 * console.log(document)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type Markdown = typeof Markdown.Type;

/**
 * Schema factory that renders Markdown text into HTML using `Bun.markdown.html`.
 *
 * Returns a schema transformation from Markdown source text to rendered HTML
 * text. Encoding back to Markdown is not supported.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 * import { MarkdownTextToHtml } from "@beep/schema/Markdown"
 *
 * const MarkdownToHtml = MarkdownTextToHtml()
 * const program = S.decodeUnknownEffect(MarkdownToHtml)("# Hello")
 * const html = await Effect.runPromise(program)
 * console.log(html.includes("<h1"))
 * ```
 *
 * @param options - Optional Bun Markdown parser options. Raw HTML tag filtering is enabled by default.
 * @returns Schema transformation from Markdown text to rendered HTML text.
 * @category validation
 * @since 0.0.0
 */
export const MarkdownTextToHtml = (options?: MarkdownRenderOptions) => {
  const renderMarkdownHtml = makeRenderMarkdownHtml(options);

  return S.String.pipe(
    S.decodeTo(S.String, {
      decode: SchemaGetter.transformOrFail(renderMarkdownHtml),
      encode: SchemaGetter.transformOrFail(encodeUnsupported),
    }),
    $I.annoteSchema("MarkdownTextToHtml", {
      description: "Schema factory that renders Markdown text into HTML text with Bun's Markdown runtime.",
    })
  );
};

/**
 * Builds a decoder that renders Markdown text to HTML and then decodes the
 * result through a target schema.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 * import { decodeMarkdownTextAs } from "@beep/schema/Markdown"
 *
 * const decodeHtml = decodeMarkdownTextAs(S.String)
 *
 * const program = decodeHtml("# Hello")
 * const html = await Effect.runPromise(program)
 * console.log(html.includes("Hello"))
 * ```
 *
 * @param schema - Target schema to decode rendered HTML output into.
 * @param options - Optional Bun Markdown parser options. Raw HTML tag filtering is enabled by default.
 * @returns Decoder function from Markdown text to the target schema type.
 * @category utilities
 * @since 0.0.0
 */
export const decodeMarkdownTextAs = <Schema extends S.Top>(schema: Schema, options?: MarkdownRenderOptions) => {
  const decodeMarkdownHtmlText = S.decodeUnknownEffect(MarkdownTextToHtml(options));
  const decodeTargetSchema = S.decodeUnknownEffect(schema);
  const decodeTarget = Effect.fnUntraced(function* (input: Parameters<typeof decodeTargetSchema>[0]) {
    return yield* decodeTargetSchema(input);
  });

  return flow(decodeMarkdownHtmlText, Effect.flatMap(decodeTarget));
};
