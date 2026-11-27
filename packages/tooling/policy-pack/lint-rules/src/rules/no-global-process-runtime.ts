/**
 * Oxlint rule blocking direct host platform/architecture reads outside the
 * shared host-process reference module.
 *
 * @packageDocumentation
 * @since 0.1.0
 */

import { defineRule } from "@oxlint/plugins";
import * as HashSet from "effect/HashSet";
import * as MutableHashMap from "effect/MutableHashMap";
import * as MutableHashSet from "effect/MutableHashSet";
import * as O from "effect/Option";
import {
  getPropertyName,
  identifierName,
  isIdentifier,
  literalStringValue,
  makeIdentifierShadowTracker,
  pathMatchesSuffix,
  toRepoPath,
  unwrapExpression,
  unwrapMemberExpression,
} from "./utils.ts";
import type { ESTree } from "@oxlint/plugins";
import type { MaybeNode, MemberAccess } from "./utils.ts";

const RUNTIME_PROPERTIES = HashSet.fromIterable(["platform", "arch"]);
const HOST_PROCESS_REFERENCE_FILES = HashSet.fromIterable([
  "packages/foundation/modeling/utils/src/HostProcess.ts",
  "tools/tsgo-shim/tsgo.js",
]);
const NODE_OS_MODULES = HashSet.fromIterable(["node:os", "os"]);

const isHostProcessReferenceFile = (filename: string, cwd: string): boolean =>
  HashSet.some(HOST_PROCESS_REFERENCE_FILES, (file) => pathMatchesSuffix(toRepoPath(filename, cwd), file));

const hostProcessTarget = (property: string): string =>
  property === "arch" ? "HostProcessArchitecture" : "HostProcessPlatform";
const processReadMessage = (property: string): string =>
  `Use ${hostProcessTarget(property)} instead of process.${property}; inject the runtime reference in Effect code and provide it explicitly in tests.`;

const osCallMessage = (property: string): string =>
  `Use ${hostProcessTarget(property)} instead of os.${property}(); inject the runtime reference in Effect code and provide it explicitly in tests.`;

/**
 * Oxlint rule that blocks direct host platform and architecture reads outside
 * the shared host-process reference module.
 *
 * **Details**
 *
 * Two files may read the host runtime directly: the shared `HostProcess`
 * reference module, which every other file reaches through
 * `HostProcessPlatform` / `HostProcessArchitecture` in Effect code or its
 * `current*` constants in sync code and tests, and the pre-runtime tsgo
 * bootstrap shim, which has no Effect runtime to inject into. The rule flags
 * `process.platform` and `process.arch`, read bare (unless a local `process`
 * shadows it) or through `globalThis.process`, and `platform()` / `arch()`
 * calls through a namespace, default or destructured `node:os` import.
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
    const shadow = makeIdentifierShadowTracker(["process"]);
    let hostProcessReferenceFile = false;

    const resetBindings = () => {
      hostProcessReferenceFile = isHostProcessReferenceFile(context.filename, context.cwd);
      MutableHashSet.clear(nodeOsNamespaces);
      MutableHashMap.clear(nodeOsRuntimeImports);
      shadow.reset();
    };
    const isGlobalThisProcess = (node: MaybeNode): boolean =>
      O.exists(
        unwrapMemberExpression(node),
        (access) =>
          isIdentifier("globalThis")(access.object) &&
          O.exists(getPropertyName(access.property), (p) => p === "process")
      );
    const isGlobalProcessObject = (node: MaybeNode): boolean => {
      if (isIdentifier("process")(unwrapExpression(node))) return !shadow.isShadowed("process");
      return isGlobalThisProcess(node);
    };
    const recordRuntimeSpecifier = (specifier: ESTree.ImportSpecifier) => {
      const imported = O.filter(getPropertyName(specifier.imported), (name) => HashSet.has(RUNTIME_PROPERTIES, name));
      if (O.isSome(imported)) MutableHashMap.set(nodeOsRuntimeImports, specifier.local.name, imported.value);
    };

    const recordSpecifier = (specifier: ESTree.ImportDeclaration["specifiers"][number]) => {
      if (specifier.type === "ImportSpecifier") return recordRuntimeSpecifier(specifier);
      MutableHashSet.add(nodeOsNamespaces, specifier.local.name);
    };

    const trackImportDeclaration = (node: ESTree.ImportDeclaration) => {
      const source = literalStringValue(node.source);
      if (O.isNone(source) || !HashSet.has(NODE_OS_MODULES, source.value)) return;
      for (const specifier of node.specifiers) recordSpecifier(specifier);
    };
    const namespacedRuntimeCall = (access: MemberAccess): O.Option<string> =>
      O.filter(
        access.object,
        (object) => object.type === "Identifier" && MutableHashSet.has(nodeOsNamespaces, object.name)
      ).pipe(
        O.flatMap(() => getPropertyName(access.property)),
        O.filter((property) => HashSet.has(RUNTIME_PROPERTIES, property))
      );
    const importedRuntimeCall = (callee: MaybeNode): O.Option<string> =>
      O.flatMap(unwrapExpression(callee), identifierName).pipe(
        O.flatMap((name) => MutableHashMap.get(nodeOsRuntimeImports, name))
      );

    const getNodeOsRuntimeCall = (callee: MaybeNode): O.Option<string> =>
      O.orElse(importedRuntimeCall(callee), () => O.flatMap(unwrapMemberExpression(callee), namespacedRuntimeCall));
    const globalProcessProperty = (node: ESTree.MemberExpression): O.Option<string> =>
      getPropertyName(node.property).pipe(
        O.filter((property) => HashSet.has(RUNTIME_PROPERTIES, property)),
        O.filter(() => isGlobalProcessObject(node.object))
      );

    return {
      before: resetBindings,
      ImportDeclaration: trackImportDeclaration,
      ...shadow.visitors,
      MemberExpression(node) {
        if (hostProcessReferenceFile) return;

        const property = globalProcessProperty(node);
        if (O.isNone(property)) return;

        context.report({ node, message: processReadMessage(property.value) });
      },
      CallExpression(node) {
        if (hostProcessReferenceFile) return;

        const property = getNodeOsRuntimeCall(node.callee);
        if (O.isNone(property)) return;

        context.report({ node, message: osCallMessage(property.value) });
      },
    };
  },
});
