/**
 * The `int-members` and `number-members` codemod rules: rewrite consumers of
 * the retired `@beep/schema` `Int` and `Number` concepts onto upstream
 * `effect/Schema` members.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { A, Str } from "@beep/utils";
import { Match, pipe } from "effect";
import * as O from "effect/Option";
import * as R from "effect/Record";
import { Node, Project, SyntaxKind } from "ts-morph";
import {
  SchemaParityCodemodEdit,
  SchemaParityCodemodImport,
  SchemaParityCodemodResidue,
  SchemaParityCodemodRule,
  SchemaParityCodemodRulePlan,
  SchemaParityCodemodSite,
} from "./SchemaParityCodemod.schemas.ts";
import {
  schemaParityCodemodInsertAt as insertAt,
  renderSchemaParityCodemodEdits,
  schemaParityCodemodReplaceNode as replaceNode,
} from "./SchemaParityCodemodEdits.ts";
import {
  schemaParityCodemodNamedValueBinding as namedValueBinding,
  schemaParityCodemodNamespaceBinding as namespaceBinding,
  resolveSchemaParityCodemodName as resolveAt,
  schemaParityCodemodNameResolvesTo as resolvesTo,
} from "./SchemaParityCodemodImports.ts";
import type {
  CallExpression,
  FileSystemHost,
  Identifier,
  ImportDeclaration,
  ImportSpecifier,
  SourceFile,
} from "ts-morph";
import type { SchemaParityCodemodRuleContext, SchemaParityCodemodRuleId } from "./SchemaParityCodemod.schemas.ts";

type DecodedTypes = {
  readonly Type: string;
  readonly Encoded: string;
};

const numberTypes: DecodedTypes = { Type: "number", Encoded: "number" };

// A member whose every use becomes an upstream expression; `entity` values
// (`S.Natural`) may also stand in `typeof` queries.
type Replacement = {
  readonly _tag: "Replace";
  readonly value: (schema: string) => string;
  readonly entity: boolean;
  readonly types: O.Option<DecodedTypes>;
  readonly statics: ReadonlyArray<string>;
};

// A member that keeps its name as a consumer-local schema: imported from the
// package's `moduleFileName` module when one exists, declared in the file
// otherwise (tests, JSDoc examples, single-consumer packages).
type Relocation = {
  readonly _tag: "Relocate";
  readonly composition: (schema: string) => string;
  readonly moduleFileName: string;
  readonly types: DecodedTypes;
  readonly statics: ReadonlyArray<string>;
};

type Recipe = Replacement | Relocation;

// A re-export the owner module carries for a sibling concept: imports of
// `name` through a specifier whose last segment is `from` (`@beep/schema/Int`,
// `../Int.ts`) move to the same specifier ending in `to`.
type Repoint = {
  readonly from: string;
  readonly name: string;
  readonly to: string;
};

type MemberRuleSpec = {
  readonly id: SchemaParityCodemodRuleId;
  readonly ownerModule: string;
  readonly exampleModules: ReadonlyArray<string>;
  readonly recipes: R.ReadonlyRecord<string, Recipe>;
  readonly repoints: ReadonlyArray<Repoint>;
};

type Action = { readonly _tag: "Rewrite"; readonly recipe: Recipe } | { readonly _tag: "Repoint"; readonly to: string };

type Binding = {
  readonly local: string;
  readonly member: string;
  readonly specifier: ImportSpecifier;
  readonly action: Action;
};

type SchemaAlias = {
  readonly alias: string;
  readonly imports: ReadonlyArray<SchemaParityCodemodImport>;
  readonly edits: ReadonlyArray<SchemaParityCodemodEdit>;
};

type RelocationTarget =
  | { readonly _tag: "Module"; readonly specifier: string }
  | { readonly _tag: "Local" }
  | { readonly _tag: "Ambiguous"; readonly modules: ReadonlyArray<string> };

type Environment = {
  readonly schemaAlias: (site: Node) => O.Option<SchemaAlias>;
  readonly relocation: (recipe: Relocation) => RelocationTarget;
  readonly terminator: string;
};

type Decision =
  | {
      readonly _tag: "Rewrite";
      readonly facet: string;
      readonly siteNode: Node;
      readonly edits: ReadonlyArray<SchemaParityCodemodEdit>;
      readonly imports: ReadonlyArray<SchemaParityCodemodImport>;
    }
  | { readonly _tag: "Residue"; readonly facet: string; readonly siteNode: Node; readonly reason: string };

type Planned = {
  readonly decisions: ReadonlyArray<Decision>;
  readonly edits: ReadonlyArray<SchemaParityCodemodEdit>;
  readonly imports: ReadonlyArray<SchemaParityCodemodImport>;
};

type Position =
  | { readonly _tag: "Type"; readonly node: Node }
  | { readonly _tag: "TypeMember"; readonly node: Node; readonly member: string }
  | { readonly _tag: "Typeof" }
  | { readonly _tag: "Static"; readonly call: CallExpression; readonly name: string }
  | { readonly _tag: "Shorthand"; readonly node: Node }
  | { readonly _tag: "Value" }
  | { readonly _tag: "Unsupported"; readonly reason: string };

const rewrite = (
  facet: string,
  siteNode: Node,
  edits: ReadonlyArray<SchemaParityCodemodEdit>,
  imports: ReadonlyArray<SchemaParityCodemodImport> = A.empty()
): Decision => ({ _tag: "Rewrite", facet, siteNode, edits, imports });

const residue = (facet: string, siteNode: Node, reason: string): Decision => ({
  _tag: "Residue",
  facet,
  siteNode,
  reason,
});

const isResidue = (decision: Decision): boolean => decision._tag === "Residue";

const schemaMember = (
  member: string,
  statics: ReadonlyArray<string> = A.empty(),
  types: DecodedTypes = numberTypes
): Replacement => ({
  _tag: "Replace",
  value: (schema) => `${schema}.${member}`,
  entity: true,
  types: O.some(types),
  statics,
});

const schemaComposition = (value: (schema: string) => string): Replacement => ({
  _tag: "Replace",
  value,
  entity: false,
  types: O.some(numberTypes),
  statics: A.empty(),
});

const checkComposition = (value: (schema: string) => string): Replacement => ({
  _tag: "Replace",
  value,
  entity: false,
  types: O.none(),
  statics: A.empty(),
});

// ---------------------------------------------------------------------------
// Bindings: which import specifiers name a retired member.

const importedMember = (specifier: ImportSpecifier): O.Option<{ readonly name: string; readonly file: string }> =>
  pipe(
    O.fromNullishOr(specifier.getSymbol()),
    O.map((symbol) => (symbol.isAlias() ? (symbol.getAliasedSymbol() ?? symbol) : symbol)),
    O.flatMap((symbol) =>
      O.map(A.head(symbol.getDeclarations()), (declaration) => ({
        name: symbol.getName(),
        file: declaration.getSourceFile().getFilePath(),
      }))
    )
  );

const localName = (specifier: ImportSpecifier): string =>
  pipe(
    O.fromNullishOr(specifier.getAliasNode()),
    O.map((node) => node.getText()),
    O.getOrElse(() => specifier.getName())
  );

const lastSegment = (from: string) => new RegExp(`(^|/)${from}(\\.ts)?$`, "u");

const repointFor = (
  spec: MemberRuleSpec,
  declaration: ImportDeclaration,
  name: string
): O.Option<{ readonly to: string }> =>
  pipe(
    A.findFirst(
      spec.repoints,
      (repoint) => repoint.name === name && lastSegment(repoint.from).test(declaration.getModuleSpecifierValue())
    ),
    O.map((repoint) => ({
      to: Str.replace(lastSegment(repoint.from), `$1${repoint.to}$2`)(declaration.getModuleSpecifierValue()),
    }))
  );

const bindingsWith =
  (spec: MemberRuleSpec, memberOf: (declaration: ImportDeclaration, specifier: ImportSpecifier) => O.Option<string>) =>
  (sourceFile: SourceFile): ReadonlyArray<Binding> =>
    A.flatMap(sourceFile.getImportDeclarations(), (declaration) =>
      A.getSomes(
        A.map(declaration.getNamedImports(), (specifier): O.Option<Binding> => {
          const repoint = repointFor(spec, declaration, specifier.getName());
          if (O.isSome(repoint)) {
            return O.some({
              local: localName(specifier),
              member: specifier.getName(),
              specifier,
              action: { _tag: "Repoint", to: repoint.value.to },
            } satisfies Binding);
          }
          return pipe(
            memberOf(declaration, specifier),
            O.flatMap((member) =>
              O.map(
                R.get(spec.recipes, member),
                (recipe) =>
                  ({
                    local: localName(specifier),
                    member,
                    specifier,
                    action: { _tag: "Rewrite", recipe },
                  }) satisfies Binding
              )
            )
          );
        })
      )
    );

// Type-directed: the specifier's aliased symbol must be declared in the owner
// module, whichever barrel or subpath the file imported it through.
const typedBindings = (spec: MemberRuleSpec): ((sourceFile: SourceFile) => ReadonlyArray<Binding>) =>
  bindingsWith(spec, (_declaration, specifier) =>
    pipe(
      importedMember(specifier),
      O.filter(({ file }) => Str.endsWith(spec.ownerModule)(file)),
      O.map(({ name }) => name)
    )
  );

// JSDoc examples are parsed without module resolution, so the import's module
// specifier stands in for the owner check.
const exampleBindings = (spec: MemberRuleSpec): ((sourceFile: SourceFile) => ReadonlyArray<Binding>) =>
  bindingsWith(spec, (declaration, specifier) =>
    A.contains(spec.exampleModules, declaration.getModuleSpecifierValue()) ? O.some(specifier.getName()) : O.none()
  );

// ---------------------------------------------------------------------------
// References and their syntactic positions.

const isInsideImportOrDoc = (identifier: Identifier): boolean =>
  identifier.getFirstAncestor((node) => Node.isImportDeclaration(node) || Node.isJSDoc(node)) !== undefined;

// A shorthand property's own symbol is the property; its value symbol is the
// binding it reads.
const valueSymbolOf = (identifier: Identifier) => {
  const parent = identifier.getParent();
  return parent !== undefined && Node.isShorthandPropertyAssignment(parent)
    ? identifier.getProject().getTypeChecker().getShorthandAssignmentValueSymbol(parent)
    : identifier.getSymbol();
};

const referencesOf = (identifiers: ReadonlyArray<Identifier>, binding: Binding): ReadonlyArray<Identifier> =>
  A.filter(
    identifiers,
    (identifier) =>
      identifier.getText() === binding.local &&
      pipe(
        O.fromNullishOr(valueSymbolOf(identifier)),
        O.exists((symbol) =>
          A.some(symbol.getDeclarations(), (node) => node.compilerNode === binding.specifier.compilerNode)
        )
      )
  );

const unsupported = (reason: string): Position => ({ _tag: "Unsupported", reason });

const qualifiedPosition = (identifier: Identifier, parent: Node): Position => {
  if (!Node.isQualifiedName(parent) || parent.getLeft() !== identifier) {
    return unsupported("qualified-name");
  }
  const outer = parent.getParent();
  const member = parent.getRight().getText();
  return outer !== undefined && (Node.isTypeQuery(outer) || Node.isTypeReference(outer))
    ? { _tag: "TypeMember", node: outer, member }
    : unsupported("qualified-name");
};

const accessPosition = (parent: Node, statics: ReadonlyArray<string>): Position =>
  pipe(
    O.liftPredicate(parent, Node.isPropertyAccessExpression),
    O.flatMap((access) =>
      pipe(
        O.fromNullishOr(access.getParentIfKind(SyntaxKind.CallExpression)),
        O.filter((call) => call.getExpression() === access && A.contains(statics, access.getName())),
        O.map((call): Position => ({ _tag: "Static", call, name: access.getName() }))
      )
    ),
    O.getOrElse((): Position => ({ _tag: "Value" }))
  );

const typePosition = (identifier: Identifier, parent: Node): O.Option<Position> => {
  if (Node.isTypeReference(parent)) {
    return O.some({ _tag: "Type", node: parent });
  }
  if (Node.isQualifiedName(parent)) {
    return O.some(qualifiedPosition(identifier, parent));
  }
  return Node.isTypeQuery(parent) ? O.some({ _tag: "Typeof" }) : O.none();
};

const valuePosition = (identifier: Identifier, parent: Node, statics: ReadonlyArray<string>): Position => {
  if (Node.isPropertyAccessExpression(parent) && parent.getExpression() === identifier) {
    return accessPosition(parent, statics);
  }
  if (Node.isShorthandPropertyAssignment(parent)) {
    return { _tag: "Shorthand", node: parent };
  }
  return Node.isExportSpecifier(parent) || Node.isExportAssignment(parent)
    ? unsupported("re-exported")
    : { _tag: "Value" };
};

const positionOf = (identifier: Identifier, statics: ReadonlyArray<string>): Position =>
  pipe(
    O.fromNullishOr(identifier.getParent()),
    O.match({
      onNone: () => unsupported("detached-identifier"),
      onSome: (parent) =>
        O.getOrElse(typePosition(identifier, parent), () => valuePosition(identifier, parent, statics)),
    })
  );

const isTypePosition = (position: Position): boolean => position._tag === "Type" || position._tag === "TypeMember";

const callArguments = (call: CallExpression): string =>
  A.join(
    A.map(call.getArguments(), (argument) => argument.getText()),
    ", "
  );

// ---------------------------------------------------------------------------
// Per-reference decisions.

const withSchema = (
  env: Environment,
  facet: string,
  site: Node,
  build: (schema: string) => ReadonlyArray<SchemaParityCodemodEdit>
): Decision =>
  pipe(
    env.schemaAlias(site),
    O.match({
      onNone: () => residue(facet, site, "Schema-binding-conflict"),
      onSome: ({ alias, edits, imports }) => rewrite(facet, site, A.appendAll(build(alias), edits), imports),
    })
  );

const typeDecision = (
  facet: string,
  identifier: Identifier,
  node: Node,
  member: string,
  types: O.Option<DecodedTypes>
): Decision =>
  pipe(
    types,
    O.flatMap((decoded) => (member === "Type" || member === "Encoded" ? O.some(decoded[member]) : O.none())),
    O.match({
      onNone: () => residue(facet, identifier, "no-upstream-type"),
      onSome: (text) => rewrite(facet, node, [replaceNode(node, text)]),
    })
  );

const replaceDecision = (env: Environment, binding: Binding, recipe: Replacement, identifier: Identifier): Decision => {
  const facet = binding.member;
  return Match.valueTags(positionOf(identifier, recipe.statics), {
    Type: ({ node }) => typeDecision(`${facet}.type`, identifier, node, "Type", recipe.types),
    TypeMember: ({ member, node }) => typeDecision(`${facet}.type`, identifier, node, member, recipe.types),
    Typeof: () =>
      recipe.entity
        ? withSchema(env, `${facet}.typeof`, identifier, (schema) => [replaceNode(identifier, recipe.value(schema))])
        : residue(`${facet}.typeof`, identifier, "typeof-composition"),
    Static: ({ call, name }) =>
      withSchema(env, `${facet}.${name}`, call, (schema) => [
        replaceNode(call, `${schema}.${name}(${recipe.value(schema)})(${callArguments(call)})`),
      ]),
    Shorthand: ({ node }) =>
      withSchema(env, `${facet}.value`, node, (schema) => [
        replaceNode(node, `${binding.local}: ${recipe.value(schema)}`),
      ]),
    Value: () =>
      withSchema(env, `${facet}.value`, identifier, (schema) => [replaceNode(identifier, recipe.value(schema))]),
    Unsupported: ({ reason }) => residue(`${facet}.value`, identifier, reason),
  });
};

// A relocated member keeps its name, so only codec statics (which the local
// composition does not carry) and unsupported positions need a decision.
const relocatedDecision = (
  env: Environment,
  binding: Binding,
  recipe: Relocation,
  identifier: Identifier
): O.Option<Decision> =>
  Match.valueTags(positionOf(identifier, recipe.statics), {
    Static: ({ call, name }) =>
      O.some(
        withSchema(env, `${binding.member}.${name}`, call, (schema) => [
          replaceNode(call, `${schema}.${name}(${binding.local})(${callArguments(call)})`),
        ])
      ),
    Unsupported: ({ reason }) => O.some(residue(`${binding.member}.value`, identifier, reason)),
    Type: () => O.none(),
    TypeMember: () => O.none(),
    Typeof: () => O.none(),
    Shorthand: () => O.none(),
    Value: () => O.none(),
  });

// ---------------------------------------------------------------------------
// Binding plans: reference decisions plus what happens to the import.

type ImportFate =
  | { readonly _tag: "Keep" }
  | { readonly _tag: "Drop" }
  | { readonly _tag: "Repoint"; readonly to: string };

type LocalDeclaration = {
  readonly local: string;
  readonly composition: (schema: string) => string;
  readonly withType: boolean;
};

type BindingPlan = {
  readonly binding: Binding;
  readonly decisions: ReadonlyArray<Decision>;
  readonly fate: ImportFate;
  readonly localDeclaration: O.Option<LocalDeclaration>;
};

const bindingPlan = (
  binding: Binding,
  decisions: ReadonlyArray<Decision>,
  fate: ImportFate,
  localDeclaration: O.Option<LocalDeclaration> = O.none()
): BindingPlan => ({ binding, decisions, fate, localDeclaration });

const planReplacement = (
  env: Environment,
  binding: Binding,
  recipe: Replacement,
  references: ReadonlyArray<Identifier>
): BindingPlan => {
  const decisions = A.map(references, (identifier) => replaceDecision(env, binding, recipe, identifier));
  return bindingPlan(binding, decisions, A.some(decisions, isResidue) ? { _tag: "Keep" } : { _tag: "Drop" });
};

const typeOnlyRelocation = (binding: Binding, recipe: Relocation, references: ReadonlyArray<Identifier>): BindingPlan =>
  planReplacement(
    { schemaAlias: () => O.none(), relocation: () => ({ _tag: "Local" }), terminator: "" },
    binding,
    { _tag: "Replace", value: () => binding.local, entity: false, types: O.some(recipe.types), statics: A.empty() },
    references
  );

const relocationSite = (binding: Binding, target: RelocationTarget): Decision =>
  Match.valueTags(target, {
    Module: ({ specifier }) =>
      binding.local === binding.member
        ? rewrite(`${binding.member}.import`, binding.specifier, A.empty(), [
            SchemaParityCodemodImport.cases.NamedImport.make({ moduleSpecifier: specifier, name: binding.member }),
          ])
        : residue(`${binding.member}.import`, binding.specifier, "aliased-import"),
    Local: () => rewrite(`${binding.member}.local`, binding.specifier, A.empty()),
    Ambiguous: () => residue(`${binding.member}.import`, binding.specifier, "ambiguous-local-module"),
  });

const planRelocation = (
  env: Environment,
  binding: Binding,
  recipe: Relocation,
  references: ReadonlyArray<Identifier>
): BindingPlan => {
  const positions = A.map(references, (identifier) => positionOf(identifier, recipe.statics));
  if (A.isReadonlyArrayNonEmpty(positions) && A.every(positions, isTypePosition)) {
    return typeOnlyRelocation(binding, recipe, references);
  }
  const target = env.relocation(recipe);
  const site = relocationSite(binding, target);
  const decisions = A.prepend(
    A.getSomes(A.map(references, (identifier) => relocatedDecision(env, binding, recipe, identifier))),
    site
  );
  if (A.some(decisions, isResidue)) {
    return bindingPlan(binding, decisions, { _tag: "Keep" });
  }
  return bindingPlan(
    binding,
    decisions,
    { _tag: "Drop" },
    O.some({
      local: binding.local,
      composition: recipe.composition,
      withType: A.some(positions, (position) => isTypePosition(position) || position._tag === "Typeof"),
    }).pipe(O.filter(() => target._tag === "Local"))
  );
};

const planBinding =
  (env: Environment, identifiers: ReadonlyArray<Identifier>) =>
  (binding: Binding): BindingPlan => {
    const references = referencesOf(identifiers, binding);
    return Match.valueTags(binding.action, {
      Repoint: ({ to }) =>
        bindingPlan(binding, [rewrite(`${binding.member}.repoint`, binding.specifier, A.empty())], {
          _tag: "Repoint",
          to,
        }),
      Rewrite: ({ recipe }) =>
        recipe._tag === "Replace"
          ? planReplacement(env, binding, recipe, references)
          : planRelocation(env, binding, recipe, references),
    });
  };

// ---------------------------------------------------------------------------
// Import declaration surgery and local declarations.

type DeclarationEdit = {
  readonly declaration: ImportDeclaration;
  readonly start: number;
  readonly end: number;
  readonly text: string;
  readonly removed: boolean;
};

const specifierTexts = (specifiers: ReadonlyArray<ImportSpecifier>): string =>
  A.join(
    A.map(specifiers, (specifier) => specifier.getText()),
    ", "
  );

const declarationEdit = (
  declaration: ImportDeclaration,
  plans: ReadonlyArray<BindingPlan>,
  terminator: string
): { readonly edit: O.Option<DeclarationEdit>; readonly imports: ReadonlyArray<SchemaParityCodemodImport> } => {
  const fateOf = (specifier: ImportSpecifier): ImportFate =>
    pipe(
      A.findFirst(plans, (plan) => plan.binding.specifier.compilerNode === specifier.compilerNode),
      O.map((plan) => plan.fate),
      O.getOrElse((): ImportFate => ({ _tag: "Keep" }))
    );
  const named = declaration.getNamedImports();
  const kept = A.filter(named, (specifier) => fateOf(specifier)._tag === "Keep");
  const repointed = A.getSomes(
    A.map(named, (specifier) => {
      const fate = fateOf(specifier);
      return fate._tag === "Repoint" ? O.some({ specifier, to: fate.to }) : O.none();
    })
  );
  if (kept.length === named.length) {
    return { edit: O.none(), imports: A.empty() };
  }
  const bare = declaration.getDefaultImport() === undefined && declaration.getNamespaceImport() === undefined;
  const targets = A.dedupe(A.map(repointed, ({ to }) => to));
  const start = declaration.getStart();
  const end = declaration.getEnd();
  if (bare && A.isReadonlyArrayEmpty(kept) && targets.length === 1) {
    const keyword = declaration.isTypeOnly() ? "import type" : "import";
    const text = `${keyword} { ${specifierTexts(A.map(repointed, ({ specifier }) => specifier))} } from "${targets[0]}"${terminator}`;
    return { edit: O.some({ declaration, start, end, text, removed: false }), imports: A.empty() };
  }
  const imports = A.map(repointed, ({ specifier, to }) =>
    SchemaParityCodemodImport.cases.NamedImport.make({ moduleSpecifier: to, name: specifier.getName() })
  );
  if (bare && A.isReadonlyArrayEmpty(kept)) {
    return { edit: O.some({ declaration, start, end, text: "", removed: true }), imports };
  }
  return pipe(
    O.fromNullishOr(declaration.getImportClause()?.getNamedBindings()),
    O.match({
      onNone: () => ({ edit: O.none(), imports }),
      onSome: (bindings) => ({
        edit: O.some({
          declaration,
          start: bindings.getStart(),
          end: bindings.getEnd(),
          text: `{ ${specifierTexts(kept)} }`,
          removed: false,
        }),
        imports,
      }),
    })
  );
};

const localDeclarationText = (declaration: LocalDeclaration, schema: string, terminator: string): string =>
  A.join(
    [
      `const ${declaration.local} = ${declaration.composition(schema)}${terminator}`,
      ...(declaration.withType ? [`type ${declaration.local} = typeof ${declaration.local}.Type${terminator}`] : []),
    ],
    "\n"
  );

// A removed declaration also takes its line break, unless it carries the local
// declarations because no import remains to follow.
const declarationToEdit = (
  sourceText: string,
  edit: DeclarationEdit,
  replacement: O.Option<string>
): SchemaParityCodemodEdit =>
  O.match(replacement, {
    onNone: () =>
      SchemaParityCodemodEdit.make({
        start: edit.start,
        end: edit.removed && Str.slice(edit.end, edit.end + 1)(sourceText) === "\n" ? edit.end + 1 : edit.end,
        text: edit.text,
      }),
    onSome: (text) => SchemaParityCodemodEdit.make({ start: edit.start, end: edit.end, text }),
  });

type ImportPlan = {
  readonly edits: ReadonlyArray<SchemaParityCodemodEdit>;
  readonly imports: ReadonlyArray<SchemaParityCodemodImport>;
  readonly decisions: ReadonlyArray<Decision>;
};

// Local declarations follow the last import that survives; when every import
// goes, they replace the last one.
const placeLocals = (
  sourceFile: SourceFile,
  surgeryEdits: ReadonlyArray<DeclarationEdit>,
  localText: O.Option<string>
): ReadonlyArray<SchemaParityCodemodEdit> => {
  const sourceText = sourceFile.getFullText();
  const removed = (declaration: ImportDeclaration): boolean =>
    A.some(surgeryEdits, (edit) => edit.removed && edit.declaration.compilerNode === declaration.compilerNode);
  const survivor = A.findLast(sourceFile.getImportDeclarations(), (declaration) => !removed(declaration));
  const carrier = O.isSome(survivor) ? O.none<DeclarationEdit>() : A.last(surgeryEdits);
  const edits = A.map(surgeryEdits, (edit) =>
    declarationToEdit(
      sourceText,
      edit,
      O.filter(localText, () => O.exists(carrier, (candidate) => candidate === edit))
    )
  );
  const loose = O.flatMap(localText, (text) =>
    O.map(survivor, (declaration) => insertAt(declaration.getEnd(), `\n\n${text}`))
  );
  return A.appendAll(edits, O.toArray(loose));
};

const planImports = (sourceFile: SourceFile, plans: ReadonlyArray<BindingPlan>, env: Environment): ImportPlan => {
  const declarations = sourceFile.getImportDeclarations();
  const surgery = A.map(declarations, (declaration) => declarationEdit(declaration, plans, env.terminator));
  const locals = A.getSomes(A.map(plans, (plan) => plan.localDeclaration));
  const site = A.last(declarations);
  const schema = O.flatMap(site, (node) => env.schemaAlias(node));
  if (A.isReadonlyArrayNonEmpty(locals) && O.isNone(schema)) {
    return {
      edits: A.empty(),
      imports: A.empty(),
      decisions: A.map(locals, (local) =>
        residue(
          `${local.local}.local`,
          O.getOrElse(site, () => sourceFile),
          "Schema-binding-conflict"
        )
      ),
    };
  }
  const localText = pipe(
    O.liftPredicate(locals, A.isReadonlyArrayNonEmpty),
    O.flatMap((nonEmpty) =>
      O.map(schema, ({ alias }) =>
        A.join(
          A.map(nonEmpty, (local) => localDeclarationText(local, alias, env.terminator)),
          "\n"
        )
      )
    )
  );
  return {
    edits: placeLocals(sourceFile, A.getSomes(A.map(surgery, (entry) => entry.edit)), localText),
    imports: A.appendAll(
      A.flatMap(surgery, (entry) => entry.imports),
      A.isReadonlyArrayNonEmpty(locals)
        ? O.getOrElse(
            O.map(schema, (alias) => alias.imports),
            A.empty<SchemaParityCodemodImport>
          )
        : A.empty()
    ),
    decisions: A.empty(),
  };
};

const planSource = (sourceFile: SourceFile, bindings: ReadonlyArray<Binding>, env: Environment): Planned => {
  const locals = A.map(bindings, (binding) => binding.local);
  const identifiers = A.filter(
    sourceFile.getDescendantsOfKind(SyntaxKind.Identifier),
    (identifier) => A.contains(locals, identifier.getText()) && !isInsideImportOrDoc(identifier)
  );
  const plans = A.map(bindings, planBinding(env, identifiers));
  const imports = planImports(sourceFile, plans, env);
  const decisions = A.appendAll(
    A.flatMap(plans, (plan) => plan.decisions),
    imports.decisions
  );
  const localSchemaEdits = A.isReadonlyArrayNonEmpty(A.getSomes(A.map(plans, (plan) => plan.localDeclaration)))
    ? pipe(
        A.last(sourceFile.getImportDeclarations()),
        O.flatMap((anchor) => env.schemaAlias(anchor)),
        O.map((alias) => alias.edits),
        O.getOrElse(A.empty<SchemaParityCodemodEdit>)
      )
    : A.empty<SchemaParityCodemodEdit>();
  return {
    decisions,
    edits: A.appendAll(imports.edits, localSchemaEdits),
    imports: A.appendAll(
      A.flatMap(decisions, (decision) => (decision._tag === "Rewrite" ? decision.imports : A.empty())),
      imports.imports
    ),
  };
};

// ---------------------------------------------------------------------------
// Typed environment: bindings resolved by the program's checker.

const schemaNamespaceImport = (sourceFile: SourceFile) => namespaceBinding(sourceFile, "effect/Schema");

const effectSchemaNamedImport = (sourceFile: SourceFile) => namedValueBinding(sourceFile, "effect", "Schema");

const existingSchemaBinding = (sourceFile: SourceFile) =>
  O.orElse(schemaNamespaceImport(sourceFile), () => effectSchemaNamedImport(sourceFile));

const typedSchemaAlias = (site: Node): O.Option<SchemaAlias> => {
  const existing = existingSchemaBinding(site.getSourceFile());
  if (O.isSome(existing)) {
    return resolvesTo(site, existing.value.local, existing.value.declaration)
      ? O.some({ alias: existing.value.local, imports: A.empty(), edits: A.empty() })
      : O.none();
  }
  return O.isNone(resolveAt(site, "S"))
    ? O.some({
        alias: "S",
        imports: [
          SchemaParityCodemodImport.cases.NamespaceImport.make({ moduleSpecifier: "effect/Schema", alias: "S" }),
        ],
        edits: A.empty(),
      })
    : O.none();
};

const TEST_PATH = /(?:\/(?:test|tests|dtslint|__tests__)\/|\.(?:test|spec)\.tsx?$)/u;

const parentDirectory = (path: string): O.Option<string> =>
  pipe(
    Str.lastIndexOf("/")(path),
    O.filter((index) => index > 0),
    O.map((index) => Str.slice(0, index)(path))
  );

// The nearest directory holding a package or TypeScript project: a workspace
// package, or a scratchpad project with its own tsconfig.
const unitRootOf = (fs: FileSystemHost, directory: string): O.Option<string> =>
  fs.fileExistsSync(`${directory}/package.json`) || fs.fileExistsSync(`${directory}/tsconfig.json`)
    ? O.some(directory)
    : O.flatMap(parentDirectory(directory), (parent) => unitRootOf(fs, parent));

const segments = (path: string): ReadonlyArray<string> => A.filter(Str.split(path, "/"), Str.isNonEmpty);

/**
 * Relative module specifier from a directory to a file, both absolute.
 */
