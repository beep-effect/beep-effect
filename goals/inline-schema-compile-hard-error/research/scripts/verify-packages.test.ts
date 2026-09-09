import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import * as S from "effect/Schema";

const Identity = S.Struct({
  head: S.String,
  committedTree: S.String,
  treeDigest: S.String,
  canResume: S.Boolean,
});
const decodeIdentity = S.decodeUnknownSync(S.fromJsonString(Identity));
const runner = join(import.meta.dir, "verify-packages.ts");

test("clean committed changes invalidate package receipts while checkpoint writes do not", () => {
  const fixture = mkdtempSync(join(tmpdir(), "inline-schema-proof-"));
  const research = join(fixture, "goals/inline-schema-compile-hard-error/research");
  const packageManifest = join(fixture, "packages/example/package.json");
  const valuePath = join(fixture, "packages/example/value.txt");
  const run = (command: string[]) => {
    const child = Bun.spawnSync(command, { cwd: fixture, stdout: "pipe", stderr: "pipe" });
    expect(child.exitCode, child.stderr.toString()).toBe(0);
    return child.stdout.toString().trim();
  };
  const identity = () => decodeIdentity(run([process.execPath, runner, "--identity-only", "--resume"]));
  const commit = (message: string) =>
    run([
      "git",
      "-c",
      "user.name=Proof Test",
      "-c",
      "user.email=proof@example.invalid",
      "-c",
      "commit.gpgsign=false",
      "-c",
      "core.hooksPath=/dev/null",
      "commit",
      "-m",
      message,
    ]);
  try {
    mkdirSync(research, { recursive: true });
    mkdirSync(dirname(packageManifest), { recursive: true });
    writeFileSync(join(research, "opening-census.json"), '{"byOwnerFamily":{"@beep/lint-rules":1}}');
    writeFileSync(packageManifest, '{"name":"@beep/lint-rules"}');
    writeFileSync(valuePath, "first implementation\n");
    run(["git", "init", "--quiet"]);
    run(["git", "add", "."]);
    commit("test: initial implementation");
    const first = identity();
    expect(first.head).toBe(run(["git", "rev-parse", "HEAD"]));
    expect(first.committedTree).toBe(run(["git", "rev-parse", "HEAD^{tree}"]));
    expect(first.canResume).toBe(false);

    const reportPath = join(research, "package-verification.json");
    writeFileSync(reportPath, JSON.stringify({ treeDigest: first.treeDigest, results: [] }));
    expect(identity().canResume).toBe(false);
    writeFileSync(reportPath, JSON.stringify({ ...first, results: [] }));
    expect(identity().canResume).toBe(true);

    writeFileSync(valuePath, "changed implementation\n");
    expect(identity().canResume).toBe(false);
    run(["git", "add", "packages/example/value.txt"]);
    commit("test: change committed implementation");
    expect(run(["git", "diff", "HEAD"])).toBe("");
    const changed = identity();
    expect(changed.committedTree).not.toBe(first.committedTree);
    expect(changed.treeDigest).not.toBe(first.treeDigest);
    expect(changed.canResume).toBe(false);
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});
