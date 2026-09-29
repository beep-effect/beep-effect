/**
 * The `unknown-json-retirement` and `opaque-record-retirement` codemod rules:
 * one planner that rewrites consumers of retired `@beep/schema` members onto
 * upstream `effect/Schema` compositions.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import { A, Str } from "@beep/utils";
import { Match, pipe, Result } from "effect";
import * as Num from "effect/Number";
import * as O from "effect/Option";
import * as R from "effect/Record";
import { Node, SyntaxKind } from "ts-morph";
import {
  SchemaParityCodemodEdit,
  SchemaParityCodemodImport,
  SchemaParityCodemodResidue,
  SchemaParityCodemodRule,
  SchemaParityCodemodRulePlan,
  SchemaParityCodemodSite,
} from "./SchemaParityCodemod.schemas.ts";
import { renderSchemaParityCodemodEdits } from "./SchemaParityCodemodEdits.ts";
import {
  resolveSchemaParityCodemodName,
  schemaParityCodemodResolvesTo,
  schemaParityCodemodValueImports,
} from "./SchemaParityCodemodImports.ts";
import type { Identifier, ImportDeclaration, ImportSpecifier, SourceFile } from "ts-morph";
import type { SchemaParityCodemodRuleContext, SchemaParityCodemodRuleId } from "./SchemaParityCodemod.schemas.ts";

const $I = $RepoCliId.create("commands/Lint/internal/SchemaParityCodemodRetirementRules");

/**
 * `@beep/schema` Unknown and Json members retired by P3 group C of
 * `goals/effect-schema-parity`, rewritten by `unknown-json-retirement`.
 *
 * **Details**
 *
 * `UnknownFromJsonString` becomes `S.fromJsonString(S.Unknown)` and its bound
 * codec statics become codecs compiled at module level; `decodeJsonString` and
 * `encodeJsonString` are those statics under another name; `Unknown` becomes
 * `S.Unknown` and `JsonObject` becomes `S.JsonObject`.
 *
 * **Example** (Check a retired member name)
 *
 * ```ts
 * import { UnknownJsonRetiredMember } from "@beep/repo-cli/test/Lint"
 *
 * console.log(UnknownJsonRetiredMember.is.JsonObject("JsonObject")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const UnknownJsonRetiredMember = LiteralKit([
  "UnknownFromJsonString",
  "Unknown",
  "decodeJsonString",
  "encodeJsonString",
  "JsonObject",
]).pipe(
  $I.annoteSchema("UnknownJsonRetiredMember", {
    description: "A retired @beep/schema Unknown or Json member rewritten onto effect/Schema.",
  })
);

/**
 * A retired @beep/schema Unknown or Json member rewritten onto effect/Schema.
 *
 * @category type-level
 * @since 0.0.0
 */
export type UnknownJsonRetiredMember = typeof UnknownJsonRetiredMember.Type;

/**
 * `@beep/schema` Opaque and Record members retired by P3 group C of
 * `goals/effect-schema-parity`, rewritten by `opaque-record-retirement`.
 *
 * **Details**
 *
 * `UnknownRecord` becomes `S.Record(S.String, S.Unknown)`; `Defect(options)`
 * becomes `S.Defect(options)` and `OpaqueUnknown` becomes `S.Unknown`, both
 * piped through `S.overrideToEquivalence(() => () => true)` so the owning
 * field keeps its always-true equivalence.
 *
 * **Example** (Check a retired member name)
 *
 * ```ts
 * import { OpaqueRecordRetiredMember } from "@beep/repo-cli/test/Lint"
 *
 * console.log(OpaqueRecordRetiredMember.is.Defect("Defect")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const OpaqueRecordRetiredMember = LiteralKit(["UnknownRecord", "Defect", "OpaqueUnknown"]).pipe(
  $I.annoteSchema("OpaqueRecordRetiredMember", {
    description: "A retired @beep/schema Opaque or Record member rewritten onto effect/Schema.",
  })
);

/**
 * A retired @beep/schema Opaque or Record member rewritten onto effect/Schema.
 *
 * @category type-level
 * @since 0.0.0
 */
export type OpaqueRecordRetiredMember = typeof OpaqueRecordRetiredMember.Type;

const ALWAYS_EQUIVALENT = "overrideToEquivalence(() => () => true)";

type MemberSpec = {
  readonly owner: string;
  // Upstream expression for a schema-value use, given the file's effect/Schema alias.
  readonly value: (schema: string) => string;
  // Module-level name used when the expression is shared by several sites.
  readonly hoist: O.Option<string>;
  // Inserted into codec runner names (`decodeUnknown<Tag>Option`).
  readonly runnerTag: O.Option<string>;
  readonly typeText: O.Option<(schema: string) => string>;
  // A member that is itself a bound codec: every value use reads this codec.
  readonly runnerAlias: O.Option<string>;
  // A constructor only valid when called (`Defect(options)`).
  readonly calledOnly: boolean;
};