const relativeSpecifier = (fromDirectory: string, toFile: string): string => {
  const from = segments(fromDirectory);
  const to = segments(toFile);
  const shared = pipe(
    A.zip(from, A.dropRight(to, 1)),
    A.takeWhile(([left, right]) => left === right)
  ).length;
  const up = A.map(A.drop(from, shared), () => "..");
  const path = A.join(A.appendAll(up, A.drop(to, shared)), "/");
  return A.isReadonlyArrayEmpty(up) ? `./${path}` : path;
};

const localModules = (fs: FileSystemHost, root: string, fileName: string, self: string): ReadonlyArray<string> =>
  A.filter(
    fs.globSync([`${root}/**/${fileName}`, `!${root}/**/node_modules/**`, `!${root}/**/dist/**`]),
    (path) =>
      path !== self &&
      !TEST_PATH.test(path) &&
      O.exists(
        O.flatMap(parentDirectory(path), (directory) => unitRootOf(fs, directory)),
        (unit) => unit === root
      )
  );

const typedRelocation =
  (sourceFile: SourceFile) =>
  (recipe: Relocation): RelocationTarget => {
    const filePath = sourceFile.getFilePath();
    if (TEST_PATH.test(filePath)) {
      return { _tag: "Local" };
    }
    const fs = sourceFile.getProject().getFileSystem();
    const directory = O.getOrElse(parentDirectory(filePath), () => "/");
    const modules = pipe(
      unitRootOf(fs, directory),
      O.map((root) => localModules(fs, root, recipe.moduleFileName, filePath)),
      O.getOrElse(A.empty<string>)
    );
    return A.match(modules, {
      onEmpty: (): RelocationTarget => ({ _tag: "Local" }),
      onNonEmpty: (found): RelocationTarget =>
        found.length === 1
          ? { _tag: "Module", specifier: relativeSpecifier(directory, A.headNonEmpty(found)) }
          : { _tag: "Ambiguous", modules: found },
    });
  };

