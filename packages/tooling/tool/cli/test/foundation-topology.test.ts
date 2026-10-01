import { fileURLToPath } from "node:url";
import { it } from "@beep/test-runner";
import { A, Str } from "@beep/utils";
import { describe, expect } from "@effect/vitest";
import { Effect } from "effect";

const repoRoot = Str.replace(/\/$/u, "")(fileURLToPath(new URL("../../../../..", import.meta.url)));
const joinPath = (base: string, ...segments: ReadonlyArray<string>): string =>
  [Str.replace(/\/+$/u, "")(base), ...segments.map((segment) => Str.replace(/^\/+|\/+$/gu, "")(segment))]
    .filter((segment) => segment.length > 0)
    .join("/");
const relativeToRepo = (path: string): string =>
  Str.startsWith(`${repoRoot}/`)(path) ? Str.replace(`${repoRoot}/`, "")(path) : path;
const pathExistsSync = (path: string): boolean =>
  Bun.spawnSync(["test", "-e", path], { stderr: "ignore", stdout: "ignore" }).exitCode === 0;

const readJsonFile = (path: string) => Effect.promise(() => Bun.file(path).json() as Promise<unknown>);

const packageJsonPathsUnder = (directory: string): ReadonlyArray<string> =>
  Array.from(new Bun.Glob("**/package.json").scanSync({ absolute: true, cwd: directory }));

const isCanonicalToolingPackageRoot = (packageJsonPath: string): boolean =>
  /^packages\/tooling\/[^/]+\/[^/]+\/package\.json$/u.test(relativeToRepo(packageJsonPath));

describe("foundation package topology", () => {
  it.effect("keeps foundation packages canonical and leaves no legacy common workspace", () =>
    Effect.gen(function* () {
      const rootPackage = (yield* readJsonFile(joinPath(repoRoot, "package.json"))) as {
        readonly workspaces?: ReadonlyArray<string>;
      };

      expect(rootPackage.workspaces).toEqual(
        expect.arrayContaining([
          "packages/foundation/capability/*",
          "packages/foundation/modeling/*",
          "packages/foundation/primitive/*",
          "packages/foundation/ui-system/*",
        ])
      );
      expect(rootPackage.workspaces).not.toContain("packages/common/*");
      expect(pathExistsSync(joinPath(repoRoot, "packages", "common"))).toBe(false);

      const packageJsonPaths = packageJsonPathsUnder(joinPath(repoRoot, "packages", "foundation"));
      expect(packageJsonPaths.length).toBeGreaterThan(0);

      for (const packageJsonPath of packageJsonPaths) {
        const workspacePath = Str.replace(/\/package\.json$/u, "")(relativeToRepo(packageJsonPath));
        const [, family, kind] = Str.split("/")(workspacePath);
        const packageJson = (yield* readJsonFile(packageJsonPath)) as {
          readonly name?: string;
          readonly homepage?: string;
          readonly repository?: {
            readonly directory?: string;
          };
          readonly beep?: {
            readonly family?: string;
            readonly kind?: string;
          };
        };

        expect(family, `${workspacePath} family segment`).toBe("foundation");
        expect(packageJson.beep, `${workspacePath} beep metadata`).toEqual({
          family: "foundation",
          kind,
        });
        expect(packageJson.repository?.directory, `${workspacePath} repository.directory`).toBe(workspacePath);
        expect(packageJson.homepage, `${workspacePath} homepage`).toMatch(new RegExp(`/${workspacePath}$`, "u"));
      }
    })
  );
});

describe("tooling package topology", () => {
  it.effect("keeps tooling packages canonical and leaves no legacy tooling workspace", () =>
    Effect.gen(function* () {
      const rootPackage = (yield* readJsonFile(joinPath(repoRoot, "package.json"))) as {
        readonly workspaces?: ReadonlyArray<string>;
      };

      expect(rootPackage.workspaces).toEqual(
        expect.arrayContaining([
          "packages/tooling/library/*",
          "packages/tooling/policy-pack/*",
          "packages/tooling/test-kit/*",
          "packages/tooling/tool/*",
        ])
      );
      expect(rootPackage.workspaces).not.toEqual(expect.arrayContaining(["tooling/cli", "tooling/repo-checks"]));
      expect(pathExistsSync(joinPath(repoRoot, "tooling"))).toBe(false);

      const packageJsonPaths = A.filter(
        packageJsonPathsUnder(joinPath(repoRoot, "packages", "tooling")),
        isCanonicalToolingPackageRoot
      );
      expect(packageJsonPaths.length).toBeGreaterThan(0);

      for (const packageJsonPath of packageJsonPaths) {
        const workspacePath = Str.replace(/\/package\.json$/u, "")(relativeToRepo(packageJsonPath));
        const [, family, kind] = Str.split("/")(workspacePath);
        const packageJson = (yield* readJsonFile(packageJsonPath)) as {
          readonly homepage?: string;
          readonly repository?: {
            readonly directory?: string;
          };
          readonly beep?: {
            readonly family?: string;
            readonly kind?: string;
          };
        };

        expect(family, `${workspacePath} family segment`).toBe("tooling");
        expect(packageJson.beep, `${workspacePath} beep metadata`).toEqual({
          family: "tooling",
          kind,
        });
        expect(packageJson.repository?.directory, `${workspacePath} repository.directory`).toBe(workspacePath);
        expect(packageJson.homepage, `${workspacePath} homepage`).toMatch(new RegExp(`/${workspacePath}$`, "u"));
      }
    })
  );
});
