/**
 * Domain models shared by docgen parsing, checking, and printing.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoDocgenId } from "@beep/identity/packages";
import { PosInt, TaggedErrorClass } from "@beep/schema";
import { A, Str } from "@beep/utils";
import { Context, Effect, Layer, Order, pipe } from "effect";
import { dual } from "effect/Function";
import * as S from "effect/Schema";
import type * as Ordering from "effect/Ordering";
import type * as Parser from "./Parser.ts";

const $I = $RepoDocgenId.create("Domain");

const StringArray = S.Array(S.String);
const OptionalString = S.UndefinedOr(S.String);
const OptionalStringArray = S.UndefinedOr(StringArray);
const DocgenSymbolName = S.NonEmptyString.pipe(
  $I.annoteSchema("DocgenSymbolName", {
    description: "Non-empty source symbol name rendered by docgen.",
  })
);
const DocgenSignatureText = S.NonEmptyString.pipe(
  $I.annoteSchema("DocgenSignatureText", {
    description: "Non-empty TypeScript declaration text rendered by docgen.",
  })
);
const DocgenPathSegments = S.Array(S.NonEmptyString).pipe(
  $I.annoteSchema("DocgenPathSegments", {
    description: "Non-empty path segments identifying a parsed source module.",
  })
);

class DocNewOptions extends S.Class<DocNewOptions>($I`DocNewOptions`)(
  {
    since: StringArray,
    deprecated: StringArray,
    examples: StringArray,
    category: StringArray,
    throws: StringArray,
    sees: StringArray,
    tags: S.Record(S.String, OptionalStringArray),
  },
  $I.annote("DocNewOptions", {
    description: "Constructor options carrying grouped JSDoc tag values for a normalized Doc.",
  })
) {}

/**
 * Represents a one-based source location in a parsed file.
 *
 * @example
 * ```ts
 * import { Position } from "@beep/repo-docgen/Domain"
 * const position = Position.new(1, 1)
 * console.log(position)
 * ```
 * @category models
 * @since 0.0.0
 */
export class Position extends S.Class<Position>($I`Position`)(
  {
    column: PosInt.annotateKey({
      description: "One-based source column number.",
    }),
    line: PosInt.annotateKey({
      description: "One-based source line number.",
    }),
  },
  $I.annote("Position", {
    description: "One-based source location in a parsed file.",
  })
) {
  /**
   * Creates a source position from line and column coordinates.
   *
   * @param line - One-based line number.
   * @param column - One-based column number.
   * @returns Position instance for the provided coordinates.
   */
  static readonly new: {
    (line: number, column: number): Position;
    (column: number): (line: number) => Position;
  } = dual(
    2,
    (line: number, column: number): Position =>
      Position.make({
        column: PosInt.make(column),
        line: PosInt.make(line),
      })
  );
}

/**
 * Represents normalized JSDoc metadata for a documented symbol.
 *
 * @example
 * ```ts
 * import { Doc } from "@beep/repo-docgen/Domain"
 * const doc = Doc.new("Description.", {
 *   since: ["0.0.0"],
 *   deprecated: [],
 *   examples: [],
 *   category: ["models"],
 *   throws: [],
 *   sees: [],
 *   tags: {}
 * })
 * console.log(doc)
 * ```
 * @category models
 * @since 0.0.0
 */
