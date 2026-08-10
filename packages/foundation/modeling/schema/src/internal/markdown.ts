/**
 * Internal Markdown runtime helpers.
 *
 * @since 0.0.0
 */
import { thunkEmptyRecord } from "@beep/utils";
import { flow, pipe, Result } from "effect";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as MarkdownPackage from "micromark";
import * as MarkdownGfmPackage from "micromark-extension-gfm";

type MarkdownHtmlRender = (input: string) => unknown;

type BunMarkdownRuntime = {
  readonly markdown: {
    readonly html: MarkdownHtmlRender;
  };
};

type MarkdownRuntime = {
  readonly Bun?: BunMarkdownRuntime;
};

type MarkdownModule = typeof MarkdownPackage;
type MarkdownGfmModule = typeof MarkdownGfmPackage;

type MarkdownModuleLoader = () => MarkdownModule;
type MarkdownGfmModuleLoader = () => MarkdownGfmModule;
type MarkdownParserOptions = {
  readonly loadMarkdownGfm: MarkdownGfmModuleLoader;
};

/**
 * Renders a Markdown document into a `Result` carrying the rendered HTML.
 *
 * Named (rather than spelled inline) so the pipeable-signature analysis can
 * relate the data-first and data-last returns of
 * {@link makeParseMarkdownForSchema}.
 */
type MarkdownSchemaParser = (input: string) => MarkdownParseResult;

/**
 * The runtime-application step of the data-last
 * {@link makeParseMarkdownForSchema} form.
 */
type MarkdownSchemaParserForRuntime = (runtime: MarkdownRuntime) => MarkdownSchemaParser;

/**
 * Public schema module export.
 *
 * @category type-level
 * @since 0.0.0
 */
export type MarkdownParseResult = Result.Result<string, string>;

/**
 * Public schema module export.
 *
 * @category schemas
 * @since 0.0.0
 */
export const loadMarkdownModule = (): MarkdownModule => MarkdownPackage;

/**
 * Public schema module export.
 *
 * @category schemas
 * @since 0.0.0
 */
export const loadMarkdownGfmModule = (): MarkdownGfmModule => MarkdownGfmPackage;

const invalidMarkdownOutput = "Invalid Markdown input (Expected HTML string output).";

const renderMarkdownIssueMessage = (cause: unknown): string =>
  P.isError(cause) ? `Invalid Markdown input (${cause.message}).` : "Invalid Markdown input.";

const getBunRuntime = (runtime: MarkdownRuntime): O.Option<BunMarkdownRuntime> => O.fromNullishOr(runtime.Bun);

const getBunMarkdownHtml = (input: unknown): O.Option<MarkdownHtmlRender> =>
  pipe(
    O.fromNullishOr(input),
    O.filter(P.isObject),
    O.flatMap((value) => (P.hasProperty(value, "Bun") ? O.fromNullishOr(value.Bun) : O.none())),
    O.filter(P.isObject),
    O.flatMap((value) => (P.hasProperty(value, "markdown") ? O.fromNullishOr(value.markdown) : O.none())),
    O.filter(P.isObject),
    O.flatMap((value) =>
      P.hasProperty(value, "html")
        ? (() => {
            const html = value.html;

            return P.isFunction(html) ? O.some((input: string) => html(input)) : O.none();
          })()
        : O.none()
    )
  );

const decodeMarkdownHtml = (html: unknown): MarkdownParseResult =>
  P.isString(html) ? Result.succeed(html) : Result.fail(invalidMarkdownOutput);

const toMarkdownParseResult: (result: Result.Result<unknown, unknown>) => MarkdownParseResult = flow(
  Result.mapError(renderMarkdownIssueMessage),
  Result.flatMap(decodeMarkdownHtml)
);

/**
 * Public schema module export.
 *
 * @category schemas
 * @since 0.0.0
 */
export const getGlobalMarkdownRuntime = (): MarkdownRuntime =>
  pipe(
    getBunMarkdownHtml(globalThis),
    O.map((html) => ({
      Bun: {
        markdown: {
          html,
        },
      },
    })),
    O.getOrElse(thunkEmptyRecord)
  );

/**
 * Public schema module export.
 *
 * @category constructors
 * @since 0.0.0
 */
export const makeParseMarkdownForSchema: {
  (loadMarkdown: MarkdownModuleLoader, options: MarkdownParserOptions): MarkdownSchemaParserForRuntime;
  (runtime: MarkdownRuntime, loadMarkdown: MarkdownModuleLoader, options: MarkdownParserOptions): MarkdownSchemaParser;
} = dual(
  3,
  (
    runtime: MarkdownRuntime,
    loadMarkdown: MarkdownModuleLoader,
    options: MarkdownParserOptions
  ): MarkdownSchemaParser =>
    (input: string): MarkdownParseResult =>
      pipe(
        getBunRuntime(runtime),
        O.match({
          onNone: () =>
            toMarkdownParseResult(
              Result.try(() => {
                const markdown = loadMarkdown();
                const markdownGfm = options.loadMarkdownGfm();

                return markdown.micromark(input, {
                  extensions: [markdownGfm.gfm()],
                  htmlExtensions: [markdownGfm.gfmHtml()],
                });
              })
            ),
          onSome: ({ markdown }) => toMarkdownParseResult(Result.try(() => markdown.html(input))),
        })
      )
);
