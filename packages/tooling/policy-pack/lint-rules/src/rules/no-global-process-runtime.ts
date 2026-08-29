/**
 * Oxlint rule blocking direct host platform/architecture reads outside the
 * shared host-process reference module.
 *
 * @packageDocumentation
 * @since 0.1.0
 */

import { defineRule } from "@oxlint/plugins";
import { HashSet, MutableHashMap, MutableHashSet } from "effect";
import * as O from "effect/Option";
import {
  getPropertyName,
  identifierName,
  isIdentifier,
  literalStringValue,
  pathMatchesSuffix,
  toRepoPath,
  unwrapExpression,
  unwrapMemberExpression,
} from "./utils.ts";
import type { ESTree } from "@oxlint/plugins";
import type { MaybeNode, MemberAccess } from "./utils.ts";

const RUNTIME_PROPERTIES = HashSet.fromIterable(["platform", "arch"]);
// The sole beep file allowed to read host runtime platform/architecture directly.
// Everything else must inject the runtime reference (Effect code) or provide it
// explicitly (tests). Repoint this if the canonical host-process module moves.
const HOST_PROCESS_REFERENCE_FILE = "packages/foundation/capability/chalk/src/internal/SupportsColor.ts";
const NODE_OS_MODULES = HashSet.fromIterable(["node:os", "os"]);

const isHostProcessReferenceFile = (filename: string, cwd: string): boolean =>
  pathMatchesSuffix(toRepoPath(filename, cwd), HOST_PROCESS_REFERENCE_FILE);

const hostProcessTarget = (property: string): string =>
  property === "arch" ? "HostProcessArchitecture" : "HostProcessPlatform";

// Distinct wording per detection path: a `process.<prop>` member read vs an `os.<prop>()` call.
const processReadMessage = (property: string): string =>
  `Use ${hostProcessTarget(property)} instead of process.${property}; inject the runtime reference in Effect code and provide it explicitly in tests.`;

const osCallMessage = (property: string): string =>
  `Use ${hostProcessTarget(property)} instead of os.${property}(); inject the runtime reference in Effect code and provide it explicitly in tests.`;

/**
 * Oxlint rule that blocks direct host platform and architecture reads outside
 * the shared host-process reference module.
 *
 * **Example** (Host runtime rule description)
 *
 * ```ts
 * import { strictEqual } from "node:assert/strict"
 * import plugin from "@beep/lint-rules/oxlint"
 *
 * const description = plugin.rules["no-global-process-runtime"]?.meta.docs.description
 *
 * strictEqual(description?.includes("host runtime"), true)
 * ```
 *
 * @category tools
 * @since 0.1.0
 */