export class Doc extends S.Class<Doc>($I`Doc`)(
  {
    description: OptionalString.annotateKey({
      description: "Trimmed main JSDoc description when present.",
    }),
    since: StringArray.annotateKey({
      description: "Collected @since tag values.",
    }),
    deprecated: StringArray.annotateKey({
      description: "Collected @deprecated tag values.",
    }),
    examples: StringArray.annotateKey({
      description: "Collected @example tag bodies.",
    }),
    category: StringArray.annotateKey({
      description: "Collected @category tag values.",
    }),
    throws: StringArray.annotateKey({
      description: "Collected @throws tag values.",
    }),
    sees: StringArray.annotateKey({
      description: "Collected @see tag values.",
    }),
    tags: S.Record(S.String, OptionalStringArray).annotateKey({
      description: "Raw grouped JSDoc tag values preserved for downstream quality checks.",
    }),
  },
  $I.annote("Doc", {
    description: "Normalized JSDoc metadata for a documented symbol.",
  })
) {
  /**
   * Creates a normalized documentation record.
   *
   * @param description - Main description text when present.
   * @param options - Normalized JSDoc tag values.
   * @returns Doc model with array fields normalized.
   */
  static readonly new: {
    (description: string | undefined, options: DocNewOptions): Doc;
    (options: DocNewOptions): (description: string | undefined) => Doc;
  } = dual(
    2,
    (description: string | undefined, options: DocNewOptions): Doc =>
      Doc.make({
        description,
        since: A.fromIterable(options.since),
        deprecated: A.fromIterable(options.deprecated),
        examples: A.fromIterable(options.examples),
        category: A.fromIterable(options.category),
        throws: A.fromIterable(options.throws),
        sees: A.fromIterable(options.sees),
        tags: options.tags,
      })
  );

  /**
   * Returns a copy of the doc with a different description.
   *
   * @param description - Replacement description text.
   * @returns Doc instance with the updated description.
   */
  modifyDescription(description: string | undefined): Doc {
    return Doc.new(description, {
      since: this.since,
      deprecated: this.deprecated,
      examples: this.examples,
      category: this.category,
      throws: this.throws,
      sees: this.sees,
      tags: this.tags,
    });
  }
}

class SignaturePositionOptions extends S.Class<SignaturePositionOptions>($I`SignaturePositionOptions`)(
  {
    signature: DocgenSignatureText,
    position: Position,
  },
  $I.annote("SignaturePositionOptions", {
    description: "Constructor options carrying declaration text and source position.",
  })
) {}

/**
 * Represents a named documented API member with source and signature metadata.
 *
 * @example
 * ```ts
 * import { Doc, DocEntry, Position } from "@beep/repo-docgen/Domain"
 * const doc = Doc.new("Description.", {
 *   since: ["0.0.0"],
 *   deprecated: [],
 *   examples: [],
 *   category: ["models"],
 *   throws: [],
 *   sees: [],
 *   tags: {}
 * })
 * const entry = DocEntry.new("Example", doc, {
 *   signature: "const Example: string",
 *   position: Position.new(1, 1)
 * })
 * console.log(entry)
 * ```
 * @category models
 * @since 0.0.0
 */
export class DocEntry extends S.Class<DocEntry>($I`DocEntry`)(
  {
    name: DocgenSymbolName.annotateKey({
      description: "Documented API member name.",
    }),
    doc: Doc.annotateKey({
      description: "Parsed documentation for the API member.",
    }),
    signature: DocgenSignatureText.annotateKey({
      description: "Printable TypeScript signature for the API member.",
    }),
    position: Position.annotateKey({
      description: "Source location for the API member.",
    }),
  },
  $I.annote("DocEntry", {
    description: "Named documented API member with source and signature metadata.",
  })
) {
  /**
   * Creates a documented entry for a named API member.
   *
   * @param name - Exported member name.
   * @param doc - Parsed documentation metadata.
   * @param options - Printable signature and source position for the member.
   * @returns Doc entry instance.
   */
  static readonly new: {
    (name: string, doc: Doc, options: SignaturePositionOptions): DocEntry;
    (doc: Doc, options: SignaturePositionOptions): (name: string) => DocEntry;
  } = dual(
    3,
    (name: string, doc: Doc, options: SignaturePositionOptions): DocEntry =>
      DocEntry.make({
        name,
        doc,
        signature: options.signature,
        position: options.position,
      })
  );
}

class ClassNewOptions extends S.Class<ClassNewOptions>($I`ClassNewOptions`)(
  {
    signature: DocgenSignatureText,
    position: Position,
    methods: S.Array(DocEntry),
    staticMethods: S.Array(DocEntry),
    properties: S.Array(DocEntry),
  },
  $I.annote("ClassNewOptions", {
    description: "Constructor options carrying class signature and member entries.",
  })
) {}