// ---------------------------------------------------------------------------
// JSDoc examples: fenced `ts` blocks rewritten through a scratch parse.

type ExampleLine = {
  readonly lineStart: number;
  readonly fileOffset: number;
  readonly codeOffset: number;
};

type ExampleBlock = {
  readonly code: string;
  readonly lines: ReadonlyArray<ExampleLine>;
  readonly prefix: string;
};

const DOC_COMMENT = /\/\*\*[\s\S]*?\*\//gu;
const LINE_PREFIX = /^[ \t]*\*?[ \t]?/u;
const FENCE_OPEN = /^```(?:ts|typescript)\b/u;
const FENCE_CLOSE = /^```\s*$/u;

type CommentLine = {
  readonly offset: number;
  readonly prefix: string;
  readonly content: string;
};

const commentLines = (comment: string, offset: number): ReadonlyArray<CommentLine> =>
  A.reduce(Str.split(comment, "\n"), { cursor: offset, lines: A.empty<CommentLine>() }, (state, line) => {
    const prefix = pipe(
      Str.match(LINE_PREFIX)(line),
      O.map((match) => match[0]),
      O.getOrElse(() => "")
    );
    return {
      cursor: state.cursor + line.length + 1,
      lines: A.append(state.lines, {
        offset: state.cursor + prefix.length,
        prefix,
        content: Str.slice(prefix.length)(line),
      }),
    };
  }).lines;

