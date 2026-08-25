/**
 * TypeScript source parser for docgen module models.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoDocgenId } from "@beep/identity/packages";
import { A, Str, thunkEmptyStr } from "@beep/utils";
import * as doctrine from "doctrine";
import { Context, Effect, flow, Layer, Path, pipe } from "effect";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as ast from "ts-morph";
import * as Configuration from "./Configuration.ts";
import * as Domain from "./Domain.ts";

const $I = $RepoDocgenId.create("Parser");

const withSource = <A, E, R>(source: SourceShape, effect: Effect.Effect<A, E, R | Source>) =>
  Effect.scoped(
    Layer.build(Source.layer(source)).pipe(
      Effect.flatMap(
        Effect.fnUntraced(function* (context) {
          return yield* effect.pipe(Effect.provide(context));
        })
      )
    )
  );

/**
 * Source metadata carried through parser effects while a module is being processed.
 *
 * **Example** (Logging SourceShape value)
 *
 * ```ts
 * import { SourceShape } from "@beep/repo-docgen/Parser"
 * console.log(SourceShape)
 * ```
 *
 * @internal
 * @category parsing
 * @since 0.0.0
 */
export class SourceShape {
  readonly path: ReadonlyArray<string>;
  readonly sourceFile: ast.SourceFile;

  constructor(path: ReadonlyArray<string>, sourceFile: ast.SourceFile) {
    this.path = path;
    this.sourceFile = sourceFile;
  }

  /**
   * Creates source metadata for a parsed module.
   *
   * @param path - Path segments describing the module.
   * @param sourceFile - Backing ts-morph source file.
   * @returns Source metadata instance.
   */
  static readonly new: {
    (path: ReadonlyArray<string>, sourceFile: ast.SourceFile): SourceShape;
    (sourceFile: ast.SourceFile): (path: ReadonlyArray<string>) => SourceShape;
  } = dual(
    2,
    (path: ReadonlyArray<string>, sourceFile: ast.SourceFile): SourceShape => new SourceShape(path, sourceFile)
  );
}

/**
 * Parser service that provides the active source context while traversing a module.
 *
 * **Example** (Logging Source service)
 *
 * ```ts
 * import { Source } from "@beep/repo-docgen/Parser"
 * console.log(Source)
 * ```
 *
 * @internal
 * @category parsing
 * @since 0.0.0
 */
export class Source extends Context.Service<Source, SourceShape>()($I`Source`) {
  /**
   * Creates a layer that provides the current parser source context.
   *
   * @param source - Source metadata to provide.
   * @returns Layer providing the {@link Source} service.
   */
  static layer(source: SourceShape) {
    return Layer.succeed(Source, Source.of(source));
  }
}

const sortModulesByPath: <A extends Domain.Module>(self: Iterable<A>) => Array<A> = A.sort<Domain.Module>(
  Domain.ByPath
);

const getJSDocText: (jsdocs: ReadonlyArray<ast.JSDoc>) => string = A.matchRight({
  onEmpty: thunkEmptyStr,
  onNonEmpty: (_, last) => last.getText(),
});

const getDocComment: (ranges: ReadonlyArray<ast.CommentRange>) => O.Option<ast.CommentRange> = flow(
  A.filter((range) => Str.startsWith("/**")(range.getText())),
  A.last
);

class ParsedComment extends S.Class<ParsedComment>($I`ParsedComment`)(
  {
    description: S.String.pipe(S.UndefinedOr),
    tags: S.Record(S.String, S.Array(S.String).pipe(S.UndefinedOr)),
  },
  $I.annote("ParsedComment", {
    description: "Normalized description and grouped tag values parsed from a raw JSDoc block.",
  })
) {}

/**
 * Parses a raw JSDoc block into a normalized description and grouped tag map.
 *
 * **Example** (Parse simple JSDoc comment)
 *
 * ```ts
 * import { parseComment } from "@beep/repo-docgen/Parser"
 * const comment = parseComment("/** Example. *\/")
 * console.log(comment)
 * ```
 *
 * @internal
 * @param text - Raw JSDoc text to parse.
 * @returns Parsed comment description and grouped tag values.
 * @category parsing
 * @since 0.0.0
 */