export default defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow direct host runtime platform/architecture reads outside the shared host process references.",
    },
  },
  createOnce(context) {
    const nodeOsNamespaces = MutableHashSet.empty<string>();
    const nodeOsRuntimeImports = MutableHashMap.empty<string, string>();
    // Lexical-scope approximation for `process` shadowing: one frame per enclosing function
    // (plus a module-level frame), flagged when that scope binds a local `process`. This catches
    // function parameters and simple `var`/`let`/`const process` declarators; it does NOT model
    // destructured (`const { process } = ...`) or block-scoped bindings precisely.
    const scopeStack: Array<{ shadowed: boolean }> = [{ shadowed: false }];

    const resetBindings = () => {
      MutableHashSet.clear(nodeOsNamespaces);
      MutableHashMap.clear(nodeOsRuntimeImports);
      scopeStack.length = 0;
      scopeStack.push({ shadowed: false });
    };

    const currentScope = (): { shadowed: boolean } => scopeStack[scopeStack.length - 1] ?? { shadowed: false };

    const paramShadowsProcess = (params: ReadonlyArray<ESTree.ParamPattern>): boolean =>
      params.some((param) => param.type === "Identifier" && param.name === "process");

    const pushScope = (params: ReadonlyArray<ESTree.ParamPattern>) => {
      scopeStack.push({ shadowed: paramShadowsProcess(params) });
    };

    const popScope = () => {
      if (scopeStack.length > 1) scopeStack.pop();
    };

    const recordDeclarator = (node: ESTree.VariableDeclarator) => {
      if (node.id.type === "Identifier" && node.id.name === "process") currentScope().shadowed = true;
    };

    const isProcessShadowed = (): boolean => scopeStack.some((scope) => scope.shadowed);

    // `globalThis.process` — the namespaced spelling, unaffected by a local `process` binding.
    const isGlobalThisProcess = (node: MaybeNode): boolean =>
      O.exists(
        unwrapMemberExpression(node),
        (access) =>
          isIdentifier("globalThis")(access.object) &&
          O.exists(getPropertyName(access.property), (p) => p === "process")
      );

    // A bare global `process` (skipped when locally shadowed) or the explicit `globalThis.process`.
    const isGlobalProcessObject = (node: MaybeNode): boolean => {
      if (isIdentifier("process")(unwrapExpression(node))) return !isProcessShadowed();
      return isGlobalThisProcess(node);
    };

    // Record a destructured `{ platform } from "node:os"` runtime import under its local name.
    const recordRuntimeSpecifier = (specifier: ESTree.ImportSpecifier) => {
      const imported = O.filter(getPropertyName(specifier.imported), (name) => HashSet.has(RUNTIME_PROPERTIES, name));
      if (O.isSome(imported)) MutableHashMap.set(nodeOsRuntimeImports, specifier.local.name, imported.value);
    };

    const recordSpecifier = (specifier: ESTree.ImportDeclaration["specifiers"][number]) => {
      if (specifier.type === "ImportSpecifier") return recordRuntimeSpecifier(specifier);
      // Namespace / default imports expose the whole `node:os` module under one local name.
      MutableHashSet.add(nodeOsNamespaces, specifier.local.name);
    };

    const trackImportDeclaration = (node: ESTree.ImportDeclaration) => {
      const source = literalStringValue(node.source);
      if (O.isNone(source) || !HashSet.has(NODE_OS_MODULES, source.value)) return;
      for (const specifier of node.specifiers) recordSpecifier(specifier);
    };

    // `os.platform()` / `nodeOs.arch()` — a runtime call through a tracked `node:os` namespace.
    const namespacedRuntimeCall = (access: MemberAccess): O.Option<string> =>
      O.filter(
        access.object,
        (object) => object.type === "Identifier" && MutableHashSet.has(nodeOsNamespaces, object.name)
      ).pipe(
        O.flatMap(() => getPropertyName(access.property)),
        O.filter((property) => HashSet.has(RUNTIME_PROPERTIES, property))
      );

    // `platform()` / `arch()` — a runtime call through a destructured `node:os` import.
    const importedRuntimeCall = (callee: MaybeNode): O.Option<string> =>
      O.flatMap(unwrapExpression(callee), identifierName).pipe(
        O.flatMap((name) => MutableHashMap.get(nodeOsRuntimeImports, name))
      );

    const getNodeOsRuntimeCall = (callee: MaybeNode): O.Option<string> =>
      O.orElse(importedRuntimeCall(callee), () => O.flatMap(unwrapMemberExpression(callee), namespacedRuntimeCall));

    // `process.platform` / `globalThis.process.arch` — a flagged global-process property read.
    const globalProcessProperty = (node: ESTree.MemberExpression): O.Option<string> =>
      getPropertyName(node.property).pipe(
        O.filter((property) => HashSet.has(RUNTIME_PROPERTIES, property)),
        O.filter(() => isGlobalProcessObject(node.object))
      );

    return {
      before: resetBindings,
      ImportDeclaration: trackImportDeclaration,
      FunctionDeclaration: (node) => pushScope(node.params),
      "FunctionDeclaration:exit": popScope,
      FunctionExpression: (node) => pushScope(node.params),
      "FunctionExpression:exit": popScope,
      ArrowFunctionExpression: (node) => pushScope(node.params),
      "ArrowFunctionExpression:exit": popScope,
      VariableDeclarator: recordDeclarator,
      MemberExpression(node) {
        if (isHostProcessReferenceFile(context.filename, context.cwd)) return;

        const property = globalProcessProperty(node);
        if (O.isNone(property)) return;

        context.report({ node, message: processReadMessage(property.value) });
      },
      CallExpression(node) {
        if (isHostProcessReferenceFile(context.filename, context.cwd)) return;

        const property = getNodeOsRuntimeCall(node.callee);
        if (O.isNone(property)) return;

        context.report({ node, message: osCallMessage(property.value) });
      },
    };
  },
});