/**
 * Represents a documented class and its emitted member structure.
 *
 * @example
 * ```ts
 * import { Class, Doc, Position } from "@beep/repo-docgen/Domain"
 * const doc = Doc.new("Description.", {
 *   since: ["0.0.0"],
 *   deprecated: [],
 *   examples: [],
 *   category: ["models"],
 *   throws: [],
 *   sees: [],
 *   tags: {}
 * })
 * const model = Class.new("Example", doc, {
 *   signature: "class Example",
 *   position: Position.new(1, 1),
 *   methods: [],
 *   staticMethods: [],
 *   properties: []
 * })
 * console.log(model)
 * ```
 * @category models
 * @since 0.0.0
 */
export class Class extends S.TaggedClass<Class>($I`Class`)(
  "Class",
  {
    name: DocgenSymbolName.annotateKey({
      description: "Class name rendered in generated documentation.",
    }),
    doc: Doc.annotateKey({
      description: "Parsed class documentation.",
    }),
    signature: DocgenSignatureText.annotateKey({
      description: "Printable TypeScript class signature.",
    }),
    position: Position.annotateKey({
      description: "Source location for the class declaration.",
    }),
    methods: S.Array(DocEntry).annotateKey({
      description: "Documented instance methods.",
    }),
    staticMethods: S.Array(DocEntry).annotateKey({
      description: "Documented static methods.",
    }),
    properties: S.Array(DocEntry).annotateKey({
      description: "Documented class properties.",
    }),
  },
  $I.annote("Class", {
    description: "Documented class and its emitted member structure.",
  })
) {
  /**
   * Creates a documented class model.
   *
   * @param name - Identifier shown in generated docs for the class.
   * @param doc - Parsed class documentation.
   * @param options - Printable signature, source position, and member entries.
   * @returns Class model instance.
   */
  static readonly new: {
    (name: string, doc: Doc, options: ClassNewOptions): Class;
    (doc: Doc, options: ClassNewOptions): (name: string) => Class;
  } = dual(
    3,
    (name: string, doc: Doc, options: ClassNewOptions): Class =>
      Class.make({
        name,
        doc,
        signature: options.signature,
        position: options.position,
        methods: A.fromIterable(options.methods),
        staticMethods: A.fromIterable(options.staticMethods),
        properties: A.fromIterable(options.properties),
      })
  );
}

/**
 * Represents a documented interface declaration.
 *
 * @example
 * ```ts
 * import { Doc, Interface, Position } from "@beep/repo-docgen/Domain"
 * const doc = Doc.new("Description.", {
 *   since: ["0.0.0"],
 *   deprecated: [],
 *   examples: [],
 *   category: ["models"],
 *   throws: [],
 *   sees: [],
 *   tags: {}
 * })
 * const model = Interface.new("Example", doc, {
 *   signature: "interface Example {}",
 *   position: Position.new(1, 1)
 * })
 * console.log(model)
 * ```
 * @category models
 * @since 0.0.0
 */
export class Interface extends S.TaggedClass<Interface>($I`Interface`)(
  "Interface",
  {
    name: DocgenSymbolName.annotateKey({
      description: "Interface name rendered in generated documentation.",
    }),
    doc: Doc.annotateKey({
      description: "Parsed interface documentation.",
    }),
    signature: DocgenSignatureText.annotateKey({
      description: "Printable TypeScript interface signature.",
    }),
    position: Position.annotateKey({
      description: "Source location for the interface declaration.",
    }),
  },
  $I.annote("Interface", {
    description: "Documented interface declaration.",
  })
) {
  /**
   * Creates a documented interface model.
   *
   * @param name - Identifier shown in generated docs for the interface.
   * @param doc - Parsed interface documentation.
   * @param options - Printable signature and source position for the interface.
   * @returns Interface model instance.
   */
  static readonly new: {
    (name: string, doc: Doc, options: SignaturePositionOptions): Interface;
    (doc: Doc, options: SignaturePositionOptions): (name: string) => Interface;
  } = dual(
    3,
    (name: string, doc: Doc, options: SignaturePositionOptions): Interface =>
      Interface.make({
        name,
        doc,
        signature: options.signature,
        position: options.position,
      })
  );
}

/**
 * Represents a documented function declaration or function-valued export.
 *
 * @example
 * ```ts
 * import { Doc, Function, Position } from "@beep/repo-docgen/Domain"
 * const doc = Doc.new("Description.", {
 *   since: ["0.0.0"],
 *   deprecated: [],
 *   examples: [],
 *   category: ["models"],
 *   throws: [],
 *   sees: [],
 *   tags: {}
 * })
 * const model = Function.new("example", doc, {
 *   signature: "const example: () => void",
 *   position: Position.new(1, 1)
 * })
 * console.log(model)
 * ```
 * @category models
 * @since 0.0.0
 */