const plainSpec = {
  hoist: O.none<string>(),
  runnerTag: O.none<string>(),
  runnerAlias: O.none<string>(),
  calledOnly: false,
};

const unknownJson = {
  owner: "/schema/src/Unknown.ts",
  value: (schema: string) => `${schema}.fromJsonString(${schema}.Unknown)`,
  hoist: O.some("UnknownJson"),
  runnerTag: O.some("Json"),
  typeText: O.some(() => "unknown"),
  runnerAlias: O.none<string>(),
  calledOnly: false,
};

const unknownJsonSpecs: Readonly<Record<string, MemberSpec>> = {
  UnknownFromJsonString: unknownJson,
  Unknown: {
    ...plainSpec,
    owner: "/schema/src/Unknown.ts",
    value: (schema) => `${schema}.Unknown`,
    typeText: O.some(() => "unknown"),
  },
  decodeJsonString: {
    ...unknownJson,
    owner: "/schema/src/Json.ts",
    typeText: O.none(),
    runnerAlias: O.some("decodeUnknownEffect"),
  },
  encodeJsonString: {
    ...unknownJson,
    owner: "/schema/src/Json.ts",
    typeText: O.none(),
    runnerAlias: O.some("encodeUnknownEffect"),
  },
  JsonObject: {
    ...plainSpec,
    owner: "/schema/src/Json.ts",
    value: (schema) => `${schema}.JsonObject`,
    typeText: O.some((schema) => `${schema}.JsonObject`),
  },
} satisfies { readonly [K in UnknownJsonRetiredMember]: MemberSpec };

const opaqueRecordSpecs: Readonly<Record<string, MemberSpec>> = {
  UnknownRecord: {
    ...plainSpec,
    owner: "/schema/src/Record/Record.schema.ts",
    value: (schema) => `${schema}.Record(${schema}.String, ${schema}.Unknown)`,
    hoist: O.some("UnknownRecord"),
    runnerTag: O.some("Record"),
    typeText: O.some(() => "Readonly<Record<string, unknown>>"),
  },
  Defect: {
    ...plainSpec,
    owner: "/schema/src/Opaque.ts",
    value: (schema) => `${schema}.Defect`,
    typeText: O.none(),
    calledOnly: true,
  },
  OpaqueUnknown: {
    ...plainSpec,
    owner: "/schema/src/Opaque.ts",
    value: (schema) => `${schema}.Unknown.pipe(${schema}.${ALWAYS_EQUIVALENT})`,
    hoist: O.some("OpaqueUnknown"),
    typeText: O.some(() => "unknown"),
  },
} satisfies { readonly [K in OpaqueRecordRetiredMember]: MemberSpec };

type SpecOf = (member: string) => O.Option<MemberSpec>;

const unknownJsonSpecOf: SpecOf = (member) => R.get(unknownJsonSpecs, member);

const opaqueRecordSpecOf: SpecOf = (member) => R.get(opaqueRecordSpecs, member);

const RUNNER_PATTERN = /^(decode|encode)(Unknown)?(Effect|Exit|Option|Promise|Result|Sync)$/u;

// `encodeUnknownSync` with tag `Json` becomes `encodeUnknownJsonSync`.
const runnerName = (codec: string, tag: string): string =>
  pipe(
    Str.match(RUNNER_PATTERN)(codec),
    O.match({
      onNone: () => `${codec}${tag}`,
      onSome: ([, verb = "", unknown = "", kind = ""]) => A.join([verb, unknown, tag, kind], ""),
    })
  );

type Binding = {
  readonly member: string;
  readonly spec: MemberSpec;
  readonly specifier: ImportSpecifier;
  readonly local: string;
};

type Use =
  | { readonly _tag: "Value"; readonly node: Identifier; readonly nested: boolean }
  | { readonly _tag: "Runner"; readonly node: Node; readonly codec: string; readonly nested: boolean }
  | { readonly _tag: "DefectCall"; readonly node: Identifier; readonly call: Node }
  | { readonly _tag: "Type"; readonly node: Node }
  | { readonly _tag: "Residue"; readonly node: Node; readonly reason: string };

const resolveAt = resolveSchemaParityCodemodName;

const declaredOnlyBy =
  (site: Node, name: string) =>
  (nodes: ReadonlyArray<Node>): boolean =>
    O.match(resolveAt(site, name), {
      onNone: () => true,
      onSome: (symbol) =>
        A.every(symbol.declarations ?? A.empty(), (declaration) =>
          A.some(nodes, (node) => node.compilerNode === declaration)
        ),
    });

const resolvesTo = schemaParityCodemodResolvesTo;

const isOwnedBy = (specifier: ImportSpecifier, owner: string): boolean => {
  const symbol = specifier.getNameNode().getSymbol();
  const target = symbol?.isAlias() === true ? symbol.getAliasedSymbol() : symbol;
  return pipe(
    O.fromNullishOr(target),
    O.exists((resolved) =>
      A.some(resolved.getDeclarations(), (declaration) =>
        Str.endsWith(owner)(declaration.getSourceFile().getFilePath())
      )
    )
  );
};

