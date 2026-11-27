/**
 * Inline source templates for a model-first bounded context.
 *
 * @packageDocumentation
 * @category utilities
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { A, Str } from "@beep/utils";
import { pipe } from "effect/Function";
import * as Order from "effect/Order";
import * as S from "effect/Schema";
import { ArchitectureContextRole } from "../Architecture.schemas.ts";

const $I = $RepoCliId.create("commands/Architecture/internal/ModelFirstTemplates");

const fence = "```";

/**
 * The names a model-first context is generated from: the context slug and
 * its first Module, with every derived package and identity name.
 *
 * **Example** (Names for the notes context)
 *
 * ```ts
 * import { ModelFirstContextRequest, modelFirstContextNamesFor } from "@beep/repo-cli/commands/Architecture/internal/ModelFirstTemplates"
 *
 * const names = modelFirstContextNamesFor(ModelFirstContextRequest.make({ context: "notes", module: "Note" }))
 * console.log(names.contractPackage) // "@beep/notes-contract"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ModelFirstContextNames extends S.Opaque<ModelFirstContextNames, { readonly brand: unique symbol }>()(
  S.Struct({
    context: S.String,
    contextPascal: S.String,
    contextLabel: S.String,
    module: S.String,
    contractPackage: S.String,
    modelPackage: S.String,
    hostPackage: S.String,
    contractIdentity: S.String,
    modelIdentity: S.String,
  }).pipe(
    $I.annoteSchema("ModelFirstContextNames", {
      description: "Context, Module, package and identity names a model-first context is generated from.",
    })
  )
) {}

/**
 * What a model-first context is generated from: its kebab-case context slug
 * (the `packages/<context>` folder) and the PascalCase name of its first Module.
 *
 * **Example** (Request the notes context)
 *
 * ```ts
 * import { ModelFirstContextRequest } from "@beep/repo-cli/commands/Architecture/internal/ModelFirstTemplates"
 *
 * const request = ModelFirstContextRequest.make({ context: "notes", module: "Note" })
 * console.log(request.module) // "Note"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ModelFirstContextRequest extends S.Opaque<ModelFirstContextRequest, { readonly brand: unique symbol }>()(
  S.Struct({ context: S.String, module: S.String }).pipe(
    $I.annoteSchema("ModelFirstContextRequest", {
      description: "The context slug and first Module name a model-first context is generated from.",
    })
  )
) {}

/**
 * Derives every generated name from a context slug and a Module name.
 *
 * **Example** (Derive the identity composer of a contract package)
 *
 * ```ts
 * import { ModelFirstContextRequest, modelFirstContextNamesFor } from "@beep/repo-cli/commands/Architecture/internal/ModelFirstTemplates"
 *
 * console.log(modelFirstContextNamesFor(ModelFirstContextRequest.make({ context: "case-files", module: "CaseFile" })).contractIdentity) // "$CaseFilesContractId"
 * ```
 *
 * @param input - The kebab-case context slug (the `packages/<context>` folder) and the PascalCase name of its first Module.
 * @returns The derived names.
 * @category constructors
 * @since 0.0.0
 */
export const modelFirstContextNamesFor = ({ context, module }: ModelFirstContextRequest): ModelFirstContextNames => {
  const contextPascal = Str.pascalCase(context);
  return ModelFirstContextNames.make({
    context,
    contextPascal,
    contextLabel: Str.replaceAll("-", " ")(context),
    module: Str.pascalCase(module),
    contractPackage: `@beep/${context}-contract`,
    modelPackage: `@beep/${context}-model`,
    hostPackage: `@beep/${context}-host`,
    contractIdentity: `$${contextPascal}ContractId`,
    modelIdentity: `$${contextPascal}ModelId`,
  });
};

type Space = "value" | "type" | "both";

const bindingsIn = (names: string, space: Space): ReadonlyArray<readonly [string, Space]> =>
  pipe(
    Str.split(names, ","),
    A.map(Str.trim),
    A.filter(Str.isNonEmpty),
    A.map((entry): readonly [string, Space] => {
      const typeOnly = Str.startsWith("type ")(entry);
      const local = A.lastNonEmpty(Str.split(Str.replace(/^type\s+/u, "")(entry), /\s+as\s+/u));
      return [Str.trim(local), typeOnly ? "type" : space];
    })
  );

const matchesOf = (content: string, pattern: RegExp): ReadonlyArray<RegExpMatchArray> =>
  A.fromIterable(pipe(content, Str.matchAll(pattern)));

const declarationSpace = (keyword: string): Space =>
  keyword === "class" ? "both" : keyword === "type" || keyword === "interface" ? "type" : "value";

