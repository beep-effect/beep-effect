import {
  McpbLaunch,
  McpbManifest,
  McpbManifestFields,
  McpbPackageFailure,
  McpbPackageSpec,
  McpbPrompt,
  McpbTool,
  McpbUserConfigField,
  makeMcpbPackageCommand,
  mcpbCompiledLaunch,
  mcpbManifest,
  mcpbTargetSpec,
  mcpbWindowsRuntime,
} from "@beep/mcpb-kit";
import * as BunServices from "@effect/platform-bun/BunServices";
import { describe, expect, it, layer } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const McpbManifestJson = S.fromJsonString(McpbManifest, { space: 2 });

const fields = McpbManifestFields.make({
  name: "beep-example",
  displayName: "Beep Example",
  version: "0.1.0",
  description: "An example server.",
  env: { ZETA: "z", DATA_DIR: "${user_config.data_dir}" },
  userConfig: {
    data_dir: McpbUserConfigField.make({
      type: "directory",
      title: "Data folder",
      description: "Folder the server reads.",
      required: true,
    }),
  },
  tools: [McpbTool.make({ name: "find", description: "Find things." })],
});

const spec = McpbPackageSpec.make({
  appName: "example-mcp",
  commandName: "example-package",
  repoRoot: "/repo",
  forbiddenArchiveFragments: ["src/"],
  manifest: fields,
});

describe("mcpbTargetSpec", () => {
  it("compiles the Linux executable named after the app", () => {
    const linux = mcpbTargetSpec("linux-x64", "example-mcp");
    expect(linux.launch).toEqual({ kind: "compiled", bunTarget: "bun-linux-x64", executable: "example-mcp" });
    expect(linux.nativePackage).toBe("node-bindings-linux-x64");
    expect(linux.platform).toBe("linux");
  });

  it("ships the pinned runtime, a script and the win32 bindings for Windows", () => {
    const windows = mcpbTargetSpec("example-mcp")("windows-x64");
    expect(windows.launch).toEqual({
      kind: "runtime-script",
      runtime: mcpbWindowsRuntime,
      runtimeArgs: ["--no-env-file"],
      script: "example-mcp.js",
    });
    expect(windows.nativePackage).toBe("node-bindings-win32-x64");
    expect(windows.platform).toBe("win32");
  });

  it("never compiles an executable into a Windows bundle", () => {
    expect(McpbLaunch.guards.compiled(mcpbTargetSpec("windows-x64", "example-mcp").launch)).toBe(false);
  });
});

describe("mcpbCompiledLaunch", () => {
  it("adds .exe to a Windows executable", () => {
    expect(mcpbCompiledLaunch("windows-x64", "example-setup")).toEqual({
      kind: "compiled",
      bunTarget: "bun-windows-x64",
      executable: "example-setup.exe",
    });
    expect(mcpbCompiledLaunch("example-setup")("linux-x64").executable).toBe("example-setup");
  });
});

describe("mcpbWindowsRuntime", () => {
  it("pins the official Windows release archive by sha256", () => {
    expect(mcpbWindowsRuntime.asset).toBe("bun-windows-x64");
    expect(mcpbWindowsRuntime.executable).toBe("bun.exe");
    expect(mcpbWindowsRuntime.sha256).toMatch(/^[0-9a-f]{64}$/);
  });
});

layer(BunServices.layer, { timeout: "30 seconds" })("the pinned Windows runtime", (it) => {
  it.effect("names the Bun version the repository pins in .bun-version", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      // The checked-in file itself: a Bun bump that leaves the pin behind fails here.
      const versionFile = yield* fs.realPath(path.resolve(import.meta.dirname, "../../../../../.bun-version"));
      const repoVersion = yield* fs.readFileString(versionFile);
      expect(mcpbWindowsRuntime.version).toBe(Str.trim(repoVersion));
    })
  );
});

