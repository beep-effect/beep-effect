/**
 * Sequential package-verification matrix for the inline compiler migration.
 *
 * The runner checkpoints after every package and resumes only when the owned
 * source-tree fingerprint is unchanged.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import * as A from "effect/Array";
import * as Order from "effect/Order";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const Census = S.Struct({ byOwnerFamily: S.Record(S.String, S.Number) });
const PackageManifest = S.Struct({ name: S.String });
const PreviousReport = S.Struct({
  committedTree: S.String,
  treeDigest: S.String,
  results: S.Array(
    S.Struct({
      packageName: S.String,
      ok: S.Boolean,
      exitCode: S.Number,
      durationMillis: S.Number,
      output: S.String,
    })
  ),
});
const decodeCensus = S.decodeUnknownSync(S.fromJsonString(Census));
const decodePackageManifest = S.decodeUnknownSync(S.fromJsonString(PackageManifest));
const decodePreviousReport = S.decodeUnknownOption(S.fromJsonString(PreviousReport));
const decodeGitIdentity = S.decodeUnknownSync(S.Tuple([S.NonEmptyString, S.NonEmptyString]));

const run = (cwd: string, command: ReadonlyArray<string>) =>
  Bun.spawnSync(A.fromIterable(command), { cwd, stdout: "pipe", stderr: "pipe" });

const repoRoot = run(process.cwd(), ["git", "rev-parse", "--show-toplevel"]).stdout.toString().trim();
const identity = run(repoRoot, ["git", "rev-parse", "HEAD", "HEAD^{tree}"]);
if (identity.exitCode !== 0) throw new Error("Cannot identify the committed package-verification tree.");
const [head, committedTree] = decodeGitIdentity(identity.stdout.toString().trim().split("\n"));
const goalRoot = resolve(repoRoot, "goals/inline-schema-compile-hard-error");
const census = decodeCensus(readFileSync(resolve(goalRoot, "research/opening-census.json"), "utf8"));
const reportPath = resolve(goalRoot, "research/package-verification.json");
const packageNames = A.sort(A.dedupe([...Object.keys(census.byOwnerFamily), "@beep/lint-rules"]), Order.String);
const packageRoots = new Map(
  A.map(
    A.filter(Str.split("\n")(run(repoRoot, ["git", "ls-files", "**/package.json"]).stdout.toString()), Str.isNonEmpty),
    (manifestPath) => {
      const manifest = decodePackageManifest(readFileSync(resolve(repoRoot, manifestPath), "utf8"));
      return [manifest.name, dirname(resolve(repoRoot, manifestPath))] as const;
    }
  )
);
const missingPackageRoots = A.filter(packageNames, (packageName) => !packageRoots.has(packageName));
if (!A.isReadonlyArrayEmpty(missingPackageRoots)) {
  throw new Error(`No package root found for: ${A.join(missingPackageRoots, ", ")}`);
}

const diff = run(repoRoot, [
  "git",
  "diff",
  "--binary",
  "HEAD",
  "--",
  ".",
  ":(exclude)goals/inline-schema-compile-hard-error/**",
]).stdout;
const untracked = run(repoRoot, ["git", "ls-files", "--others", "--exclude-standard"])
  .stdout.toString()
  .split("\n")
  .filter(
    (filename) =>
      filename.length > 0 &&
      !filename.startsWith("goals/inline-schema-compile-hard-error/") &&
      !filename.startsWith("scratchpad/semantica-ir/")
  )
  .sort();
const hasher = new Bun.CryptoHasher("sha256");
hasher.update("inline-schema-package-verification/v2\n");
hasher.update(committedTree);
hasher.update(readFileSync(import.meta.filename));
hasher.update(JSON.stringify(packageNames));
hasher.update(diff);
for (const filename of untracked) {
  hasher.update(filename);
  hasher.update(readFileSync(resolve(repoRoot, filename)));
}
const treeDigest = hasher.digest("hex");

const previous = existsSync(reportPath)
  ? decodePreviousReport(readFileSync(reportPath, "utf8"))
  : { _tag: "None" as const };
const canResume =
  process.argv.includes("--resume") &&
  previous._tag === "Some" &&
  previous.value.committedTree === committedTree &&
  previous.value.treeDigest === treeDigest;
const results = canResume ? [...previous.value.results] : [];
const completed = new Set(
  A.map(
    A.filter(results, (result) => result.ok),
    (result) => result.packageName
  )
);
const startedAt = new Date().toISOString();

const checkpoint = (): void => {
  const currentHead = run(repoRoot, ["git", "rev-parse", "HEAD"]);
  if (currentHead.exitCode !== 0 || currentHead.stdout.toString().trim() !== head) {
    throw new Error("HEAD changed during package verification; refusing to relabel mixed-tree results.");
  }
  const failures = A.filter(results, (result) => !result.ok);
  writeFileSync(
    reportPath,
    `${JSON.stringify(
      {
        schemaVersion: "inline-schema-package-verification/v2",
        head,
        committedTree,
        treeDigest,
        startedAt,
        updatedAt: new Date().toISOString(),
        summary: {
          expected: packageNames.length,
          completed: results.length,
          passed: results.length - failures.length,
          failed: failures.length,
        },
        results,
      },
      null,
      2
    )}\n`
  );
};

if (process.argv.includes("--identity-only")) {
  process.stdout.write(`${JSON.stringify({ head, committedTree, treeDigest, canResume })}\n`);
} else if (process.argv.includes("--list")) {
  process.stdout.write(`${A.join(packageNames, "\n")}\n`);
} else {
  for (const [index, packageName] of packageNames.entries()) {
    if (completed.has(packageName)) {
      process.stdout.write(`[${index + 1}/${packageNames.length}] resume ${packageName}\n`);
      continue;
    }

    process.stdout.write(`[${index + 1}/${packageNames.length}] verify ${packageName}\n`);
    const started = performance.now();
    const packageRoot = packageRoots.get(packageName);
    if (packageRoot === undefined) throw new Error(`No package root found for ${packageName}`);
    const refresh = run(repoRoot, ["bunx", "tsc", "-b", resolve(packageRoot, "tsconfig.json"), "--force"]);
    const child = run(repoRoot, ["bun", "run", "beep", "quality", "package-verify", packageName]);
    const refreshOutput =
      refresh.exitCode === 0
        ? ""
        : `-------- project-reference refresh (non-authoritative) --------\n${refresh.stdout.toString()}${refresh.stderr.toString()}\n`;
    const output = Str.replaceAll(
      repoRoot,
      "."
    )(`${child.exitCode === 0 ? "" : refreshOutput}${child.stdout.toString()}${child.stderr.toString()}`);
    const result = {
      packageName,
      ok: child.exitCode === 0,
      exitCode: child.exitCode,
      durationMillis: Math.round(performance.now() - started),
      output: child.exitCode === 0 ? A.join(A.takeRight(output.trim().split("\n"), 3), "\n") : output,
    };
    const priorIndex = results.findIndex((entry) => entry.packageName === packageName);
    if (priorIndex === -1) results.push(result);
    else results[priorIndex] = result;
    checkpoint();
    process.stdout.write(`${result.ok ? "pass" : "FAIL"} ${packageName} (${result.durationMillis}ms)\n`);
    if (!result.ok) break;
  }

  checkpoint();
  const failures = A.filter(results, (result) => !result.ok);
  process.stdout.write(
    `complete=${results.length} passed=${results.length - failures.length} failed=${failures.length}\n`
  );
  process.exitCode = A.isReadonlyArrayEmpty(failures) ? 0 : 1;
}
