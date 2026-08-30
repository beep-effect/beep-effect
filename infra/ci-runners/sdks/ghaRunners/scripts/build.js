const fs = require("node:fs");
const path = require("node:path");
const process = require("node:process");
const { execFileSync } = require("node:child_process");

const packageRoot = path.join(__dirname, "..");

const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, "utf8"));

const parseCompilerArgument = (args) => {
  const compilerFlag = args.indexOf("--compiler");
  if (compilerFlag === -1) {
    return undefined;
  }

  const compilerPath = args.at(compilerFlag + 1);
  if (compilerPath === undefined) {
    throw new Error("Expected a path after --compiler");
  }

  return path.resolve(compilerPath);
};

const resolveCompiler = (root, explicitCompiler) =>
  explicitCompiler ?? require.resolve("typescript/bin/tsc", { paths: [root] });

const assertSupportedCompiler = (compilerPath) => {
  const compilerPackage = readJson(
    path.join(path.dirname(compilerPath), "..", "package.json"),
  );
  const majorVersion = Number.parseInt(
    compilerPackage.version.split(".", 1)[0],
    10,
  );

  if (majorVersion !== 6) {
    throw new Error(
      `Expected TypeScript 6 for the ghaRunners SDK, but ${compilerPath} provides ${compilerPackage.version}`,
    );
  }
};

const build = ({ compilerPath, root = packageRoot } = {}) => {
  const packageJsonPath = path.join(root, "package.json");
  const packageJson = readJson(packageJsonPath);
  const dependencies = Object.keys(packageJson.dependencies ?? {}).concat(
    Object.keys(packageJson.devDependencies ?? {}),
  );
  const types = dependencies
    .filter((dependency) => dependency.startsWith("@types/"))
    .map((dependency) => dependency.slice("@types/".length))
    .join(",");
  const compiler = resolveCompiler(root, compilerPath);

  assertSupportedCompiler(compiler);
  execFileSync(
    process.execPath,
    types.length > 0 ? [compiler, "--types", types] : [compiler],
    { cwd: root },
  );

  fs.copyFileSync(packageJsonPath, path.join(root, "bin", "package.json"));
};

if (require.main === module) {
  try {
    build({ compilerPath: parseCompilerArgument(process.argv.slice(2)) });
  } catch (error) {
    console.error("Failed to build the ghaRunners SDK", error);
    process.exitCode = 1;
  }
}

module.exports = {
  assertSupportedCompiler,
  build,
  parseCompilerArgument,
  resolveCompiler,
};
