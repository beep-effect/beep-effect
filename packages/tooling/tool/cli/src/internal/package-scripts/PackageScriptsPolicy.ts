/**
 * Workspace scripts policy with lossless free-tier repairs.
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import { FsUtils, jsonStringifyPretty, resolveWorkspaceDirs } from "@beep/repo-utils";
import { Context, Effect, FileSystem, Match, Path } from "effect";
import * as A from "effect/Array";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { isDoctestSourcePath } from "../jsdoc/DoctestSource.ts";
import {
  CodegenGeneratorPackage,
  implScriptDefaults,
  PackageKind,
  PackageScriptsReport,
  ScriptsBlock,
  scriptsBlockFromRecord,
  TaskScriptName,
  taskScriptRules,
} from "./PackageScripts.schemas.ts";
import type { PackageScriptsDrift, TaskScriptRule } from "./PackageScripts.schemas.ts";

const $I = $RepoCliId.create("internal/package-scripts/PackageScriptsPolicy");

/**
 * Filesystem or decoding failure while evaluating the workspace policy.
 * **Example** (Describe a policy failure)
 * ```ts
 * import { PackageScriptsPolicyError } from "@beep/repo-cli/test/PackageScripts"
 * console.log(PackageScriptsPolicyError.make({ message: "Invalid manifest", cause: "invalid JSON" }).message)
 * ```
 * @category errors
 * @since 0.0.0
 */
export class PackageScriptsPolicyError extends S.TaggedError<PackageScriptsPolicyError>()(
  $I`PackageScriptsPolicyError`,
  {
    message: S.String,
    cause: S.Defect({ includeStack: true }),
  }
) {}

/**
 * Manifest-path evidence for derived task presence; expected receives a single-manifest projection.
 * **Example** (Represent an empty census)
 * ```ts
 * import { DerivationEvidence } from "@beep/repo-cli/test/PackageScripts"
 * import * as HashSet from "effect/HashSet"
 * const evidence = DerivationEvidence.make({ doctestOwners: HashSet.empty(), bypassingConfigs: HashSet.empty(), generators: HashSet.empty() })
 * console.log(HashSet.size(evidence.doctestOwners)) // 0
 * ```
 * @category models
 * @since 0.0.0
 */
export class DerivationEvidence extends S.Class<DerivationEvidence>($I`DerivationEvidence`)(
  { doctestOwners: S.HashSet(S.String), bypassingConfigs: S.HashSet(S.String), generators: S.HashSet(S.String) },
  $I.annote("DerivationEvidence", {
    description: "Derived task membership keyed by repository-relative manifest path.",
  })
) {}

/**
 * Pure block evaluation and effectful workspace policy operations.
 * @category ports
 * @since 0.0.0
 */
export interface PackageScriptsPolicyShape {
  readonly check: (repoRoot: string) => Effect.Effect<PackageScriptsReport, PackageScriptsPolicyError>;
  readonly diff: (actual: ScriptsBlock, expected: ScriptsBlock) => ReadonlyArray<PackageScriptsDrift>;
  readonly expected: (kind: PackageKind, actual: ScriptsBlock, evidence: DerivationEvidence) => ScriptsBlock;
  readonly kindOf: (manifestPath: string) => Effect.Effect<PackageKind, PackageScriptsPolicyError>;
  readonly rules: (kind: PackageKind) => ReadonlyArray<TaskScriptRule>;
  readonly write: (repoRoot: string) => Effect.Effect<PackageScriptsReport, PackageScriptsPolicyError>;
}