export const parseComment = (text: string): ParsedComment => {
  const annotation: doctrine.Annotation = doctrine.parse(text, {
    unwrap: true,
  });

  const description = pipe(
    O.fromNullishOr(annotation.description),
    O.map(Str.trim),
    O.filter(Str.isNonEmpty),
    O.getOrUndefined
  );

  const tags = pipe(
    annotation.tags,
    A.groupBy((tag) => tag.title),
    R.map((values) =>
      A.map(values, (tag) => pipe(O.fromNullishOr(tag.description), O.map(Str.trim), O.getOrElse(thunkEmptyStr)))
    )
  );

  return ParsedComment.make({ description, tags });
};

const isVariableDeclarationList = (
  value: ast.VariableDeclarationList | ast.CatchClause
): value is ast.VariableDeclarationList => value.getKind() === ast.ts.SyntaxKind.VariableDeclarationList;

const parseDoc = (text: string) => {
  const comment = parseComment(text);
  return Domain.Doc.new(comment.description, {
    since: comment.tags.since ?? [],
    deprecated: comment.tags.deprecated ?? [],
    examples: comment.tags.example ?? [],
    category: comment.tags.category ?? [],
    throws: comment.tags.throws ?? [],
    sees: comment.tags.see ?? [],
    tags: comment.tags,
  });
};

const shouldIgnore = (doc: Domain.Doc): boolean => R.has(doc.tags, "internal") || R.has(doc.tags, "ignore");

const parsePosition = Effect.fn("parsePosition")(function* (
  node: ast.Node
): Effect.fn.Return<Domain.Position, never, Source> {
  const source = yield* Source;
  const startPos = node.getStart();
  const position = source.sourceFile.getLineAndColumnAtPos(startPos);
  return Domain.Position.new(position.line, position.column);
});

const parseInterfaceDeclaration = Effect.fn("parseInterfaceDeclaration")(function* (id: ast.InterfaceDeclaration) {
  const doc = parseDoc(getJSDocText(id.getJsDocs()));
  if (shouldIgnore(doc)) {
    return [];
  }

  const position = yield* parsePosition(id);
  return [
    Domain.Interface.new(id.getName(), doc, {
      signature: id.getText(),
      position,
    }),
  ];
});

const parseInterfaceDeclarations = (interfaces: ReadonlyArray<ast.InterfaceDeclaration>) =>
  Effect.forEach(
    A.filter(interfaces, (declaration) => declaration.isExported()),
    parseInterfaceDeclaration
  ).pipe(Effect.map(A.flatten));

/**
 * Parses exported interface declarations from the active source file.
 *
 * **Example** (Parsing User interface)
 *
 * ```ts
 * import { parseInterfaces, Source, SourceShape } from "@beep/repo-docgen/Parser"
 * import { Effect } from "effect"
 * import { Project } from "ts-morph"
 *
 * const project = new Project({ useInMemoryFileSystem: true })
 * const sourceFile = project.createSourceFile("sample.ts", "/** User profile. *\/\nexport interface User { readonly id: string }")
 * const source = SourceShape.new(["sample.ts"], sourceFile)
 * const interfaces = Effect.runSync(parseInterfaces.pipe(Effect.provide(Source.layer(source))))
 *
 * console.log(interfaces[0]?.name) // "User"
 * ```
 *
 * @effects Reads the active {@link Source} service; it does not touch the filesystem.
 * @category parsing
 * @since 0.0.0
 */
export const parseInterfaces = Effect.gen(function* () {
  const source = yield* Source;
  return yield* parseInterfaceDeclarations(source.sourceFile.getInterfaces());
});

const getTypeText = (node: ast.Node) =>
  node
    .getType()
    .getText(
      node,
      ast.ts.TypeFormatFlags.NoTruncation |
        ast.ts.TypeFormatFlags.WriteArrayAsGenericType |
        ast.ts.TypeFormatFlags.UseAliasDefinedOutsideCurrentScope |
        ast.ts.TypeFormatFlags.NoTypeReduction |
        ast.ts.TypeFormatFlags.AllowUniqueESSymbolType |
        ast.ts.TypeFormatFlags.WriteArrowStyleSignature
    );

