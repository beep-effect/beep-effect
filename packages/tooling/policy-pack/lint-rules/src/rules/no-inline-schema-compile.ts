/**
 * Oxlint rule reporting Effect Schema decoder/encoder calls whose schema is
 * constructed inline inside a function body.
 *
 * @packageDocumentation
 * @since 0.1.0
 */

import { thunkFalse } from "@beep/utils/thunk";
import { defineRule } from "@oxlint/plugins";
import { HashSet, Match, MutableHashSet } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as Str from "effect/String";
import {
  classifyImportSpecifier,
  getPropertyName,
  ImportBinding,
  unwrapExpression,
  unwrapMemberExpression,
} from "./utils.ts";
import type { ESTree } from "@oxlint/plugins";
import type { AstNode, MaybeNode } from "./utils.ts";

// Effect caches each schema's parser per AST, so a decoder/encoder over a hoisted schema
// compiles once however often it is called. A schema constructed inline in a function body
// is a new AST on every call, misses that cache, and recompiles.
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
    return firstChar !== undefined && Str.toUpperCase(firstChar) === firstChar;
  }

  return expression.value.type === "MemberExpression" && isStaticSchemaReference(expression.value.object);
};

const inlineSchemaMessage = (method: string) =>
  `Hoist the schema passed to Schema.${method}(...) to module scope: inline schema construction defeats the per-AST parser cache, so every call builds and compiles a new schema.`;

/**
 * Oxlint rule that reports Effect Schema decoder and encoder calls whose
 * schema is constructed inline inside a function body.
 *
 * **Details**
 *
 * A plain schema reference is not reported: Effect caches each schema's
 * parser per AST, so `Schema.decodeUnknownSync(Model)` inside a function
 * compiles `Model` once. Only inline construction such as
 * `Schema.decodeSync(Schema.Array(Model))` builds a new AST per call.
 *
 * **Example** (Schema compile rule description)
 *
 * ```ts
 * import { strictEqual } from "node:assert/strict"
 * import plugin from "@beep/lint-rules/oxlint"
 *
 * const description = plugin.rules["no-inline-schema-compile"]?.meta.docs.description
 *
 * strictEqual(description?.includes("per-AST parser cache"), true)
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
        "Disallow Schema decoder/encoder calls over a schema constructed inline in a function body; hoist the schema to module scope so the per-AST parser cache applies.",
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
        O.filter(
          P.Struct({
            object: isSchemaReceiver,
          })
        ),
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

    const isStaticSchemaExpression = (node: MaybeNode): boolean => {
      const expression = unwrapExpression(node);
      if (O.isNone(expression)) return false;

      return Match.value(expression.value).pipe(
        Match.discriminator("type")("Identifier", isStaticSchemaReference),
        Match.discriminator("type")("MemberExpression", isStaticSchemaReference),
        Match.discriminator("type")("Literal", () => true),
        Match.discriminator("type")("ArrayExpression", ({ elements }) =>
          A.every(
            elements,
            (element) =>
              element === null ||
              isStaticSchemaExpression(element.type === "SpreadElement" ? element.argument : element)
          )
        ),
        Match.discriminator("type")("ObjectExpression", ({ properties }) =>
          A.every(properties, (property) => {
            if (property.type === "SpreadElement") return isStaticSchemaExpression(property.argument);
            if (property.computed && !isStaticSchemaExpression(property.key)) return false;
            return property.kind === "init" && !property.method && isStaticSchemaExpression(property.value);
          })
        ),
        Match.discriminator("type")("TemplateLiteral", ({ expressions }) => A.isReadonlyArrayEmpty(expressions)),
        Match.discriminator("type")(
          "UnaryExpression",
          ({ argument, operator }) =>
            (Str.Equivalence(operator, "-") || Str.Equivalence(operator, "+")) && isStaticSchemaExpression(argument)
        ),
        Match.discriminator("type")("CallExpression", (call) =>
          O.match(asSchemaMethodCall(call), {
            onNone: thunkFalse,
            onSome: ({ args }) => A.every(args, isStaticSchemaExpression),
          })
        ),
        Match.orElse(thunkFalse)
      );
    };

    const isNestedStaticSchemaCall = (node: MaybeNode): boolean =>
      O.match(asSchemaMethodCall(node), {
        onNone: thunkFalse,
        onSome: ({ args }) => A.every(args, isStaticSchemaExpression),
      });

    // Report only when the first argument constructs a static schema inline; a plain schema
    // reference hits the per-AST parser cache and is fine inside a function body.
    const reportMessage = (method: string, firstArg: MaybeNode): O.Option<string> =>
      isNestedStaticSchemaCall(firstArg) ? O.some(inlineSchemaMessage(method)) : O.none();

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