export class Function extends S.TaggedClass<Function>($I`Function`)(
  "Function",
  {
    name: DocgenSymbolName.annotateKey({
      description: "Function name rendered in generated documentation.",
    }),
    doc: Doc.annotateKey({
      description: "Parsed function documentation.",
    }),
    signature: DocgenSignatureText.annotateKey({
      description: "Printable TypeScript function signature.",
    }),
    position: Position.annotateKey({
      description: "Source location for the function declaration.",
    }),
  },
  $I.annote("Function", {
    description: "Documented function declaration or function-valued export.",
  })
) {
  /**
   * Creates a documented function model.
   *
   * @param name - Identifier shown in generated docs for the function.
   * @param doc - Parsed function documentation.
   * @param options - Printable signature and source position for the function.
   * @returns Function model instance.
   */
  static readonly new: {
    (name: string, doc: Doc, options: SignaturePositionOptions): Function;
    (doc: Doc, options: SignaturePositionOptions): (name: string) => Function;
  } = dual(
    3,
    (name: string, doc: Doc, options: SignaturePositionOptions): Function =>
      Function.make({
        name,
        doc,
        signature: options.signature,
        position: options.position,
      })
  );
}

/**
 * Represents a documented type alias declaration.
 *
 * @example
 * ```ts
 * import { Doc, Position, TypeAlias } from "@beep/repo-docgen/Domain"
 * const doc = Doc.new("Description.", {
 *   since: ["0.0.0"],
 *   deprecated: [],
 *   examples: [],
 *   category: ["models"],
 *   throws: [],
 *   sees: [],
 *   tags: {}
 * })
 * const model = TypeAlias.new("Example", doc, {
 *   signature: "type Example = string",
 *   position: Position.new(1, 1)
 * })
 * console.log(model)
 * ```
 * @category models
 * @since 0.0.0
 */
export class TypeAlias extends S.TaggedClass<TypeAlias>($I`TypeAlias`)(
  "TypeAlias",
  {
    name: DocgenSymbolName.annotateKey({
      description: "Type alias name rendered in generated documentation.",
    }),
    doc: Doc.annotateKey({
      description: "Parsed type alias documentation.",
    }),
    signature: DocgenSignatureText.annotateKey({
      description: "Printable TypeScript type alias signature.",
    }),
    position: Position.annotateKey({
      description: "Source location for the type alias declaration.",
    }),
  },
  $I.annote("TypeAlias", {
    description: "Documented type alias declaration.",
  })
) {
  /**
   * Creates a documented type alias model.
   *
   * @param name - Identifier shown in generated docs for the type alias.
   * @param doc - Parsed type alias documentation.
   * @param options - Printable signature and source position for the type alias.
   * @returns Type alias model instance.
   */
  static readonly new: {
    (name: string, doc: Doc, options: SignaturePositionOptions): TypeAlias;
    (doc: Doc, options: SignaturePositionOptions): (name: string) => TypeAlias;
  } = dual(
    3,
    (name: string, doc: Doc, options: SignaturePositionOptions): TypeAlias =>
      TypeAlias.make({
        name,
        doc,
        signature: options.signature,
        position: options.position,
      })
  );
}

/**
 * Represents a documented exported constant declaration.
 *
 * @example
 * ```ts
 * import { Constant, Doc, Position } from "@beep/repo-docgen/Domain"
 * const doc = Doc.new("Description.", {
 *   since: ["0.0.0"],
 *   deprecated: [],
 *   examples: [],
 *   category: ["models"],
 *   throws: [],
 *   sees: [],
 *   tags: {}
 * })
 * const model = Constant.new("example", doc, {
 *   signature: "const example: string",
 *   position: Position.new(1, 1)
 * })
 * console.log(model)
 * ```
 * @category models
 * @since 0.0.0
 */