const policyError = (message: string) => (cause: unknown) => PackageScriptsPolicyError.make({ message, cause });
const rulesFor = (kind: PackageKind) => A.filter(taskScriptRules, (rule) => rule.kind === kind);
const placeholder = S.String.check(S.isPattern(/(?:echo ['"]no codegen needed['"]|will be implemented)/u));
const isPlaceholder = S.is(placeholder);
const kindForDirectory = (dir: string): PackageKind =>
  Match.value(dir).pipe(
    Match.when(Str.startsWith("apps/labs/"), () => "lab" as const),
    Match.when(Str.startsWith("apps/"), () => "app" as const),
    Match.when(Str.startsWith("packages/tooling/tool/"), () => "tool" as const),
    Match.when(Str.startsWith("packages/ecosystem/"), () => "ecosystem" as const),
    Match.when("infra", () => "infra" as const),
    Match.when("scratchpad", () => "exempt" as const),
    Match.when(Str.startsWith("tools/"), () => "exempt" as const),
    Match.orElse(() => "library" as const)
  );

const expectedBlock: PackageScriptsPolicyShape["expected"] = (kind, actual, evidence) => {
  if (PackageKind.is.exempt(kind)) return actual;
  let tasks = actual.tasks;
  let impls = actual.impls;
  for (const rule of rulesFor(kind)) {
    const present = HashMap.has(actual.tasks, rule.name);
    const enabled = Match.value(rule.presence).pipe(
      Match.tag("required", () => true),
      Match.tag("optional", () => present),
      Match.tag("absent", () => false),
      Match.tag("derived", ({ rule }) =>
        rule === "codegen-generator"
          ? HashSet.size(evidence.generators) > 0
          : HashSet.size(evidence.doctestOwners) > 0 && HashSet.size(evidence.bypassingConfigs) === 0
      ),
      Match.exhaustive
    );
    if (!enabled) {
      tasks = HashMap.remove(tasks, rule.name);
      continue;
    }
    if (rule.binding._tag === "owned") continue;
    const value =
      rule.binding._tag === "cli"
        ? rule.binding.command
        : `bun run ${rule.binding.ifPresent ? "--if-present " : ""}${rule.binding.impl}`;
    tasks = HashMap.set(tasks, rule.name, value);
    if (rule.binding._tag === "indirection" && !rule.binding.ifPresent && !HashMap.has(impls, rule.binding.impl)) {
      const binding = rule.binding;
      const fallback = A.findFirst(implScriptDefaults, (row) => row.kind === kind && row.name === binding.impl);
      if (O.isSome(fallback)) impls = HashMap.set(impls, fallback.value.name, fallback.value.value);
    }
  }
  const codegen = HashMap.get(tasks, "codegen");
  if (O.isSome(codegen) && isPlaceholder(codegen.value)) tasks = HashMap.remove(tasks, "codegen");
  return ScriptsBlock.make({ kind, tasks, impls, extras: actual.extras });
};

const diffBlock: PackageScriptsPolicyShape["diff"] = (actual, expected) => {
  if (PackageKind.is.exempt(actual.kind)) return [];
  const drift: Array<PackageScriptsDrift> = [];
  for (const name of TaskScriptName.Options) {
    const before = HashMap.get(actual.tasks, name);
    const after = HashMap.get(expected.tasks, name);
    if (name === "codegen" && O.isSome(before) && isPlaceholder(before.value)) {
      drift.push({ _tag: "placeholder", name, actual: before.value });
    } else if (O.isNone(before) && O.isSome(after)) drift.push({ _tag: "missing-task", name });
    else if (O.isSome(before) && O.isNone(after)) drift.push({ _tag: "unexpected-task", name });
    else if (O.isSome(before) && O.isSome(after) && before.value !== after.value) {
      drift.push({ _tag: "wrong-binding", name, expected: after.value, actual: before.value });
    }
  }
  for (const [name] of expected.impls) {
    if (!HashMap.has(actual.impls, name)) drift.push({ _tag: "missing-impl", name });
  }
  for (const rule of rulesFor(actual.kind)) {
    if (rule.presence._tag === "required" && rule.binding._tag === "owned" && !HashMap.has(actual.tasks, rule.name)) {
      drift.push({ _tag: "missing-task", name: rule.name });
    }
  }
  return drift;
};

/**
 * Evaluates root workspace members and repairs only policy-owned script text.
 * **Example** (Construct the policy effect)
 * ```ts
 * import { PackageScriptsPolicy } from "@beep/repo-cli/test/PackageScripts"
 * import { Effect } from "effect"
 * console.log(Effect.isEffect(PackageScriptsPolicy.make("/repo"))) // true
 * ```
 * @category services
 * @since 0.0.0
 */
export class PackageScriptsPolicy extends Context.Service<PackageScriptsPolicy, PackageScriptsPolicyShape>()(
  $I`PackageScriptsPolicy`,
  {
    make: Effect.fn("PackageScriptsPolicy.make")(function* (root: string) {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const fsUtils = yield* FsUtils;
      const workspaces = (repoRoot: string) =>
        resolveWorkspaceDirs(repoRoot).pipe(
          Effect.provideService(FsUtils, fsUtils),
          Effect.mapError(policyError("Cannot discover workspaces"))
        );
      const kindOf = Effect.fn("PackageScriptsPolicy.kindOf")(function* (manifestPath: string) {
        const dirs = yield* workspaces(root);
        const absolute = path.resolve(root, manifestPath);
        const dir = path.dirname(absolute);
        if (!A.contains(dirs.pipe(HashMap.values, A.fromIterable), dir)) {
          return yield* PackageScriptsPolicyError.make({
            message: `Manifest outside workspace domain: ${manifestPath}`,
            cause: manifestPath,
          });
        }
        return kindForDirectory(path.relative(root, dir));
      });
      const run = Effect.fn("PackageScriptsPolicy.run")(
        function* (repoRoot: string, write: boolean) {
          const dirs = yield* workspaces(repoRoot);
          const entries = A.sort(dirs.pipe(HashMap.values, A.fromIterable), Order.String);
          let owners = HashSet.empty<string>();
          let bypasses = HashSet.empty<string>();
          const generators = HashSet.fromIterable(
            A.map(CodegenGeneratorPackage.Options, (dir) => `${dir}/package.json`)
          );
          const sources = yield* fsUtils.globFiles(["packages/**/src/**/*.{ts,tsx}", "apps/**/src/**/*.{ts,tsx}"], {
            cwd: repoRoot,
            ignore: ["**/node_modules/**", "**/.context/**", "**/test/fixtures/**", "**/*.d.ts"],
          });
          let drift = HashMap.empty<string, ReadonlyArray<PackageScriptsDrift>>();
          for (const source of sources) {
            if (!isDoctestSourcePath(source)) continue;
            const text = yield* fs.readFileString(path.join(repoRoot, source));
            if (!Str.includes("import.meta.vitest")(text)) continue;
            const owner = A.findFirst(entries, (dir) => Str.startsWith(`${dir}/`)(path.join(repoRoot, source)));
            if (O.isSome(owner)) owners = HashSet.add(owners, `${path.relative(repoRoot, owner.value)}/package.json`);
            else
              drift = HashMap.set(drift, source, [
                { _tag: "derivation-conflict", name: "doctest", reason: "Marked source has no workspace owner" },
              ]);
          }
          for (const dir of entries) {
            const manifest = `${path.relative(repoRoot, dir)}/package.json`;
            if (!HashSet.has(owners, manifest)) continue;
            const configs = yield* fsUtils.globFiles("vitest*.config.ts", { cwd: dir });
            for (const config of configs) {
              const text = yield* fs.readFileString(path.join(dir, config));
              if (!Str.includes("vitest.shared.ts")(text)) bypasses = HashSet.add(bypasses, manifest);
            }
          }
          const evidence = DerivationEvidence.make({ doctestOwners: owners, bypassingConfigs: bypasses, generators });
          let written = HashSet.empty<string>();
          for (const dir of entries) {
            const manifestPath = `${path.relative(repoRoot, dir)}/package.json`;
            const kind = kindForDirectory(path.relative(repoRoot, dir));
            if (PackageKind.is.exempt(kind)) continue;
            const file = path.join(dir, "package.json");
            const text = yield* fs.readFileString(file);
            const manifest = yield* S.decodeEffect(S.fromJsonString(S.Record(S.String, S.Unknown)))(text);
            const actual = yield* S.decodeUnknownEffect(scriptsBlockFromRecord(kind))(
              R.get(manifest, "scripts").pipe(O.getOrElse(() => ({})))
            );
            const local = DerivationEvidence.make({
              doctestOwners: HashSet.filter(evidence.doctestOwners, (entry) => entry === manifestPath),
              bypassingConfigs: HashSet.filter(evidence.bypassingConfigs, (entry) => entry === manifestPath),
              generators: HashSet.filter(evidence.generators, (entry) => entry === manifestPath),
            });
            const expected = expectedBlock(kind, actual, local);
            const conflicts: Array<PackageScriptsDrift> = [];
            if (HashSet.has(bypasses, manifestPath))
              conflicts.push({
                _tag: "derivation-conflict",
                name: "doctest",
                reason: "Marked sources use a vitest config that bypasses vitest.shared.ts",
              });
            if (HashSet.has(generators, manifestPath) && !HashMap.has(expected.tasks, "codegen"))
              conflicts.push({ _tag: "missing-task", name: "codegen" });
            if (write && A.isReadonlyArrayNonEmpty(diffBlock(actual, expected))) {
              const scripts = yield* S.encodeEffect(scriptsBlockFromRecord(kind))(expected);
              const rendered = `${yield* jsonStringifyPretty({ ...manifest, scripts })}\n`;
              if (rendered !== text) {
                yield* fs.writeFileString(file, rendered);
                written = HashSet.add(written, manifestPath);
              }
            }
            const rows = [...diffBlock(write ? expected : actual, expected), ...conflicts];
            if (A.isReadonlyArrayNonEmpty(rows)) drift = HashMap.set(drift, manifestPath, rows);
          }
          return PackageScriptsReport.make({
            schemaVersion: "package-scripts-report/v1",
            rules: "package-scripts-rules/v1",
            manifests: entries.length,
            drift,
            written,
          });
        },
        Effect.mapError(policyError("Cannot evaluate scripts policy"))
      );
      return {
        kindOf,
        rules: rulesFor,
        expected: expectedBlock,
        diff: diffBlock,
        check: (repoRoot: string) => run(repoRoot, false),
        write: (repoRoot: string) => run(repoRoot, true),
      };
    }),
  }
) {}
