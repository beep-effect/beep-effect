/**
 * Extract the `effect/Schema` index from the installed `effect` package: the
 * type checker resolves every value export through an in-memory probe file,
 * and the installed `src/` modules supply each export's JSDoc summary and
 * `@category`.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { pipe } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { Node, Project, ts } from "ts-morph";
import { SchemaIdiomsError } from "./SchemaIdioms.errors.ts";
import {
  SchemaGetterEntry,
  SchemaGetterModule,
  SchemaIndex,
  SchemaIndexCheck,
  SchemaIndexCodec,
  SchemaIndexCombinator,
} from "./SchemaIdioms.model.ts";
import type { SourceFile, Type } from "ts-morph";
import type { SchemaIndexEntry } from "./SchemaIdioms.model.ts";

const $I = $RepoCliId.create("commands/SchemaIdioms/SchemaIdioms.extract");

const EffectPackageManifest = S.Struct({ version: S.String }).pipe(
  $I.annoteSchema("EffectPackageManifest", {
    description: "The installed effect package.json fields the schema index records.",
  })
);

const decodeEffectPackageManifest = S.decodeUnknownEffect(S.fromJsonString(EffectPackageManifest));

const PROBE_FILE_NAME = "__beep_schema_idioms_probe__.ts";

const SCHEMA_MODULE = "effect/Schema";

const GETTER_MODULES = SchemaGetterModule.literals;

const PROBE_PRELUDE = A.join(
  [
    'import * as S from "effect/Schema";',
    'import type * as AST from "effect/SchemaAST";',
    'import type * as SchemaGetter from "effect/SchemaGetter";',
    'import type * as SchemaTransformation from "effect/SchemaTransformation";',
    "type Ret<R> = R extends S.Codec<infer T, infer E, any, any> ? { schema: { t: T; e: E } }",
    "  : R extends AST.Check<infer I> ? { check: I } : { other: 1 };",
    'declare function probe<T, E>(s: S.Codec<T, E, any, any>): { kind: "schema"; t: T; e: E };',
    'declare function probe<A extends ReadonlyArray<any>, R>(f: (...a: A) => R): { kind: "fn"; r: Ret<R> };',
    'declare function probe(x: unknown): { kind: "other" };',
    "export type Modules = [typeof SchemaGetter, typeof SchemaTransformation];",
  ],
  "\n"
);

const TYPE_TEXT_FLAGS = ts.TypeFormatFlags.NoTruncation | ts.TypeFormatFlags.UseFullyQualifiedType;

const IMPORTED_TYPE_QUALIFIER = /import\("[^"]*?([A-Za-z0-9_]+)(?:\.js|\.d\.ts|\.ts)?"\)\./g;

const LINK_TAG = /\{@link(?:code|plain)?\s+([^}|\s]+)(?:\s*\|\s*([^}]+))?\s*\}/g;

const FIRST_SENTENCE = /^(.*?[.!?])(?:\s|$)/;

const PARAGRAPH_BREAK = /\n\s*\n/;

const byName: Order.Order<{ readonly name: string }> = Order.mapInput(
  Order.String,
  (entry: { readonly name: string }) => entry.name
);

const byModuleThenName: Order.Order<SchemaGetterEntry> = Order.combine(
  Order.mapInput(Order.String, (entry: SchemaGetterEntry) => entry.module),
  byName
);

const makeProject = (): Project =>
  new Project({
    skipAddingFilesFromTsConfig: true,
    skipFileDependencyResolution: true,
    compilerOptions: {
      strict: true,
      noEmit: true,
      skipLibCheck: true,
      exactOptionalPropertyTypes: true,
      target: ts.ScriptTarget.ESNext,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      types: [],
    },
  });

const isValueDeclaration = (node: Node): boolean =>
  Node.isVariableDeclaration(node) ||
  Node.isFunctionDeclaration(node) ||
  Node.isClassDeclaration(node) ||
  Node.isEnumDeclaration(node);

const valueExportNames = (file: SourceFile): ReadonlyArray<string> =>
  pipe(
    A.fromIterable(file.getExportedDeclarations()),
    A.filter(([, declarations]) => A.some(declarations, isValueDeclaration)),
    A.map(([name]) => name),
    A.sort(Order.String)
  );

const moduleFileOf = (probe: SourceFile, specifier: string): Effect.Effect<SourceFile, SchemaIdiomsError> =>
  pipe(
    O.fromNullishOr(probe.getImportDeclaration(specifier)),
    O.flatMap((declaration) => O.fromNullishOr(declaration.getModuleSpecifierSourceFile())),
    Effect.fromOption,
    Effect.mapError(() =>
      SchemaIdiomsError.new(`could not resolve ${specifier} from the repository root; is effect installed?`)
    )
  );

/**
 * Shorten checker type text: drop `import("…")` qualifiers down to the module
 * name and collapse whitespace.
 *
 * **Example** (Shorten an imported type)
 *
 * ```ts
 * import { normalizeTypeText } from "@beep/repo-cli/commands/SchemaIdioms"
 *
 * console.log(normalizeTypeText('import("effect/DateTime").Utc')) // "DateTime.Utc"
 * ```
 *
 * @param text - Type text printed by the TypeScript checker.
 * @returns The text with module-qualified names and single spaces.
 * @category formatting
 * @since 0.0.0
 */
