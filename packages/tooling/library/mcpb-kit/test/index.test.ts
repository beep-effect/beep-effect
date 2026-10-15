import {
  McpbManifest,
  McpbManifestFields,
  McpbPackageFailure,
  McpbPackageSpec,
  McpbPrompt,
  McpbTool,
  McpbUserConfigField,
  makeMcpbPackageCommand,
  mcpbManifest,
  mcpbTargetSpec,
} from "@beep/mcpb-kit";
import { describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

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
  it("names the Linux executable after the app", () => {
    const linux = mcpbTargetSpec("linux-x64", "example-mcp");
    expect(linux.executable).toBe("example-mcp");
    expect(linux.bunTarget).toBe("bun-linux-x64");
    expect(linux.nativePackage).toBe("node-bindings-linux-x64");
    expect(linux.platform).toBe("linux");
  });

  it("adds .exe and the win32 bindings for Windows", () => {
    const windows = mcpbTargetSpec("example-mcp")("windows-x64");
    expect(windows.executable).toBe("example-mcp.exe");
    expect(windows.bunTarget).toBe("bun-windows-x64");
    expect(windows.nativePackage).toBe("node-bindings-win32-x64");
    expect(windows.platform).toBe("win32");
  });
});

describe("mcpbManifest", () => {
  it("writes the shared fields, the bundled command and sorted environment", () => {
    const manifest = mcpbManifest(fields, mcpbTargetSpec("windows-x64", spec.appName));
    expect(manifest.compatibility.platforms).toEqual(["win32"]);
    expect(manifest.server.entry_point).toBe("example-mcp.exe");
    expect(manifest.server.mcp_config.command).toBe("${__dirname}/example-mcp.exe");
    expect(Object.keys(manifest.server.mcp_config.env)).toEqual(["DATA_DIR", "NODE_PATH", "ZETA"]);
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
      const json = yield* S.encodeEffect(S.fromJsonString(McpbManifest, { space: 2 }))(
        mcpbManifest(fields, mcpbTargetSpec("linux-x64", spec.appName))
      );
      expect(json.startsWith('{\n  "manifest_version": "0.3",\n  "name": "beep-example",\n  "display_name"')).toBe(
        true
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
