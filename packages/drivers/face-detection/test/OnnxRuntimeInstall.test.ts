import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import * as fs from "node:fs";
import { createRequire } from "node:module";
import * as os from "node:os";
import * as path from "node:path";
import { PassThrough } from "node:stream";
import { Script } from "node:vm";
import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import { strToU8, zipSync } from "fflate";

const require = createRequire(import.meta.url);
const installerPath = path.resolve(path.dirname(require.resolve("onnxruntime-node")), "../script/install-utils.js");
const installerRequire = createRequire(installerPath);
const packageInfo = { name: "Test.Runtime", versions: [{ feed: "test", version: "1.0.0" }] };
const entry = "runtimes/linux-x64/native/libonnxruntime.so";
const binary = strToU8("test native binary");
const timestamp = 1_754_546_950;

type InstallPackages = (
  packages: ReadonlyArray<typeof packageInfo>,
  manifests: ReadonlyArray<{ packagesInfo: typeof packageInfo; pathInPackage: string; filepath: string }>,
  feeds: Record<string, { type: string; index: string }>
) => Promise<void>;

describe("ONNX Runtime's patched NuGet installer", { concurrent: false }, () => {
  let root: string;
  let temp: string;
  let destination: string;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "beep-onnx-installer-test-"));
    temp = path.join(root, "tmp");
    fs.mkdirSync(temp);
    destination = path.join(root, "bin", "libonnxruntime.so");
  });

  afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

  // Exercise the installed upstream script with real ZIP bytes and real filesystem
  // operations. Only NuGet's HTTP responses, the temp root, and the clock are fake.
  const install = async (archive: Uint8Array) => {
    const module: { exports: { installPackages?: InstallPackages } } = { exports: {} };
    const https = {
      get: (url: string, receive: (response: PassThrough) => void) => {
        const response = Object.assign(new PassThrough(), {
          statusCode: 200,
          headers: { "content-type": "application/json" },
        });
        const payload = url.endsWith(".nupkg")
          ? archive
          : JSON.stringify(
              url === "https://test.invalid/index.json"
                ? { resources: [{ "@type": "PackageBaseAddress/3.0.0", "@id": "https://test.invalid/packages/" }] }
                : { versions: ["1.0.0"] }
            );
        queueMicrotask(() => {
          receive(response);
          response.end(payload);
        });
        return new EventEmitter();
      },
    };
    new Script(fs.readFileSync(installerPath, "utf8"), { filename: installerPath }).runInNewContext({
      module,
      require: (id: string) => {
        switch (id) {
          case "https":
            return https;
          case "os":
            return { tmpdir: () => temp };
          default:
            return installerRequire(id);
        }
      },
      console: { log: () => {}, warn: () => {} },
      Date: { now: () => timestamp },
    });
    assert(module.exports.installPackages);
    await module.exports.installPackages(
      [packageInfo],
      [{ packagesInfo: packageInfo, pathInPackage: entry, filepath: destination }],
      { test: { type: "nuget", index: "https://test.invalid/index.json" } }
    );
  };

  it("loads fflate through the narrowly scoped installer dependency", () => {
    expect(installerRequire("adm-zip/package.json").name).toBe("fflate");
    expect(installerRequire("onnxruntime-node/package.json").version).toBe("1.29.0");
  });

  it("installs the selected binary and replaces an existing binary", async () => {
    await install(zipSync({ [entry]: binary }));
    expect(fs.readFileSync(destination)).toEqual(Buffer.from(binary));
    await install(zipSync({ [entry]: strToU8("updated binary") }));
    expect(fs.readFileSync(destination, "utf8")).toBe("updated binary");
    expect(fs.readdirSync(temp)).toEqual([]);
    expect(fs.readdirSync(path.dirname(destination))).toEqual(["libonnxruntime.so"]);
  });

  it("does not follow a symlink planted at the former predictable extraction path", async () => {
    const sentinel = path.join(root, "sentinel");
    fs.writeFileSync(sentinel, "untouched");
    const planted = path.join(temp, `onnxruntime-node-pkgs_${timestamp}`, "extracted");
    fs.mkdirSync(planted, { recursive: true });
    fs.symlinkSync(sentinel, path.join(planted, "libonnxruntime.so"));

    await install(zipSync({ [entry]: binary }));

    expect(fs.readFileSync(sentinel, "utf8")).toBe("untouched");
    expect(fs.readFileSync(destination)).toEqual(Buffer.from(binary));
    expect(fs.readdirSync(temp)).toEqual([`onnxruntime-node-pkgs_${timestamp}`]);
  });

  it("replaces a destination symlink without overwriting the linked file", async () => {
    const sentinel = path.join(root, "sentinel");
    fs.writeFileSync(sentinel, "untouched");
    fs.mkdirSync(path.dirname(destination));
    fs.symlinkSync(sentinel, destination);

    await install(zipSync({ [entry]: binary }));

    expect(fs.readFileSync(sentinel, "utf8")).toBe("untouched");
    expect(fs.lstatSync(destination).isSymbolicLink()).toBe(false);
    expect(fs.readFileSync(destination)).toEqual(Buffer.from(binary));
  });

  it("ignores archive paths outside the selected manifest entry", async () => {
    await install(zipSync({ [entry]: binary, "../../escaped": strToU8("unwanted") }));
    expect(fs.readdirSync(root).sort()).toEqual(["bin", "tmp"]);
    expect(fs.readdirSync(temp)).toEqual([]);
    expect(fs.readdirSync(path.dirname(destination))).toEqual(["libonnxruntime.so"]);
  });

  it("rejects missing entries and cleans up the download", async () => {
    await expect(install(zipSync({ other: binary }))).rejects.toThrow(`Failed to find ${entry}`);
    expect(fs.existsSync(destination)).toBe(false);
    expect(fs.readdirSync(temp)).toEqual([]);
  });

  it("rejects corrupt archives and cleans up the download", async () => {
    await expect(install(strToU8("not a ZIP archive"))).rejects.toThrow("Failed to open NuGet package");
    expect(fs.existsSync(destination)).toBe(false);
    expect(fs.readdirSync(temp)).toEqual([]);
  });
});
