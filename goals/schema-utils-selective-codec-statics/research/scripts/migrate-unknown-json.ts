import { resolve } from "node:path";
import { Glob } from "bun";
import { Project, SyntaxKind } from "ts-morph";

const repoRoot = resolve(import.meta.dir, "../../../..");
const unsupportedTestContract = "packages/foundation/modeling/schema/test/Unknown.test.ts";

const project = new Project({ skipAddingFilesFromTsConfig: true });
const paths: Array<string> = [];
for await (const path of new Glob("{packages,apps}/**/*.{ts,tsx}").scan(repoRoot)) {
  paths.push(resolve(repoRoot, path));
}
project.addSourceFilesAtPaths(paths);

let migratedReferences = 0;
let migratedFiles = 0;

for (const sourceFile of project.getSourceFiles()) {
  const relativePath = sourceFile.getFilePath().slice(repoRoot.length + 1);
  if (relativePath === unsupportedTestContract) {
    continue;
  }

  const references = sourceFile
    .getDescendantsOfKind(SyntaxKind.PropertyAccessExpression)
    .filter((access) => access.getExpression().getText() === "Unknown" && access.getName().endsWith("FromJsonString"));
  if (references.length === 0) {
    continue;
  }

  const unknownImport = sourceFile
    .getImportDeclarations()
    .find((declaration) =>
      declaration
        .getNamedImports()
        .some(
          (namedImport) =>
            namedImport.getName() === "Unknown" &&
            (namedImport.getAliasNode() === undefined || namedImport.getAliasNode()?.getText() === "Unknown")
        )
    );
  if (unknownImport === undefined) {
    throw new Error(`Cannot find the Unknown import in '${relativePath}'.`);
  }
  if (unknownImport.getNamedImports().every((namedImport) => namedImport.getName() !== "UnknownFromJsonString")) {
    unknownImport.addNamedImport("UnknownFromJsonString");
  }

  for (const reference of references) {
    const method = reference.getName();
    const selectedMethod =
      method === "encodeSyncFromJsonString" ? "encodeUnknownSync" : method.replace("FromJsonString", "");
    reference.replaceWithText(`UnknownFromJsonString.${selectedMethod}`);
    migratedReferences += 1;
  }

  migratedFiles += 1;
  await sourceFile.save();
}

console.log(JSON.stringify({ migratedFiles, migratedReferences }));
