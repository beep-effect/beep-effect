import * as Checker from "@beep/repo-docgen/Checker";
import * as Configuration from "@beep/repo-docgen/Configuration";
import * as Parser from "@beep/repo-docgen/Parser";
import { describe, expect, it, layer } from "@effect/vitest";
import { Effect, Layer } from "effect";
import * as P from "effect/Predicate";
import * as ast from "ts-morph";
import { defaultDocgenConfig } from "./helpers.ts";

const makeSourcefile = (source: string | ast.SourceFile) => {
  if (P.isString(source)) {
    const project = new ast.Project({
      compilerOptions: { strict: true },
      useInMemoryFileSystem: true,
    });
    const filename = "test.ts";
    return project.createSourceFile(filename, source);
  }
  return source;
};

const makeSource = (source: string | ast.SourceFile) => {
  const sourceFile = makeSourcefile(source);
  return Parser.SourceShape.new([sourceFile.getBaseName()], sourceFile);
};

const makeTestLayer = (source: string | ast.SourceFile, config: Partial<Configuration.ConfigurationShape>) =>
  Layer.mergeAll(
    Parser.Source.layer(makeSource(source)),
    Configuration.Configuration.layer({
      ...defaultDocgenConfig,
      ...config,
    })
  );

const expectEqual = <A>(actual: A, expected: A) => Effect.sync(() => expect(actual).toEqual(expected));

const failureTest = <A>(
  name: string,
  config: Partial<Configuration.ConfigurationShape>,
  sourceText: string,
  parser: Effect.Effect<A, never, Parser.Source | Configuration.Configuration>,
  checker: (value: A) => Effect.Effect<Array<string>, never, Configuration.Configuration | Parser.Source>,
  failure: ReadonlyArray<string>
) =>
  layer(makeTestLayer(sourceText, config))((it) =>
    it.effect(name, () =>
      parser.pipe(
        Effect.flatMap(
          Effect.fnUntraced(function* (value) {
            return yield* checker(value);
          })
        ),
        Effect.flatMap(
          Effect.fnUntraced(function* (actual) {
            return yield* expectEqual(actual, failure);
          })
        )
      )
    )
  );