const parseType = (node: ast.Node) => {
  let text = getTypeText(node);
  for (const property of node.getDescendantsOfKind(ast.ts.SyntaxKind.PropertySignature)) {
    if (!shouldIgnore(parseDoc(getJSDocText(property.getJsDocs())))) continue;
    const readonly = P.isNotUndefined(property.getFirstModifierByKind(ast.ts.SyntaxKind.ReadonlyKeyword))
      ? "readonly "
      : "";
    const optional = property.hasQuestionToken() ? "?" : "";
    const type = property.getTypeNode()?.getText() ?? getTypeText(property);
    const signature = `${readonly}${property.getName()}${optional}: ${type}`;
    text = pipe(
      text,
      Str.replaceAll(`; ${signature}`, ""),
      Str.replaceAll(`${signature}; `, ""),
      Str.replaceAll(signature, "")
    );
  }
  return text;
};

const getFunctionDeclarationJSDocs = (fd: ast.FunctionDeclaration): Array<ast.JSDoc> =>
  A.matchLeft(fd.getOverloads(), {
    onEmpty: () => fd.getJsDocs(),
    onNonEmpty: (firstOverload) => firstOverload.getJsDocs(),
  });

const parseFunctionDeclaration = Effect.fn("parseFunctionDeclaration")(function* (fd: ast.FunctionDeclaration) {
  const doc = parseDoc(getJSDocText(getFunctionDeclarationJSDocs(fd)));
  if (shouldIgnore(doc)) {
    return [];
  }

  const name = fd.getName() ?? "";
  const signature = `declare const ${name}: ${parseType(fd)}`;
  const position = yield* parsePosition(fd);
  return [Domain.Function.new(name, doc, { signature, position })];
});

const parseFunctionVariableDeclaration = Effect.fn("parseFunctionVariableDeclaration")(function* (
  vd: ast.VariableDeclaration
) {
  const statement = vd.getParent().getParent();
  if (!ast.Node.isVariableStatement(statement)) {
    return [];
  }
  const doc = parseDoc(getJSDocText(statement.getJsDocs()));
  if (shouldIgnore(doc)) {
    return [];
  }

  const name = vd.getName();
  const signature = `declare const ${name}: ${parseType(vd)}`;
  const position = yield* parsePosition(vd);
  return [Domain.Function.new(name, doc, { signature, position })];
});

const getFunctionDeclarations = Effect.gen(function* () {
  const source = yield* Source;
  const functions = A.filter(source.sourceFile.getFunctions(), (fd) => fd.isExported());
  const arrows = A.filter(source.sourceFile.getVariableDeclarations(), (vd) => {
    if (!isVariableDeclarationList(vd.getParent())) {
      return false;
    }

    const statement = vd.getParent().getParent();
    if (!ast.Node.isVariableStatement(statement)) {
      return false;
    }

    return (
      statement.isExported() &&
      pipe(
        O.fromNullishOr(vd.getInitializer()),
        O.filter((expr) => ast.Node.isFunctionLikeDeclaration(expr)),
        O.isSome
      )
    );
  });

  return { functions, arrows };
});

/**
 * Parses exported function declarations from the active source file.
 *
 * **Example** (Parsing double function)
 *
 * ```ts
 * import { parseFunctions, Source, SourceShape } from "@beep/repo-docgen/Parser"
 * import { Effect } from "effect"
 * import { Project } from "ts-morph"
 *
 * const project = new Project({ useInMemoryFileSystem: true })
 * const sourceFile = project.createSourceFile("sample.ts", "/** Doubles a value. *\/\nexport function double(n: number) { return n * 2 }")
 * const source = SourceShape.new(["sample.ts"], sourceFile)
 * const functions = Effect.runSync(parseFunctions.pipe(Effect.provide(Source.layer(source))))
 *
 * console.log(functions[0]?.name) // "double"
 * ```
 *
 * @effects Reads the active {@link Source} service; it does not touch the filesystem.
 * @category parsing
 * @since 0.0.0
 */
export const parseFunctions = Effect.gen(function* () {
  const { arrows, functions } = yield* getFunctionDeclarations;
  const functionDeclarations = yield* Effect.forEach(functions, parseFunctionDeclaration).pipe(Effect.map(A.flatten));
  const functionVariableDeclarations = yield* Effect.forEach(arrows, parseFunctionVariableDeclaration).pipe(
    Effect.map(A.flatten)
  );
  return [...functionDeclarations, ...functionVariableDeclarations];
});