const topLevelBindings = (content: string): ReadonlyArray<readonly [string, Space]> => [
  ...A.map(
    matchesOf(content, /^import\s+(type\s+)?\*\s+as\s+(\$?\w+)\s+from/gmu),
    (match): readonly [string, Space] => [String(match[2]), match[1] === undefined ? "both" : "type"]
  ),
  ...A.flatMap(matchesOf(content, /^import\s+(type\s+)?\{([^}]*)\}\s+from/gmu), (match) =>
    bindingsIn(String(match[2]), match[1] === undefined ? "both" : "type")
  ),
  ...A.flatMap(matchesOf(content, /^(?:export\s+)?const\s+\{([^}]*)\}\s*=/gmu), (match) =>
    bindingsIn(String(match[1]), "value")
  ),
  ...A.map(
    matchesOf(content, /^(?:export\s+)?(const|let|function|class|type|interface)\s+(\$?\w+)/gmu),
    (match): readonly [string, Space] => [String(match[2]), declarationSpace(String(match[1]))]
  ),
];

const overlaps = (left: Space, right: Space): boolean => left === "both" || right === "both" || left === right;

/**
 * The top-level names a generated file binds twice in one namespace: an
 * import and a declaration, two imports, or two declarations. A value and a
 * type of the same name (`const NoteId` beside `type NoteId`) do not clash.
 *
 * **Example** (A Module named after an import)
 *
 * ```ts
 * import { duplicateBindingsOf } from "@beep/repo-cli/commands/Architecture/internal/ModelFirstTemplates"
 *
 * const source = 'import * as Domain from "@alchemy.run/domain";\nexport class Domain {}\n'
 * console.log(duplicateBindingsOf(source)) // ["Domain"]
 * ```
 *
 * @param content - A generated TypeScript file.
 * @returns The clashing names, sorted and once each.
 * @category getters
 * @since 0.0.0
 */
export const duplicateBindingsOf = (content: string): ReadonlyArray<string> => {
  const bindings = topLevelBindings(content);
  return pipe(
    bindings,
    A.filter(([name, space], index) =>
      A.some(
        bindings,
        ([other, otherSpace], otherIndex) => otherIndex !== index && other === name && overlaps(space, otherSpace)
      )
    ),
    A.map(([name]) => name),
    A.dedupe,
    A.sort(Order.String)
  );
};

/**
 * One generated source file of a model-first context, relative to its
 * package root. Files under `src/` are the package's exact entry points.
 *
 * **Example** (A generated file)
 *
 * ```ts
 * import { ModelFirstSourceFile } from "@beep/repo-cli/commands/Architecture/internal/ModelFirstTemplates"
 *
 * const file = ModelFirstSourceFile.make({
 *   role: "host",
 *   path: "src/Adapters.ts",
 *   content: "export {};\n",
 *   description: "Write the host adapters.",
 * })
 * console.log(file.path) // "src/Adapters.ts"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ModelFirstSourceFile extends S.Opaque<ModelFirstSourceFile, { readonly brand: unique symbol }>()(
  S.Struct({
    role: ArchitectureContextRole,
    path: S.String,
    content: S.String,
    description: S.String,
  }).pipe(
    $I.annoteSchema("ModelFirstSourceFile", {
      description: "One generated source file of a model-first context, relative to its package root.",
    })
  )
) {}

const header = (summary: string, category: string): string => `/**
 * ${summary}
 *
 * @packageDocumentation
 * @category ${category}
 * @since 0.0.0
 */
`;

const idTemplate = (names: ModelFirstContextNames): string => {
  const M = names.module;
  return `${header(`The id of the ${names.contextLabel} context's ${M} Module.`, "ids")}
import { ${names.contractIdentity} } from "@beep/identity/packages";
import * as S from "effect/Schema";

const $I = ${names.contractIdentity}.create("${M}/${M}.id");

/**
 * A ${M}: one consistency boundary of the ${names.contextLabel} context.
 *
 * **Example** (Brand a ${M} id)
 *
 * ${fence}ts
 * import { ${M}Id } from "${names.contractPackage}/${M}/${M}.id"
 *
 * const id = ${M}Id.make("${Str.kebabCase(M)}_1")
 * console.log(id) // "${Str.kebabCase(M)}_1"
 * ${fence}
 *
 * @category ids
 * @since 0.0.0
 */
export const ${M}Id = S.String.pipe(
  S.brand("${M}Id"),
  $I.annoteSchema("${M}Id", { description: "The id of one ${M}." })
);

/**
 * A ${M} id.
 *
 * **Example** (Type a ${M} id)
 *
 * ${fence}ts
 * import { ${M}Id } from "${names.contractPackage}/${M}/${M}.id"
 *
 * const id: ${M}Id = ${M}Id.make("${Str.kebabCase(M)}_1")
 * console.log(id) // "${Str.kebabCase(M)}_1"
 * ${fence}
 *
 * @category ids
 * @since 0.0.0
 */
export type ${M}Id = typeof ${M}Id.Type;
`;
};

const commandTemplate = (names: ModelFirstContextNames): string => {
  const M = names.module;
  return `${header(`Create${M}: the command, the event it records and the rejection only it returns.`, "commands")}
import * as Domain from "@alchemy.run/domain";
import { ${names.contractIdentity} } from "@beep/identity/packages";
import * as S from "effect/Schema";
import { ${M}Id } from "./${M}.id.ts";

const $I = ${names.contractIdentity}.create("${M}/Create${M}.command");

