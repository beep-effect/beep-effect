import { resolve } from "node:path";
import { Glob } from "bun";
import { Project } from "ts-morph";

const repoRoot = resolve(import.meta.dir, "../../../..");
const migrationNames = new Set(["SchemaUtils", "Unknown"]);

const project = new Project({ skipAddingFilesFromTsConfig: true });
const paths: Array<string> = [];
for await (const path of new Glob("{packages,apps}/**/*.{ts,tsx}").scan(repoRoot)) {
  const absolutePath = resolve(repoRoot, path);
  const source = await Bun.file(absolutePath).text();
  if (source.includes("Unknown") || source.includes("SchemaUtils")) {
    paths.push(absolutePath);
  }
}
project.addSourceFilesAtPaths(paths);

let removedImports = 0;
let changedFiles = 0;

for (const sourceFile of project.getSourceFiles()) {
  let changed = false;

  for (const declaration of sourceFile.getImportDeclarations()) {
    const namespaceImport = declaration.getNamespaceImport();
    if (
      namespaceImport !== undefined &&
      migrationNames.has(namespaceImport.getText()) &&
      namespaceImport.findReferencesAsNodes().length === 0
    ) {
      declaration.remove();
      removedImports += 1;
      changed = true;
      continue;
    }

    for (const namedImport of declaration.getNamedImports()) {
      const localName = namedImport.getAliasNode()?.getText() ?? namedImport.getName();
      const localIdentifier = namedImport.getAliasNode() ?? namedImport.getNameNode();
      if (migrationNames.has(localName) && localIdentifier.findReferencesAsNodes().length === 0) {
        namedImport.remove();
        removedImports += 1;
        changed = true;
      }
    }

    if (
      !declaration.wasForgotten() &&
      declaration.getDefaultImport() === undefined &&
      declaration.getNamespaceImport() === undefined &&
      declaration.getNamedImports().length === 0
    ) {
      declaration.remove();
    }
  }

  if (changed) {
    changedFiles += 1;
    await sourceFile.save();
  }
}

console.log(JSON.stringify({ changedFiles, removedImports }));
