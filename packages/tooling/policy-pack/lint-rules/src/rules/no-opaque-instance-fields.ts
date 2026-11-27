/**
 * Oxlint rule reporting instance fields and methods on classes extending
 * `Schema.Opaque`, keeping opaque schema wrappers data-only.
 *
 * @packageDocumentation
 * @since 0.1.0
 */

import { defineRule } from "@oxlint/plugins";
import * as HashSet from "effect/HashSet";
import * as MutableHashSet from "effect/MutableHashSet";
import * as O from "effect/Option";
import {
  classifyImportSpecifier,
  getPropertyName,
  ImportBinding,
  unwrapExpression,
  unwrapMemberExpression,
} from "./utils.ts";
import type { ESTree } from "@oxlint/plugins";
import type { AstNode, MaybeNode, MemberAccess } from "./utils.ts";

const SCHEMA_SOURCES = HashSet.fromIterable(["effect", "effect/Schema"]);
const SCHEMA_MODULE_SOURCES = HashSet.fromIterable(["effect/Schema"]);
const EFFECT_ROOT_SOURCE = "effect";
const INSTANCE_MEMBER_TYPES = HashSet.fromIterable(["PropertyDefinition", "MethodDefinition"]);
const INSTANCE_MEMBER_MESSAGE = "Classes extending Schema.Opaque must not have instance members";

/**
 * Oxlint rule that reports instance fields and methods on classes extending
 * `Schema.Opaque`, keeping opaque schema wrappers data-only.
 *
 * **Details**
 *
 * The rule recognizes `Opaque` reached as a named import from `effect` or
 * `effect/Schema`, as `<Schema>.Opaque` where `<Schema>` is the `effect/Schema` module (namespace
 * or default import) or a named `Schema` import from `effect` or
 * `effect/Schema`, and as `<Effect>.Schema.Opaque` through a namespace or
 * default import of `effect`. It checks a class that extends the curried
 * application `Opaque<X>()(...)` of any of those; type-only imports and
 * same-named imports from other modules are ignored.
 *
 * **Example** (Opaque fields rule description)
 *
 * ```ts
 * import { strictEqual } from "node:assert/strict"
 * import plugin from "@beep/lint-rules/oxlint"
 *
 * const description = plugin.rules["no-opaque-instance-fields"]?.meta.docs.description
 *
 * strictEqual(description, "Disallow instance members in Schema.Opaque classes")
 * ```
 *
 * @category tools
 * @since 0.1.0
 */
export default defineRule({
  meta: {
    type: "problem",
    docs: { description: "Disallow instance members in Schema.Opaque classes" },
  },
  create(context) {
    const schemaIdentifiers = MutableHashSet.empty<string>();
    const opaqueIdentifiers = MutableHashSet.empty<string>();
    const effectRootNamespaces = MutableHashSet.empty<string>();

    const isTrackedIdentifier = (node: O.Option<AstNode>, tracked: MutableHashSet.MutableHashSet<string>): boolean =>
      O.exists(node, (expression) => expression.type === "Identifier" && MutableHashSet.has(tracked, expression.name));

    const memberOf = (object: O.Option<AstNode>): O.Option<MemberAccess> => O.flatMap(object, unwrapMemberExpression);

    const isTrackedAccess = (
      access: MemberAccess,
      name: string,
      tracked: MutableHashSet.MutableHashSet<string>
    ): boolean =>
      O.exists(getPropertyName(access.property), (member) => member === name) &&
      isTrackedIdentifier(access.object, tracked);

    const isEffectRootSchema = (object: O.Option<AstNode>): boolean =>
      O.exists(memberOf(object), (access) => isTrackedAccess(access, "Schema", effectRootNamespaces));

    const isSchemaReceiver = (object: O.Option<AstNode>): boolean =>
      isTrackedIdentifier(object, schemaIdentifiers) || isEffectRootSchema(object);

    const isOpaqueCallee = (node: MaybeNode): boolean => {
      if (isTrackedIdentifier(unwrapExpression(node), opaqueIdentifiers)) return true;
      return O.exists(
        unwrapMemberExpression(node),
        (access) =>
          O.exists(getPropertyName(access.property), (member) => member === "Opaque") && isSchemaReceiver(access.object)
      );
    };

    const isOpaqueCall = (callee: AstNode): boolean =>
      callee.type === "CallExpression" && isOpaqueCallee(callee.callee);

    const isSchemaOpaqueExtension = (node: ESTree.Class): boolean =>
      O.exists(
        unwrapExpression(node.superClass),
        (sc) => sc.type === "CallExpression" && O.exists(unwrapExpression(sc.callee), isOpaqueCall)
      );

    const isInstanceMember = (element: ESTree.ClassBody["body"][number]): boolean =>
      HashSet.has(INSTANCE_MEMBER_TYPES, element.type) && "static" in element && !element.static;

    const checkClass = (node: ESTree.Class) => {
      if (!isSchemaOpaqueExtension(node)) return;
      for (const element of node.body.body) {
        if (isInstanceMember(element)) {
          context.report({ node: element, message: INSTANCE_MEMBER_MESSAGE });
        }
      }
    };

    const recordNamedBinding = (imported: string, local: string) => {
      if (imported === "Schema") MutableHashSet.add(schemaIdentifiers, local);
      else if (imported === "Opaque") MutableHashSet.add(opaqueIdentifiers, local);
    };

    const recordModuleBinding = (source: string, local: string) => {
      if (HashSet.has(SCHEMA_MODULE_SOURCES, source)) MutableHashSet.add(schemaIdentifiers, local);
      else if (source === EFFECT_ROOT_SOURCE) MutableHashSet.add(effectRootNamespaces, local);
    };

    const recordBinding = (source: string, binding: ImportBinding) =>
      ImportBinding.match(binding, {
        named: ({ imported, local }) => recordNamedBinding(imported, local),
        namespace: ({ local }) => recordModuleBinding(source, local),
        default: ({ local }) => recordModuleBinding(source, local),
      });

    return {
      ImportDeclaration(node) {
        if (node.importKind === "type") return;
        const source = node.source.value;
        if (!HashSet.has(SCHEMA_SOURCES, source)) return;
        for (const specifier of node.specifiers) {
          O.match(classifyImportSpecifier(specifier), { onNone: () => {}, onSome: (b) => recordBinding(source, b) });
        }
      },
      ClassDeclaration: checkClass,
      ClassExpression: checkClass,
    };
  },
});