describe("mcpbManifest", () => {
  it("launches the bundled runtime with the script on Windows", () => {
    const manifest = mcpbManifest(fields, mcpbTargetSpec("windows-x64", spec.appName));
    expect(manifest.compatibility.platforms).toEqual(["win32"]);
    expect(manifest.server.type).toBe("binary");
    expect(manifest.server.entry_point).toBe("bun.exe");
    expect(manifest.server.mcp_config.command).toBe("${__dirname}/bun.exe");
    expect(manifest.server.mcp_config.args).toEqual(["--no-env-file", "${__dirname}/example-mcp.js"]);
    expect(R.keys(manifest.server.mcp_config.env)).toEqual(["DATA_DIR", "NODE_PATH", "ZETA"]);
    expect(manifest.server.mcp_config.env.NODE_PATH).toBe("${__dirname}/node_modules");
    expect(manifest.user_config.data_dir).toEqual({
      type: "directory",
      title: "Data folder",
      description: "Folder the server reads.",
      required: true,
    });
    expect(manifest.tools).toEqual([{ name: "find", description: "Find things." }]);
    expect("prompts" in manifest).toBe(false);
  });

  it("launches the compiled executable without arguments on Linux", () => {
    const manifest = mcpbManifest(fields, mcpbTargetSpec("linux-x64", spec.appName));
    expect(manifest.compatibility.platforms).toEqual(["linux"]);
    expect(manifest.server.entry_point).toBe("example-mcp");
    expect(manifest.server.mcp_config.command).toBe("${__dirname}/example-mcp");
    expect("args" in manifest.server.mcp_config).toBe(false);
    expect(manifest.server.mcp_config.env.NODE_PATH).toBe("${__dirname}/node_modules");
  });

  it("writes declared prompts after the tools", () => {
    const withPrompt = McpbManifestFields.make({
      ...fields,
      prompts: [McpbPrompt.make({ name: "onboard", description: "Set up.", text: "Follow the steps." })],
    });
    const manifest = mcpbManifest(withPrompt, mcpbTargetSpec("linux-x64", spec.appName));
    expect(manifest.prompts).toEqual([{ name: "onboard", description: "Set up.", text: "Follow the steps." }]);
  });

  it.effect("encodes as two-space JSON in manifest field order", () =>
    Effect.gen(function* () {
      const json = yield* S.encodeEffect(McpbManifestJson)(
        mcpbManifest(fields, mcpbTargetSpec("linux-x64", spec.appName))
      );
      expect(Str.startsWith('{\n  "manifest_version": "0.3",\n  "name": "beep-example",\n  "display_name"')(json)).toBe(
        true
      );
    })
  );

  it.effect("writes the Windows launch as command, args, then env", () =>
    Effect.gen(function* () {
      const json = yield* S.encodeEffect(McpbManifestJson)(
        mcpbManifest(fields, mcpbTargetSpec("windows-x64", spec.appName))
      );
      expect(json).toContain(
        A.join(
          [
            '    "mcp_config": {',
            '      "command": "${__dirname}/bun.exe",',
            '      "args": [',
            '        "--no-env-file",',
            '        "${__dirname}/example-mcp.js"',
            "      ],",
            '      "env": {',
          ],
          "\n"
        )
      );
    })
  );
});

describe("makeMcpbPackageCommand", () => {
  it("names the packaging command", () => {
    expect(makeMcpbPackageCommand(spec).name).toBe("example-package");
  });
});

describe("McpbPackageFailure", () => {
  it("ignores the cause when comparing failures", () => {
    const same = S.toEquivalence(McpbPackageFailure);
    const first = McpbPackageFailure.make({ cause: { diagnostic: "first" }, message: "Packaging failed." });
    const second = McpbPackageFailure.make({ cause: { diagnostic: "second" }, message: "Packaging failed." });
    const different = McpbPackageFailure.make({ message: "Packaging timed out." });
    expect(same(first, second)).toBe(true);
    expect(same(first, different)).toBe(false);
  });
});
