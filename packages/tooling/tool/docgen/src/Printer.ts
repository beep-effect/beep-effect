/**
 * Markdown printer for parsed docgen module models.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoDocgenId } from "@beep/identity/packages";
import { SchemaUtils } from "@beep/schema";
import { A, Str, thunkEmptyStr } from "@beep/utils";
import { Effect, Layer, Match, Order, pipe } from "effect";
import { dual, flow } from "effect/Function";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Configuration from "./Configuration.ts";
import * as Domain from "./Domain.ts";
import * as Parser from "./Parser.ts";

const $I = $RepoDocgenId.create("Printer");

/**
 * Union of documented entities that the markdown printer can render.
 *
 * @internal
 * @example
 * ```ts
 * import type { Printable } from "@beep/repo-docgen/Printer"
 * type ExamplePrintable = Printable
 * ```
 * @category formatting
 * @since 0.0.0
 */
export const Printable = S.Union([
  Domain.Class,
  Domain.Constant,
  Domain.Export,
  Domain.Function,
  Domain.Interface,
  Domain.TypeAlias,
  Domain.Namespace,
]).pipe(
  S.toTaggedUnion("_tag"),
  $I.annoteSchema("Printable", {
    description: "Union of documented entities that the markdown printer can render.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Companion type for {@link Printable}
 *
 * @example
 * ```ts
 * import { Printable } from "@beep/repo-docgen/Printer";
 *
 * type ExamplePrintable = Printable
 * ```
 * @category models
 * @since 0.0.0
 */
export type Printable = typeof Printable.Type;

const Markdown = {
  bold: (content: string) => `**${content}**`,
  strikethrough: (content: string) => `~~${content}~~`,
};

const replaceJSDocLinks: (text: string) => string = Str.replaceWith(
  /\{@link\s+([^\s}]+)(?:\s+([^}]+))?}/g,
  (_match, link, label) => {
    const linkText = P.isString(link) ? link : "";
    const labelText = P.isString(label) ? label : linkText;
    return `\`${Str.trim(labelText)}\``;
  }
);

const removeFenceMetadata: (markdown: string) => string = Str.replaceWith(
  /^(`{3,})([^\n]*)/gm,
  (_match, fence, info) => {
    const fenceText = P.isString(fence) ? fence : "";
    const infoText = P.isString(info) ? info : "";
    const tokens = pipe(infoText, Str.trim, Str.split(/\s+/));
    return `${fenceText}${pipe(tokens, A.head, O.getOrElse(thunkEmptyStr))}`;
  }
);

const printOptionalDescription = Effect.fn("printOptionalDescription")(function* (description: string | undefined) {
  if (P.isUndefined(description)) {
    return "";
  }

  const config = yield* Configuration.Configuration;
  const descriptionWithoutLinks = replaceJSDocLinks(description);
  const out =
    config.theme === Configuration.DEFAULT_THEME
      ? removeFenceMetadata(descriptionWithoutLinks)
      : descriptionWithoutLinks;
  return `\n\n${out}`;
});

const printArray = (title: string, values?: ReadonlyArray<string>): string => {
  if (P.isUndefined(values) || A.isReadonlyArrayEmpty(values)) {
    return "";
  }

  return `\n\n${Markdown.bold(title)}\n\n${A.join("\n")(values)}`;
};

const printFence = (code: string): string => {
  if (
    pipe(
      ["```ts", "~~~ts"],
      A.some((prefix) => Str.startsWith(prefix)(code))
    )
  ) {
    return code;
  }

  return `\`\`\`ts\n${code}\n\`\`\``;
};

const printOptionalSignature = (signature?: string): string =>
  signature === undefined ? "" : `\n\n${Markdown.bold("Signature")}\n\n${printFence(signature)}`;

const printThrowsArray = (throws?: ReadonlyArray<string>) => printArray("Throws", throws);

const printExamplesArray = (examples: ReadonlyArray<string>): string =>
  examples.length === 0
    ? ""
    : pipe(
        examples,
        A.map((example) => `\n\n**Example**\n\n${printFence(example)}`),
        A.join("")
      );

const printOptionalSince = (since: ReadonlyArray<string>): string =>
  since.length === 0 ? "" : `\n\nSince v${A.join(", ")(since)}`;

const printHeaderByIndentation = (indentation: number) =>
  Match.value(indentation).pipe(
    Match.when(0, () => "## "),
    Match.when(1, () => "### "),
    Match.orElse(() => "#### ")
  );