export class Constant extends S.TaggedClass<Constant>($I`Constant`)(
  "Constant",
  {
    name: DocgenSymbolName.annotateKey({
      description: "Constant name rendered in generated documentation.",
    }),
    doc: Doc.annotateKey({
      description: "Parsed constant documentation.",
    }),
    signature: DocgenSignatureText.annotateKey({
      description: "Printable TypeScript constant signature.",
    }),
    position: Position.annotateKey({
      description: "Source location for the constant declaration.",
    }),
  },
  $I.annote("Constant", {
    description: "Documented exported constant declaration.",
  })
) {
  /**
   * Creates a documented constant model.
   *
   * @param name - Identifier shown in generated docs for the constant.
   * @param doc - Parsed constant documentation.
   * @param options - Printable signature and source position for the constant.
   * @returns Constant model instance.
   */
  static readonly new: {
    (name: string, doc: Doc, options: SignaturePositionOptions): Constant;
    (doc: Doc, options: SignaturePositionOptions): (name: string) => Constant;
  } = dual(
    3,
    (name: string, doc: Doc, options: SignaturePositionOptions): Constant =>
      Constant.make({
        name,
        doc,
        signature: options.signature,
        position: options.position,
      })
  );
}

class ExportNewOptions extends S.Class<ExportNewOptions>($I`ExportNewOptions`)(
  {
    signature: DocgenSignatureText,
    position: Position,
    isNamespaceExport: S.Boolean,
  },
  $I.annote("ExportNewOptions", {
    description: "Constructor options carrying export signature, position, and namespace-export marker.",
  })
) {}

/**
 * Represents a named export declaration that is documented separately from its original declaration.
 *
 * @remarks
 * Namespace export declarations are marked with `isNamespaceExport` so the printer can label
 * `export * as Name from "./module.ts"` differently from named export lists.
 * @example
 * ```ts
 * import { Doc, Export, Position } from "@beep/repo-docgen/Domain"
 * const doc = Doc.new("Description.", {
 *   since: ["0.0.0"],
 *   deprecated: [],
 *   examples: [],
 *   category: ["models"],
 *   throws: [],
 *   sees: [],
 *   tags: {}
 * })
 * const model = Export.new("Example", doc, {
 *   signature: "export { Example }",
 *   position: Position.new(1, 1),
 *   isNamespaceExport: false
 * })
 * console.log(model)
 * ```
 * @category models
 * @since 0.0.0
 */
export class Export extends S.TaggedClass<Export>($I`Export`)(
  "Export",
  {
    name: DocgenSymbolName.annotateKey({
      description: "Export name rendered in generated documentation.",
    }),
    doc: Doc.annotateKey({
      description: "Parsed export documentation.",
    }),
    signature: DocgenSignatureText.annotateKey({
      description: "Printable TypeScript export signature.",
    }),
    position: Position.annotateKey({
      description: "Source location for the export declaration.",
    }),
    isNamespaceExport: S.Boolean.annotateKey({
      description: "Whether the export came from a namespace export declaration.",
    }),
  },
  $I.annote("Export", {
    description: "Named export declaration documented separately from its original declaration.",
  })
) {
  /**
   * Creates a documented manual export model.
   *
   * @param name - Exported name.
   * @param doc - Parsed export documentation.
   * @param options - Printable signature, source position, and namespace export flag.
   * @returns Export model instance.
   */
  static readonly new: {
    (name: string, doc: Doc, options: ExportNewOptions): Export;
    (doc: Doc, options: ExportNewOptions): (name: string) => Export;
  } = dual(
    3,
    (name: string, doc: Doc, options: ExportNewOptions): Export =>
      Export.make({
        name,
        doc,
        signature: options.signature,
        position: options.position,
        isNamespaceExport: options.isNamespaceExport,
      })
  );
}

class NamespaceNewOptionsShape extends S.Class<NamespaceNewOptionsShape>($I`NamespaceNewOptions`)(
  {
    position: Position,
    interfaces: S.Array(Interface),
    typeAliases: S.Array(TypeAlias),
    namespaces: S.Array(S.Any),
  },
  $I.annote("NamespaceNewOptions", {
    description: "Constructor options carrying nested namespace members.",
  })
) {}
type NamespaceNewOptions = Omit<NamespaceNewOptionsShape, "namespaces"> & {
  readonly namespaces: ReadonlyArray<Namespace>;
};