const bindingsOf = (sourceFile: SourceFile, specOf: SpecOf): ReadonlyArray<Binding> =>
  A.flatMap(sourceFile.getImportDeclarations(), (declaration) =>
    A.filterMap(declaration.getNamedImports(), (specifier) => {
      const member = specifier.getName();
      return pipe(
        specOf(member),
        O.filter((spec) => isOwnedBy(specifier, spec.owner)),
        O.match({
          onNone: () => Result.failVoid,
          onSome: (spec) =>
            Result.succeed({ member, spec, specifier, local: specifier.getAliasNode()?.getText() ?? member }),
        })
      );
    })
  );

// ts-morph's `isFunctionLikeDeclaration` misses function expressions (the
// `Effect.fn(function* () {})` bodies), so every function-body kind is listed.
const FUNCTION_BODY_KINDS: ReadonlyArray<SyntaxKind> = [
  SyntaxKind.ArrowFunction,
  SyntaxKind.Constructor,
  SyntaxKind.FunctionDeclaration,
  SyntaxKind.FunctionExpression,
  SyntaxKind.GetAccessor,
  SyntaxKind.MethodDeclaration,
  SyntaxKind.SetAccessor,
];

const isInsideFunction = (node: Node): boolean =>
  node.getFirstAncestor((ancestor) => A.contains(FUNCTION_BODY_KINDS, ancestor.getKind())) !== undefined;

const classifyProperty = (binding: Binding, identifier: Identifier, parent: Node): O.Option<Use> => {
  if (!Node.isPropertyAccessExpression(parent) || parent.getExpression() !== identifier) {
    return O.none();
  }
  const name = parent.getName();
  return O.isSome(binding.spec.runnerTag) && RUNNER_PATTERN.test(name)
    ? O.some({ _tag: "Runner", node: parent, codec: name, nested: isInsideFunction(parent) })
    : O.none();
};

const classifyType = (binding: Binding, identifier: Identifier, parent: Node): O.Option<Use> => {
  if (Node.isTypeReference(parent)) {
    return O.some(
      O.isNone(binding.spec.typeText) || A.isReadonlyArrayNonEmpty(parent.getTypeArguments())
        ? { _tag: "Residue", node: parent, reason: "unsupported-type-reference" }
        : { _tag: "Type", node: parent }
    );
  }
  return Node.isQualifiedName(parent) || Node.isTypeQuery(parent) || Node.isExportSpecifier(parent)
    ? O.some({ _tag: "Residue", node: identifier, reason: `unsupported-${parent.getKindName()}` })
    : O.none();
};

const classifyDefect = (identifier: Identifier, parent: Node): Use =>
  Node.isCallExpression(parent) && parent.getExpression() === identifier
    ? { _tag: "DefectCall", node: identifier, call: parent }
    : { _tag: "Residue", node: identifier, reason: "defect-not-called" };

const classifyValue = (binding: Binding, identifier: Identifier, parent: Node): Use =>
  binding.spec.calledOnly
    ? classifyDefect(identifier, parent)
    : O.match(binding.spec.runnerAlias, {
        onNone: (): Use => ({ _tag: "Value", node: identifier, nested: isInsideFunction(identifier) }),
        onSome: (codec): Use => ({ _tag: "Runner", node: identifier, codec, nested: isInsideFunction(identifier) }),
      });

const classify = (binding: Binding, identifier: Identifier): Use => {
  const parent = identifier.getParentOrThrow();
  return pipe(
    classifyType(binding, identifier, parent),
    O.orElse(() => (O.isSome(binding.spec.runnerAlias) ? O.none() : classifyProperty(binding, identifier, parent))),
    O.getOrElse(() => classifyValue(binding, identifier, parent))
  );
};

const usesOf = (sourceFile: SourceFile, binding: Binding): ReadonlyArray<Use> =>
  pipe(
    sourceFile.getDescendantsOfKind(SyntaxKind.Identifier),
    A.filter(
      (identifier) =>
        identifier.getText() === binding.local &&
        identifier.getFirstAncestorByKind(SyntaxKind.ImportDeclaration) === undefined &&
        resolvesTo(identifier, binding.local, binding.specifier)
    ),
    A.map((identifier) => classify(binding, identifier))
  );

type ModuleReference = {
  readonly reference: string;
  readonly imports: ReadonlyArray<SchemaParityCodemodImport>;
};

type Refs = {
  readonly alias: string;
  readonly imports: ReadonlyArray<SchemaParityCodemodImport>;
  // `flow` and `Result` references for Sync codecs, which compile to
  // `flow(S.<codec>Result(schema), Result.getOrThrow)`.
  readonly flow: O.Option<ModuleReference>;
  readonly result: O.Option<ModuleReference>;
};

const importedFrom = (sourceFile: SourceFile, local: string): O.Option<string> =>
  A.findFirst(sourceFile.getImportDeclarations(), (declaration) =>
    !declaration.isTypeOnly() &&
    (declaration.getNamespaceImport()?.getText() === local ||
      A.some(
        declaration.getNamedImports(),
        (specifier) =>
          !specifier.isTypeOnly() && specifier.getAliasNode() === undefined && specifier.getName() === local
      ))
      ? O.some(declaration.getModuleSpecifierValue())
      : O.none()
  );

