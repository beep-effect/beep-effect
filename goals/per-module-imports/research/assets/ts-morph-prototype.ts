import { Project, QuoteKind, StructureKind } from "ts-morph";
import type { ImportDeclarationStructure, OptionalKind } from "ts-morph";

type NamespaceTarget = {
  readonly kind: "namespace";
  readonly source: string;
};

type NamedTarget = {
  readonly imported?: string;
  readonly kind: "named";
  readonly source: string;
};

type Target = NamedTarget | NamespaceTarget;

const mappings: Readonly<Record<string, Readonly<Record<string, Target>>>> = {
  "@beep/schema": {
    NonNegativeInt: { kind: "named", source: "@beep/schema/Number" },
  },
  "@beep/utils": {
    A: { kind: "namespace", source: "@beep/utils/Array" },
    P: { kind: "namespace", source: "@beep/utils/Predicate" },
    thunkFalse: { kind: "named", source: "@beep/utils/thunk" },
  },
  effect: {
    Cause: { kind: "namespace", source: "effect/Cause" },
    Context: { kind: "namespace", source: "effect/Context" },
    Effect: { kind: "namespace", source: "effect/Effect" },
    Layer: { kind: "namespace", source: "effect/Layer" },
    Path: { kind: "namespace", source: "effect/Path" },
    Result: { kind: "namespace", source: "effect/Result" },
    Scope: { kind: "namespace", source: "effect/Scope" },
    flow: { kind: "named", source: "effect/Function" },
    identity: { kind: "named", source: "effect/Function" },
    pipe: { kind: "named", source: "effect/Function" },
  },
};

const project = new Project({
  manipulationSettings: { quoteKind: QuoteKind.Double },
  skipAddingFilesFromTsConfig: true,
});

const filePaths = process.argv.slice(2);
if (filePaths.length === 0) {
  throw new Error("Pass one or more TypeScript files.");
}

for (const filePath of filePaths) {
  const sourceFile = project.addSourceFileAtPath(filePath);

  for (const declaration of [...sourceFile.getImportDeclarations()]) {
    const barrel = declaration.getModuleSpecifierValue();
    const barrelMappings = mappings[barrel];
    if (barrelMappings === undefined) continue;

    if (declaration.getDefaultImport() !== undefined || declaration.getNamespaceImport() !== undefined) {
      throw new Error(`${filePath}: unsupported non-named barrel import from ${barrel}`);
    }

    const namespaceImports: Array<OptionalKind<ImportDeclarationStructure>> = [];
    const namedGroups = new Map<
      string,
      {
        readonly isTypeOnly: boolean;
        readonly source: string;
        readonly specifiers: Array<{ alias?: string; name: string }>;
      }
    >();

    for (const specifier of declaration.getNamedImports()) {
      const imported = specifier.getName();
      const local = specifier.getAliasNode()?.getText() ?? imported;
      const target = barrelMappings[imported];
      if (target === undefined) {
        throw new Error(`${filePath}: mapping missing for ${barrel}:${imported}`);
      }

      const isTypeOnly = declaration.isTypeOnly() || specifier.isTypeOnly();
      if (target.kind === "namespace") {
        namespaceImports.push({
          isTypeOnly,
          kind: StructureKind.ImportDeclaration,
          moduleSpecifier: target.source,
          namespaceImport: local,
        });
        continue;
      }

      const targetName = target.imported ?? imported;
      const groupKey = `${target.source}\u0000${isTypeOnly ? "type" : "value"}`;
      const group = namedGroups.get(groupKey) ?? {
        isTypeOnly,
        source: target.source,
        specifiers: [],
      };
      group.specifiers.push({
        alias: local === targetName ? undefined : local,
        name: targetName,
      });
      namedGroups.set(groupKey, group);
    }

    const namedImports: Array<OptionalKind<ImportDeclarationStructure>> = [...namedGroups.values()].map((group) => ({
      isTypeOnly: group.isTypeOnly,
      kind: StructureKind.ImportDeclaration,
      moduleSpecifier: group.source,
      namedImports: group.specifiers,
    }));

    const statementIndex = sourceFile.getStatements().indexOf(declaration);
    sourceFile.insertImportDeclarations(statementIndex, [...namespaceImports, ...namedImports]);
    declaration.remove();
  }

  sourceFile.saveSync();
}
