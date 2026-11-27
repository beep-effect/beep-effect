/**
 * Oxlint rule preventing net-new manual `Effect.run*`/`ManagedRuntime.make`
 * calls in test files while preserving the current legacy baseline counts.
 *
 * @packageDocumentation
 * @since 0.1.0
 */

import { defineRule } from "@oxlint/plugins";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as MutableHashSet from "effect/MutableHashSet";
import * as O from "effect/Option";
import {
  classifyImportSpecifier,
  getPropertyName,
  ImportBinding,
  pathMatchesSuffix,
  toRepoPath,
  unwrapMemberExpression,
} from "./utils.ts";
import type { AstNode, MaybeNode } from "./utils.ts";

const TEST_FILE_PATTERN = /\.(?:test|spec)\.[cm]?[jt]sx?$/u;
const EFFECT_RUNTIME_METHODS = HashSet.fromIterable([
  "runCallback",
  "runCallbackWith",
  "runFork",
  "runForkWith",
  "runPromise",
  "runPromiseExit",
  "runPromiseExitWith",
  "runPromiseWith",
  "runSync",
  "runSyncExit",
  "runSyncExitWith",
  "runSyncWith",
]);
const EFFECT_NAMED_SOURCES = HashSet.fromIterable(["effect"]);
const EFFECT_MODULE_SOURCES = HashSet.fromIterable(["effect/Effect"]);
const MANAGED_RUNTIME_NAMED_SOURCES = HashSet.fromIterable(["effect", "effect/ManagedRuntime"]);
const MANAGED_RUNTIME_MODULE_SOURCES = HashSet.fromIterable(["effect/ManagedRuntime"]);
const EFFECT_ROOT_SOURCE = "effect";

/**
 * Legacy manual-runner debt, keyed by repo-relative test file path.
 *
 * **Details**
 *
 * Each row is the live count of manual runners in that file, so the rule
 * admits no net-new occurrence there; unlisted test files must have zero.
 * The baseline guard in `test/oxlint-rules.test.ts` fails when a row names a missing file
 * or a count that differs from the file's live violations, so rows shrink as
 * files migrate. To regenerate, empty this map and tally from the repo root:
 *
 * ```sh
 * bunx oxlint --config .oxlintrc.json --format unix packages apps infra \
 *   | rg "no-manual-effect-runtime-in-tests" | cut -d: -f1 | sort | uniq -c
 * ```
 *
 * **Example** (Read a file's allowance)
 *
 * ```ts
 * import { ok } from "node:assert/strict"
 * import { MANUAL_EFFECT_RUNTIME_LEGACY_BASELINE } from "@beep/lint-rules/oxlint"
 * import * as HashMap from "effect/HashMap"
 *
 * ok(HashMap.size(MANUAL_EFFECT_RUNTIME_LEGACY_BASELINE) > 0)
 * ```
 *
 * @category configuration
 * @since 0.1.0
 */
export const MANUAL_EFFECT_RUNTIME_LEGACY_BASELINE = HashMap.fromIterable<string, number>([
  ["apps/oip-web/test/oip-web.test.tsx", 4],
]);

const baselineFor = (repoPath: string): number => {
  for (const [suffix, count] of MANUAL_EFFECT_RUNTIME_LEGACY_BASELINE) {
    if (pathMatchesSuffix(repoPath, suffix)) return count;
  }
  return 0;
};

/**
 * Oxlint rule that prevents net-new manual `Effect.run*` and
 * `ManagedRuntime.make` calls in test files while preserving the current
 * legacy baseline counts.
 *
 * **Details**
 *
 * The rule follows `Effect` as a named import from `effect` or the
 * `effect/Effect` module itself, `ManagedRuntime` as a named import from
 * `effect` or `effect/ManagedRuntime` or that module itself, and the `effect`
 * root namespace reached as `<root>.Effect.run*` or
 * `<root>.ManagedRuntime.make`. Same-named imports from other modules are
 * ignored.
 *
 * **Example** (Manual runtime rule description)
 *
 * ```ts
 * import { strictEqual } from "node:assert/strict"
 * import plugin from "@beep/lint-rules/oxlint"
 *
 * const description = plugin.rules["no-manual-effect-runtime-in-tests"]?.meta.docs.description
 *
 * strictEqual(description?.includes("@effect/vitest"), true)
 * ```
 *
 * @category tools
 * @since 0.1.0
 */