// An existing import of `local` from one of `modules`, or a new import when the name is free.
const effectReference = (
  sourceFile: SourceFile,
  local: string,
  modules: ReadonlyArray<string>,
  fallback: SchemaParityCodemodImport
): O.Option<ModuleReference> =>
  O.match(importedFrom(sourceFile, local), {
    onSome: (module) =>
      A.some(modules, (allowed) => allowed === module) ? O.some({ reference: local, imports: A.empty() }) : O.none(),
    onNone: () =>
      O.isNone(resolveAt(sourceFile, local)) ? O.some({ reference: local, imports: [fallback] }) : O.none(),
  });

const namedImport = (moduleSpecifier: string, name: string): SchemaParityCodemodImport =>
  SchemaParityCodemodImport.cases.NamedImport.make({ moduleSpecifier, name });

// The file's effect/Schema binding: a namespace import of `effect/Schema`, a
// named `Schema` import from `effect`, or a new `S` namespace import.
const refsOf = (sourceFile: SourceFile): O.Option<Refs> => {
  const namespace = A.findFirst(schemaParityCodemodValueImports(sourceFile, "effect/Schema"), (declaration) =>
    O.fromNullishOr(declaration.getNamespaceImport()?.getText())
  );
  const named = A.findFirst(schemaParityCodemodValueImports(sourceFile, "effect"), (declaration) =>
    A.findFirst(declaration.getNamedImports(), (specifier) =>
      !specifier.isTypeOnly() && specifier.getName() === "Schema"
        ? O.some(specifier.getAliasNode()?.getText() ?? "Schema")
        : O.none()
    )
  );
  return pipe(
    O.orElse(namespace, () => named),
    O.map((alias) => ({ alias, imports: A.empty<SchemaParityCodemodImport>() })),
    O.orElse(() =>
      O.isNone(resolveAt(sourceFile, "S"))
        ? O.some({
            alias: "S",
            imports: [
              SchemaParityCodemodImport.cases.NamespaceImport.make({ moduleSpecifier: "effect/Schema", alias: "S" }),
            ],
          })
        : O.none()
    ),
    O.map(
      (schema): Refs => ({
        ...schema,
        flow: effectReference(
          sourceFile,
          "flow",
          ["effect", "effect/Function", "@beep/utils"],
          namedImport("effect", "flow")
        ),
        result: effectReference(sourceFile, "Result", ["effect", "effect/Result"], namedImport("effect", "Result")),
      })
    )
  );
};

const isSyncCodec = (codec: string): boolean => Str.endsWith("Sync")(codec);

// Sync codecs throw through `Result.getOrThrow`, the repo's form for a
// synchronous wrapper (effect(schemaSync) rejects `S.*Sync` calls).
const runnerExpression = (codec: string, schema: string, refs: Refs): string =>
  isSyncCodec(codec)
    ? `${O.getOrElse(
        O.map(refs.flow, (flow) => flow.reference),
        () => "flow"
      )}(${refs.alias}.${Str.replace(/Sync$/u, "Result")(codec)}(${schema}), ${O.getOrElse(
        O.map(refs.result, (result) => result.reference),
        () => "Result"
      )}.getOrThrow)`
    : `${refs.alias}.${codec}(${schema})`;

const syncImports = (refs: Refs): ReadonlyArray<SchemaParityCodemodImport> =>
  A.flatMap([...O.toArray(refs.flow), ...O.toArray(refs.result)], (reference) => reference.imports);

type BindingPlan = {
  readonly binding: Binding;
  readonly uses: ReadonlyArray<Use>;
  readonly hoisted: O.Option<string>;
  readonly runners: ReadonlyArray<string>;
};

const valueUses = (uses: ReadonlyArray<Use>) =>
  A.filter(uses, (use): use is Extract<Use, { readonly _tag: "Value" }> => use._tag === "Value");

// Only reads inside function bodies need a hoisted runner; a module-level read
// compiles in place, where the per-AST parser cache already shares it.
const runnerCodecs = (uses: ReadonlyArray<Use>): ReadonlyArray<string> =>
  A.dedupe(
    A.filterMap(uses, (use) => (use._tag === "Runner" && use.nested ? Result.succeed(use.codec) : Result.failVoid))
  );

const inPlaceRunners = (uses: ReadonlyArray<Use>): number =>
  A.filter(uses, (use) => use._tag === "Runner" && !use.nested).length;

const withSyncBindings =
  (refs: Refs) =>
  (use: Use): Use =>
    use._tag === "Runner" && isSyncCodec(use.codec) && (O.isNone(refs.flow) || O.isNone(refs.result))
      ? { _tag: "Residue", node: use.node, reason: "sync-codec-flow-or-Result-binding-unavailable" }
      : use;