const printTitle = (name: string, deprecated: ReadonlyArray<string>, postfix?: string): string => {
  const printableName = Str.trim(name) === "hasOwnProperty" ? `${name} (function)` : name;
  const title = deprecated.length > 0 ? Markdown.strikethrough(printableName) : printableName;
  return postfix === undefined ? title : `${title} ${postfix}`;
};

const printSeesArray = (sees?: ReadonlyArray<string>): string => {
  if (sees === undefined || sees.length === 0) {
    return "";
  }

  return `\n\n${Markdown.bold("See")}\n\n${pipe(
    sees,
    A.map((see) => `- ${replaceJSDocLinks(see)}`),
    A.join("\n")
  )}`;
};

const pathSegments = (segments: ReadonlyArray<string>): ReadonlyArray<string> =>
  A.flatMap(segments, flow(Str.split(/[\\/]+/), A.filter(Str.isNonEmpty)));

const startsWithSegments = (segments: ReadonlyArray<string>, prefix: ReadonlyArray<string>): boolean =>
  prefix.length > 0 && A.every(prefix, (segment, index) => segments[index] === segment);

const findSubsequenceIndex = (segments: ReadonlyArray<string>, subsequence: ReadonlyArray<string>): number => {
  if (subsequence.length === 0 || subsequence.length > segments.length) {
    return -1;
  }

  for (let index = 0; index <= segments.length - subsequence.length; index++) {
    if (A.every(subsequence, (segment, offset) => segments[index + offset] === segment)) {
      return index;
    }
  }

  return -1;
};

const stripSourceDirSegments = (
  segments: ReadonlyArray<string>,
  sourceDirSegments: ReadonlyArray<string>
): ReadonlyArray<string> => {
  if (sourceDirSegments.length === 0) {
    return segments;
  }

  if (startsWithSegments(segments, sourceDirSegments)) {
    return A.drop(segments, sourceDirSegments.length);
  }

  const sourceDirIndex = findSubsequenceIndex(segments, sourceDirSegments);
  return sourceDirIndex === -1 ? segments : A.drop(segments, sourceDirIndex + sourceDirSegments.length);
};

const getSourceLinkPath = (source: Parser.SourceShape, config: Configuration.ConfigurationShape): string => {
  const sourceSegments = pathSegments(source.path);
  const sourceDirSegments = pathSegments([config.srcDir]);
  const relativeSegments = stripSourceDirSegments(sourceSegments, sourceDirSegments);
  return relativeSegments.length === 0 ? source.sourceFile.getBaseName() : A.join("/")(relativeSegments);
};

const appendUrlPath = (baseUrl: string, relativePath: string): string =>
  `${baseUrl}${Str.endsWith("/")(baseUrl) ? "" : "/"}${relativePath}`;

const printOptionalSourceLink = Effect.fn("printOptionalSourceLink")(function* (position?: Domain.Position) {
  if (P.isUndefined(position)) {
    return "";
  }

  const config = yield* Configuration.Configuration;
  const source = yield* Parser.Source;
  const sourcePath = getSourceLinkPath(source, config);
  return `\n\n[Source](${appendUrlPath(config.srcLink, sourcePath)}#L${position.line})`;
});
type PrintModelOptions = {
  readonly signature?: string | undefined;
  readonly position?: Domain.Position | undefined;
  readonly indentation?: number | undefined;
  readonly postfix?: string | undefined;
};
const printModel = Effect.fn("printModel")(function* (name: string, doc: Domain.Doc, options: PrintModelOptions) {
  const sourceLink = yield* printOptionalSourceLink(options.position);
  const description = yield* printOptionalDescription(doc.description);
  return (
    printHeaderByIndentation(options.indentation ?? 0) +
    printTitle(name, doc.deprecated, options.postfix) +
    description +
    printThrowsArray(doc.throws) +
    printExamplesArray(doc.examples) +
    printSeesArray(doc.sees) +
    printOptionalSignature(options.signature) +
    sourceLink +
    printOptionalSince(doc.since)
  );
});
type PrintEntryOptions = {
  readonly indentation?: number | undefined;
  readonly postfix?: string | undefined;
};
const printEntry = (model: Domain.DocEntry, options: PrintEntryOptions) =>
  printModel(model.name, model.doc, {
    signature: model.signature,
    position: model.position,
    indentation: options.indentation,
    postfix: options.postfix,
  });