describe("Checker", () => {
  describe("kind-aware example enforcement", () => {
    it.layer(
      makeTestLayer(
        `
/**
 * Returns a stable value.
 *
 * @since 1.0.0
 */
export const stableValue = 1
        `,
        { enforceExamples: true }
      )
    )("value-level exports", (it) => {
      it.effect(
        "rejects a value-level export without an Example",
        Effect.fnUntraced(function* () {
          const constants = yield* Parser.parseConstants;
          const errors = yield* Checker.checkConstants(constants);

          expect(errors).toHaveLength(1);
          expect(errors[0]).toContain("Missing examples");
        })
      );
    });

    it.layer(
      makeTestLayer(
        `
/**
 * Pure compile-time shape for a named value.
 *
 * @since 1.0.0
 */
export interface NamedValue { readonly name: string }

/**
 * Pure compile-time identifier.
 *
 * @since 1.0.0
 */
export type Identifier = string

/**
 * Compile-time declarations grouped under one name.
 *
 * @since 1.0.0
 */
export namespace Contracts {
  /**
   * Nested compile-time identifier.
   *
   * @since 1.0.0
   */
  export type NestedIdentifier = string
}
        `,
        { enforceExamples: true }
      )
    )("pure type-level exports", (it) => {
      it.effect(
        "accepts interfaces, type aliases, and namespaces without Examples",
        Effect.fnUntraced(function* () {
          const module = yield* Parser.parseModule;
          const errors = yield* Checker.checkModule(module);

          expect(errors).toEqual([]);
        })
      );
    });
  });

  describe("checkFunctions", () => {
    failureTest(
      "should raise an error if `@since` tag is missing",
      {},
      `
/** @since 1.0.0 */
export function a() {}

/** description */
export function b() {}
        `,
      Parser.parseFunctions,
      Checker.checkFunctions,
      [
        "Missing `@since` tag in file /test.ts:\n" +
          "\n" +
          "  4 |\n" +
          "  5 | /** description */\n" +
          "> 6 | export function b() {}\n" +
          "    | ^\n" +
          "  7 |         ",
      ]
    );

    it.layer(
      makeTestLayer(
        `
/**
 * Documented function.
 *
 * **Example** (Call the function)
 *
 * \`\`\`ts
 * import { documented } from "test"
 * console.log(documented())
 * \`\`\`
 *
 * @since 1.0.0
 */
export function documented() { return true }
        `,
        { enforceExamples: true }
      )
    )("titled example sections", (it) => {
      it.effect("accepts the repository's titled Example grammar", () =>
        Parser.parseFunctions.pipe(
          Effect.flatMap(Checker.checkFunctions),
          Effect.flatMap((actual) => expectEqual(actual, []))
        )
      );
    });
  });

  describe("checkExports", () => {
    it.layer(
      makeTestLayer("export { a }", {
        enforceDescriptions: true,
        enforceExamples: true,
        enforceVersion: true,
      })
    )("re-export edge documentation", (it) => {
      it.effect("treats a re-export as a graph edge rather than a documentation owner", () =>
        Parser.parseExports.pipe(
          Effect.flatMap(Checker.checkExports),
          Effect.flatMap((actual) => expectEqual(actual, []))
        )
      );
    });

    it.layer(
      makeTestLayer("/** Owner description. */\nexport const owner = 1\nexport { owner as alias }", {
        enforceDescriptions: false,
        enforceExamples: false,
        enforceVersion: true,
      })
    )("re-export owner documentation", (it) => {
      it.effect("validates an aliased re-export only through its owning declaration", () =>
        Effect.gen(function* () {
          const module = yield* Parser.parseModule;
          const actual = yield* Checker.checkModule(module);

          expect(actual).toHaveLength(1);
          expect(actual[0]).toContain("Missing `@since` tag");
        })
      );
    });
  });

  describe("checkNamespaces", () => {
    failureTest(
      "should raise an error if `@since` tag is missing",
      {},
      "export namespace A {}",
      Parser.parseNamespaces,
      Checker.checkNamespaces,
      ["Missing `@since` tag in file /test.ts:\n" + "\n" + "> 1 | export namespace A {}\n" + "    | ^"]
    );

    failureTest(
      "should raise an error if `@since` tag is missing on a nested interface",
      {},
      `
      /**
       * @since 1.0.0
       */
      export namespace A {
        export interface B {}
      }
      `,
      Parser.parseNamespaces,
      Checker.checkNamespaces,
      [
        "Missing `@since` tag in file /test.ts:\n" +
          "\n" +
          "  4 |        */\n" +
          "  5 |       export namespace A {\n" +
          "> 6 |         export interface B {}\n" +
          "    |         ^\n" +
          "  7 |       }\n" +
          "  8 |       ",
      ]
    );

    failureTest(
      "should raise an error if `@since` tag is missing on a nested type alias",
      {},
      `
      /**
       * @since 1.0.0
       */
      export namespace A {
        export type B = string
      }
      `,
      Parser.parseNamespaces,
      Checker.checkNamespaces,
      [
        "Missing `@since` tag in file /test.ts:\n" +
          "\n" +
          "  4 |        */\n" +
          "  5 |       export namespace A {\n" +
          "> 6 |         export type B = string\n" +
          "    |         ^\n" +
          "  7 |       }\n" +
          "  8 |       ",
      ]
    );

    failureTest(
      "should raise an error if `@since` tag is missing on a nested namespace",
      {},
      `
      /**
       * @since 1.0.0
       */
      export namespace A {
        export namespace B {}
      }
      `,
      Parser.parseNamespaces,
      Checker.checkNamespaces,
      [
        "Missing `@since` tag in file /test.ts:\n" +
          "\n" +
          "  4 |        */\n" +
          "  5 |       export namespace A {\n" +
          "> 6 |         export namespace B {}\n" +
          "    |         ^\n" +
          "  7 |       }\n" +
          "  8 |       ",
      ]
    );
  });

  describe("checkClasses", () =>
    failureTest(
      "should raise an error if `@since` tag is missing",
      {},
      "export class MyClass {}",
      Parser.parseClasses,
      Checker.checkClasses,
      ["Missing `@since` tag in file /test.ts:\n" + "\n" + "> 1 | export class MyClass {}\n" + "    | ^"]
    ));
});