/**
 * Refused: a ${M} is created once.
 *
 * **Example** (Refuse a second creation)
 *
 * ${fence}ts
 * import { ${M}AlreadyCreated } from "${names.contractPackage}/${M}/Create${M}.command"
 *
 * const refusal = ${M}AlreadyCreated.make({})
 * console.log(refusal._tag) // "${M}AlreadyCreated"
 * ${fence}
 *
 * @category rejections
 * @since 0.0.0
 */
export class ${M}AlreadyCreated extends S.TaggedError<${M}AlreadyCreated, { readonly brand: unique symbol }>()(
  "${M}AlreadyCreated",
  {},
  $I.annote("${M}AlreadyCreated", { httpApiStatus: 409, description: "This ${M} was already created." })
) {}

/**
 * The fact: a ${M} now exists, with this title.
 *
 * **Example** (Record a creation)
 *
 * ${fence}ts
 * import { ${M}Created } from "${names.contractPackage}/${M}/Create${M}.command"
 *
 * const event = ${M}Created.make({ title: "First" })
 * console.log(event.title) // "First"
 * ${fence}
 *
 * @category events
 * @since 0.0.0
 */
export class ${M}Created extends Domain.Event("${M}Created", { title: S.String }) {}

/**
 * Create a ${M} with a title. A ${M} id is created once.
 *
 * **Example** (Ask to create a ${M})
 *
 * ${fence}ts
 * import { Create${M} } from "${names.contractPackage}/${M}/Create${M}.command"
 *
 * const command = Create${M}.make({ title: "First" })
 * console.log(command.title) // "First"
 * ${fence}
 *
 * @category commands
 * @since 0.0.0
 */
export class Create${M} extends Domain.Command(
  "Create${M}",
  {
    target: ${M}Id,
    input: { title: S.String },
    events: [${M}Created],
    rejects: [${M}AlreadyCreated],
  },
  { description: "Create a ${M} with a title." }
) {}
`;
};

const readTemplate = (names: ModelFirstContextNames): string => {
  const M = names.module;
  return `${header(`The ${M}Summary view's read contract, with no aggregate behind it.`, "reads")}
import * as Domain from "@alchemy.run/domain";
import { ${names.contractIdentity} } from "@beep/identity/packages";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { ${M}Created } from "./Create${M}.command.ts";
import { ${M}Id } from "./${M}.id.ts";

const $I = ${names.contractIdentity}.create("${M}/${M}Summary.read");

/**
 * Refused: no ${M} has this id yet.
 *
 * **Example** (Refuse a read of an unknown ${M})
 *
 * ${fence}ts
 * import { ${M}NotFound } from "${names.contractPackage}/${M}/${M}Summary.read"
 *
 * console.log(${M}NotFound.make({})._tag) // "${M}NotFound"
 * ${fence}
 *
 * @category rejections
 * @since 0.0.0
 */
export class ${M}NotFound extends S.TaggedError<${M}NotFound, { readonly brand: unique symbol }>()(
  "${M}NotFound",
  {},
  $I.annote("${M}NotFound", { httpApiStatus: 404, description: "No ${M} has this id yet." })
) {}

/**
 * One ${M} as a reader sees it: its title, once it is created.
 *
 * **Example** (Decode a summary)
 *
 * ${fence}ts
 * import { ${M}SummaryState } from "${names.contractPackage}/${M}/${M}Summary.read"
 * import * as S from "effect/Schema"
 *
 * const summary = S.decodeUnknownSync(${M}SummaryState)({ title: "First" })
 * console.log(summary.title) // { _id: "Option", _tag: "Some", value: "First" }
 * ${fence}
 *
 * @category models
 * @since 0.0.0
 */
export const ${M}SummaryState = S.Struct({ title: S.OptionFromNullOr(S.String) }).pipe(
  $I.annoteSchema("${M}SummaryState", { description: "One ${M} as a reader sees it." })
);

/**
 * One ${M} as a reader sees it.
 *
 * **Example** (Type a summary)
 *
 * ${fence}ts
 * import type { ${M}SummaryState } from "${names.contractPackage}/${M}/${M}Summary.read"
 *
 * const titleOf = (summary: ${M}SummaryState) => summary.title
 * console.log(typeof titleOf) // "function"
 * ${fence}
 *
 * @category models
 * @since 0.0.0
 */
export type ${M}SummaryState = typeof ${M}SummaryState.Type;

/**
 * The summary of a ${M} nobody has created yet.
 *
 * **Example** (An empty summary)
 *
 * ${fence}ts
 * import { ${M}SummaryInitial } from "${names.contractPackage}/${M}/${M}Summary.read"
 * import * as O from "effect/Option"
 *
 * console.log(O.isNone(${M}SummaryInitial.title)) // true
 * ${fence}
 *
 * @category models
 * @since 0.0.0
 */
export const ${M}SummaryInitial: ${M}SummaryState = ${M}SummaryState.make({ title: O.none() });