const printStaticMethod = (model: Domain.DocEntry) =>
  printEntry(model, {
    indentation: 1,
    postfix: "(static method)",
  });

const printMethod = (model: Domain.DocEntry) =>
  printEntry(model, {
    indentation: 1,
    postfix: "(method)",
  });

const printProperty = (model: Domain.DocEntry) =>
  printEntry(model, {
    indentation: 1,
    postfix: "(property)",
  });

const printClass = Effect.fn("printClass")(function* (model: Domain.Class) {
  const header = yield* printEntry(model, { postfix: "(class)" });
  const staticMethods = yield* Effect.forEach(model.staticMethods, printStaticMethod);
  const methods = yield* Effect.forEach(model.methods, printMethod);
  const properties = yield* Effect.forEach(model.properties, printProperty);

  return (
    header +
    pipe(
      staticMethods,
      A.map((value) => `\n\n${value}`),
      A.join("")
    ) +
    pipe(
      methods,
      A.map((value) => `\n\n${value}`),
      A.join("")
    ) +
    pipe(
      properties,
      A.map((value) => `\n\n${value}`),
      A.join("")
    )
  );
});

const printConstant = (model: Domain.Constant) => printEntry(model, {});

const printExport = (model: Domain.Export) =>
  printEntry(model, {
    postfix: model.isNamespaceExport ? "(namespace export)" : undefined,
  });

const printFunction = (model: Domain.Function) => printEntry(model, {});

const printInterface: {
  (
    model: Domain.Interface,
    indentation: number
  ): Effect.Effect<string, never, Configuration.Configuration | Parser.Source>;
  (
    indentation: number
  ): (model: Domain.Interface) => Effect.Effect<string, never, Configuration.Configuration | Parser.Source>;
} = dual(2, (model: Domain.Interface, indentation: number) =>
  printEntry(model, {
    indentation,
    postfix: "(interface)",
  })
);

const printTypeAlias: {
  (
    model: Domain.TypeAlias,
    indentation: number
  ): Effect.Effect<string, never, Configuration.Configuration | Parser.Source>;
  (
    indentation: number
  ): (model: Domain.TypeAlias) => Effect.Effect<string, never, Configuration.Configuration | Parser.Source>;
} = dual(2, (model: Domain.TypeAlias, indentation: number) =>
  printEntry(model, {
    indentation,
    postfix: "(type alias)",
  })
);

const printNamespace: {
  (
    model: Domain.Namespace,
    indentation: number
  ): Effect.Effect<string, never, Configuration.Configuration | Parser.Source>;
  (
    indentation: number
  ): (model: Domain.Namespace) => Effect.Effect<string, never, Configuration.Configuration | Parser.Source>;
} = dual(
  2,
  Effect.fn("printNamespace")(function* (
    model: Domain.Namespace,
    indentation: number
  ): Effect.fn.Return<string, never, Configuration.Configuration | Parser.Source> {
    const header = yield* printModel(model.name, model.doc, {
      position: model.position,
      indentation,
      postfix: "(namespace)",
    });
    const interfaces = yield* Effect.forEach(model.interfaces, (inter) => printInterface(inter, indentation + 1));
    const typeAliases = yield* Effect.forEach(model.typeAliases, (typeAlias) =>
      printTypeAlias(typeAlias, indentation + 1)
    );
    const namespaces = yield* Effect.forEach(model.namespaces, printNamespace(indentation + 1));

    return (
      header +
      pipe(
        interfaces,
        A.map((value) => `\n\n${value}`),
        A.join("")
      ) +
      pipe(
        typeAliases,
        A.map((value) => `\n\n${value}`),
        A.join("")
      ) +
      pipe(
        namespaces,
        A.map((value) => `\n\n${value}`),
        A.join("")
      )
    );
  })
);

