import { describe, expect, it } from "vitest";

const bucketNames = ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"] as const;

const repoRoot = decodeURIComponent(new URL("../../../../..", import.meta.url).pathname);

const workspaceDependencyNames = (packageJson: {
  readonly dependencies?: Readonly<Record<string, string>>;
  readonly devDependencies?: Readonly<Record<string, string>>;
  readonly peerDependencies?: Readonly<Record<string, string>>;
  readonly optionalDependencies?: Readonly<Record<string, string>>;
}): ReadonlyArray<string> => [
  ...Object.keys(packageJson.dependencies ?? {}),
  ...Object.keys(packageJson.devDependencies ?? {}),
  ...Object.keys(packageJson.peerDependencies ?? {}),
  ...Object.keys(packageJson.optionalDependencies ?? {}),
];

describe("topo-sort", () => {
  it("prints workspace package names in dependency order", async () => {
    const result = Bun.spawnSync({
      cmd: ["bun", "packages/tooling/tool/cli/src/bin.ts", "topo-sort"],
      cwd: repoRoot,
      stderr: "pipe",
      stdout: "pipe",
    });
    const stdout = new TextDecoder().decode(result.stdout);
    const lines = stdout
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith("$"));
    const repoCli = await Bun.file(`${repoRoot}/packages/tooling/tool/cli/package.json`).json();
    const repoCliAt = lines.indexOf("@beep/repo-cli");

    expect(result.exitCode).toBe(0);
    expect(lines.length).toBeGreaterThan(0);
    for (const bucketName of bucketNames) {
      expect(lines).not.toContain(bucketName);
    }
    for (const line of lines) {
      expect(line.includes(" ")).toBe(false);
    }
    expect(repoCliAt).toBeGreaterThanOrEqual(0);
    expect(lines).not.toContain("@beep/root");
    for (const dependencyName of workspaceDependencyNames(repoCli)) {
      if (!dependencyName.startsWith("@beep/")) continue;
      const dependencyAt = lines.indexOf(dependencyName);
      expect(dependencyAt).toBeGreaterThanOrEqual(0);
      expect(dependencyAt).toBeLessThan(repoCliAt);
    }
  });
});