// How many module-level expressions a binding needs its schema in; a value
// read inside a function body always shares the hoisted const.
const schemaDemand = (uses: ReadonlyArray<Use>): number =>
  A.some(valueUses(uses), (use) => use.nested)
    ? 2
    : valueUses(uses).length + inPlaceRunners(uses) + runnerCodecs(uses).length;

const draftBinding = (sourceFile: SourceFile, refs: Refs, binding: Binding): BindingPlan => {
  const uses = A.map(usesOf(sourceFile, binding), withSyncBindings(refs));
  return { binding, uses, hoisted: O.none(), runners: runnerCodecs(uses) };
};

// Members sharing a hoist name (`UnknownFromJsonString`, `decodeJsonString`,
// `encodeJsonString`) share one module-level const once the file needs the
// composition more than once.
const planBindings = (sourceFile: SourceFile, refs: Refs, bindings: ReadonlyArray<Binding>) => {
  const drafts = A.map(bindings, (binding) => draftBinding(sourceFile, refs, binding));
  const demandFor = (name: string): number =>
    A.reduce(
      A.filter(drafts, (draft) => O.exists(draft.binding.spec.hoist, (hoist) => hoist === name)),
      0,
      (total, draft) => total + schemaDemand(draft.uses)
    );
  return A.map(
    drafts,
    (draft): BindingPlan => ({ ...draft, hoisted: O.filter(draft.binding.spec.hoist, (name) => demandFor(name) > 1) })
  );
};

type FilePlan = {
  readonly edits: ReadonlyArray<SchemaParityCodemodEdit>;
  readonly imports: ReadonlyArray<SchemaParityCodemodImport>;
  readonly sites: ReadonlyArray<{ readonly facet: string; readonly node: Node }>;
  readonly residue: ReadonlyArray<{ readonly facet: string; readonly node: Node; readonly reason: string }>;
};

const replaceNode = (node: Node, text: string): SchemaParityCodemodEdit =>
  SchemaParityCodemodEdit.make({ start: node.getStart(), end: node.getEnd(), text });

// `{ decodeJsonString }` keeps its property name: `{ decodeJsonString: <replacement> }`.
const replaceUse = (node: Node, text: string): SchemaParityCodemodEdit =>
  replaceNode(node, Node.isShorthandPropertyAssignment(node.getParent()) ? `${node.getText()}: ${text}` : text);

const insertAt = (offset: number, text: string): SchemaParityCodemodEdit =>
  SchemaParityCodemodEdit.make({ start: offset, end: offset, text });

const schemaReference = (plan: BindingPlan, alias: string): string =>
  O.getOrElse(plan.hoisted, () => plan.binding.spec.value(alias));

// `Defect(options).pipe(f)` keeps one pipe: the override becomes its first stage.
const defectCallEdits = (use: Extract<Use, { readonly _tag: "DefectCall" }>, alias: string) => {
  const override = `${alias}.${ALWAYS_EQUIVALENT}`;
  const piped = pipe(
    O.fromNullishOr(use.call.getParentIfKind(SyntaxKind.PropertyAccessExpression)),
    O.filter((access) => access.getName() === "pipe"),
    O.flatMap((access) => O.fromNullishOr(access.getParentIfKind(SyntaxKind.CallExpression))),
    O.flatMap((call) => A.head(call.getArguments()))
  );
  return [
    replaceNode(use.node, `${alias}.Defect`),
    O.match(piped, {
      onNone: () => insertAt(use.call.getEnd(), `.pipe(${override})`),
      onSome: (first) => insertAt(first.getStart(), `${override}, `),
    }),
  ];
};

const useEdits = (plan: BindingPlan, refs: Refs, use: Use): ReadonlyArray<SchemaParityCodemodEdit> =>
  Match.valueTags(use, {
    Value: ({ node }) => [replaceUse(node, schemaReference(plan, refs.alias))],
    Runner: ({ codec, nested, node }) => [
      replaceUse(
        node,
        nested
          ? runnerName(
              codec,
              O.getOrElse(plan.binding.spec.runnerTag, () => "")
            )
          : runnerExpression(codec, schemaReference(plan, refs.alias), refs)
      ),
    ],
    DefectCall: (defect) => defectCallEdits(defect, refs.alias),
    Type: ({ node }) => [
      replaceNode(
        node,
        pipe(
          plan.binding.spec.typeText,
          O.map((typeText) => typeText(refs.alias)),
          O.getOrElse(() => "unknown")
        )
      ),
    ],
    Residue: () => A.empty<SchemaParityCodemodEdit>(),
  });

const useFacet = (plan: BindingPlan, use: Use): string =>
  use._tag === "Runner" && O.isNone(plan.binding.spec.runnerAlias)
    ? `${plan.binding.member}.${use.codec}`
    : use._tag === "Type"
      ? `${plan.binding.member}:type`
      : plan.binding.member;