/**
 * Renders a single documented entity into markdown.
 *
 * @internal
 * @remarks
 * Rendering depends on the active {@link Configuration.Configuration} and {@link Parser.Source}
 * so generated pages can include theme-compatible fences and source links.
 * @example
 * ```ts
 * import { Effect, Layer } from "effect"
 * import { Project } from "ts-morph"
 * import {
 *   DEFAULT_THEME,
 *   Configuration,
 *   ConfigurationShape,
 *   defaultCompilerOptions
 * } from "@beep/repo-docgen/Configuration"
 * import { Constant, Doc, Position } from "@beep/repo-docgen/Domain"
 * import { Source, SourceShape } from "@beep/repo-docgen/Parser"
 * import { print } from "@beep/repo-docgen/Printer"
 * const project = new Project({ useInMemoryFileSystem: true })
 * const sourceFile = project.createSourceFile("src/example.ts", "export const answer = 42")
 * const source = SourceShape.new(["src", "example.ts"], sourceFile)
 * const config = ConfigurationShape.make({
 *   enableSearch: true,
 *   enforceDescriptions: false,
 *   enforceExamples: true,
 *   enforceVersion: true,
 *   examplesCompilerOptions: defaultCompilerOptions,
 *   exclude: [],
 *   include: [],
 *   outDir: "docs",
 *   parseCompilerOptions: defaultCompilerOptions,
 *   projectHomepage: "https://github.com/beep-effect/beep-effect",
 *   projectName: "@beep/repo-docgen",
 *   runExamples: false,
 *   srcDir: "src",
 *   srcLink: "https://github.com/beep-effect/beep-effect/blob/main/packages/tooling/tool/docgen/src",
 *   theme: DEFAULT_THEME,
 *   tscExecutable: "tsc"
 * })
 * const doc = Doc.new("The answer exported by the example module.", {
 *   since: ["0.0.0"],
 *   deprecated: [],
 *   examples: ["console.log(42)"],
 *   category: ["constants"],
 *   throws: [],
 *   sees: [],
 *   tags: {}
 * })
 * const model = Constant.new("answer", doc, {
 *   signature: "const answer: 42",
 *   position: Position.new(1, 14)
 * })
 * const markdown = Effect.runSync(
 *   print(model).pipe(Effect.provide(Layer.mergeAll(Configuration.layer(config), Source.layer(source))))
 * )
 * console.log(markdown.includes("answer"))
 * ```
 * @category formatting
 * @since 0.0.0
 */
export const print = Match.type<Printable>().pipe(
  Match.tagsExhaustive({
    Class: printClass,
    Constant: printConstant,
    Export: printExport,
    Function: printFunction,
    Interface: printInterface(0),
    TypeAlias: printTypeAlias(0),
    Namespace: printNamespace(0),
  })
);

const DEFAULT_CATEGORY = "utils";

const byCategory = Order.mapInput(Str.Order, ([category]: [string, ...Array<unknown>]) => category);

const getPrintables = (module: Domain.Module): ReadonlyArray<Printable> =>
  A.flatten([
    module.classes,
    module.constants,
    module.exports,
    module.functions,
    module.interfaces,
    module.typeAliases,
    module.namespaces,
  ]);

const sortByName: <
  A extends {
    name: string;
  },
>(
  self: Iterable<A>
) => Array<A> = A.sort(Order.mapInput(Str.Order, ({ name }: { readonly name: string }) => name));

/**
 * Renders a parsed module into markdown grouped by documentation category.
 *
 * @param module - Parsed docgen module to render.
 * @returns An Effect that yields the module rendered as category-grouped markdown.
 * @remarks
 * Printables are sorted by category and then by symbol name. Symbols with no
 * `@category` are grouped under the legacy `utils` fallback.
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { Project } from "ts-morph"
 * import {
 *   DEFAULT_THEME,
 *   Configuration,
 *   ConfigurationShape,
 *   defaultCompilerOptions
 * } from "@beep/repo-docgen/Configuration"
 * import { Constant, Doc, Module, Position } from "@beep/repo-docgen/Domain"
 * import { SourceShape } from "@beep/repo-docgen/Parser"
 * import { printModule } from "@beep/repo-docgen/Printer"
 * const project = new Project({ useInMemoryFileSystem: true })
 * const sourceFile = project.createSourceFile("src/example.ts", "export const answer = 42")
 * const source = SourceShape.new(["src", "example.ts"], sourceFile)
 * const config = ConfigurationShape.make({
 *   enableSearch: true,
 *   enforceDescriptions: false,
 *   enforceExamples: true,
 *   enforceVersion: true,
 *   examplesCompilerOptions: defaultCompilerOptions,
 *   exclude: [],
 *   include: [],
 *   outDir: "docs",
 *   parseCompilerOptions: defaultCompilerOptions,
 *   projectHomepage: "https://github.com/beep-effect/beep-effect",
 *   projectName: "@beep/repo-docgen",
 *   runExamples: false,
 *   srcDir: "src",
 *   srcLink: "https://github.com/beep-effect/beep-effect/blob/main/packages/tooling/tool/docgen/src",
 *   theme: DEFAULT_THEME,
 *   tscExecutable: "tsc"
 * })
 * const doc = Doc.new("Example module.", {
 *   since: ["0.0.0"],
 *   deprecated: [],
 *   examples: [],
 *   category: ["models"],
 *   throws: [],
 *   sees: [],
 *   tags: {}
 * })
 * const constant = Constant.new("answer", doc, {
 *   signature: "const answer: 42",
 *   position: Position.new(1, 14)
 * })
 * const module = Module.new(source, "example.ts", {
 *   doc,
 *   path: ["src", "example.ts"],
 *   classes: [],
 *   interfaces: [],
 *   functions: [],
 *   typeAliases: [],
 *   constants: [constant],
 *   exports: [],
 *   namespaces: []
 * })
 * const markdown = Effect.runSync(printModule(module).pipe(Effect.provide(Configuration.layer(config))))
 * console.log(markdown.includes("# models"))
 * ```
 * @category formatting
 * @since 0.0.0
 */