export const normalizeTypeText = (text: string): string =>
  pipe(text, Str.replace(IMPORTED_TYPE_QUALIFIER, "$1."), Str.replace(/\s+/g, " "), Str.trim);

/**
 * The first sentence of a JSDoc description's first prose paragraph, with
 * `{@link}` tags reduced to their text.
 *
 * **Details**
 *
 * Paragraphs that open a section (`**Details**`, `**Example** (…)`) are
 * skipped. A description with no prose paragraph has no summary.
 *
 * **Example** (Summarise a description)
 *
 * ```ts
 * import { jsDocSummary } from "@beep/repo-cli/commands/SchemaIdioms"
 *
 * console.log(jsDocSummary("Decodes a {@link Duration}. More text.\n\n**Details**\n\nIgnored."))
 * // { _id: 'Option', _tag: 'Some', value: 'Decodes a Duration.' }
 * ```
 *
 * @param description - JSDoc description text without its block tags.
 * @returns The summary sentence, or none when no paragraph is prose.
 * @category parsing
 * @since 0.0.0
 */
export const jsDocSummary = (description: string): O.Option<string> =>
  pipe(
    Str.split(description, PARAGRAPH_BREAK),
    A.map((paragraph) => pipe(paragraph, Str.replace(LINK_TAG, "$1"), Str.replace(/\s+/g, " "), Str.trim)),
    A.findFirst((paragraph) => Str.isNonEmpty(paragraph) && !Str.startsWith("**")(paragraph)),
    O.map((paragraph) =>
      pipe(
        O.fromNullishOr(FIRST_SENTENCE.exec(paragraph)),
        O.flatMap((match) => A.get(match, 1)),
        O.getOrElse(() => paragraph)
      )
    )
  );

const SchemaDoc = S.Struct({ summary: S.Option(S.String), category: S.Option(S.String) }).pipe(
  $I.annoteSchema("SchemaDoc", {
    description: "The JSDoc summary sentence and @category read for one exported declaration.",
  })
);

type SchemaDoc = typeof SchemaDoc.Type;

const noDoc: SchemaDoc = { summary: O.none(), category: O.none() };

const statementExportNames = (statement: Node): ReadonlyArray<string> => {
  if (Node.isVariableStatement(statement) && statement.isExported()) {
    return A.map(statement.getDeclarations(), (declaration) => declaration.getName());
  }
  if ((Node.isFunctionDeclaration(statement) || Node.isClassDeclaration(statement)) && statement.isExported()) {
    return O.match(O.fromNullishOr(statement.getName()), { onNone: A.empty, onSome: A.of });
  }
  return A.empty();
};

const statementDoc = (statement: Node): O.Option<SchemaDoc> =>
  pipe(
    Node.isJSDocable(statement) ? A.last(statement.getJsDocs()) : O.none(),
    O.map((doc) => ({
      summary: jsDocSummary(doc.getDescription()),
      category: pipe(
        A.findFirst(doc.getTags(), (tag) => tag.getTagName() === "category"),
        O.flatMap((tag) => O.fromNullishOr(tag.getCommentText())),
        O.map(Str.trim),
        O.filter(Str.isNonEmpty)
      ),
    }))
  );

const docsOf = (file: SourceFile): HashMap.HashMap<string, SchemaDoc> =>
  A.reduce(file.getStatements(), HashMap.empty<string, SchemaDoc>(), (docs, statement) =>
    O.match(statementDoc(statement), {
      onNone: () => docs,
      onSome: (doc) =>
        A.reduce(statementExportNames(statement), docs, (acc, name) =>
          HashMap.has(acc, name) ? acc : HashMap.set(acc, name, doc)
        ),
    })
  );

const docOf = (docs: HashMap.HashMap<string, SchemaDoc>, name: string): SchemaDoc =>
  O.getOrElse(HashMap.get(docs, name), () => noDoc);

const propertyType = (type: Type, name: string, at: Node): O.Option<Type> =>
  O.map(O.fromNullishOr(type.getProperty(name)), (symbol) => symbol.getTypeAtLocation(at));

const typeText = (type: Type): string => normalizeTypeText(type.getText(undefined, TYPE_TEXT_FLAGS));

const probeKind = (type: Type, at: Node): O.Option<string> =>
  pipe(
    propertyType(type, "kind", at),
    O.map((kind) => kind.getLiteralValue()),
    O.filter(P.isString)
  );