/**
 * Represents a documented namespace and its nested exported members.
 *
 * @example
 * ```ts
 * import { Doc, Namespace, Position } from "@beep/repo-docgen/Domain"
 * const doc = Doc.new("Description.", {
 *   since: ["0.0.0"],
 *   deprecated: [],
 *   examples: [],
 *   category: ["models"],
 *   throws: [],
 *   sees: [],
 *   tags: {}
 * })
 * const model = Namespace.new("Example", doc, {
 *   position: Position.new(1, 1),
 *   interfaces: [],
 *   typeAliases: [],
 *   namespaces: []
 * })
 * console.log(model)
 * ```
 * @category models
 * @since 0.0.0
 */
export class Namespace extends S.TaggedClass<Namespace>($I`Namespace`)(
  "Namespace",
  {
    name: DocgenSymbolName.annotateKey({
      description: "Namespace name rendered in generated documentation.",
    }),
    doc: Doc.annotateKey({
      description: "Parsed namespace documentation.",
    }),
    position: Position.annotateKey({
      description: "Source location for the namespace declaration.",
    }),
    interfaces: S.Array(Interface).annotateKey({
      description: "Documented interfaces nested in the namespace.",
    }),
    typeAliases: S.Array(TypeAlias).annotateKey({
      description: "Documented type aliases nested in the namespace.",
    }),
    namespaces: S.Array(S.Any).annotateKey({
      description: "Documented child namespaces.",
    }),
  },
  $I.annote("Namespace", {
    description: "Documented namespace and its nested exported members.",
  })
) {
  declare readonly namespaces: ReadonlyArray<Namespace>;

  /**
   * Creates a documented namespace model.
   *
   * @param name - Identifier shown in generated docs for the namespace.
   * @param doc - Parsed namespace documentation.
   * @param options - Source position and nested namespace member collections.
   * @returns Namespace model instance.
   */
  static readonly new: {
    (name: string, doc: Doc, options: NamespaceNewOptions): Namespace;
    (doc: Doc, options: NamespaceNewOptions): (name: string) => Namespace;
  } = dual(
    3,
    (name: string, doc: Doc, options: NamespaceNewOptions): Namespace =>
      Namespace.make({
        name,
        doc,
        position: options.position,
        interfaces: A.fromIterable(options.interfaces),
        typeAliases: A.fromIterable(options.typeAliases),
        namespaces: A.fromIterable(options.namespaces),
      })
  );
}

class ModuleNewOptions extends S.Class<ModuleNewOptions>($I`ModuleNewOptions`)(
  {
    doc: Doc,
    path: DocgenPathSegments,
    classes: S.Array(Class),
    interfaces: S.Array(Interface),
    functions: S.Array(Function),
    typeAliases: S.Array(TypeAlias),
    constants: S.Array(Constant),
    exports: S.Array(Export),
    namespaces: S.Array(Namespace),
  },
  $I.annote("ModuleNewOptions", {
    description: "Constructor options carrying parsed module documentation and members.",
  })
) {}

/**
 * Represents a fully parsed module ready for validation and printing.
 *
 * @example
 * ```ts
 * import { Project } from "ts-morph"
 * import { Doc, Module } from "@beep/repo-docgen/Domain"
 * import { SourceShape } from "@beep/repo-docgen/Parser"
 *
 * const project = new Project({ useInMemoryFileSystem: true })
 * const sourceFile = project.createSourceFile("src/example.ts", "export const value = 1")
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
 * console.log(module.path)
 * ```
 * @category models
 * @since 0.0.0
 */