export const printModule = (module: Domain.Module) =>
  Effect.scoped(
    Layer.build(Parser.Source.layer(module.source)).pipe(
      Effect.flatMap(
        Effect.fnUntraced(function* (context) {
          return yield* Effect.gen(function* () {
            const description = yield* printModel(module.name, module.doc, { postfix: "overview" });
            const grouped = A.groupBy(sortByName(getPrintables(module)), (printable) =>
              printable.doc.category.length === 0 ? DEFAULT_CATEGORY : A.join(", ")(printable.doc.category)
            );
            const printables = A.sort(byCategory)(R.toEntries(grouped) as Array<[string, Array<Printable>]>);

            const strings = yield* Effect.forEach(
              printables,
              Effect.fnUntraced(function* ([category, categoryPrintables]) {
                const values = yield* Effect.forEach(sortByName(categoryPrintables), print);
                return `\n\n# ${category}${pipe(
                  values,
                  A.map((value) => `\n\n${value}`),
                  A.join("")
                )}`;
              })
            );

            return `${description}

<!-- toc -->${A.join("")(strings)}`;
          }).pipe(Effect.provide(context));
        })
      )
    )
  );

/**
 * Builds the front matter used for a generated module documentation page.
 *
 * @example
 * ```ts
 * import { Project } from "ts-morph"
 * import { Doc, Module } from "@beep/repo-docgen/Domain"
 * import { SourceShape } from "@beep/repo-docgen/Parser"
 * import { printFrontMatter } from "@beep/repo-docgen/Printer"
 *
 * const project = new Project({ useInMemoryFileSystem: true })
 * const sourceFile = project.createSourceFile("src/example.ts", "")
 * const source = SourceShape.new(["src", "example.ts"], sourceFile)
 * const doc = Doc.new("Example module.", {
 *   since: ["0.0.0"],
 *   deprecated: [],
 *   examples: [],
 *   category: ["models"],
 *   throws: [],
 *   sees: [],
 *   tags: {}
 * })
 * const module = Module.new(source, "example.ts", {
 *   doc,
 *   path: ["src", "example.ts"],
 *   classes: [],
 *   interfaces: [],
 *   functions: [],
 *   typeAliases: [],
 *   constants: [],
 *   exports: [],
 *   namespaces: []
 * })
 *
 * const frontMatter = printFrontMatter(module, 3)
 * console.log(frontMatter.includes("nav_order: 3"))
 * ```
 * @category formatting
 * @since 0.0.0
 */
export const printFrontMatter: {
  (module: Domain.Module, navOrder: number): string;
  (navOrder: number): (module: Domain.Module) => string;
} = dual(
  2,
  (module: Domain.Module, navOrder: number): string => `---
title: ${module.name}
nav_order: ${navOrder}
parent: Modules
---`
);

/**
 * `prettier` is optional in this repo-local port; returning the markdown
 * unchanged keeps the generation deterministic while avoiding another runtime
 * dependency during the migration.
 *
 * @param content - Markdown content to normalize before writing.
 * @returns Effect that currently returns the markdown unchanged.
 * @example
 * ```ts
 * import { prettify } from "@beep/repo-docgen/Printer"
 * const rendered = prettify("# Title")
 * console.log(rendered)
 * ```
 * @category formatting
 * @since 0.0.0
 */
export function prettify(content: string) {
  return Effect.succeed(content);
}