const blockOf = (lines: ReadonlyArray<CommentLine>): ExampleBlock =>
  A.reduce(
    lines,
    {
      code: "",
      lines: A.empty<ExampleLine>(),
      prefix: pipe(
        A.findFirst(lines, (line) => !Str.isEmpty(line.content)),
        O.map((line) => line.prefix),
        O.getOrElse(() => " * ")
      ),
    },
    (block, line) => ({
      code: A.isReadonlyArrayEmpty(block.lines) ? line.content : `${block.code}\n${line.content}`,
      lines: A.append(block.lines, {
        lineStart: line.offset - line.prefix.length,
        fileOffset: line.offset,
        codeOffset: A.isReadonlyArrayEmpty(block.lines) ? 0 : block.code.length + 1,
      }),
      prefix: block.prefix,
    })
  );

const exampleBlocks = (text: string): ReadonlyArray<ExampleBlock> =>
  A.flatMap(A.fromIterable(Str.matchAll(DOC_COMMENT)(text)), (match) => {
    const lines = commentLines(match[0], match.index ?? 0);
    return A.reduce(
      lines,
      { open: O.none<ReadonlyArray<CommentLine>>(), blocks: A.empty<ExampleBlock>() },
      (state, line) =>
        O.match(state.open, {
          onNone: () => (FENCE_OPEN.test(line.content) ? { ...state, open: O.some(A.empty<CommentLine>()) } : state),
          onSome: (open) =>
            FENCE_CLOSE.test(line.content)
              ? { open: O.none(), blocks: A.append(state.blocks, blockOf(open)) }
              : { ...state, open: O.some(A.append(open, line)) },
        })
    ).blocks;
  });