const entryOf = (probe: SourceFile, name: string, doc: SchemaDoc): SchemaIndexEntry => {
  const combinator = SchemaIndexCombinator.make({ kind: "combinator", name, ...doc });
  return pipe(
    O.fromNullishOr(probe.getVariableDeclaration(`_${name}`)),
    O.flatMap((declaration) => {
      const type = declaration.getType();
      return pipe(
        probeKind(type, declaration),
        O.flatMap((kind): O.Option<SchemaIndexEntry> => {
          if (kind === "schema") {
            return O.map(
              O.all([propertyType(type, "t", declaration), propertyType(type, "e", declaration)]),
              ([decoded, encoded]) =>
                SchemaIndexCodec.make({
                  kind: "codec",
                  name,
                  decoded: typeText(decoded),
                  encoded: typeText(encoded),
                  ...doc,
                })
            );
          }
          return pipe(
            propertyType(type, "r", declaration),
            O.flatMap((result) => propertyType(result, "check", declaration)),
            O.map((input) => SchemaIndexCheck.make({ kind: "check", name, input: typeText(input), ...doc }))
          );
        })
      );
    }),
    O.getOrElse(() => combinator)
  );
};

const readEffectVersion = Effect.fn("SchemaIdioms.readEffectVersion")(function* (effectRoot: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const manifest = yield* fs
    .readFileString(path.join(effectRoot, "package.json"))
    .pipe(Effect.flatMap(decodeEffectPackageManifest), SchemaIdiomsError.mapError("could not read the effect version"));
  return manifest.version;
});

const readSourceDocs = Effect.fn("SchemaIdioms.readSourceDocs")(function* (
  project: Project,
  effectRoot: string,
  module: string
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const file = path.join(effectRoot, "src", `${module}.ts`);
  const text = yield* fs
    .readFileString(file)
    .pipe(SchemaIdiomsError.mapError(`could not read effect/src/${module}.ts`));
  return docsOf(project.createSourceFile(file, text, { overwrite: true }));
});

/**
 * Build the schema index from the effect package installed at the repository
 * root.
 *
 * **Details**
 *
 * Export names come from the checker's view of each module's declarations,
 * never from runtime keys. One in-memory probe file asks the checker what each
 * `effect/Schema` export is: a codec with decoded and encoded types, a check
 * constructor with its input type, or (when the result depends on the schema
 * it is given) a combinator. Entries are sorted by name and carry no paths, so
 * the output depends only on the installed effect.
 *
 * **Example** (Extract the index)
 *
 * ```ts
 * import { extractSchemaIndex } from "@beep/repo-cli/commands/SchemaIdioms"
 * import * as Effect from "effect/Effect"
 *
 * const program = extractSchemaIndex(process.cwd()).pipe(Effect.map((index) => index.entries.length))
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @param repoRoot - Absolute repository root whose `node_modules/effect` is indexed.
 * @returns The sorted index and the installed effect version.
 * @category use-cases
 * @since 0.0.0
 */
export const extractSchemaIndex = Effect.fn("SchemaIdioms.extractSchemaIndex")(function* (repoRoot: string) {
  const path = yield* Path.Path;
  const effectRoot = path.join(repoRoot, "node_modules", "effect");
  const effectVersion = yield* readEffectVersion(effectRoot);
  const project = makeProject();
  const probe = project.createSourceFile(path.join(repoRoot, PROBE_FILE_NAME), PROBE_PRELUDE, { overwrite: true });
  const schemaFile = yield* moduleFileOf(probe, SCHEMA_MODULE);
  const getterFiles = yield* Effect.forEach(
    GETTER_MODULES,
    (module) =>
      Effect.map(moduleFileOf(probe, `effect/${module}`), (file): readonly [SchemaGetterModule, SourceFile] => [
        module,
        file,
      ]),
    { concurrency: 1 }
  );
  const schemaNames = valueExportNames(schemaFile);
  probe.addStatements(A.map(schemaNames, (name) => `export const _${name} = probe(S.${name});`));
  const schemaDocs = yield* readSourceDocs(project, effectRoot, "Schema");
  const entries = A.map(schemaNames, (name) => entryOf(probe, name, docOf(schemaDocs, name)));
  const getters = yield* Effect.forEach(
    getterFiles,
    ([module, file]) =>
      Effect.gen(function* () {
        const docs = yield* readSourceDocs(project, effectRoot, module);
        const names = valueExportNames(file);
        return A.map(names, (name) => SchemaGetterEntry.make({ module, name, ...docOf(docs, name) }));
      }),
    { concurrency: 1 }
  );
  return SchemaIndex.make({
    effectVersion,
    entries: A.sort(entries, byName),
    getters: A.sort(A.flatten(getters), byModuleThenName),
  });
});
