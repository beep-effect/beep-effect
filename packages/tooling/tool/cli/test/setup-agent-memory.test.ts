import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readlinkSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const setupScriptPath = fileURLToPath(new URL("../../../../../scripts/setup-agent-memory.sh", import.meta.url));

const writeExecutable = (filePath: string, content: string): void => {
  writeFileSync(filePath, content);
  chmodSync(filePath, 0o755);
};

describe("setup-agent-memory", () => {
  it("resolves a missing relative Effect checkout without GNU realpath", () => {
    const tempDir = mkdtempSync(`${tmpdir()}/setup-agent-memory-test-`);

    try {
      const binDir = `${tempDir}/bin`;
      const repoRoot = `${tempDir}/repo`;
      const storeDir = `${tempDir}/store`;
      const workingDirectory = `${tempDir}/working`;

      for (const directory of [binDir, repoRoot, storeDir, workingDirectory]) {
        mkdirSync(directory, { recursive: true });
      }
      writeExecutable(`${binDir}/uvx`, "#!/bin/sh\nprintf 'beep-shared\\n'\n");
      writeExecutable(`${binDir}/codegraph`, "#!/bin/sh\nexit 0\n");
      writeExecutable(
        `${binDir}/git`,
        '#!/bin/sh\nif [ "$1" = "clone" ]; then\n  for argument do target=$argument; done\n  mkdir -p "$target/.git"\nfi\n'
      );
      writeExecutable(`${binDir}/realpath`, "#!/bin/sh\nprintf 'realpath must not be called\\n' >&2\nexit 91\n");

      const canonicalWorkingDirectory = realpathSync(workingDirectory);
      const expectedEffectRef = `${canonicalWorkingDirectory}/effect-reference`;
      expect(existsSync(expectedEffectRef)).toBe(false);

      const result = Bun.spawnSync(["bash", setupScriptPath, repoRoot], {
        cwd: workingDirectory,
        env: {
          ...process.env,
          BEEP_EFFECT_CHECKOUT: "missing-segment/../effect-reference",
          BEEP_SHARED_STORE: storeDir,
          PATH: `${binDir}:${process.env.PATH ?? ""}`,
        },
        stderr: "pipe",
        stdout: "pipe",
      });

      expect(result.stderr.toString()).toBe("");
      expect(result.exitCode, result.stderr.toString()).toBe(0);
      expect(readlinkSync(`${repoRoot}/.repos/effect`)).toBe(expectedEffectRef);
    } finally {
      rmSync(tempDir, { force: true, recursive: true });
    }
  });
});