const toFileOffset = (block: ExampleBlock, codeOffset: number): number =>
  pipe(
    A.findLast(block.lines, (line) => line.codeOffset <= codeOffset),
    O.map((line) => line.fileOffset + (codeOffset - line.codeOffset)),
    O.getOrElse(() => codeOffset)
  );

const prefixedLine = (block: ExampleBlock, line: string): string =>
  Str.isEmpty(line) ? Str.trimEnd(block.prefix) : `${block.prefix}${line}`;

// Inserted lines take the block's comment prefix; an empty line in the middle
// takes it without trailing whitespace, while the last segment continues the
// existing line and keeps it whole.
const reprefix = (block: ExampleBlock, text: string): string => {
  const parts = Str.split(text, "\n");
  return A.join(
    A.map(parts, (line, index) =>
      index === 0 ? line : index < parts.length - 1 ? prefixedLine(block, line) : `${block.prefix}${line}`
    ),
    "\n"
  );
};

const lineStartingAt = (block: ExampleBlock, codeOffset: number): O.Option<ExampleLine> =>
  A.findFirst(block.lines, (line) => line.codeOffset === codeOffset);

// Whole code lines map to whole comment lines, prefixes included: a deletion
// removes them, and an insertion of complete lines lands before the line's
// prefix, so both can meet at the same line start without overlapping.
const wholeLineEdit = (block: ExampleBlock, edit: SchemaParityCodemodEdit): O.Option<SchemaParityCodemodEdit> =>
  pipe(
    lineStartingAt(block, edit.start),
    O.flatMap((first) => {
      if (Str.isEmpty(edit.text)) {
        return O.map(
          O.filter(lineStartingAt(block, edit.end), () => edit.end > edit.start),
          (next) => SchemaParityCodemodEdit.make({ start: first.lineStart, end: next.lineStart, text: "" })
        );
      }
      return edit.end === edit.start && Str.endsWith("\n")(edit.text)
        ? O.some(
            SchemaParityCodemodEdit.make({
              start: first.lineStart,
              end: first.lineStart,
              text: `${A.join(
                A.map(A.dropRight(Str.split(edit.text, "\n"), 1), (line) => prefixedLine(block, line)),
                "\n"
              )}\n`,
            })
          )
        : O.none();
    })
  );