const hoistedDeclarations = (plan: BindingPlan, refs: Refs): ReadonlyArray<string> => {
  const tag = O.getOrElse(plan.binding.spec.runnerTag, () => "");
  const schema = schemaReference(plan, refs.alias);
  return [
    ...O.match(plan.hoisted, {
      onNone: () => A.empty<string>(),
      onSome: (name) => [`const ${name} = ${plan.binding.spec.value(refs.alias)};`],
    }),
    ...A.map(plan.runners, (codec) => `const ${runnerName(codec, tag)} = ${runnerExpression(codec, schema, refs)};`),
  ];
};

const declaredNames = (plan: BindingPlan): ReadonlyArray<string> => [
  ...O.toArray(plan.hoisted),
  ...A.map(plan.runners, (codec) =>
    runnerName(
      codec,
      O.getOrElse(plan.binding.spec.runnerTag, () => "")
    )
  ),
];

// Import specifiers the rewrite deletes: those of bindings whose every use rewrites.
const removalEdits = (
  declaration: ImportDeclaration,
  removed: ReadonlyArray<ImportSpecifier>
): ReadonlyArray<SchemaParityCodemodEdit> => {
  const specifiers = declaration.getNamedImports();
  const isRemoved = (specifier: ImportSpecifier) => A.some(removed, (entry) => entry === specifier);
  if (
    A.every(specifiers, isRemoved) &&
    declaration.getDefaultImport() === undefined &&
    declaration.getNamespaceImport() === undefined
  ) {
    const text = declaration.getSourceFile().getFullText();
    const trailing = Str.slice(declaration.getEnd(), declaration.getEnd() + 1)(text);
    const end = declaration.getEnd() + (trailing === "\n" ? 1 : 0);
    return [SchemaParityCodemodEdit.make({ start: declaration.getStart(), end, text: "" })];
  }
  return A.filterMap(specifiers, (specifier, index) => {
    if (!isRemoved(specifier)) {
      return Result.failVoid;
    }
    const next = A.get(specifiers, index + 1);
    const previous = A.get(specifiers, index - 1);
    return Result.succeed(
      O.isSome(next) && !isRemoved(next.value)
        ? SchemaParityCodemodEdit.make({ start: specifier.getStart(), end: next.value.getStart(), text: "" })
        : SchemaParityCodemodEdit.make({
            start: O.isSome(previous) ? previous.value.getEnd() : specifier.getStart(),
            end: specifier.getEnd(),
            text: "",
          })
    );
  });
};

// Runs of removed specifiers collapse into one range each so their edits never overlap.
const mergeAdjacent = (edits: ReadonlyArray<SchemaParityCodemodEdit>): ReadonlyArray<SchemaParityCodemodEdit> =>
  A.reduce(
    A.sort(edits, (left: SchemaParityCodemodEdit, right: SchemaParityCodemodEdit) =>
      left.start < right.start ? -1 : left.start > right.start ? 1 : 0
    ),
    A.empty<SchemaParityCodemodEdit>(),
    (merged, edit) =>
      pipe(
        A.last(merged),
        O.filter((last) => edit.start <= last.end),
        O.match({
          onNone: () => A.append(merged, edit),
          onSome: (last) =>
            A.append(
              A.dropRight(merged, 1),
              SchemaParityCodemodEdit.make({ start: last.start, end: Num.max(last.end, edit.end), text: "" })
            ),
        })
      )
  );

// Directives (`"use client"`), imports and re-exports carry no module code.
const isPreamble = (statement: Node): boolean =>
  Node.isImportDeclaration(statement) ||
  (Node.isExportDeclaration(statement) && statement.hasModuleSpecifier()) ||
  (Node.isExpressionStatement(statement) && Node.isStringLiteral(statement.getExpression()));

// Hoisted consts go before the first module statement: a statement between two
// imports may already read them, and imports are hoisted so the consts may
// precede later import declarations.
const hoistAnchor = (
  sourceFile: SourceFile,
  declarations: ReadonlyArray<ImportDeclaration>
): O.Option<ImportDeclaration> =>
  O.match(
    A.findFirst(sourceFile.getStatements(), (statement) => !isPreamble(statement)),
    {
      onNone: () => A.last(declarations),
      onSome: (code) => A.findLast(declarations, (declaration) => declaration.getEnd() <= code.getStart()),
    }
  );

const importEdits = (
  sourceFile: SourceFile,
  removed: ReadonlyArray<ImportSpecifier>,
  hoisted: ReadonlyArray<string>
): ReadonlyArray<SchemaParityCodemodEdit> => {
  const declarations = sourceFile.getImportDeclarations();
  const removals = A.flatMap(declarations, (declaration) =>
    mergeAdjacent(
      removalEdits(
        declaration,
        A.filter(removed, (specifier) => specifier.getImportDeclaration() === declaration)
      )
    )
  );
  if (A.isReadonlyArrayEmpty(hoisted)) {
    return removals;
  }
  const block = A.join(hoisted, "\n");
  return O.match(hoistAnchor(sourceFile, declarations), {
    onNone: () => removals,
    onSome: (last) => {
      const lastRemoval = A.findFirst(removals, (edit) => edit.start === last.getStart() && edit.end >= last.getEnd());
      return O.match(lastRemoval, {
        onNone: () => A.append(removals, insertAt(last.getEnd(), `\n\n${block}`)),
        onSome: (edit) =>
          A.append(
            A.filter(removals, (other) => other !== edit),
            SchemaParityCodemodEdit.make({ start: edit.start, end: edit.end, text: `\n${block}\n` })
          ),
      });
    },
  });
};

