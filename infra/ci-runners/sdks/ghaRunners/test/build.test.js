const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { build } = require("../scripts/build.js");

const writeCompiler = (root, version, source) => {
  const compilerRoot = path.join(root, "typescript");
  const compilerPath = path.join(compilerRoot, "bin", "tsc");
  fs.mkdirSync(path.dirname(compilerPath), { recursive: true });
  fs.writeFileSync(
    path.join(compilerRoot, "package.json"),
    JSON.stringify({ version }),
  );
  fs.writeFileSync(compilerPath, source);
  return compilerPath;
};

test("build uses the explicitly selected TypeScript 6 compiler", (context) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "gha-runners-build-"));
  context.after(() => fs.rmSync(root, { force: true, recursive: true }));
  const compilerPath = writeCompiler(
    root,
    "6.0.3",
    `require("node:fs").writeFileSync(${JSON.stringify(path.join(root, "invocation.json"))}, JSON.stringify({ args: process.argv.slice(2), cwd: process.cwd() }));`,
  );
  fs.mkdirSync(path.join(root, "bin"));
  fs.writeFileSync(
    path.join(root, "package.json"),
    JSON.stringify({
      dependencies: { "@types/node": "^20", typescript: "^6.0.3" },
    }),
  );

  build({ compilerPath, root });

  assert.deepEqual(
    JSON.parse(fs.readFileSync(path.join(root, "invocation.json"), "utf8")),
    {
      args: ["--types", "node"],
      cwd: root,
    },
  );
  assert.equal(fs.existsSync(path.join(root, "bin", "package.json")), true);
});

test("build rejects a stale TypeScript 4 compiler before execution", (context) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "gha-runners-build-"));
  context.after(() => fs.rmSync(root, { force: true, recursive: true }));
  const compilerPath = writeCompiler(
    root,
    "4.9.5",
    "throw new Error('must not execute');",
  );
  fs.mkdirSync(path.join(root, "bin"));
  fs.writeFileSync(
    path.join(root, "package.json"),
    JSON.stringify({ dependencies: {} }),
  );

  assert.throws(
    () => build({ compilerPath, root }),
    /Expected TypeScript 6 for the ghaRunners SDK, but .* provides 4\.9\.5/,
  );
});

test("the SDK does not compile during dependency installation", () => {
  const packageJson = require("../package.json");

  assert.equal(packageJson.scripts.postinstall, undefined);
});