const toFileEdit = (block: ExampleBlock, edit: SchemaParityCodemodEdit): SchemaParityCodemodEdit =>
  O.getOrElse(wholeLineEdit(block, edit), () =>
    SchemaParityCodemodEdit.make({
      start: toFileOffset(block, edit.start),
      end: toFileOffset(block, edit.end),
      text: reprefix(block, edit.text),
    })
  );

const exampleSchemaAlias =
  (sourceFile: SourceFile) =>
  (_site: Node): O.Option<SchemaAlias> =>
    pipe(
      existingSchemaBinding(sourceFile),
      O.map(({ local }): SchemaAlias => ({ alias: local, imports: A.empty(), edits: A.empty() })),
      O.orElse(() =>
        O.some({
          alias: "S",
          imports: A.empty(),
          edits: [
            insertAt(
              pipe(
                A.head(sourceFile.getImportDeclarations()),
                O.map((declaration) => declaration.getStart()),
                O.getOrElse(() => 0)
              ),
              'import * as S from "effect/Schema"\n'
            ),
          ],
        })
      )
    );

const scratchProject = (): Project => new Project({ useInMemoryFileSystem: true, skipAddingFilesFromTsConfig: true });

const dedupeEdits = (edits: ReadonlyArray<SchemaParityCodemodEdit>): ReadonlyArray<SchemaParityCodemodEdit> =>
  A.dedupeWith(
    edits,
    (left, right) => left.start === right.start && left.end === right.end && left.text === right.text
  );