const parseTypeAliasDeclaration = Effect.fn("parseTypeAliasDeclaration")(function* (ta: ast.TypeAliasDeclaration) {
  const doc = parseDoc(getJSDocText(ta.getJsDocs()));
  if (shouldIgnore(doc)) {
    return [];
  }

  const name = ta.getName();
  const type = parseType(ta);
  const definition = ta.getTypeNode()?.getText() ?? "";
  const signature = `type ${ta.getTypeParameters().length > 0 ? type : name} = ${definition}`;
  const position = yield* parsePosition(ta);
  return [Domain.TypeAlias.new(name, doc, { signature, position })];
});

const parseTypeAliasDeclarations = (typeAliases: ReadonlyArray<ast.TypeAliasDeclaration>) =>
  Effect.forEach(
    A.filter(typeAliases, (declaration) => declaration.isExported()),
    parseTypeAliasDeclaration
  ).pipe(Effect.map(A.flatten));

/**
 * Parses exported type alias declarations from the active source file.
 *
 * **Example** (Parsing UserId type alias)
 *
 * ```ts
 * import { parseTypeAliases, Source, SourceShape } from "@beep/repo-docgen/Parser"
 * import { Effect } from "effect"
 * import { Project } from "ts-morph"
 *
 * const project = new Project({ useInMemoryFileSystem: true })
 * const sourceFile = project.createSourceFile("sample.ts", "/** Branded id. *\/\nexport type UserId = string")
 * const source = SourceShape.new(["sample.ts"], sourceFile)
 * const aliases = Effect.runSync(parseTypeAliases.pipe(Effect.provide(Source.layer(source))))
 *
 * console.log(aliases[0]?.signature) // "type UserId = string"
 * ```
 *
 * @effects Reads the active {@link Source} service; it does not touch the filesystem.
 * @category parsing
 * @since 0.0.0
 */
export const parseTypeAliases = Effect.gen(function* () {
  const source = yield* Source;
  return yield* parseTypeAliasDeclarations(source.sourceFile.getTypeAliases());
});

const parseConstantVariableDeclaration = Effect.fn("parseConstantVariableDeclaration")(function* (
  vd: ast.VariableDeclaration
) {
  const statement = vd.getParent().getParent();
  if (!ast.Node.isVariableStatement(statement)) {
    return [];
  }
  const doc = parseDoc(getJSDocText(statement.getJsDocs()));
  if (shouldIgnore(doc)) {
    return [];
  }

  const name = vd.getName();
  const signature = `declare const ${name}: ${parseType(vd)}`;
  const position = yield* parsePosition(vd);
  return [Domain.Constant.new(name, doc, { signature, position })];
});

/**
 * Parses exported constant declarations from the active source file.
 *
 * **Example** (Parsing MAX_RETRIES constant)
 *
 * ```ts
 * import { parseConstants, Source, SourceShape } from "@beep/repo-docgen/Parser"
 * import { Effect } from "effect"
 * import { Project } from "ts-morph"
 *
 * const project = new Project({ useInMemoryFileSystem: true })
 * const sourceFile = project.createSourceFile("sample.ts", "/** Maximum retry count. *\/\nexport const MAX_RETRIES = 2")
 * const source = SourceShape.new(["sample.ts"], sourceFile)
 * const constants = Effect.runSync(parseConstants.pipe(Effect.provide(Source.layer(source))))
 *
 * console.log(constants[0]?.name) // "MAX_RETRIES"
 * ```
 *
 * @effects Reads the active {@link Source} service; it does not touch the filesystem.
 * @category parsing
 * @since 0.0.0
 */
export const parseConstants = Effect.gen(function* () {
  const source = yield* Source;
  const declarations = A.filter(source.sourceFile.getVariableDeclarations(), (vd) => {
    if (!isVariableDeclarationList(vd.getParent())) {
      return false;
    }

    const statement = vd.getParent().getParent();
    if (!ast.Node.isVariableStatement(statement)) {
      return false;
    }

    return (
      statement.isExported() &&
      pipe(
        O.fromNullishOr(vd.getInitializer()),
        O.filter((expr) => !ast.Node.isFunctionLikeDeclaration(expr)),
        O.isSome
      )
    );
  });

  return yield* Effect.forEach(declarations, parseConstantVariableDeclaration).pipe(Effect.map(A.flatten));
});

