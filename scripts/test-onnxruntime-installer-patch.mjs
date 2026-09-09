// Regression proof for the temporary-directory mitigation associated with
// GHSA-vwc7-r8mq-g2x9. Downloads are in-memory fixtures; extraction uses the
// installed ONNX installer and its real adm-zip dependency.
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import * as fs from "node:fs";
import { createRequire } from "node:module";
import * as os from "node:os";
import * as path from "node:path";
import { Readable } from "node:stream";
import { test } from "node:test";
import { runInNewContext } from "node:vm";

const require = createRequire(path.join(process.cwd(), "package.json"));
const packagePath = require.resolve("onnxruntime-node/package.json");
const installerPath = path.join(path.dirname(packagePath), "script/install-utils.js");
const installerRequire = createRequire(installerPath);
const AdmZip = installerRequire("adm-zip");
const source = fs.readFileSync(installerPath, "utf8");
const timestamp = 1700000000000;
const payload = "fixture native binary";

function fixtureResponses(missingEntry) {
  const zip = new AdmZip();
  zip.addFile(missingEntry ? "other.bin" : "native.bin", Buffer.from(payload));
  return new Map([
    [
      "https://fixture.invalid/index.json",
      JSON.stringify({
        resources: [{ "@type": "PackageBaseAddress/3.0.0", "@id": "https://fixture.invalid/packages/" }],
      }),
    ],
    ["https://fixture.invalid/packages/fixture/index.json", JSON.stringify({ versions: ["1.0.0"] })],
    ["https://fixture.invalid/packages/fixture/1.0.0/fixture.1.0.0.nupkg", zip.toBuffer()],
  ]);
}

function fixtureHttps(responses) {
  return {
    get(url, receive) {
      const body = responses.get(url);
      assert.notEqual(body, undefined, `Unexpected fixture request: ${url}`);
      const request = new EventEmitter();
      queueMicrotask(() => {
        const response = Readable.from([body]);
        response.statusCode = 200;
        response.headers = { "content-type": "application/json" };
        receive(response);
      });
      return request;
    },
  };
}

function loadInstaller(root, created, missingEntry) {
  const modules = new Map([
    [
      "fs",
      {
        ...fs,
        mkdtempSync(prefix) {
          const directory = fs.mkdtempSync(prefix);
          created.push({ directory, mode: fs.statSync(directory).mode & 0o777 });
          return directory;
        },
      },
    ],
    ["os", { ...os, tmpdir: () => root }],
    ["https", fixtureHttps(fixtureResponses(missingEntry))],
  ]);
  const module = { exports: {} };
  runInNewContext(
    source,
    {
      module,
      require: (name) => modules.get(name) ?? installerRequire(name),
      console: { log() {}, warn() {} },
      Date: { now: () => timestamp },
      process,
    },
    { filename: installerPath }
  );
  return module.exports.installPackages;
}

async function withExtractionFixture(missingEntry, verify) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "beep-onnx-installer-test-"));
  try {
    const legacy = path.join(root, `onnxruntime-node-pkgs_${timestamp}`);
    const extraction = path.join(legacy, "extracted");
    const victim = path.join(root, "protected.txt");
    fs.mkdirSync(extraction, { recursive: true });
    fs.writeFileSync(victim, "protected");
    fs.symlinkSync(victim, path.join(extraction, "native.bin"));
    const created = [];
    const install = loadInstaller(root, created, missingEntry);
    const packagesInfo = { name: "fixture", versions: [{ feed: "fixture", version: "1.0.0" }] };
    const destination = path.join(root, "output/native.bin");
    const run = () =>
      install(
        [packagesInfo],
        [
          {
            packagesInfo,
            filepath: destination,
            pathInPackage: "native.bin",
          },
        ],
        { fixture: { type: "nuget", index: "https://fixture.invalid/index.json" } }
      );
    await verify({ run, victim, destination, legacy, created });
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

function assertPrivateCleanup(created, legacy) {
  assert.equal(created.length, 1, "Installer must allocate one fresh temporary directory");
  assert.notEqual(created[0].directory, legacy);
  assert.equal(created[0].mode, 0o700, "Extraction workspace must be private");
  assert.equal(fs.existsSync(created[0].directory), false, "Installer must clean its own workspace");
  assert.equal(fs.existsSync(legacy), true, "Installer must leave pre-existing paths alone");
}

test("installer ignores a precreated destination symlink and installs the selected entry", async () => {
  await withExtractionFixture(false, async ({ run, victim, destination, legacy, created }) => {
    await run();
    assert.equal(fs.readFileSync(victim, "utf8"), "protected");
    assert.equal(fs.readFileSync(destination, "utf8"), payload);
    assertPrivateCleanup(created, legacy);
  });
});

test("installer cleans its private workspace when the requested archive entry is missing", async () => {
  await withExtractionFixture(true, async ({ run, victim, destination, legacy, created }) => {
    await assert.rejects(run(), /Failed to find native.bin in NuGet package/);
    assert.equal(fs.readFileSync(victim, "utf8"), "protected");
    assert.equal(fs.existsSync(destination), false);
    assertPrivateCleanup(created, legacy);
  });
});
