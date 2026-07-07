import { defineRule } from "@oxlint/plugins";
import { HashSet, MutableHashSet } from "effect";
import * as O from "effect/Option";
import {
  classifyImportSpecifier,
  getPropertyName,
  ImportBinding,
  unwrapExpression,
  unwrapMemberExpression,
} from "./utils.ts";
import type { ESTree } from "@oxlint/plugins";
import type { AstNode, MaybeNode } from "./utils.ts";

// Effect Schema decoder/encoder APIs allocate compiled functions. Keep them
// outside function bodies so hot paths do not rebuild compilers per call.
const COMPILER_METHODS = HashSet.fromIterable([
  "is",
  "asserts",
  "decodeEffect",
  "decodeExit",
  "decodeOption",
  "decodePromise",
  "decodeResult",
  "decodeSync",
  "decodeUnknownExit",
  "decodeUnknownEffect",
  "decodeUnknownOption",
  "decodeUnknownPromise",
  "decodeUnknownResult",
  "decodeUnknownSync",

  "encodeExit",
  "encodeEffect",
  "encodeOption",
  "encodePromise",
  "encodeResult",
  "encodeSync",
  "encodeUnknownExit",
  "encodeUnknownEffect",
  "encodeUnknownOption",
  "encodeUnknownPromise",
  "encodeUnknownResult",
  "encodeUnknownSync",
]);

// Sources whose `Schema` binding we trust: `effect` re-exports `Schema`; `effect/Schema` is the
// module itself (namespace/default) and re-exports a `Schema` named member.
const SCHEMA_NAMED_SOURCES = HashSet.fromIterable(["effect", "effect/Schema"]);
const SCHEMA_MODULE_SOURCES = HashSet.fromIterable(["effect/Schema"]);

const isStaticSchemaReference = (node: MaybeNode): boolean => {
  const expression = unwrapExpression(node);
  if (O.isNone(expression)) return false;

  if (expression.value.type === "Identifier") {
    const [firstChar] = expression.value.name;
    return firstChar !== undefined && firstChar.toUpperCase() === firstChar;
  }

  return expression.value.type === "MemberExpression";
};

const messageHigh = (method: string) =>
  `Hoist Schema.${method}(...) to module scope: both the inline schema literal and the compiled function are rebuilt on every call. Move the compiled function to a module-level const.`;

const messageMedium = (method: string) =>
  `Hoist Schema.${method}(...) to module scope: the compiled function is rebuilt on every call. Move it to a module-level const.`;

/**
 * Oxlint rule that reports Effect Schema decoder and encoder compiler calls
 * created inside function bodies instead of hoisted module constants.
 *
 * @example
 * ```ts
 * import { strictEqual } from "node:assert/strict"
 * import plugin from "@beep/lint-rules/oxlint"
 *
 * const description = plugin.rules["no-inline-schema-compile"]?.meta.docs.description
 *
 * strictEqual(description?.includes("hoist them to module scope"), true)
 * ```
 * @category tools
 * @since 0.1.0
 */
export default defineRule({
  meta: {
    type: "problem",
    docs: {
      description: "Disallow Schema decoder/encoder compiler calls inside function bodies; hoist them to module scope.",
    },
  },
  createOnce(context) {
    // Local names bound to the Schema module via imports (namespace, default, named, aliases).
    const schemaIdentifiers = MutableHashSet.empty<string>();
    let functionDepth = 0;

    const before = () => {
      MutableHashSet.clear(schemaIdentifiers);
      functionDepth = 0;
    };

    const isSchemaReceiver = (node: O.Option<AstNode>): boolean =>
      O.exists(
        node,
        (expression) => expression.type === "Identifier" && MutableHashSet.has(schemaIdentifiers, expression.name)
      );

    // Resolve a `<schemaBinding>.<method>` access to its compiler method name, if tracked.
    const compilerMethod = (callee: MaybeNode): O.Option<string> =>
      unwrapMemberExpression(callee).pipe(
        O.filter((access) => isSchemaReceiver(access.object)),
        O.flatMap((access) => getPropertyName(access.property)),
        O.filter((method) => HashSet.has(COMPILER_METHODS, method))
      );

    // Narrow `node` to a `<schemaBinding>.<method>(...)` call, yielding method name + arguments.
    const asSchemaMethodCall = (
      node: MaybeNode
    ): O.Option<{ readonly method: O.Option<string>; readonly args: ReadonlyArray<ESTree.Argument> }> =>
      unwrapExpression(node).pipe(
        O.filter((expression) => expression.type === "CallExpression"),
        O.flatMap((call) =>
          unwrapMemberExpression(call.callee).pipe(
            O.filter((access) => isSchemaReceiver(access.object)),
            O.map((access) => ({ method: getPropertyName(access.property), args: call.arguments }))
          )
        )
      );

    const isNestedStaticSchemaCall = (node: MaybeNode): boolean =>
      O.match(asSchemaMethodCall(node), {
        onNone: () => false,
        onSome: ({ method, args }) => {
          if (!O.exists(method, (name) => name === "fromJsonString")) return true;
          const [firstArg] = args;
          return isStaticSchemaReference(firstArg) || isNestedStaticSchemaCall(firstArg);
        },
      });

    // High when the first argument is itself a nested static schema call (literal + compiler both
    // rebuilt); medium when it is a plain static schema reference (only the compiler rebuilt).
    const reportMessage = (method: string, firstArg: MaybeNode): O.Option<string> => {
      const high = firstArg !== undefined && isNestedStaticSchemaCall(firstArg);
      if (high) return O.some(messageHigh(method));
      return isStaticSchemaReference(firstArg) ? O.some(messageMedium(method)) : O.none();
    };

    const tracksSchema = (source: string, binding: ImportBinding): boolean =>
      ImportBinding.match(binding, {
        named: ({ imported }) => imported === "Schema" && HashSet.has(SCHEMA_NAMED_SOURCES, source),
        namespace: () => HashSet.has(SCHEMA_MODULE_SOURCES, source),
        default: () => HashSet.has(SCHEMA_MODULE_SOURCES, source),
      });

    // Record `import { Schema }` / `import * as Schema` / `import Schema` bindings to the Schema module.
    const recordBinding = (source: string, binding: ImportBinding) => {
      if (tracksSchema(source, binding)) MutableHashSet.add(schemaIdentifiers, binding.local);
    };

    const enterFunction = () => {
      functionDepth++;
    };

    const exitFunction = () => {
      functionDepth--;
    };

    return {
      before,
      ImportDeclaration(node) {
        if (node.importKind === "type") return;
        const source = node.source.value;
        for (const specifier of node.specifiers) {
          O.match(classifyImportSpecifier(specifier), { onNone: () => {}, onSome: (b) => recordBinding(source, b) });
        }
      },
      FunctionDeclaration: enterFunction,
      "FunctionDeclaration:exit": exitFunction,
      FunctionExpression: enterFunction,
      "FunctionExpression:exit": exitFunction,
      ArrowFunctionExpression: enterFunction,
      "ArrowFunctionExpression:exit": exitFunction,
      CallExpression(node) {
        if (functionDepth === 0) return;

        const message = O.flatMap(compilerMethod(node.callee), (method) => reportMessage(method, node.arguments[0]));
        if (O.isNone(message)) return;

        context.report({ node: node.callee, message: message.value });
      },
    };
  },
});