type FilePlan = {
  readonly edits: ReadonlyArray<SchemaParityCodemodEdit>;
  readonly imports: ReadonlyArray<SchemaParityCodemodImport>;
  readonly sites: ReadonlyArray<SchemaParityCodemodSite>;
  readonly residue: ReadonlyArray<SchemaParityCodemodResidue>;
};

const reportDecisions = (
  ruleId: SchemaParityCodemodRuleId,
  filePath: string,
  sourceFile: SourceFile,
  decisions: ReadonlyArray<Decision>,
  locate: (offset: number) => number
): Pick<FilePlan, "sites" | "residue"> => {
  const position = (node: Node) => sourceFile.getLineAndColumnAtPos(locate(node.getStart()));
  return {
    sites: A.getSomes(
      A.map(decisions, (decision) =>
        decision._tag === "Rewrite"
          ? O.some(
              SchemaParityCodemodSite.make({
                ruleId,
                facet: decision.facet,
                filePath,
                line: position(decision.siteNode).line,
                column: position(decision.siteNode).column,
                before: decision.siteNode.getText(),
                after: renderSchemaParityCodemodEdits(
                  decision.siteNode.getSourceFile().getFullText(),
                  decision.siteNode.getStart(),
                  decision.siteNode.getEnd(),
                  decision.edits
                ),
              })
            )
          : O.none()
      )
    ),
    residue: A.getSomes(
      A.map(decisions, (decision) =>
        decision._tag === "Residue"
          ? O.some(
              SchemaParityCodemodResidue.make({
                ruleId,
                facet: decision.facet,
                filePath,
                line: position(decision.siteNode).line,
                column: position(decision.siteNode).column,
                text: decision.siteNode.getText(),
                reason: decision.reason,
              })
            )
          : O.none()
      )
    ),
  };
};

const exampleEnvironment = (codeFile: SourceFile): Environment => ({
  schemaAlias: exampleSchemaAlias(codeFile),
  relocation: () => ({ _tag: "Local" }),
  terminator: "",
});

const mentionsRule = (spec: MemberRuleSpec, code: string): boolean =>
  A.some(
    A.appendAll(
      R.keys(spec.recipes),
      A.map(spec.repoints, (repoint) => repoint.name)
    ),
    (name) => Str.includes(name)(code)
  );

const planExamples = (spec: MemberRuleSpec, sourceFile: SourceFile, filePath: string): FilePlan => {
  const project = scratchProject();
  const plans = A.map(
    A.filter(exampleBlocks(sourceFile.getFullText()), (block) => mentionsRule(spec, block.code)),
    (block, index) => {
      const codeFile = project.createSourceFile(`/example-${index}.ts`, block.code, { overwrite: true });
      const bindings = exampleBindings(spec)(codeFile);
      if (A.isReadonlyArrayEmpty(bindings)) {
        return { edits: A.empty(), imports: A.empty(), sites: A.empty(), residue: A.empty() } satisfies FilePlan;
      }
      const planned = planSource(codeFile, bindings, exampleEnvironment(codeFile));
      const edits = dedupeEdits(
        A.appendAll(
          planned.edits,
          A.flatMap(planned.decisions, (decision) => (decision._tag === "Rewrite" ? decision.edits : A.empty()))
        )
      );
      return {
        edits: A.map(edits, (edit) => toFileEdit(block, edit)),
        imports: A.empty(),
        ...reportDecisions(
          spec.id,
          filePath,
          sourceFile,
          A.map(planned.decisions, (decision) => ({ ...decision, facet: `${decision.facet}.example` })),
          (offset) => toFileOffset(block, offset)
        ),
      } satisfies FilePlan;
    }
  );
  return {
    edits: A.flatMap(plans, (plan) => plan.edits),
    imports: A.empty(),
    sites: A.flatMap(plans, (plan) => plan.sites),
    residue: A.flatMap(plans, (plan) => plan.residue),
  };
};

const planTyped = (spec: MemberRuleSpec, sourceFile: SourceFile, filePath: string): FilePlan => {
  const bindings = typedBindings(spec)(sourceFile);
  if (A.isReadonlyArrayEmpty(bindings)) {
    return { edits: A.empty(), imports: A.empty(), sites: A.empty(), residue: A.empty() };
  }
  const planned = planSource(sourceFile, bindings, {
    schemaAlias: typedSchemaAlias,
    relocation: typedRelocation(sourceFile),
    terminator: ";",
  });
  return {
    edits: dedupeEdits(
      A.appendAll(
        planned.edits,
        A.flatMap(planned.decisions, (decision) => (decision._tag === "Rewrite" ? decision.edits : A.empty()))
      )
    ),
    imports: planned.imports,
    ...reportDecisions(spec.id, filePath, sourceFile, planned.decisions, (offset) => offset),
  };
};