export class Module extends S.Class<Module>($I`Module`)(
  {
    source: S.Any,
    name: DocgenSymbolName.annotateKey({
      description: "Module display name rendered in generated documentation.",
    }),
    doc: Doc.annotateKey({
      description: "Parsed module-level documentation.",
    }),
    path: DocgenPathSegments.annotateKey({
      description: "Normalized source path segments for the module.",
    }),
    classes: S.Array(Class).annotateKey({
      description: "Documented classes exported by the module.",
    }),
    interfaces: S.Array(Interface).annotateKey({
      description: "Documented interfaces exported by the module.",
    }),
    functions: S.Array(Function).annotateKey({
      description: "Documented functions exported by the module.",
    }),
    typeAliases: S.Array(TypeAlias).annotateKey({
      description: "Documented type aliases exported by the module.",
    }),
    constants: S.Array(Constant).annotateKey({
      description: "Documented constants exported by the module.",
    }),
    exports: S.Array(Export).annotateKey({
      description: "Documented export declarations emitted by the module.",
    }),
    namespaces: S.Array(Namespace).annotateKey({
      description: "Documented namespaces exported by the module.",
    }),
  },
  $I.annote("Module", {
    description: "Fully parsed module ready for validation and printing.",
  })
) {
  declare readonly source: Parser.SourceShape;

  /**
   * Creates a documented module model.
   *
   * @param source - Parsed source metadata.
   * @param name - Module display name.
   * @param options - Parsed documentation, path segments, and documented module members.
   * @returns Module model instance.
   */
  static readonly new: {
    (source: Parser.SourceShape, name: string, options: ModuleNewOptions): Module;
    (name: string, options: ModuleNewOptions): (source: Parser.SourceShape) => Module;
  } = dual(
    3,
    (source: Parser.SourceShape, name: string, options: ModuleNewOptions): Module =>
      Module.make({
        source,
        name,
        doc: options.doc,
        path: A.fromIterable(options.path),
        classes: A.fromIterable(options.classes),
        interfaces: A.fromIterable(options.interfaces),
        functions: A.fromIterable(options.functions),
        typeAliases: A.fromIterable(options.typeAliases),
        constants: A.fromIterable(options.constants),
        exports: A.fromIterable(options.exports),
        namespaces: A.fromIterable(options.namespaces),
      })
  );
}

class FileNewOptions extends S.Class<FileNewOptions>($I`FileNewOptions`)(
  {
    isOverwritable: S.Boolean.pipe(
      S.withConstructorDefault(Effect.succeed(false)),
      S.withDecodingDefaultKey(Effect.succeed(false))
    ),
  },
  $I.annote("FileNewOptions", {
    description: "Constructor options for output file overwrite behavior.",
  })
) {}
type FileNewOptionsInput = Exclude<(typeof FileNewOptions)["~type.make.in"], void>;

/**
 * Ordering that sorts modules by their normalized lowercase source path.
 *
 * @example
 * ```ts
 * import * as A from "effect/Array"
 * import { Project } from "ts-morph"
 * import { ByPath, Doc, Module } from "@beep/repo-docgen/Domain"
 * import { SourceShape } from "@beep/repo-docgen/Parser"
 *
 * const project = new Project({ useInMemoryFileSystem: true })
 * const sourceFile = project.createSourceFile("src/a.ts", "")
 * const doc = Doc.new("Example module.", {
 *   since: ["0.0.0"],
 *   deprecated: [],
 *   examples: [],
 *   category: ["models"],
 *   throws: [],
 *   sees: [],
 *   tags: {}
 * })
 * const first = Module.new(SourceShape.new(["src", "a.ts"], sourceFile), "a.ts", {
 *   doc,
 *   path: ["src", "a.ts"],
 *   classes: [],
 *   interfaces: [],
 *   functions: [],
 *   typeAliases: [],
 *   constants: [],
 *   exports: [],
 *   namespaces: []
 * })
 * const second = Module.new(SourceShape.new(["src", "b.ts"], sourceFile), "b.ts", {
 *   doc,
 *   path: ["src", "b.ts"],
 *   classes: [],
 *   interfaces: [],
 *   functions: [],
 *   typeAliases: [],
 *   constants: [],
 *   exports: [],
 *   namespaces: []
 * })
 *
 * const sorted = A.sort(ByPath)([second, first])
 * console.log(sorted[0]?.name)
 * console.log(ByPath(second)(first))
 * ```
 * @category utilities
 * @since 0.0.0
 */
export const ByPath: {
  (that: Module): (self: Module) => Ordering.Ordering;
  (self: Module, that: Module): Ordering.Ordering;
} = dual(
  2,
  Order.mapInput(Str.Order, (module: Module) => pipe(module.path, A.join("/"), Str.toLowerCase))
);

/**
 * Represents a file which can be optionally overwritable.
 *
 * @example
 * ```ts
 * import { File } from "@beep/repo-docgen/Domain"
 * const file = File.new("docs/index.md", "# Docs", { isOverwritable: true })
 * console.log(file)
 * ```
 * @category models
 * @since 0.0.0
 */
