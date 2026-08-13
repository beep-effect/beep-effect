const assert = require("node:assert/strict");
const path = require("node:path");

const buildDirectory = process.argv[2];
assert.ok(buildDirectory, "expected the build directory argument");

for (const filename of ["index.cjs", "authorizer.cjs", "writer.cjs"]) {
  const bundle = require(path.join(buildDirectory, filename));
  assert.equal(typeof bundle.handler, "function", `${filename} must export handler`);
}

console.log("Bundle smoke: 3/3 handlers export functions");
