import { describe, expect, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as R from "effect/Record";

const bucketNames = ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"] as const;

const repoRoot = decodeURIComponent(new URL("../../../../..", import.meta.url).pathname);

const workspaceDependencyNames = (packageJson: {
  readonly dependencies?: Readonly<Record<string, string>>;
  readonly devDependencies?: Readonly<Record<string, string>>;
  readonly peerDependencies?: Readonly<Record<string, string>>;
  readonly optionalDependencies?: Readonly<Record<string, string>>;
}): ReadonlyArray<string> => [
  ...R.keys(packageJson.dependencies ?? {}),
  ...R.keys(packageJson.devDependencies ?? {}),
  ...R.keys(packageJson.peerDependencies ?? {}),
  ...R.keys(packageJson.optionalDependencies ?? {}),
];

describe("topo-sort", () => {
  it.effect(
    "prints workspace package names in dependency order",
    Effect.fnUntraced(function* () {
      const result = Bun.spawnSync({
        cmd: ["bun", "packages/tooling/tool/cli/src/bin.ts", "topo-sort"],
        cwd: repoRoot,
        stderr: "pipe",
        stdout: "pipe",
      });
      const stdout = new TextDecoder().decode(result.stdout);
      const lines = A.filter(
        A.map(stdout.split("\n"), (line) => line.trim()),
        (line) => line.length > 0 && !line.startsWith("$")
      );
      const repoCli = yield* Effect.promise(() =>
        Bun.file(`${repoRoot}/packages/tooling/tool/cli/package.json`).json()
      );
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
    })
  );
});