export default defineRule({
  meta: {
    type: "problem",
    docs: {
      description: "Disallow manually creating or running Effect runtimes in tests; use @effect/vitest.",
    },
  },
  create(context) {
    if (!TEST_FILE_PATTERN.test(context.filename)) return {};

    const allowedCount = baselineFor(toRepoPath(context.filename, context.cwd));
    let occurrenceCount = 0;
    const effectIdentifiers = MutableHashSet.empty<string>();
    const managedRuntimeIdentifiers = MutableHashSet.empty<string>();
    const effectRootNamespaces = MutableHashSet.empty<string>();

    const isTracked = (node: O.Option<AstNode>, tracked: MutableHashSet.MutableHashSet<string>): boolean =>
      O.exists(node, (expression) => expression.type === "Identifier" && MutableHashSet.has(tracked, expression.name));
    const isRootMember = (object: O.Option<AstNode>, name: string): boolean =>
      O.exists(
        O.flatMap(object, unwrapMemberExpression),
        (access) =>
          O.exists(getPropertyName(access.property), (member) => member === name) &&
          isTracked(access.object, effectRootNamespaces)
      );
    const isEffectReceiver = (object: O.Option<AstNode>): boolean =>
      isTracked(object, effectIdentifiers) || isRootMember(object, "Effect");

    const isManagedRuntimeReceiver = (object: O.Option<AstNode>): boolean =>
      isTracked(object, managedRuntimeIdentifiers) || isRootMember(object, "ManagedRuntime");

    const effectRunner = (object: O.Option<AstNode>, property: string): O.Option<string> =>
      isEffectReceiver(object) && HashSet.has(EFFECT_RUNTIME_METHODS, property)
        ? O.some(`Effect.${property}`)
        : O.none();

    const managedRuntimeRunner = (object: O.Option<AstNode>, property: string): O.Option<string> =>
      isManagedRuntimeReceiver(object) && property === "make" ? O.some("ManagedRuntime.make") : O.none();

    const runnerLabel = (object: O.Option<AstNode>, property: string): O.Option<string> =>
      O.orElse(effectRunner(object, property), () => managedRuntimeRunner(object, property));

    const manualRunnerName = (callee: MaybeNode): O.Option<string> =>
      unwrapMemberExpression(callee).pipe(
        O.flatMap((access) =>
          O.flatMap(getPropertyName(access.property), (property) => runnerLabel(access.object, property))
        )
      );

    const isNamed = (imported: string, expected: string, sources: HashSet.HashSet<string>, source: string): boolean =>
      imported === expected && HashSet.has(sources, source);
    const recordNamed = (imported: string, local: string, source: string) => {
      if (isNamed(imported, "Effect", EFFECT_NAMED_SOURCES, source)) MutableHashSet.add(effectIdentifiers, local);
      else if (isNamed(imported, "ManagedRuntime", MANAGED_RUNTIME_NAMED_SOURCES, source)) {
        MutableHashSet.add(managedRuntimeIdentifiers, local);
      }
    };
    const recordModule = (local: string, source: string) => {
      if (HashSet.has(EFFECT_MODULE_SOURCES, source)) MutableHashSet.add(effectIdentifiers, local);
      else if (HashSet.has(MANAGED_RUNTIME_MODULE_SOURCES, source))
        MutableHashSet.add(managedRuntimeIdentifiers, local);
      else if (source === EFFECT_ROOT_SOURCE) MutableHashSet.add(effectRootNamespaces, local);
    };

    const recordBinding = (source: string, binding: ImportBinding) =>
      ImportBinding.match(binding, {
        named: ({ imported, local }) => recordNamed(imported, local, source),
        namespace: ({ local }) => recordModule(local, source),
        default: ({ local }) => recordModule(local, source),
      });

    return {
      ImportDeclaration(node) {
        if (node.importKind === "type") return;
        const source = node.source.value;
        for (const specifier of node.specifiers) {
          O.match(classifyImportSpecifier(specifier), { onNone: () => {}, onSome: (b) => recordBinding(source, b) });
        }
      },
      CallExpression(node) {
        const runner = manualRunnerName(node.callee);
        if (O.isNone(runner)) return;

        occurrenceCount++;
        if (occurrenceCount <= allowedCount) return;

        context.report({
          node: node.callee,
          message: `Do not use ${runner.value} in tests. Use @effect/vitest with it.effect(...) and test layers instead.`,
        });
      },
    };
  },
});