const planMembers =
  (spec: MemberRuleSpec) =>
  (sourceFile: SourceFile, context: SchemaParityCodemodRuleContext): SchemaParityCodemodRulePlan => {
    const typed = planTyped(spec, sourceFile, context.filePath);
    const examples = planExamples(spec, sourceFile, context.filePath);
    return SchemaParityCodemodRulePlan.make({
      edits: A.appendAll(typed.edits, examples.edits),
      imports: typed.imports,
      sites: A.appendAll(typed.sites, examples.sites),
      residue: A.appendAll(typed.residue, examples.residue),
    });
  };

// ---------------------------------------------------------------------------
// Rules.

const INT_SPEC: MemberRuleSpec = {
  id: "int-members",
  ownerModule: "/schema/src/Int.ts",
  exampleModules: ["@beep/schema", "@beep/schema/Int"],
  recipes: {
    Int: schemaMember("Int"),
    PosInt: {
      _tag: "Relocate",
      composition: (schema) => `${schema}.Int.check(${schema}.isGreaterThan(0))`,
      moduleFileName: "PosInt.ts",
      types: numberTypes,
      statics: ["decodeEffect"],
    },
    PostgresSerialInt: schemaComposition(
      (schema) => `${schema}.Int.check(${schema}.isBetween({ minimum: 1, maximum: 2147483647 }))`
    ),
    NegInt: schemaComposition((schema) => `${schema}.Int.check(${schema}.isLessThan(0))`),
    NonPositiveInt: schemaComposition((schema) => `${schema}.Int.check(${schema}.isLessThanOrEqualTo(0))`),
  },
  repoints: [{ from: "Int", name: "NonNegativeInt", to: "Number" }],
};

const NUMBER_SPEC: MemberRuleSpec = {
  id: "number-members",
  ownerModule: "/schema/src/Number.ts",
  exampleModules: ["@beep/schema", "@beep/schema/Number", "@beep/schema/Int"],
  recipes: {
    NonNegativeInt: schemaMember("Natural", ["is", "decodeUnknownOption"]),
    NonNegNum: schemaComposition((schema) => `${schema}.Finite.check(${schema}.isGreaterThanOrEqualTo(0))`),
    isNonNegative: checkComposition((schema) => `${schema}.isGreaterThanOrEqualTo(0)`),
    isPositive: checkComposition((schema) => `${schema}.isGreaterThan(0)`),
    isNegative: checkComposition((schema) => `${schema}.isLessThan(0)`),
    isNonPositive: checkComposition((schema) => `${schema}.isLessThanOrEqualTo(0)`),
    isPostgresSerialInt: checkComposition(
      (schema) =>
        `${schema}.makeFilterGroup([${schema}.isInt(), ${schema}.isBetween({ minimum: 1, maximum: 2147483647 })])`
    ),
    FiniteFromString: schemaMember("FiniteFromString", ["decodeEffect"], { Type: "number", Encoded: "string" }),
  },
  repoints: A.empty(),
};

/**
 * Rule rewriting consumers of the retired `@beep/schema` `Int` concept.
 *
 * **Details**
 *
 * Type-directed: an import counts only when the checker resolves it to a
 * declaration in `schema/src/Int.ts`, whichever barrel it came through.
 * `Int` becomes `S.Int` (`number` in type positions); `PostgresSerialInt`,
 * `NegInt` and `NonPositiveInt` become their `S.Int.check(...)`
 * compositions. `PosInt` keeps its name as a consumer-local
 * `S.Int.check(S.isGreaterThan(0))`: production files import the package's
 * `PosInt.ts` module when one exists, and tests, JSDoc examples and packages
 * without one declare it in the file; type-only uses become `number`.
 * `NonNegativeInt` imported through `@beep/schema/Int` moves to
 * `@beep/schema/Number`. Fenced `ts` JSDoc examples are rewritten from their
 * import specifiers.
 *
 * **Example** (Read the rule id)
 *
 * ```ts
 * import { intMembersRule } from "@beep/repo-cli/test/Lint"
 *
 * console.log(intMembersRule.id) // "int-members"
 * ```
 *
 * @category policies
 * @since 0.0.0
 */
export const intMembersRule = SchemaParityCodemodRule.make({
  id: INT_SPEC.id,
  description:
    "Rewrite retired @beep/schema Int members: Int -> S.Int, sign and serial brands -> S.Int.check(...), PosInt -> consumer-local S.Int.check(S.isGreaterThan(0)), NonNegativeInt via /Int -> /Number.",
  candidatePattern:
    /\b(?:PosInt|PostgresSerialInt|NegInt|NonPositiveInt)\b|"@beep\/schema\/Int"|\{[^}]*\bInt\b[^}]*\}\s*from\s*"@beep\/schema"/u,
  plan: planMembers(INT_SPEC),
});

/**
 * Rule rewriting consumers of the retired `@beep/schema` `Number` concept.
 *
 * **Details**
 *
 * Type-directed like {@link intMembersRule}, against `schema/src/Number.ts`.
 * `NonNegativeInt` becomes `S.Natural` (`number` in type positions; its
 * `is` and `decodeUnknownOption` statics become `S.is(S.Natural)` and
 * `S.decodeUnknownOption(S.Natural)`), `NonNegNum` becomes
 * `S.Finite.check(S.isGreaterThanOrEqualTo(0))`, the sign checks become
 * `S.isGreaterThan(0)` and its siblings, `isPostgresSerialInt` becomes an
 * `S.makeFilterGroup` of `S.isInt()` and `S.isBetween(...)`, and
 * `FiniteFromString` becomes `S.FiniteFromString`.
 *
 * **Example** (Read the rule id)
 *
 * ```ts
 * import { numberMembersRule } from "@beep/repo-cli/test/Lint"
 *
 * console.log(numberMembersRule.id) // "number-members"
 * ```
 *
 * @category policies
 * @since 0.0.0
 */
export const numberMembersRule = SchemaParityCodemodRule.make({
  id: NUMBER_SPEC.id,
  description:
    "Rewrite retired @beep/schema Number members: NonNegativeInt -> S.Natural, NonNegNum -> S.Finite.check(S.isGreaterThanOrEqualTo(0)), sign checks -> S.isGreaterThan(0) family, FiniteFromString -> S.FiniteFromString.",
  candidatePattern:
    /\b(?:NonNegativeInt|NonNegNum|isNonNegative|isPositive|isNegative|isNonPositive|isPostgresSerialInt|FiniteFromString)\b/u,
  plan: planMembers(NUMBER_SPEC),
});