type Conflict = { readonly name: string; readonly node: Node };

const nameConflicts = (sourceFile: SourceFile, plans: ReadonlyArray<BindingPlan>): ReadonlyArray<Conflict> => {
  const specifiers = A.map(plans, (plan) => plan.binding.specifier);
  const sites = A.flatMap(plans, (plan) =>
    A.map(plan.uses, (use) => ({ plan, node: use.node, names: declaredNames(plan) }))
  );
  return A.dedupeWith(
    A.flatMap(sites, ({ names, node }) =>
      A.filterMap(names, (name) =>
        declaredOnlyBy(sourceFile, name)(specifiers) && declaredOnlyBy(node, name)(specifiers)
          ? Result.failVoid
          : Result.succeed({ name, node })
      )
    ),
    (left, right) => left.name === right.name
  );
};

const rewriteImports = (refs: Refs, uses: ReadonlyArray<Use>): ReadonlyArray<SchemaParityCodemodImport> =>
  A.isReadonlyArrayEmpty(uses)
    ? A.empty()
    : A.appendAll(
        refs.imports,
        A.some(uses, (use) => use._tag === "Runner" && isSyncCodec(use.codec)) ? syncImports(refs) : A.empty()
      );

const hasRewrites = (plan: BindingPlan): boolean => A.some(plan.uses, (use) => use._tag !== "Residue");

// Declarations for every binding with a rewrite, even one whose import stays
// behind residue: its rewritten sites still read the hoisted names.
const hoistedBlock = (plans: ReadonlyArray<BindingPlan>, refs: Refs): ReadonlyArray<string> =>
  A.dedupe(A.flatMap(A.filter(plans, hasRewrites), (plan: BindingPlan) => hoistedDeclarations(plan, refs)));

const planFile = (sourceFile: SourceFile, refs: Refs, bindings: ReadonlyArray<Binding>): FilePlan => {
  const plans = planBindings(sourceFile, refs, bindings);
  const conflicts = nameConflicts(sourceFile, plans);
  if (A.isReadonlyArrayNonEmpty(conflicts)) {
    return {
      edits: A.empty(),
      imports: A.empty(),
      sites: A.empty(),
      residue: A.map(conflicts, ({ name, node }) => ({ facet: "hoist", node, reason: `name-conflict:${name}` })),
    };
  }
  const complete = A.filter(plans, (plan) => A.every(plan.uses, (use) => use._tag !== "Residue"));
  const rewrites = A.flatMap(plans, (plan) =>
    A.filterMap(plan.uses, (use) => (use._tag === "Residue" ? Result.failVoid : Result.succeed({ plan, use })))
  );
  return {
    edits: [
      ...A.flatMap(rewrites, ({ plan, use }) => useEdits(plan, refs, use)),
      ...importEdits(
        sourceFile,
        A.map(complete, (plan) => plan.binding.specifier),
        hoistedBlock(plans, refs)
      ),
    ],
    imports: rewriteImports(
      refs,
      A.map(rewrites, ({ use }) => use)
    ),
    sites: A.map(rewrites, ({ plan, use }) => ({ facet: useFacet(plan, use), node: use.node })),
    residue: A.flatMap(plans, (plan) =>
      A.filterMap(plan.uses, (use) =>
        use._tag === "Residue"
          ? Result.succeed({ facet: plan.binding.member, node: use.node, reason: use.reason })
          : Result.failVoid
      )
    ),
  };
};

const noAliasPlan = (bindings: ReadonlyArray<Binding>): FilePlan => ({
  edits: A.empty(),
  imports: A.empty(),
  sites: A.empty(),
  residue: A.map(bindings, (binding) => ({
    facet: binding.member,
    node: binding.specifier,
    reason: "schema-alias-unavailable",
  })),
});

const toRulePlan = (
  ruleId: SchemaParityCodemodRuleId,
  sourceFile: SourceFile,
  context: SchemaParityCodemodRuleContext,
  plan: FilePlan
): SchemaParityCodemodRulePlan => {
  const text = sourceFile.getFullText();
  const location = (node: Node) => sourceFile.getLineAndColumnAtPos(node.getStart());
  return SchemaParityCodemodRulePlan.make({
    edits: plan.edits,
    imports: plan.imports,
    sites: A.map(plan.sites, ({ facet, node }) =>
      SchemaParityCodemodSite.make({
        ruleId,
        facet,
        filePath: context.filePath,
        line: location(node).line,
        column: location(node).column,
        before: node.getText(),
        after: renderSchemaParityCodemodEdits(
          text,
          node.getStart(),
          node.getEnd(),
          A.filter(plan.edits, (edit) => edit.start >= node.getStart() && edit.end <= node.getEnd())
        ),
      })
    ),
    residue: A.map(plan.residue, ({ facet, node, reason }) =>
      SchemaParityCodemodResidue.make({
        ruleId,
        facet,
        filePath: context.filePath,
        line: location(node).line,
        column: location(node).column,
        text: node.getText(),
        reason,
      })
    ),
  });
};