export class File extends S.Class<File>($I`File`)(
  {
    path: S.String.annotateKey({
      description: "Output file path.",
    }),
    content: S.String.annotateKey({
      description: "Output file content.",
    }),
    isOverwritable: S.Boolean.pipe(S.withConstructorDefault(Effect.succeed(false))).annotateKey({
      description: "Whether an existing output file may be overwritten.",
    }),
  },
  $I.annote("File", {
    description: "Output file descriptor used by docgen write workflows.",
  })
) {
  /**
   * Creates an output file descriptor.
   *
   * @param path - Output file path.
   * @param content - Output file content.
   * @param options - Output file write options.
   * @returns File descriptor instance.
   */
  static readonly new: {
    (path: string, content: string, options: FileNewOptionsInput): File;
    (content: string, options: FileNewOptionsInput): (path: string) => File;
  } = dual(3, (path: string, content: string, options: FileNewOptionsInput): File => {
    const fileOptions = FileNewOptions.make(options);
    return File.make({
      path,
      content,
      isOverwritable: fileOptions.isOverwritable,
    });
  });
}

/**
 * Unique symbol used to brand docgen-specific errors.
 *
 * @example
 * ```ts
 * import { DocgenErrorTypeId } from "@beep/repo-docgen/Domain"
 *
 * console.log(Symbol.keyFor(DocgenErrorTypeId))
 * ```
 * @category symbols
 * @since 0.0.0
 */
export const DocgenErrorTypeId = Symbol.for("@beep/repo-docgen/DocgenError");

/**
 * Type-level alias for the unique docgen error branding symbol.
 *
 * @example
 * ```ts
 * import type { DocgenErrorTypeId } from "@beep/repo-docgen/Domain"
 * type ExampleDocgenErrorTypeId = DocgenErrorTypeId
 * ```
 * @category symbols
 * @since 0.0.0
 */
export type DocgenErrorTypeId = typeof DocgenErrorTypeId;

/**
 * Typed error used throughout docgen parsing and generation operations.
 *
 * @example
 * ```ts
 * import { DocgenError } from "@beep/repo-docgen/Domain"
 * const error = DocgenError.make({ message: "Unable to generate docs." })
 * console.log(error)
 * ```
 * @category models
 * @since 0.0.0
 */
export class DocgenError extends TaggedErrorClass<DocgenError>($I`DocgenError`)(
  "DocgenError",
  {
    message: S.String.annotateKey({
      description: "Human-readable docgen failure message.",
    }),
  },
  $I.annote("DocgenError", {
    description: "Typed error used throughout docgen parsing and generation operations.",
  })
) {}

/**
 * Service shape for the process APIs used by docgen.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 *
 * const fakeProcess = {
 *   argv: Effect.succeed(["bun", "docgen"]),
 *   cwd: Effect.succeed("/workspace/packages/tooling/tool/docgen"),
 *   platform: Effect.succeed("linux")
 * }
 *
 * console.log(fakeProcess.platform)
 * ```
 * @category services
 * @since 0.0.0
 */
type ProcessShape = {
  readonly argv: Effect.Effect<Array<string>>;
  readonly cwd: Effect.Effect<string>;
  readonly platform: Effect.Effect<string>;
};

const defaultProcess: ProcessShape = {
  cwd: Effect.sync(() => process.cwd()),
  platform: Effect.sync(() => process.platform),
  argv: Effect.sync(() => process.argv),
};

/**
 * Service exposing the current process working directory, platform, and argument vector.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { Process } from "@beep/repo-docgen/Domain"
 *
 * const cwd = Effect.runSync(
 *   Effect.gen(function* () {
 *     const process = yield* Process
 *     return yield* process.cwd
 *   }).pipe(Effect.provide(Process.layer))
 * )
 *
 * console.log(cwd.length > 0)
 * ```
 * @category services
 * @since 0.0.0
 */
export class Process extends Context.Service<Process, ProcessShape>()($I`Process`, {
  make: Effect.succeed(defaultProcess),
}) {
  static readonly layer = Layer.succeed(Process, Process.of(defaultProcess));
}