/**
 * The \`${M}Summary\` view's read contract: its key, state, the events it
 * emits and its rejections. The model's \`${M}Summary\` view folds the \`${M}\`
 * aggregate into the same state.
 *
 * **Gotchas**
 *
 * Interim (D9): \`events\` lists the model view's emitted events in the
 * aggregate's order, so the read RPCs match; the parity test checks.
 *
 * **Example** (Name the read contract)
 *
 * ${fence}ts
 * import { ${M}SummaryRead } from "${names.contractPackage}/${M}/${M}Summary.read"
 *
 * console.log(${M}SummaryRead.viewName) // "${M}Summary"
 * ${fence}
 *
 * @category reads
 * @since 0.0.0
 */
export class ${M}SummaryRead extends Domain.View("${M}Summary", {
  from: [],
  key: ${M}Id,
  state: ${M}SummaryState,
  initial: ${M}SummaryInitial,
  events: [${M}Created],
  rejects: [${M}NotFound],
}) {}
`;
};

const catalogTemplate = (names: ModelFirstContextNames): string => {
  const { contextPascal: C, module: M } = names;
  return `${header(`The ${names.contextLabel} context's aggregate-free catalog.`, "contracts")}
import * as Catalog from "@beep/contract-kit/Catalog";
import { Create${M} } from "./${M}/Create${M}.command.ts";
import { ${M}SummaryRead } from "./${M}/${M}Summary.read.ts";

/**
 * Everything of the ${names.contextLabel} context a client can call, with no
 * aggregate behind it.
 *
 * **Gotchas**
 *
 * Interim (D9): deleted when upstream splits the Api from the model.
 *
 * **Example** (Read the catalog's commands)
 *
 * ${fence}ts
 * import { ${C}Catalog } from "${names.contractPackage}/${C}.catalog"
 *
 * console.log(${C}Catalog.commands.length) // 1
 * ${fence}
 *
 * @category contracts
 * @since 0.0.0
 */
export const ${C}Catalog = Catalog.make({
  name: "${C}",
  commands: [Create${M}],
  views: [${M}SummaryRead],
  queries: [],
});
`;
};

const contractTemplate = (names: ModelFirstContextNames): string => {
  const { contextPascal: C, module: M } = names;
  return `${header(`The ${names.contextLabel} context's client contract.`, "contracts")}
import * as Domain from "@alchemy.run/domain";
import { ${C}Catalog } from "./${C}.catalog.ts";

/**
 * The ${names.contextLabel} context's client contract: the same RPC group as
 * the model's \`${C}Api\`, with no aggregate in its closure.
 *
 * **Example** (Count the contract's RPCs)
 *
 * ${fence}ts
 * import { ${C}Contract } from "${names.contractPackage}/${C}Api.contract"
 *
 * console.log(${C}Contract.group.requests.size > 0) // true
 * ${fence}
 *
 * @category contracts
 * @since 0.0.0
 */
export class ${C}Contract extends Domain.Api(
  "${C}Contract",
  { model: ${C}Catalog, commands: ["Create${M}"], views: ["${M}Summary"], queries: [], streams: [] },
  { description: "Create a ${M} and read its summary." }
) {}
`;
};

const contractImportsTestTemplate = (
  names: ModelFirstContextNames
): string => `import { NodeServices } from "@effect/platform-node";
import { describe, expect, layer } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { pipe } from "effect/Function";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as Str from "effect/String";
import { Project, SyntaxKind } from "ts-morph";

const allowed = [
  "@alchemy.run/domain",
  "@beep/contract-kit",
  "@beep/identity",
  "@beep/schema",
  "${names.contractPackage}",
  "effect",
] as const;