const parseExportSpecifier = Effect.fn("parseExportSpecifier")(function* (
  es: ast.ExportSpecifier,
  declarationDocComment: O.Option<ast.CommentRange>
) {
  const name = es.compilerNode.name.text;
  const specifierDocComment = getDocComment(es.getLeadingCommentRanges());
  const docComment = O.isSome(specifierDocComment) ? specifierDocComment : declarationDocComment;
  const doc = O.isSome(docComment) ? parseDoc(docComment.value.getText()) : parseDoc("");
  const signature = `declare const ${name}: ${parseType(es)}`;
  const position = yield* parsePosition(es);
  return Domain.Export.new(name, doc, {
    signature,
    position,
    isNamespaceExport: false,
  });
});

const parseExportStar = Effect.fn("parseExportStar")(function* (ed: ast.ExportDeclaration, name: string) {
  const namespace = ed.getNamespaceExport()?.getName();
  const signature = `export *${namespace === undefined ? "" : ` as ${namespace}`} from ${name}`;
  const docComment = getDocComment(ed.getLeadingCommentRanges());
  const doc = O.isSome(docComment) ? parseDoc(docComment.value.getText()) : parseDoc("");
  const position = yield* parsePosition(ed);
  return Domain.Export.new(
    namespace ?? name,
    doc.modifyDescription(
      `Re-exports all named exports from the ${name} module${namespace === undefined ? "" : ` as \`${namespace}\``}.`
    ),
    {
      signature,
      position,
      isNamespaceExport: true,
    }
  );
});

const parseNamedExports = (ed: ast.ExportDeclaration): Effect.Effect<Array<Domain.Export>, never, Source> => {
  const namedExports = ed.getNamedExports();
  const declarationDocComment = getDocComment(ed.getLeadingCommentRanges());
  return A.match(namedExports, {
    onEmpty: () =>
      pipe(
        O.fromNullishOr(ed.getModuleSpecifier()?.getText()),
        O.map((moduleSpecifier) =>
          parseExportStar(ed, moduleSpecifier).pipe(Effect.map((exportValue): Array<Domain.Export> => [exportValue]))
        ),
        O.getOrElse((): Effect.Effect<Array<Domain.Export>, never, Source> => Effect.succeed([]))
      ),
    onNonEmpty: (specifiers) =>
      Effect.forEach(specifiers, (specifier) => parseExportSpecifier(specifier, declarationDocComment)).pipe(
        Effect.map(A.fromIterable)
      ),
  });
};

/**
 * Parses manual export declarations from the active source file.
 *
 * **Example** (Parsing re-export declaration)
 *
 * ```ts
 * import { parseExports, Source, SourceShape } from "@beep/repo-docgen/Parser"
 * import { Effect } from "effect"
 * import { Project } from "ts-morph"
 *
 * const project = new Project({ useInMemoryFileSystem: true })
 * const sourceFile = project.createSourceFile("sample.ts", "/** Public value. *\/\nexport { value } from \"./value.ts\"")
 * const source = SourceShape.new(["sample.ts"], sourceFile)
 * const exports = Effect.runSync(parseExports.pipe(Effect.provide(Source.layer(source))))
 *
 * console.log(exports[0]?.name) // "value"
 * ```
 *
 * @effects Reads the active {@link Source} service; it does not touch the filesystem.
 * @category parsing
 * @since 0.0.0
 */
export const parseExports = Effect.gen(function* () {
  const source = yield* Source;
  const exports = yield* Effect.forEach(source.sourceFile.getExportDeclarations(), parseNamedExports);
  return A.flatten(exports);
});

const parseModuleDeclaration = Effect.fn("parseModuleDeclaration")(function* (
  md: ast.ModuleDeclaration
): Effect.fn.Return<Array<Domain.Namespace>, never, Source> {
  const doc = parseDoc(getJSDocText(md.getJsDocs()));
  if (shouldIgnore(doc)) {
    return [];
  }

  const [interfaces, typeAliases, namespaces, position] = yield* Effect.all(
    [
      parseInterfaceDeclarations(md.getInterfaces()),
      parseTypeAliasDeclarations(md.getTypeAliases()),
      parseModuleDeclarations(md.getModules()),
      parsePosition(md),
    ],
    { concurrency: 4 }
  );

  return A.make(
    Domain.Namespace.new(md.getName(), doc, {
      position,
      interfaces,
      typeAliases,
      namespaces,
    })
  );
});

const parseModuleDeclarations = (namespaces: ReadonlyArray<ast.ModuleDeclaration>) =>
  Effect.forEach(
    A.filter(namespaces, (namespace) => namespace.isExported()),
    parseModuleDeclaration
  ).pipe(Effect.map(A.flatten));

/**
 * Parses exported namespace declarations from the active source file.
 *
 * **Example** (Parsing Helpers namespace)
 *
 * ```ts
 * import { parseNamespaces, Source, SourceShape } from "@beep/repo-docgen/Parser"
 * import { Effect } from "effect"
 * import { Project } from "ts-morph"
 *
 * const project = new Project({ useInMemoryFileSystem: true })
 * const sourceFile = project.createSourceFile("sample.ts", "/** Grouped helpers. *\/\nexport namespace Helpers { export type Id = string }")
 * const source = SourceShape.new(["sample.ts"], sourceFile)
 * const namespaces = Effect.runSync(parseNamespaces.pipe(Effect.provide(Source.layer(source))))
 *
 * console.log(namespaces[0]?.name) // "Helpers"
 * ```
 *
 * @effects Reads the active {@link Source} service; it does not touch the filesystem.
 * @category parsing
 * @since 0.0.0
 */
export const parseNamespaces = Effect.gen(function* () {
  const source = yield* Source;
  return yield* parseModuleDeclarations(source.sourceFile.getModules());
});

const getTypeParameters = (parameters: ReadonlyArray<ast.TypeParameterDeclaration>): string =>
  parameters.length === 0
    ? ""
    : `<${pipe(
        parameters,
        A.map((parameter) => parameter.getName()),
        A.join(", ")
      )}>`;

const parseMethod = Effect.fn("parseMethod")(function* (md: ast.MethodDeclaration) {
  const name = md.getName();
  const jsdocs = A.matchLeft(md.getOverloads(), {
    onEmpty: () => md.getJsDocs(),
    onNonEmpty: (head) => head.getJsDocs(),
  });
  const doc = parseDoc(getJSDocText(jsdocs));
  if (shouldIgnore(doc)) {
    return O.none();
  }

  const position = yield* parsePosition(md);
  return O.some(
    Domain.DocEntry.new(name, doc, {
      signature: `declare const ${name}: ${parseType(md)}`,
      position,
    })
  );
});

const parseProperty = Effect.fn("parseProperty")(function* (pd: ast.PropertyDeclaration) {
  const doc = parseDoc(getJSDocText(pd.getJsDocs()));
  if (shouldIgnore(doc)) {
    return [];
  }

  const readonlyPrefix = pipe(
    O.fromNullishOr(pd.getFirstModifierByKind(ast.ts.SyntaxKind.ReadonlyKeyword)),
    O.match({
      onNone: thunkEmptyStr,
      onSome: () => "readonly ",
    })
  );
  const position = yield* parsePosition(pd);
  return [
    Domain.DocEntry.new(pd.getName(), doc, {
      signature: `${readonlyPrefix}${pd.getName()}: ${parseType(pd)}`,
      position,
    }),
  ];
});

const parseGetAccessor = Effect.fn("parseGetAccessor")(function* (accessor: ast.GetAccessorDeclaration) {
  const doc = parseDoc(getJSDocText(accessor.getJsDocs()));
  if (shouldIgnore(doc)) {
    return [];
  }

  const position = yield* parsePosition(accessor);
  return [
    Domain.DocEntry.new(accessor.getName(), doc, {
      signature: `readonly ${accessor.getName()}: ${parseType(accessor)}`,
      position,
    }),
  ];
});

const parseProperties = (c: ast.ClassDeclaration) =>
  Effect.all(
    [
      Effect.forEach(
        A.filter(
          c.getProperties(),
          (property) =>
            !property.isStatic() &&
            pipe(property.getFirstModifierByKind(ast.ts.SyntaxKind.PrivateKeyword), O.fromNullishOr, O.isNone)
        ),
        parseProperty
      ),
      Effect.forEach(
        A.filter(
          c.getGetAccessors(),
          (accessor) =>
            !accessor.isStatic() &&
            pipe(accessor.getFirstModifierByKind(ast.ts.SyntaxKind.PrivateKeyword), O.fromNullishOr, O.isNone)
        ),
        parseGetAccessor
      ),
    ],
    { concurrency: 2 }
  ).pipe(Effect.map(A.flatten), Effect.map(A.flatten));

/**
 * Computes a printable constructor signature without including the implementation body.
 *
 * **Example** (Logging signature helper)
 *
 * ```ts
 * import { getConstructorDeclarationSignature } from "@beep/repo-docgen/Parser"
 * console.log(getConstructorDeclarationSignature)
 * ```
 *
 * @internal
 * @param constructorDeclaration - Constructor declaration to serialize.
 * @returns Constructor signature text suitable for generated docs.
 * @category parsing
 * @since 0.0.0
 */
export const getConstructorDeclarationSignature = (constructorDeclaration: ast.ConstructorDeclaration): string =>
  pipe(
    O.fromNullishOr(constructorDeclaration.compilerNode.body),
    O.match({
      onNone: () => constructorDeclaration.getText(),
      onSome: (body) => {
        const end = body.getStart() - constructorDeclaration.getStart() - 1;
        return pipe(constructorDeclaration.getText(), Str.substring(0, end));
      },
    })
  );

const getClassDeclarationSignature = (c: ast.ClassDeclaration) => {
  const name = c.getName() ?? "";
  return pipe(
    Effect.succeed(getTypeParameters(c.getTypeParameters())),
    Effect.map((typeParameters) =>
      pipe(
        c.getConstructors(),
        A.matchLeft({
          onEmpty: () => `declare class ${name}${typeParameters}`,
          onNonEmpty: (head) =>
            `declare class ${name}${typeParameters} { ${getConstructorDeclarationSignature(head)} }`,
        })
      )
    )
  );
};

const parseClass = Effect.fn("parseClass")(function* (c: ast.ClassDeclaration) {
  const doc = parseDoc(getJSDocText(c.getJsDocs()));
  if (shouldIgnore(doc)) {
    return [];
  }

  const name = c.getName() ?? "";
  const signature = yield* getClassDeclarationSignature(c);
  const methods = yield* Effect.forEach(c.getInstanceMethods(), parseMethod).pipe(Effect.map(A.getSomes));
  const staticMethods = yield* Effect.forEach(c.getStaticMethods(), parseMethod).pipe(Effect.map(A.getSomes));
  const properties = yield* parseProperties(c);
  const position = yield* parsePosition(c);
  return [
    Domain.Class.new(name, doc, {
      signature,
      position,
      methods,
      staticMethods,
      properties,
    }),
  ];
});

/**
 * Parses exported class declarations from the active source file.
 *
 * **Example** (Parsing UserRepo class)
 *
 * ```ts
 * import { parseClasses, Source, SourceShape } from "@beep/repo-docgen/Parser"
 * import { Effect } from "effect"
 * import { Project } from "ts-morph"
 *
 * const project = new Project({ useInMemoryFileSystem: true })
 * const sourceFile = project.createSourceFile("sample.ts", "/** User repository. *\/\nexport class UserRepo { constructor(readonly name: string) {} }")
 * const source = SourceShape.new(["sample.ts"], sourceFile)
 * const classes = Effect.runSync(parseClasses.pipe(Effect.provide(Source.layer(source))))
 *
 * console.log(classes[0]?.signature.includes("constructor")) // true
 * ```
 *
 * @effects Reads the active {@link Source} service; it does not touch the filesystem.
 * @category parsing
 * @since 0.0.0
 */
export const parseClasses = Source.pipe(
  Effect.map((source) => A.filter(source.sourceFile.getClasses(), (declaration) => declaration.isExported())),
  Effect.flatMap(Effect.forEach(parseClass)),
  Effect.map(A.flatten)
);

/**
 * Parses the file-level module documentation block from the current source file.
 *
 * **Example** (Logging documentation parser)
 *
 * ```ts
 * import { parseModuleDocumentation } from "@beep/repo-docgen/Parser"
 * console.log(parseModuleDocumentation)
 * ```
 *
 * @internal
 * @category parsing
 * @since 0.0.0
 */
export const parseModuleDocumentation = Source.pipe(
  Effect.map((source) => A.head(source.sourceFile.getStatements())),
  Effect.map(O.flatMap((firstStatement) => getDocComment(firstStatement.getLeadingCommentRanges()))),
  Effect.map(
    O.match({
      onNone: () => parseDoc(""),
      onSome: (docComment) => parseDoc(docComment.getText()),
    })
  )
);

/**
 * Parses the active source file into a docgen module model.
 *
 * **Details**
 *
 * Module parsing fans out over the specialized parsers concurrently and then
 * preserves the original path metadata from the active {@link Source} service.
 *
 * **Example** (Parsing module with constant)
 *
 * ```ts
 * import { parseModule, Source, SourceShape } from "@beep/repo-docgen/Parser"
 * import { Effect } from "effect"
 * import { Project } from "ts-morph"
 *
 * const project = new Project({ useInMemoryFileSystem: true })
 * const sourceFile = project.createSourceFile("sample.ts", "/** Module docs. *\/\nexport const answer = 42")
 * const source = SourceShape.new(["sample.ts"], sourceFile)
 * const module = Effect.runSync(parseModule.pipe(Effect.provide(Source.layer(source))))
 *
 * console.log(module.constants[0]?.name) // "answer"
 * ```
 *
 * @effects Reads the active {@link Source} service and runs the declaration parsers concurrently.
 * @category parsing
 * @since 0.0.0
 */
export const parseModule = Effect.gen(function* () {
  const [source, doc, interfaces, functions, typeAliases, classes, constants, exports, namespaces] = yield* Effect.all(
    [
      Source,
      parseModuleDocumentation,
      parseInterfaces,
      parseFunctions,
      parseTypeAliases,
      parseClasses,
      parseConstants,
      parseExports,
      parseNamespaces,
    ],
    { concurrency: 9 }
  );

  const name = source.sourceFile.getBaseName();

  return Domain.Module.new(source, name, {
    doc,
    path: source.path,
    classes,
    interfaces,
    functions,
    typeAliases,
    constants,
    exports,
    namespaces,
  });
});

/**
 * Creates a parser for a single file using a shared ts-morph project instance.
 *
 * **Example** (Logging parseFile factory)
 *
 * ```ts
 * import { parseFile } from "@beep/repo-docgen/Parser"
 * console.log(parseFile)
 * ```
 *
 * @internal
 * @param project - Project used to resolve and parse source files.
 * @returns Function that parses one file into a module model.
 * @category parsing
 * @since 0.0.0
 */
export const parseFile = (project: ast.Project) =>
  Effect.fnUntraced(function* (file: Domain.File): Effect.fn.Return<Domain.Module, Array<string>, Path.Path> {
    const path = yield* Path.Path;
    const sourceFile = project.getSourceFile(file.path);
    const filePath = Str.split(path.sep)(file.path);

    if (sourceFile !== undefined && filePath.length > 0) {
      return yield* withSource(SourceShape.new(filePath, sourceFile), parseModule);
    }

    return yield* Effect.fail([`Unable to locate file: ${file.path}`]);
  });

const createProject = Effect.fn("createProject")(function* (files: ReadonlyArray<Domain.File>) {
  const [config, process] = yield* Effect.all([Configuration.Configuration, Domain.Process], { concurrency: 2 });
  const cwd = yield* process.cwd;
  const baseCompilerOptions = {
    strict: true,
    moduleResolution: "node" as const,
  };
  const parsed = ast.ts.parseJsonConfigFileContent(
    {
      compilerOptions: {
        ...baseCompilerOptions,
        ...config.parseCompilerOptions,
      },
    },
    ast.ts.sys,
    cwd
  );

  const project = new ast.Project({
    compilerOptions: parsed.options,
  });

  for (const file of files) {
    project.addSourceFileAtPath(file.path);
  }

  return project;
});

/**
 * Parses a set of source files into sorted module models.
 *
 * **Example** (Parsing empty file list)
 *
 * ```ts
 * import { parseFiles } from "@beep/repo-docgen/Parser"
 * const parsed = parseFiles([])
 * console.log(parsed)
 * ```
 *
 * @param files - Files to parse into module documentation models.
 * @returns Effect that parses and sorts the provided files into modules.
 * @category parsing
 * @since 0.0.0
 */
export const parseFiles = (files: ReadonlyArray<Domain.File>) =>
  createProject(files).pipe(
    Effect.flatMap((project) => pipe(files, Effect.validate(parseFile(project)), Effect.map(sortModulesByPath)))
  );
