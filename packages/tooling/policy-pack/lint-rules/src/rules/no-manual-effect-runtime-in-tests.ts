/**
 * Oxlint rule preventing net-new manual `Effect.run*`/`ManagedRuntime.make`
 * calls in test files while preserving the current legacy baseline counts.
 *
 * @packageDocumentation
 * @since 0.1.0
 */

import { defineRule } from "@oxlint/plugins";
import { HashMap, HashSet, MutableHashSet } from "effect";
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

// Import sources that bind the `Effect` namespace, the `ManagedRuntime` namespace, and the
// `effect` root namespace (reached as `<root>.Effect.run*` / `<root>.ManagedRuntime.make`).
const EFFECT_NAMED_SOURCES = HashSet.fromIterable(["effect"]);
const EFFECT_MODULE_SOURCES = HashSet.fromIterable(["effect/Effect"]);
const MANAGED_RUNTIME_NAMED_SOURCES = HashSet.fromIterable(["effect", "effect/ManagedRuntime"]);
const MANAGED_RUNTIME_MODULE_SOURCES = HashSet.fromIterable(["effect/ManagedRuntime"]);
const EFFECT_ROOT_SOURCE = "effect";

// Existing manual runners are tracked as debt. The rule permits no net-new
// occurrences in these files, while unlisted test files must have zero.
//
// Regenerate (run from repo root) after running oxlint with this rule enabled
// and an empty baseline; tally per repo-relative file:
//   bunx oxlint --config <cfg> packages apps infra \
//     | rg "no-manual-effect-runtime-in-tests" | cut -d: -f1 | sort | uniq -c
// then transcribe each `<repo-relative-path>: <count>` pair below.
const LEGACY_BASELINE = HashMap.fromIterable<string, number>([
  ["apps/oip-web/test/oip-seo.test.ts", 1],
  ["apps/oip-web/test/oip-web.test.tsx", 13],
  ["apps/professional-desktop/test/chat-ui.test.tsx", 2],
  ["infra/test/AIMetrics.test.ts", 7],
  ["infra/test/OipWeb.test.ts", 1],
  ["infra/test/Storybook.test.ts", 1],
  ["packages/architecture-lab/server/test/integration/WorkItemDrizzleRepository.pglite.test.ts", 12],
  ["packages/drivers/acp/test/agent.test.ts", 6],
  ["packages/drivers/acp/test/protocol.test.ts", 6],
  ["packages/drivers/libpff/test/Libpff.service.test.ts", 6],
  ["packages/drivers/tika/test/Tika.service.test.ts", 6],
  ["packages/drivers/venice-ai/test/VeniceAI.service.test.ts", 6],
  ["packages/drivers/wink/test/Layers.test.ts", 1],
  ["packages/drivers/wink/test/ParityTools.test.ts", 4],
  ["packages/drivers/wink/test/ToolValidation.test.ts", 2],
  ["packages/drivers/wink/test/WinkEngineRef.test.ts", 2],
  ["packages/drivers/wink/test/WinkTokenization.test.ts", 2],
  ["packages/foundation/capability/file-processing/test/FileProcessing.test.ts", 10],
  ["packages/foundation/modeling/nlp/test/Graph/Schema.test.ts", 16],
  ["packages/foundation/modeling/nlp/test/Handoff/Contract.test.ts", 1],
  ["packages/foundation/modeling/nlp/test/PatternCore.test.ts", 6],
  ["packages/foundation/capability/observability/test/Boundary.test.ts", 3],
  ["packages/foundation/capability/observability/test/DevToolsRelay.test.ts", 1],
  ["packages/foundation/capability/observability/test/HttpApiTelemetry.test.ts", 2],
  ["packages/foundation/capability/observability/test/Metric.test.ts", 3],
  ["packages/foundation/capability/observability/test/NodeSdk.test.ts", 5],
  ["packages/foundation/capability/observability/test/OtlpPacketLab.test.ts", 2],
  ["packages/foundation/capability/observability/test/PhaseProfiler.test.ts", 2],
  ["packages/foundation/capability/semantic-web/test/CanonicalizationSecurity.test.ts", 1],
  ["packages/foundation/capability/semantic-web/test/JsonLd.test.ts", 13],
  ["packages/foundation/capability/semantic-web/test/Provenance.test.ts", 1],
  ["packages/foundation/capability/semantic-web/test/ServicesAndSurface.test.ts", 9],
  ["packages/foundation/modeling/lexical/test/Lexical.codec.test.ts", 6],
  ["packages/foundation/modeling/pandoc-ast/test/integration/Pandoc.integration.test.ts", 1],
  ["packages/foundation/modeling/pandoc-ast/test/Pandoc.codec.test.ts", 16],
  ["packages/foundation/modeling/pandoc-ast/test/Pandoc.mapping.test.ts", 17],
  ["packages/foundation/modeling/schema/test/Fn.test.ts", 2],
  ["packages/foundation/modeling/schema/test/HttpHeaders.test.ts", 5],
  ["packages/foundation/modeling/schema/test/Number.test.ts", 2],
  ["packages/foundation/modeling/schema/test/Sha256.test.ts", 3],
  ["packages/foundation/modeling/utils/test/Glob.test.ts", 1],
  ["packages/foundation/ui-system/editor/test/editor-nodes.test.ts", 1],
  ["packages/tooling/library/repo-utils/test/DependencyIndex.test.ts", 1],
  ["packages/tooling/library/repo-utils/test/TsConfig.test.ts", 1],
  ["packages/tooling/library/repo-utils/test/UniqueDeps.test.ts", 1],
  ["packages/tooling/library/repo-utils/test/Workspaces.test.ts", 1],
  ["packages/tooling/policy-pack/lint-rules/test/oxlint-rules.test.ts", 1],
  ["packages/tooling/policy-pack/lint-rules/test/registry.test.ts", 1],
  ["packages/tooling/policy-pack/lint-rules/test/rules.test.ts", 1],
  ["packages/tooling/policy-pack/repo-configs/test/EffectTsgoEffectFnPolicy.test.ts", 1],
  ["packages/tooling/policy-pack/repo-configs/test/NextConfig.schemas.test.ts", 3],
  ["packages/tooling/policy-pack/repo-configs/test/NextModels.schema.test.ts", 9],
  ["packages/tooling/test-kit/test-utils/test/integration/SqlTest.pglite.test.ts", 1],
  ["packages/tooling/tool/cli/test/agent-effectiveness-command.test.ts", 12],
  ["packages/tooling/tool/cli/test/ai-metrics-command.test.ts", 52],
  ["packages/tooling/tool/cli/test/allowlist-check.test.ts", 6],
  ["packages/tooling/tool/cli/test/changeset-graph.test.ts", 4],
  ["packages/tooling/tool/cli/test/ci-command.test.ts", 1],
  ["packages/tooling/tool/cli/test/create-package-security.test.ts", 7],
  ["packages/tooling/tool/cli/test/create-package.test.ts", 13],
  ["packages/tooling/tool/cli/test/docgen.test.ts", 56],
  ["packages/tooling/tool/cli/test/effect-fn.test.ts", 4],
  ["packages/tooling/tool/cli/test/effect-imports.test.ts", 2],
  ["packages/tooling/tool/cli/test/files-command.test.ts", 74],
  ["packages/tooling/tool/cli/test/foundation-topology.test.ts", 2],
  ["packages/tooling/tool/cli/test/graphiti-proxy-security.test.ts", 2],
  ["packages/tooling/tool/cli/test/image-command.test.ts", 7],
  ["packages/tooling/tool/cli/test/lint-command.test.ts", 27],
  ["packages/tooling/tool/cli/test/native-runtime.test.ts", 5],
  ["packages/tooling/tool/cli/test/package-verify.test.ts", 3],
  ["packages/tooling/tool/cli/test/purge-security.test.ts", 2],
  ["packages/tooling/tool/cli/test/quality-artifact-generators.test.ts", 3],
  ["packages/tooling/tool/cli/test/quality-tasks.test.ts", 11],
  ["packages/tooling/tool/cli/test/reflection-lint.test.ts", 6],
  ["packages/tooling/tool/cli/test/sync-data-to-ts.test.ts", 7],
  ["packages/tooling/tool/cli/test/terse-effect.test.ts", 14],
  ["packages/tooling/tool/cli/test/tsconfig-sync.test.ts", 7],
  ["packages/tooling/tool/cli/test/yeet.test.ts", 10],
  ["packages/tooling/tool/docgen/test/Parser.test.ts", 1],
]);

