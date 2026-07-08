/**
 * Template rendering service for package generation.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { DomainError } from "@beep/repo-utils";
import { Str, thunkEmptyRecord, thunkEmptyStr } from "@beep/utils";
import { Context, Effect, FileSystem, flow, identity, SchemaTransformation } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import Handlebars from "handlebars";

const $I = $RepoCliId.create("commands/CreatePackage/TemplateService");

/**
 * Mapping between template source file and output file path.
 *
 * @example
 * ```ts
 * import { TemplateSpec } from "@beep/repo-cli/commands/CreatePackage"
 * import * as S from "effect/Schema"
 *
 * const candidate = { outputPath: "README.md", templateName: "README.md.hbs" }
 * console.log(S.is(TemplateSpec)(candidate)) // true
 * ```
 * @category models
 * @since 0.0.0
 */
export class TemplateSpec extends S.Class<TemplateSpec>($I`TemplateSpec`)(
  {
    templateName: S.String,
    outputPath: S.String,
  },
  $I.annote("TemplateSpec", {
    description: "Mapping between template source file and output file path.",
  })
) {}

/**
 * Rendered template output.
 *
 * @example
 * ```ts
 * import { RenderedTemplate } from "@beep/repo-cli/commands/CreatePackage"
 * import * as S from "effect/Schema"
 *
 * const candidate = { content: "# Example\n", outputPath: "README.md" }
 * console.log(S.is(RenderedTemplate)(candidate)) // true
 * ```
 * @category models
 * @since 0.0.0
 */
export class RenderedTemplate extends S.Class<RenderedTemplate>($I`RenderedTemplate`)(
  {
    outputPath: S.String,
    content: S.String,
  },
  $I.annote("RenderedTemplate", {
    description: "Rendered template output.",
  })
) {}

/**
 * Request payload for template rendering.
 *
 * @example
 * ```ts
 * import { TemplateRenderRequest } from "@beep/repo-cli/commands/CreatePackage"
 * import * as S from "effect/Schema"
 *
 * const candidate = { templateDir: "templates/package", templates: [{ outputPath: "README.md", templateName: "README.md.hbs" }] }
 * console.log(S.is(TemplateRenderRequest)(candidate)) // true
 * ```
 * @category models
 * @since 0.0.0
 */
export class TemplateRenderRequest extends S.Class<TemplateRenderRequest>($I`TemplateRenderRequest`)(
  {
    templateDir: S.String,
    templates: S.Array(TemplateSpec),
    context: S.Record(S.String, S.Unknown).pipe(
      S.withConstructorDefault(Effect.succeed(thunkEmptyRecord<string, unknown>())),
      S.withDecodingDefault(Effect.succeed(thunkEmptyRecord<string, unknown>()))
    ),
  },
  $I.annote("TemplateRenderRequest", {
    description: "Request payload for template rendering.",
  })
) {}

/**
 * Service contract for template rendering.
 *
 * @example
 * ```ts
 * import type { TemplateServiceShape } from "@beep/repo-cli/commands/CreatePackage"
 * const value = {} as TemplateServiceShape
 * console.log(value) // example value
 * ```
 * @category models
 * @since 0.0.0
 */
export type TemplateServiceShape = {
  readonly renderTemplates: (
    request: TemplateRenderRequest
  ) => Effect.Effect<ReadonlyArray<RenderedTemplate>, DomainError, FileSystem.FileSystem>;
};

/**
 * Service tag for template rendering.
 *
 * @example
 * ```ts
 * import { TemplateService } from "@beep/repo-cli/commands/CreatePackage"
 * import { Effect } from "effect"
 *
 * const program = Effect.service(TemplateService)
 * console.log(Effect.isEffect(program)) // true
 * ```
 * @category ports
 * @since 0.0.0
 */
export class TemplateService extends Context.Service<TemplateService, TemplateServiceShape>()($I`TemplateService`) {}

const UnknownToTemplateHelperString = S.Unknown.pipe(
  S.decodeTo(
    S.String,
    SchemaTransformation.transform({
      decode: (value) => O.fromNullishOr(value).pipe(O.map(String), O.getOrElse(thunkEmptyStr)),
      encode: identity,
    })
  ),
  $I.annoteSchema("UnknownToTemplateHelperString", {
    description: "Schema transformation that normalizes helper arguments to template-safe strings.",
  })
);

const decodeTemplateHelperString = S.decodeUnknownOption(UnknownToTemplateHelperString);
const toHelperValue = flow(decodeTemplateHelperString, O.getOrElse(thunkEmptyStr));

const createHandlebarsEnvironment = () => {
  const hbs = Handlebars.create();

  hbs.registerHelper("camelCase", flow(toHelperValue, Str.camelCase));
  hbs.registerHelper("pascalCase", flow(toHelperValue, Str.pascalCase));
  hbs.registerHelper("kebabCase", flow(toHelperValue, Str.kebabCase));
  hbs.registerHelper("snakeCase", flow(toHelperValue, Str.snakeCase));

  return hbs;
};

/**
 * Construct the default template service implementation.
 *
 * @returns Template renderer backed by Handlebars.
 * @example
 * ```ts
 * import { createTemplateService } from "@beep/repo-cli/commands/CreatePackage"
 *
 * const example = createTemplateService
 * console.log(typeof example !== "undefined") // true
 * ```
 * @category models
 * @since 0.0.0
 */
export const createTemplateService = (): TemplateServiceShape => {
  const hbs = createHandlebarsEnvironment();

  const renderTemplates: TemplateServiceShape["renderTemplates"] = Effect.fn(function* (
    request: TemplateRenderRequest
  ) {
    const fs = yield* FileSystem.FileSystem;

    return yield* Effect.forEach(
      request.templates,
      Effect.fn(function* ({ templateName, outputPath }) {
        const raw = yield* fs
          .readFileString(`${request.templateDir}/${templateName}`)
          .pipe(
            Effect.mapError(
              DomainError.newCause(`Failed to read template "${templateName}" from "${request.templateDir}"`)
            )
          );

        const compile = hbs.compile(raw, { noEscape: true });
        return RenderedTemplate.make({
          outputPath,
          content: compile(request.context),
        });
      })
    );
  });

  return {
    renderTemplates,
  };
};