const retirementPlanner =
  (ruleId: SchemaParityCodemodRuleId, specOf: SpecOf) =>
  (sourceFile: SourceFile, context: SchemaParityCodemodRuleContext): SchemaParityCodemodRulePlan => {
    const bindings = bindingsOf(sourceFile, specOf);
    if (A.isReadonlyArrayEmpty(bindings)) {
      return SchemaParityCodemodRulePlan.make({});
    }
    return toRulePlan(
      ruleId,
      sourceFile,
      context,
      O.match(refsOf(sourceFile), {
        onNone: () => noAliasPlan(bindings),
        onSome: (refs) => planFile(sourceFile, refs, bindings),
      })
    );
  };

const candidatePattern = (members: ReadonlyArray<string>): RegExp =>
  new RegExp(`\\b(?:${A.join(members, "|")})\\b`, "u");

/**
 * Rule rewriting consumers of the retired `@beep/schema` Unknown and Json
 * members ({@link UnknownJsonRetiredMember}).
 *
 * **Details**
 *
 * Type-directed: only import specifiers the checker resolves to `Unknown.ts`
 * or `Json.ts` are rewritten. A schema-value use becomes the upstream
 * composition inline, or a module-level `UnknownJson` const when the file uses
 * it more than once or inside a function body. A codec read at module level
 * (a bound static such as `UnknownFromJsonString.decodeUnknownEffect`, or
 * `decodeJsonString`) compiles in place as
 * `S.decodeUnknownEffect(S.fromJsonString(S.Unknown))`; a read inside a
 * function body becomes a module-level runner (`decodeUnknownJsonEffect`),
 * which keeps compiled codecs out of function bodies. Sync codecs compile to
 * `flow(S.<codec>Result(schema), Result.getOrThrow)`. The import specifier is
 * removed once every use rewrites; re-exports, `typeof` queries and name
 * conflicts are residue.
 *
 * **Gotchas**
 *
 * Run it and {@link opaqueRecordRetirementRule} in separate passes: both
 * delete specifiers from a shared import declaration, and the engine
 * quarantines a file whose edits overlap.
 *
 * **Example** (Read the rule id)
 *
 * ```ts
 * import { unknownJsonRetirementRule } from "@beep/repo-cli/test/Lint"
 *
 * console.log(unknownJsonRetirementRule.id) // "unknown-json-retirement"
 * ```
 *
 * @category policies
 * @since 0.0.0
 */
export const unknownJsonRetirementRule = SchemaParityCodemodRule.make({
  id: "unknown-json-retirement",
  description:
    "Rewrite retired @beep/schema Unknown and Json members: UnknownFromJsonString, decodeJsonString and encodeJsonString -> S.fromJsonString(S.Unknown) codecs compiled at module level, Unknown -> S.Unknown, JsonObject -> S.JsonObject.",
  candidatePattern: candidatePattern(UnknownJsonRetiredMember.literals),
  plan: retirementPlanner("unknown-json-retirement", unknownJsonSpecOf),
});

/**
 * Rule rewriting consumers of the retired `@beep/schema` Opaque and Record
 * members ({@link OpaqueRecordRetiredMember}).
 *
 * **Details**
 *
 * Shares the planner of {@link unknownJsonRetirementRule}. `Defect(options)`
 * becomes `S.Defect(options).pipe(S.overrideToEquivalence(() => () => true))`
 * at the owning field (an existing `.pipe(...)` takes the override as its
 * first stage); `OpaqueUnknown` becomes the same override over `S.Unknown`;
 * `UnknownRecord` becomes `S.Record(S.String, S.Unknown)`, a module-level
 * `UnknownRecord` const when shared, and `Readonly<Record<string, unknown>>`
 * in type positions. An uncalled `Defect` reference is residue.
 *
 * **Example** (Read the rule id)
 *
 * ```ts
 * import { opaqueRecordRetirementRule } from "@beep/repo-cli/test/Lint"
 *
 * console.log(opaqueRecordRetirementRule.id) // "opaque-record-retirement"
 * ```
 *
 * @category policies
 * @since 0.0.0
 */
export const opaqueRecordRetirementRule = SchemaParityCodemodRule.make({
  id: "opaque-record-retirement",
  description:
    "Rewrite retired @beep/schema Opaque and Record members: UnknownRecord -> S.Record(S.String, S.Unknown), Defect(o) and OpaqueUnknown -> S.Defect(o) and S.Unknown with an always-true S.overrideToEquivalence.",
  candidatePattern: candidatePattern(OpaqueRecordRetiredMember.literals),
  plan: retirementPlanner("opaque-record-retirement", opaqueRecordSpecOf),
});