const baselineFor = (repoPath: string): number => {
  for (const [suffix, count] of LEGACY_BASELINE) {
    if (pathMatchesSuffix(repoPath, suffix)) return count;
  }
  return 0;
};

/**
 * Oxlint rule that prevents net-new manual `Effect.run*` and
 * `ManagedRuntime.make` calls in test files while preserving the current
 * legacy baseline counts.
 *
 * @example
 * ```ts
 * import { strictEqual } from "node:assert/strict"
 * import plugin from "@beep/lint-rules/oxlint"
 *
 * const description = plugin.rules["no-manual-effect-runtime-in-tests"]?.meta.docs.description
 *
 * strictEqual(description?.includes("@effect/vitest"), true)
 * ```
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

    // Local names bound to the Effect namespace, the ManagedRuntime namespace, and the
    // `effect` root namespace (reached as `<root>.Effect.run*` / `<root>.ManagedRuntime.make`).
    const effectIdentifiers = MutableHashSet.empty<string>();
    const managedRuntimeIdentifiers = MutableHashSet.empty<string>();
    const effectRootNamespaces = MutableHashSet.empty<string>();

    const isTracked = (node: O.Option<AstNode>, tracked: MutableHashSet.MutableHashSet<string>): boolean =>
      O.exists(node, (expression) => expression.type === "Identifier" && MutableHashSet.has(tracked, expression.name));

    // `<root>.<name>` reached through the `effect` root namespace, when `object` is that member.
    const isRootMember = (object: O.Option<AstNode>, name: string): boolean =>
      O.exists(
        O.flatMap(object, unwrapMemberExpression),
        (access) =>
          O.exists(getPropertyName(access.property), (member) => member === name) &&
          isTracked(access.object, effectRootNamespaces)
      );

    // The receiver resolves to the Effect namespace, directly or via the effect root.
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

    // Record a named binding under its local name when its imported name + source match.
    const recordNamed = (imported: string, local: string, source: string) => {
      if (isNamed(imported, "Effect", EFFECT_NAMED_SOURCES, source)) MutableHashSet.add(effectIdentifiers, local);
      else if (isNamed(imported, "ManagedRuntime", MANAGED_RUNTIME_NAMED_SOURCES, source)) {
        MutableHashSet.add(managedRuntimeIdentifiers, local);
      }
    };

    // Record a module binding (`* as X` / default) for the Effect, ManagedRuntime, or root module.
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