const isAllowedPackage = (specifier: string): boolean =>
  A.some(allowed, (root) => specifier === root || Str.startsWith(\`\${root}/\`)(specifier));

const project = new Project({ useInMemoryFileSystem: true });

const specifiersOf = (fileName: string, source: string): ReadonlyArray<string> => {
  const file = project.createSourceFile(fileName, source, { overwrite: true });
  const dynamicImports = pipe(
    file.getDescendantsOfKind(SyntaxKind.CallExpression),
    A.filter((call) => call.getExpression().getKind() === SyntaxKind.ImportKeyword),
    A.flatMap((call) => A.map(call.getArguments(), (argument) => Str.replace(/^["'\`]|["'\`]$/g, "")(argument.getText())))
  );
  return [
    ...A.map(file.getImportDeclarations(), (declaration) => declaration.getModuleSpecifierValue()),
    ...A.flatMap(file.getExportDeclarations(), (declaration) =>
      O.toArray(O.fromNullishOr(declaration.getModuleSpecifierValue()))
    ),
    ...A.map(file.getDescendantsOfKind(SyntaxKind.ExternalModuleReference), (reference) =>
      Str.replace(/^["']|["']$/g, "")(reference.getExpression()?.getText() ?? "")
    ),
    ...dynamicImports,
  ];
};

const illegalImportsOf = (path: Path.Path, packageRoot: string, fileName: string, source: string) =>
  A.filter(specifiersOf(fileName, source), (specifier) => {
    if (!Str.startsWith(".")(specifier)) return !isAllowedPackage(specifier);
    const relative = path.relative(packageRoot, path.resolve(path.dirname(fileName), specifier));
    return Str.startsWith("..")(relative) || path.isAbsolute(relative);
  });

describe("contract imports", () => {
  layer(NodeServices.layer)((it) => {
    it.effect(
      "resolve no model, host or driver",
      Effect.fnUntraced(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const packageRoot = yield* path.fromFileUrl(new URL("..", import.meta.url));
        const src = path.join(packageRoot, "src");
        const entries = yield* fs.readDirectory(src, { recursive: true });
        const files = A.filter(entries, Str.endsWith(".ts"));
        const illegal = yield* Effect.forEach(
          files,
          (file) =>
            Effect.map(fs.readFileString(path.join(src, file)), (source) =>
              illegalImportsOf(path, packageRoot, path.join(src, file), source)
            ),
          { concurrency: 1 }
        );
        expect(files.length).toBeGreaterThan(0);
        expect(A.flatten(illegal)).toEqual([]);
      })
    );

    it.effect(
      "refuse a driver import, a relative import into the model and a side-effect import",
      Effect.fnUntraced(function* () {
        const path = yield* Path.Path;
        const packageRoot = yield* path.fromFileUrl(new URL("..", import.meta.url));
        const fixture = path.join(packageRoot, "src", "Fixture.ts");
        const illegal = (source: string) => illegalImportsOf(path, packageRoot, fixture, source);
        const driver = "import { Pg } from '@beep/postgres';\\n";
        const intoModel = 'export * from "../../model/src/Model.ts";\\n';
        const sideEffect = 'import "node:fs";\\n';
        const sibling = 'import { Id } from "./Id.ts";\\n';
        expect(illegal(driver)).toEqual(["@beep/postgres"]);
        expect(illegal(intoModel)).toEqual(["../../model/src/Model.ts"]);
        expect(illegal(sideEffect)).toEqual(["node:fs"]);
        expect(illegal(sibling)).toEqual([]);
      })
    );
  });
});
`;

const aggregateTemplate = (names: ModelFirstContextNames): string => {
  const M = names.module;
  return `${header(`The ${M} aggregate: its state, \`decide\` and \`evolve\`.`, "aggregates")}
import * as Domain from "@alchemy.run/domain";
import { ${names.modelIdentity} } from "@beep/identity/packages";
import { Create${M}, ${M}AlreadyCreated, ${M}Created } from "${names.contractPackage}/${M}/Create${M}.command";
import { ${M}Id } from "${names.contractPackage}/${M}/${M}.id";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

const $I = ${names.modelIdentity}.create("${M}/${M}.aggregate");

/**
 * A ${M}'s lifecycle: not written yet, then created with a title.
 *
 * **Example** (Where a ${M} stands)
 *
 * ${fence}ts
 * import { ${M}State } from "${names.modelPackage}/${M}/${M}.aggregate"
 *
 * const standing = ${M}State.match(${M}State.cases.Unwritten.make({}), {
 *   Unwritten: () => "not written",
 *   Created: ({ title }) => title,
 * })
 * console.log(standing) // "not written"
 * ${fence}
 *
 * @category models
 * @since 0.0.0
 */
export const ${M}State = S.TaggedUnion({
  Unwritten: {},
  Created: { title: S.String },
}).pipe($I.annoteSchema("${M}State", { description: "A ${M}'s lifecycle." }));

/**
 * A ${M}'s lifecycle.
 *
 * **Example** (Type a ${M} state)
 *
 * ${fence}ts
 * import { ${M}State } from "${names.modelPackage}/${M}/${M}.aggregate"
 *
 * const state: ${M}State = ${M}State.cases.Created.make({ title: "First" })
 * console.log(state._tag) // "Created"
 * ${fence}
 *
 * @category models
 * @since 0.0.0
 */
export type ${M}State = typeof ${M}State.Type;

/**
 * One ${M} of the ${names.contextLabel} context. It is created once.
 *
 * **Example** (Reference one ${M})
 *
 * ${fence}ts
 * import { ${M} } from "${names.modelPackage}/${M}/${M}.aggregate"
 *
 * const ref = ${M}.ref("${Str.kebabCase(M)}_1")
 * console.log(ref.id) // "${Str.kebabCase(M)}_1"
 * ${fence}
 *
 * @category aggregates
 * @since 0.0.0
 */
export class ${M} extends Domain.Aggregate(
  "${M}",
  {
    id: ${M}Id,
    state: ${M}State,
    initial: { _tag: "Unwritten" },
    commands: [Create${M}],
    decide: {
      Create${M}: (state, command) =>
        ${M}State.match(state, {
          Unwritten: () => Effect.succeed([${M}Created.make({ title: command.title })]),
          Created: () => Effect.fail(${M}AlreadyCreated.make({})),
        }),
    },
    evolve: {
      ${M}Created: (_state, event) => ${M}State.cases.Created.make({ title: event.title }),
    },
  },
  { description: "One ${M}, from its creation." }
) {}
`;
};

const viewTemplate = (names: ModelFirstContextNames): string => {
  const M = names.module;
  return `${header(`The ${M}Summary view.`, "views")}
import * as Domain from "@alchemy.run/domain";
import { ${M}NotFound, ${M}SummaryInitial, ${M}SummaryState } from "${names.contractPackage}/${M}/${M}Summary.read";
import * as O from "effect/Option";
import { ${M} } from "./${M}.aggregate.ts";

/**
 * One ${M} as a reader sees it, folded from the \`${M}\` aggregate into the
 * state the contract's \`${M}SummaryRead\` declares.
 *
 * **Example** (Fold a creation into a summary)
 *
 * ${fence}ts
 * import { ${M}Summary } from "${names.modelPackage}/${M}/${M}Summary.view"
 *
 * console.log(${M}Summary.viewName) // "${M}Summary"
 * ${fence}
 *
 * @category views
 * @since 0.0.0
 */
export class ${M}Summary extends Domain.View(
  "${M}Summary",
  {
    from: [${M}],
    key: ${M},
    rejects: [${M}NotFound],
    state: ${M}SummaryState,
    initial: ${M}SummaryInitial,
    evolve: {
      ${M}Created: (_view, event) => ({ title: O.some(event.title) }),
    },
  },
  { description: "One ${M} as a reader sees it." }
) {}
`;
};

const viewHandlerTemplate = (names: ModelFirstContextNames): string => {
  const M = names.module;
  return `${header(`Who may read a ${M}Summary.`, "handlers")}
import { ${M}NotFound } from "${names.contractPackage}/${M}/${M}Summary.read";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import { ${M}Summary } from "./${M}Summary.view.ts";

/**
 * Judges each read of a ${M}Summary: a ${M} nobody has created reads as
 * \`${M}NotFound\`.
 *
 * **Gotchas**
 *
 * A view is eventually consistent: a ${M} created a moment ago may read as
 * not found until the view has handled its event.
 *
 * **Example** (Provide the handler)
 *
 * ${fence}ts
 * import { ${M}SummaryLive } from "${names.modelPackage}/${M}/${M}Summary.handler"
 * import * as Layer from "effect/Layer"
 *
 * console.log(Layer.isLayer(${M}SummaryLive)) // true
 * ${fence}
 *
 * @category handlers
 * @since 0.0.0
 */
export const ${M}SummaryLive = ${M}Summary.toLayer(
  Effect.succeed((_request, summary) =>
    O.match(
      O.flatMap(O.fromNullishOr(summary), (found) => found.title),
      {
        onNone: () => Effect.fail(${M}NotFound.make({})),
        onSome: () => Effect.void,
      }
    )
  )
);
`;
};

const modelTemplate = (names: ModelFirstContextNames): string => {
  const { contextPascal: C, module: M } = names;
  return `${header(`The ${names.contextLabel} context's Model.`, "models")}
import * as Domain from "@alchemy.run/domain";
import { ${M} } from "./${M}/${M}.aggregate.ts";
import { ${M}Summary } from "./${M}/${M}Summary.view.ts";

/**
 * The ${names.contextLabel} context: its write and reaction model.
 *
 * **Example** (Verify the model)
 *
 * ${fence}ts
 * import * as Domain from "@alchemy.run/domain"
 * import { ${C}Model } from "${names.modelPackage}/${C}.model"
 *
 * console.log(Domain.verify(${C}Model).length) // 0
 * ${fence}
 *
 * @category models
 * @since 0.0.0
 */
export class ${C}Model extends Domain.Model(
  "${C}",
  {
    aggregates: [${M}],
    views: [${M}Summary],
  },
  { description: "The ${names.contextLabel} context." }
) {}
`;
};

const handlersTemplate = (names: ModelFirstContextNames): string => {
  const { contextPascal: C, module: M } = names;
  return `// Generated by \`beep architecture create context\` from ${C}Model. Do not edit.
${header(`Every handler ${C}Model needs.`, "handlers")}
import * as Layer from "effect/Layer";
import { ${M}SummaryLive } from "./${M}/${M}Summary.handler.ts";

/**
 * Every handler ${C}Model needs, as one Layer, in model order.
 *
 * **Example** (Host the model with its handlers)
 *
 * ${fence}ts
 * import { ${C}Handlers } from "${names.modelPackage}/${C}.handlers"
 * import { ${C}Model } from "${names.modelPackage}/${C}.model"
 *
 * const hosted = ${C}Model.layer(${C}Handlers)
 * console.log(typeof hosted) // "object"
 * ${fence}
 *
 * @category handlers
 * @since 0.0.0
 */
export const ${C}Handlers = Layer.mergeAll(${M}SummaryLive);
`;
};

const portsTemplate = (names: ModelFirstContextNames): string => {
  const C = names.contextPascal;
  return `${header(`The ${names.contextLabel} model's ports and the purity law.`, "ports")}
import { ${C}Handlers } from "./${C}.handlers.ts";
import { ${C}Model } from "./${C}.model.ts";
import type * as Domain from "@alchemy.run/domain";
import type * as Layer from "effect/Layer";

/**
 * Everything the ${names.contextLabel} model needs from outside itself: nothing yet.
 *
 * **Example** (Name the ports)
 *
 * ${fence}ts
 * import type { ${C}Ports } from "${names.modelPackage}/${C}.ports"
 *
 * const none: ReadonlyArray<${C}Ports> = []
 * console.log(none.length) // 0
 * ${fence}
 *
 * @category ports
 * @since 0.0.0
 */
export type ${C}Ports = never;

/**
 * What every platform gives a hosted model, read off \`Domain.InMemory\`.
 *
 * **Example** (Name the host's services)
 *
 * ${fence}ts
 * import type { Host } from "${names.modelPackage}/${C}.ports"
 *
 * const services: ReadonlyArray<Host> = []
 * console.log(services.length) // 0
 * ${fence}
 *
 * @category ports
 * @since 0.0.0
 */
export type Host = Layer.Success<typeof Domain.InMemory>;

/**
 * The ${names.contextLabel} model with its generated handler registry, on no
 * platform yet.
 *
 * **Example** (Host it in memory)
 *
 * ${fence}ts
 * import * as Domain from "@alchemy.run/domain"
 * import { ${C}Hosted } from "${names.modelPackage}/${C}.ports"
 * import * as Layer from "effect/Layer"
 *
 * const inMemory = ${C}Hosted.pipe(Layer.provide(Domain.InMemory))
 * console.log(Layer.isLayer(inMemory)) // true
 * ${fence}
 *
 * @category layers
 * @since 0.0.0
 */
export const ${C}Hosted = ${C}Model.layer(${C}Handlers);

/**
 * The purity law: the hosted model requires its ports and the host, nothing
 * else. A handler that needs an undeclared service fails this line.
 *
 * **Example** (The law holds)
 *
 * ${fence}ts
 * import { portPurity } from "${names.modelPackage}/${C}.ports"
 * import * as Layer from "effect/Layer"
 *
 * console.log(Layer.isLayer(portPurity)) // true
 * ${fence}
 *
 * @category ports
 * @since 0.0.0
 */
export const portPurity = ${C}Hosted satisfies Layer.Layer<never, unknown, ${C}Ports | Host>;
`;
};

const apiTemplate = (names: ModelFirstContextNames): string => {
  const { contextPascal: C, module: M } = names;
  return `${header(`What callers of the ${names.contextLabel} context reach.`, "apis")}
import * as Domain from "@alchemy.run/domain";
import { ${C}Model } from "./${C}.model.ts";

/**
 * What callers of the ${names.contextLabel} context reach: create a ${M} and
 * read its summary.
 *
 * **Example** (Count the Api's RPCs)
 *
 * ${fence}ts
 * import { ${C}Api } from "${names.modelPackage}/${C}Api.api"
 *
 * console.log(${C}Api.group.requests.size > 0) // true
 * ${fence}
 *
 * @category apis
 * @since 0.0.0
 */
export class ${C}Api extends Domain.Api(
  "${C}Api",
  { model: ${C}Model, commands: ["Create${M}"], views: ["${M}Summary"], queries: [], streams: [] },
  { description: "Create a ${M} and read its summary." }
) {}
`;
};

const storyTestTemplate = (names: ModelFirstContextNames): string => {
  const { contextPascal: C, module: M } = names;
  const id = `${Str.kebabCase(M)}_1`;
  return `import * as Domain from "@alchemy.run/domain";
import { Story } from "@alchemy.run/domain/Story";
import { Create${M}, ${M}AlreadyCreated, ${M}Created } from "${names.contractPackage}/${M}/Create${M}.command";
import { ${M} } from "${names.modelPackage}/${M}/${M}.aggregate";
import { ${C}Handlers } from "${names.modelPackage}/${C}.handlers";
import { ${C}Model } from "${names.modelPackage}/${C}.model";
import { expect, it } from "@effect/vitest";

const { given, rejected, then, when } = Story;

const story = Story.make(${C}Model, { layer: ${C}Handlers });
const subject = ${M}.ref("${id}");

it("the model is well defined", () => {
  expect(Domain.verify(${C}Model)).toEqual([]);
});

it.effect("creating a ${M} records ${M}Created", () =>
  story(when(subject, Create${M}.make({ title: "First" })), then(subject, ${M}Created.make({ title: "First" })))
);

it.effect("a ${M} is created once", () =>
  story(
    given(subject, ${M}Created.make({ title: "First" })),
    when(subject, Create${M}.make({ title: "Again" })),
    rejected(${M}AlreadyCreated.make({}))
  )
);
`;
};

const parityTestTemplate = (names: ModelFirstContextNames): string => {
  const C = names.contextPascal;
  return `import { groupShape } from "@beep/contract-kit/Parity";
import { ${C}Contract } from "${names.contractPackage}/${C}Api.contract";
import { ${C}Api } from "${names.modelPackage}/${C}Api.api";
import { expect, it } from "@effect/vitest";

it("the ${names.contextLabel} contract's RPC group equals the model Api's", () => {
  const expected = groupShape(${C}Api.group);
  expect(expected.length).toBeGreaterThan(0);
  expect(groupShape(${C}Contract.group)).toEqual(expected);
});
`;
};

const adaptersTemplate = (names: ModelFirstContextNames): string => {
  const C = names.contextPascal;
  return `${header(`The ${names.contextLabel} host's adapters.`, "layers")}
import * as Layer from "effect/Layer";

/**
 * Every port adapter the ${names.contextLabel} model needs: none yet, since
 * the model declares no ports.
 *
 * **Example** (Provide the adapters)
 *
 * ${fence}ts
 * import { ${C}Adapters } from "${names.hostPackage}/Adapters"
 * import * as Layer from "effect/Layer"
 *
 * console.log(Layer.isLayer(${C}Adapters)) // true
 * ${fence}
 *
 * @category layers
 * @since 0.0.0
 */
export const ${C}Adapters = Layer.empty;
`;
};

const hostTemplate = (names: ModelFirstContextNames): string => {
  const C = names.contextPascal;
  return `${header(`Hosts the ${names.contextLabel} model on a platform.`, "layers")}
import { ${C}Hosted } from "${names.modelPackage}/${C}.ports";
import * as Layer from "effect/Layer";
import { ${C}Adapters } from "./Adapters.ts";

/**
 * The ${names.contextLabel} model with its handlers and adapters, on the
 * platform you give it: \`Domain.InMemory\` in tests, a cluster platform in a
 * deployment.
 *
 * **Example** (Host it in memory)
 *
 * ${fence}ts
 * import * as Domain from "@alchemy.run/domain"
 * import { host${C} } from "${names.hostPackage}/Host"
 * import * as Layer from "effect/Layer"
 *
 * console.log(Layer.isLayer(host${C}(Domain.InMemory))) // true
 * ${fence}
 *
 * @param platform - The Layer that provides the domain platform.
 * @returns The hosted model on that platform.
 * @category layers
 * @since 0.0.0
 */
export const host${C} = <ROut, E, RIn>(platform: Layer.Layer<ROut, E, RIn>) =>
  ${C}Hosted.pipe(Layer.provide(${C}Adapters), Layer.provide(platform));
`;
};

const sourceFile = (
  role: ArchitectureContextRole,
  path: string,
  content: string,
  description: string
): ModelFirstSourceFile => ModelFirstSourceFile.make({ role, path, content, description });

/**
 * Every generated source and test file of a model-first context, in plan
 * order, relative to each package root.
 *
 * **Example** (List the notes context's files)
 *
 * ```ts
 * import {
 *   ModelFirstContextRequest,
 *   modelFirstContextNamesFor,
 *   modelFirstSourceFilesFor,
 * } from "@beep/repo-cli/commands/Architecture/internal/ModelFirstTemplates"
 *
 * const files = modelFirstSourceFilesFor(modelFirstContextNamesFor(ModelFirstContextRequest.make({ context: "notes", module: "Note" })))
 * console.log(files[0]?.path) // "src/Note/Note.id.ts"
 * ```
 *
 * @param names - The names the context is generated from.
 * @returns The generated files.
 * @category constructors
 * @since 0.0.0
 */
export const modelFirstSourceFilesFor = (names: ModelFirstContextNames): ReadonlyArray<ModelFirstSourceFile> => {
  const { contextPascal: C, module: M } = names;
  return [
    sourceFile("contract", `src/${M}/${M}.id.ts`, idTemplate(names), `Write the ${M} id.`),
    sourceFile(
      "contract",
      `src/${M}/Create${M}.command.ts`,
      commandTemplate(names),
      `Write the Create${M} command with its event and rejection.`
    ),
    sourceFile("contract", `src/${M}/${M}Summary.read.ts`, readTemplate(names), `Write the ${M}Summary read contract.`),
    sourceFile("contract", `src/${C}.catalog.ts`, catalogTemplate(names), `Write the ${C} catalog.`),
    sourceFile("contract", `src/${C}Api.contract.ts`, contractTemplate(names), `Write the ${C} client contract.`),
    sourceFile(
      "contract",
      "test/Contract.imports.test.ts",
      contractImportsTestTemplate(names),
      "Write the contract import-closure test."
    ),
    sourceFile("model", `src/${M}/${M}.aggregate.ts`, aggregateTemplate(names), `Write the ${M} aggregate.`),
    sourceFile("model", `src/${M}/${M}Summary.view.ts`, viewTemplate(names), `Write the ${M}Summary view.`),
    sourceFile(
      "model",
      `src/${M}/${M}Summary.handler.ts`,
      viewHandlerTemplate(names),
      `Write the ${M}Summary read handler.`
    ),
    sourceFile("model", `src/${C}.model.ts`, modelTemplate(names), `Write the ${C} Model.`),
    sourceFile("model", `src/${C}.handlers.ts`, handlersTemplate(names), `Write the generated ${C} handler registry.`),
    sourceFile("model", `src/${C}.ports.ts`, portsTemplate(names), `Write the ${C} ports and purity assertion.`),
    sourceFile("model", `src/${C}Api.api.ts`, apiTemplate(names), `Write the ${C} Api.`),
    sourceFile("model", `test/${C}.story.test.ts`, storyTestTemplate(names), `Write the ${C} story test.`),
    sourceFile("model", `test/${C}Api.parity.test.ts`, parityTestTemplate(names), `Write the ${C} Api parity test.`),
    sourceFile("host", "src/Adapters.ts", adaptersTemplate(names), "Write the host adapters."),
    sourceFile("host", "src/Host.ts", hostTemplate(names), `Write the ${C} host.`),
  ];
};
