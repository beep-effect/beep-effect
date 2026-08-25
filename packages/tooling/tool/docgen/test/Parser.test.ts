import * as Configuration from "@beep/repo-docgen/Configuration";
import * as Domain from "@beep/repo-docgen/Domain";
import * as Parser from "@beep/repo-docgen/Parser";
import * as Printer from "@beep/repo-docgen/Printer";
import { A, Str } from "@beep/utils";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer, Path, pipe } from "effect";
import * as P from "effect/Predicate";
import * as ast from "ts-morph";
import { defaultDocgenConfig } from "./helpers.ts";

let testCounter = 0;

const project = new ast.Project({
  compilerOptions: { strict: true },
  useInMemoryFileSystem: true,
});

const makeSourcefile = (source: string | ast.SourceFile) => {
  if (P.isString(source)) {
    const filename = `test.ts`;
    const existing = project.getSourceFile(filename);
    if (P.isNotNullish(existing)) {
      project.removeSourceFile(existing);
    }
    return project.createSourceFile(filename, source);
  }
  return source;
};

const makeSource = (source: string | ast.SourceFile) => {
  const sourceFile = makeSourcefile(source);
  const path = pipe(sourceFile.getFilePath(), Str.split(/[\\/]+/), A.filter(Str.isNonEmpty));
  return Parser.SourceShape.new(path, sourceFile);
};

const print = Effect.fn("print")(function* (printables: ReadonlyArray<Printer.Printable>) {
  const strings = yield* Effect.forEach(printables, (printable) => Printer.print(printable));
  return A.join("\n")(strings);
});

const isModule = (printableOr: ReadonlyArray<Printer.Printable> | Domain.Module): printableOr is Domain.Module =>
  !A.isArray(printableOr);

const makeParserTestLayer = (source: string | ast.SourceFile, config?: Partial<Configuration.ConfigurationShape>) =>
  Layer.mergeAll(
    Path.layer,
    Parser.Source.layer(makeSource(source)),
    Configuration.Configuration.layer({
      ...defaultDocgenConfig,
      ...config,
    })
  );

const runInLayer = <A, E, R, E2>(layer: Layer.Layer<R, E2>, effect: Effect.Effect<A, E, R>) =>
  Effect.scoped(
    Layer.build(layer).pipe(
      Effect.flatMap(
        Effect.fnUntraced(function* (context) {
          return yield* effect.pipe(Effect.provide(context));
        })
      )
    )
  );

const runSyncInLayer = <A, E, R>(layer: Layer.Layer<R, E>, effect: Effect.Effect<A, E, R>) =>
  Effect.scoped(
    Layer.build(layer).pipe(
      Effect.flatMap(
        Effect.fnUntraced(function* (context) {
          return yield* effect.pipe(Effect.provide(context));
        })
      )
    )
  ).pipe(Effect.runSync);

const expectMarkdown = Effect.fn("ParserTest.expectMarkdown")(function* <E>(
  eff: Effect.Effect<
    ReadonlyArray<Printer.Printable> | Domain.Module,
    E,
    Parser.Source | Configuration.Configuration | Path.Path
  >,
  source: string | ast.SourceFile,
  expected: string,
  config?: Partial<Configuration.ConfigurationShape>
) {
  const actual = yield* runInLayer(
    makeParserTestLayer(source, config),
    eff.pipe(
      Effect.flatMap(
        Effect.fnUntraced(function* (printableOr) {
          if (isModule(printableOr)) {
            return yield* Printer.printModule(printableOr);
          }
          return yield* print(printableOr);
        })
      )
    )
  );
  expect(actual).toBe(expected);
});

// `vitest.shared.ts` sets `sequence.concurrent`, and `makeSourcefile` removes
// and recreates the same `test.ts` inside one shared ts-morph project. Run
// concurrently, a case parses whatever source the previous one happened to
// install. That was latent while these cases returned an Effect nobody ran.
describe("Parser", { concurrent: false }, () => {
  describe("parseModule", () => {
    it.effect("preserves nested source paths in generated source links", () =>
      Effect.gen(function* () {
        const sourceFile = project.createSourceFile(
          "src/entities/Agent/Agent.model.ts",
          `/**
 * Agent model value.
 *
 * @category entity
 * @since 0.0.0
 */
export const Agent = "agent"`,
          { overwrite: true }
        );

        yield* expectMarkdown(
          Parser.parseConstants,
          sourceFile,
          `## Agent

Agent model value.

**Signature**

\`\`\`ts
declare const Agent: "agent"
\`\`\`

[Source](https://github.com/effect-ts/docgen/blob/main/src/entities/Agent/Agent.model.ts#L7)

Since v0.0.0`
        );
      })
    );

    it.effect("should not require an example for modules when `enforceExamples` is set to true", () =>
      expectMarkdown(
        Parser.parseModule,
        `/**
* This is the assert module.
*
* @since 1.0.0
*/
import * as assert from 'assert'

/**
 * This is the foo export.
 *
 * @example
 * import { foo } from 'test'
 *
 * console.log(foo)
 *
 * @category category
 * @since 1.0.0
 */
export const foo = 'foo'`,
        `## test.ts overview

This is the assert module.

Since v1.0.0

<!-- toc -->

# category

## foo

This is the foo export.

**Example**

\`\`\`ts
import { foo } from 'test'

console.log(foo)
\`\`\`

**Signature**

\`\`\`ts
declare const foo: "foo"
\`\`\`

[Source](https://github.com/effect-ts/docgen/blob/main/src/test.ts#L19)

Since v1.0.0`
      )
    );

    it.effect("should ignore non-JSDoc comments above JSDoc comments", () =>
      expectMarkdown(
        Parser.parseModule,
        `/**
* This is the assert module.
*
* @since 1.0.0
*/
import * as assert from 'assert'

// This comment should be ignored

/**
 * This is the foo export.
 *
 * @example
 * import { foo } from 'test'
 *
 * console.log(foo)
 *
 * @category category
 * @since 1.0.0
 */
export const foo = 'foo'`,
        `## test.ts overview

This is the assert module.

Since v1.0.0

<!-- toc -->

# category

## foo

This is the foo export.

**Example**

\`\`\`ts
import { foo } from 'test'

console.log(foo)
\`\`\`

**Signature**

\`\`\`ts
declare const foo: "foo"
\`\`\`

[Source](https://github.com/effect-ts/docgen/blob/main/src/test.ts#L21)

Since v1.0.0`
      )
    );
  });

  describe("parseFunctions", () => {
    it.effect("strips internal properties from rendered signatures", () =>
      Effect.gen(function* () {
        const functions = yield* runInLayer(
          makeParserTestLayer(`/**
 * Reads the public state.
 *
 * @since 1.0.0
 */
export function readState(): {
  readonly visible: string
  /** @internal */
  readonly hidden?: number
} {
  return { visible: "ready" }
}`),
          Parser.parseFunctions
        );

        expect(functions[0]?.signature).toBe("declare const readState: () => { readonly visible: string; }");
      })
    );

    it.effect(
      `should remove all metadata from typedcript code blocks when the theme is ${Configuration.DEFAULT_THEME}`,
      () =>
        expectMarkdown(
          Parser.parseFunctions,
          `/**
         * \`\`\`ts skip-type-checking a=1 showLineNumbers=true
         * const a: string = 1
         * \`\`\`
         *
         * @since 1.0.0
         */
         export function myfunc<A>() {}`,
          `## myfunc

\`\`\`ts
const a: string = 1
\`\`\`

**Signature**

\`\`\`ts
declare const myfunc: <A>() => void
\`\`\`

[Source](https://github.com/effect-ts/docgen/blob/main/src/test.ts#L8)

Since v1.0.0`
        )
    );
    it.effect("generics", () =>
      expectMarkdown(
        Parser.parseFunctions,
        `/**
         * This is a description containing two links to {@link foo} and {@link bar}.
         *
         * @since 1.2.0
         */
        export function myfunc<A>() {}`,
        `## myfunc

This is a description containing two links to \`foo\` and \`bar\`.

**Signature**

\`\`\`ts
declare const myfunc: <A>() => void
\`\`\`

[Source](https://github.com/effect-ts/docgen/blob/main/src/test.ts#L6)

Since v1.2.0`
      )
    );

    it.effect("description", () =>
      expectMarkdown(
        Parser.parseFunctions,
        `/**
         * This is a description containing two links to {@link foo} and {@link bar}.
         *
         * @since 1.2.0
         */
        export function myfunc() {}`,
        `## myfunc

This is a description containing two links to \`foo\` and \`bar\`.

**Signature**

\`\`\`ts
declare const myfunc: () => void
\`\`\`

[Source](https://github.com/effect-ts/docgen/blob/main/src/test.ts#L6)

Since v1.2.0`
      )
    );

    it.effect("throws", () =>
      expectMarkdown(
        Parser.parseFunctions,
        `/**
         * description...
         * @throws \`Error1\` - Description 1
         * @throws \`Error2\` - Description 2
         * @since 1.2.0
         */
        export function myfunc() {}`,
        `## myfunc

description...

**Throws**

\`Error1\` - Description 1
\`Error2\` - Description 2

**Signature**

\`\`\`ts
declare const myfunc: () => void
\`\`\`

[Source](https://github.com/effect-ts/docgen/blob/main/src/test.ts#L7)

Since v1.2.0`
      )
    );

    it.effect("sees", () =>
      expectMarkdown(
        Parser.parseFunctions,
        `/**
         * description...
         * @see \`foo\` Description 1
         * @see {@link bar} Description 2
         * @see {@link baz quux} Description 2
         * @since 1.2.0
         */
        export function myfunc() {}`,
        `## myfunc

description...

**See**

- \`foo\` Description 1
- \`bar\` Description 2
- \`quux\` Description 2

**Signature**

\`\`\`ts
declare const myfunc: () => void
\`\`\`

[Source](https://github.com/effect-ts/docgen/blob/main/src/test.ts#L8)

Since v1.2.0`
      )
    );

    it.effect("example without fence", () =>
      expectMarkdown(
        Parser.parseFunctions,
        `/**
         * description...
         * @example
         * const x = 1
         * @since 1.0.0
         */
        export function myfunc() {}`,
        `## myfunc

description...

**Example**

\`\`\`ts
const x = 1
\`\`\`

**Signature**

\`\`\`ts
declare const myfunc: () => void
\`\`\`

[Source](https://github.com/effect-ts/docgen/blob/main/src/test.ts#L7)

Since v1.0.0`
      )
    );

    it.effect("example with backtick fence", () =>
      expectMarkdown(
        Parser.parseFunctions,
        `/**
         * description...
         * @example
         * \`\`\`ts
         * const x = 1
         * \`\`\`
         * @since 1.0.0
         */
        export function myfunc() {}`,
        `## myfunc

description...

**Example**

\`\`\`ts
const x = 1
\`\`\`

**Signature**

\`\`\`ts
declare const myfunc: () => void
\`\`\`

[Source](https://github.com/effect-ts/docgen/blob/main/src/test.ts#L9)

Since v1.0.0`
      )
    );

    it.effect("2 examples", () =>
      expectMarkdown(
        Parser.parseFunctions,
        `/**
         * description...
         * @example
         * \`\`\`ts
         * const x = 1
         * \`\`\`
         * @example
         * \`\`\`ts
         * const x = 2
         * \`\`\`
         * @since 1.0.0
         */
        export function myfunc() {}`,
        `## myfunc

description...

**Example**

\`\`\`ts
const x = 1
\`\`\`

**Example**

\`\`\`ts
const x = 2
\`\`\`

**Signature**

\`\`\`ts
declare const myfunc: () => void
\`\`\`

[Source](https://github.com/effect-ts/docgen/blob/main/src/test.ts#L13)

Since v1.0.0`
      )
    );

    it.effect("example with metas", () =>
      expectMarkdown(
        Parser.parseFunctions,
        `/**
         * description...
         * @example
         * \`\`\`ts a=1
         * const x = 1
         * \`\`\`
         * @since 1.0.0
         */
        export function myfunc() {}`,
        `## myfunc

description...

**Example**

\`\`\`ts a=1
const x = 1
\`\`\`

**Signature**

\`\`\`ts
declare const myfunc: () => void
\`\`\`

[Source](https://github.com/effect-ts/docgen/blob/main/src/test.ts#L9)

Since v1.0.0`
      )
    );

    it.effect("example with titde fence", () =>
      expectMarkdown(
        Parser.parseFunctions,
        `/**
         * description...
         * @example
         * ~~~ts
         * const x = 1
         * ~~~
         * @since 1.0.0
         */
        export function myfunc() {}`,
        `## myfunc

description...

**Example**

~~~ts
const x = 1
~~~

**Signature**

\`\`\`ts
declare const myfunc: () => void
\`\`\`

[Source](https://github.com/effect-ts/docgen/blob/main/src/test.ts#L9)

Since v1.0.0`
      )
    );

    it.effect("should not return private function declarations", () =>
      expectMarkdown(
        Parser.parseFunctions,
        `/**
         * description...
         */
        function myfunc() {}`,
        ""
      )
    );

    it.effect("should not return ignored function declarations", () =>
      expectMarkdown(
        Parser.parseFunctions,
        `/**
         * @ignore
         */
        export function myfunc() {}`,
        ""
      )
    );

    it.effect("should not return ignored function declarations with overloads", () =>
      expectMarkdown(
        Parser.parseFunctions,
        `/**
          * @ignore
          */
          export function sum(a: number, b: number)
          export function sum(a: number, b: number): number { return a + b }`,
        ""
      )
    );

    it.effect("should not return internal function declarations", () =>
      expectMarkdown(
        Parser.parseFunctions,
        `/**
          * @internal
          */
          export function sum(a: number, b: number): number { return a + b }`,
        ""
      )
    );

    it.effect("should not return internal function declarations even with overloads", () =>
      expectMarkdown(
        Parser.parseFunctions,
        `/**
          * @internal
          */
          export function sum(a: number, b: number)
          export function sum(a: number, b: number): number { return a + b }`,
        ""
      )
    );

    it.effect("should not return private const function declarations", () =>
      expectMarkdown(Parser.parseFunctions, `const sum = (a: number, b: number): number => a + b `, "")
    );

    it.effect("should not return internal const function declarations", () =>
      expectMarkdown(
        Parser.parseFunctions,
        `/**
          * @internal
          */
          export const sum = (a: number, b: number): number => a + b `,
        ""
      )
    );

    it.effect("should account for nullable polymorphic return types", () =>
      expectMarkdown(
        Parser.parseFunctions,
        `/**
          * @since 1.0.0
          */
         export const toNullable = <A>(ma: A | null): A | null => ma`,
        `## toNullable

**Signature**

\`\`\`ts
declare const toNullable: <A>(ma: A | null) => A | null
\`\`\`

[Source](https://github.com/effect-ts/docgen/blob/main/src/test.ts#L4)

Since v1.0.0`
      )
    );

    it.effect("should handle a const function declaration", () =>
      expectMarkdown(
        Parser.parseFunctions,
        `/**
          * a description...
          * @since 1.0.0
          * @example
          * assert.deepStrictEqual(f(1, 2), { a: 1, b: 2 })
          * @example
          * assert.deepStrictEqual(f(3, 4), { a: 3, b: 4 })
          * @deprecated
          */
          export const f = (a: number, b: number): { [key: string]: number } => ({ a, b })`,
        `## ~~f~~

a description...

**Example**

\`\`\`ts
assert.deepStrictEqual(f(1, 2), { a: 1, b: 2 })
\`\`\`

**Example**

\`\`\`ts
assert.deepStrictEqual(f(3, 4), { a: 3, b: 4 })
\`\`\`

**Signature**

\`\`\`ts
declare const f: (a: number, b: number) => { [key: string]: number; }
\`\`\`

[Source](https://github.com/effect-ts/docgen/blob/main/src/test.ts#L10)

Since v1.0.0`
      )
    );

    it.effect("should handle a function declaration", () =>
      expectMarkdown(
        Parser.parseFunctions,
        `/**
        * @since 1.0.0
        */
        export function f(a: number, b: number): { [key: string]: number } { return { a, b } }`,
        `## f

**Signature**

\`\`\`ts
declare const f: (a: number, b: number) => { [key: string]: number; }
\`\`\`

[Source](https://github.com/effect-ts/docgen/blob/main/src/test.ts#L4)

Since v1.0.0`
      )
    );

    it.effect("should handle overloadings", () =>
      expectMarkdown(
        Parser.parseFunctions,
        `/**
        * a description...
        * @since 1.0.0
        * @deprecated
        */
        export function f(a: Int, b: Int): { [key: string]: number }
        export function f(a: number, b: number): { [key: string]: number }
        export function f(a: any, b: any): { [key: string]: number } { return { a, b } }`,
        `## ~~f~~

a description...

**Signature**

\`\`\`ts
declare const f: { (a: Int, b: Int): { [key: string]: number; }; (a: number, b: number): { [key: string]: number; }; }
\`\`\`

[Source](https://github.com/effect-ts/docgen/blob/main/src/test.ts#L8)

Since v1.0.0`
      )
    );
  });

  describe("parseConstants", () => {
    it.effect("should handle a constant value", () =>
      expectMarkdown(
        Parser.parseConstants,
        `/**
          * a description...
          * @since 1.0.0
          * @deprecated
          */
          export const s: string = ''`,
        `## ~~s~~

a description...

**Signature**

\`\`\`ts
declare const s: string
\`\`\`

[Source](https://github.com/effect-ts/docgen/blob/main/src/test.ts#L6)

Since v1.0.0`
      )
    );

    it.effect("should support constants with default type parameters", () =>
      expectMarkdown(
        Parser.parseConstants,
        `/**
          * @since 1.0.0
          */
          export const left: <E = never, A = never>(l: E) => string = T.left`,
        `## left

**Signature**

\`\`\`ts
declare const left: <E = never, A = never>(l: E) => string
\`\`\`

[Source](https://github.com/effect-ts/docgen/blob/main/src/test.ts#L4)

Since v1.0.0`
      )
    );

    it.effect("should support untyped constants", () =>
      expectMarkdown(
        Parser.parseConstants,
        `
      class A {
        static make(): A {
          return new A()
        }
      }
    /**
      * @since 1.0.0
      */
      export const empty = A.make()`,
        `## empty

**Signature**

\`\`\`ts
declare const empty: A
\`\`\`

[Source](https://github.com/effect-ts/docgen/blob/main/src/test.ts#L10)

Since v1.0.0`
      )
    );

    it.effect("should handle constants with typeof annotations", () =>
      expectMarkdown(
        Parser.parseConstants,
        ` const task: { a: number } = {
        a: 1
      }
      /**
      * @since 1.0.0
      */
      export const taskSeq: typeof task = {
        ...task,
        ap: (mab, ma) => () => mab().then(f => ma().then(a => f(a)))
      }`,
        `## taskSeq

**Signature**

\`\`\`ts
declare const taskSeq: { a: number; }
\`\`\`

[Source](https://github.com/effect-ts/docgen/blob/main/src/test.ts#L7)

Since v1.0.0`
      )
    );

    it.effect("should not include variables declared in for loops", () =>
      expectMarkdown(
        Parser.parseConstants,
        ` const object = { a: 1, b: 2, c: 3 };

      for (const property in object) {
        console.log(property);
      }`,
        ""
      )
    );
  });

  describe("parseTypeAliases", () =>
    it.effect("should return a type alias", () =>
      expectMarkdown(
        Parser.parseTypeAliases,
        `
        type None<A> = { readonly _tag: "None" }
        type Some<A> = { readonly _tag: "Some"; readonly value: A }
        /**
          * a description...
          * @since 1.0.0
          * @deprecated
          */
          export type Option<A> = None<A> | Some<A>`,
        `## ~~Option~~ (type alias)

a description...

**Signature**

\`\`\`ts
type Option<A> = None<A> | Some<A>
\`\`\`

[Source](https://github.com/effect-ts/docgen/blob/main/src/test.ts#L9)

Since v1.0.0`
      )
    ));

  describe("parseExports", () => {
    it.effect("should return no exports if the file is empty", () => expectMarkdown(Parser.parseExports, "", ""));

    it.effect("should return an `Export`", () =>
      expectMarkdown(
        Parser.parseExports,
        `
        const a = 1;
        const b = 2;
        export {
          /**
           * description_of_a
           * \`\`\`ts
           * const a: string = 1
           * \`\`\`
           *
           * @since 1.0.0
           */
          a,
          /**
           * description_of_b
           * @since 2.0.0
           */
          b
        }`,
        `## a

description_of_a
\`\`\`ts
const a: string = 1
\`\`\`

**Signature**

\`\`\`ts
declare const a: 1
\`\`\`

[Source](https://github.com/effect-ts/docgen/blob/main/src/test.ts#L13)

Since v1.0.0
## b

description_of_b

**Signature**

\`\`\`ts
declare const b: 2
\`\`\`

[Source](https://github.com/effect-ts/docgen/blob/main/src/test.ts#L18)

Since v2.0.0`
      )
    );

    it.effect("should handle renamimg", () =>
      expectMarkdown(
        Parser.parseExports,
        `const a = 1;
        export {
          /**
            * @since 1.0.0
            */
            a as b
          }`,
        `## b

**Signature**

\`\`\`ts
declare const b: 1
\`\`\`

[Source](https://github.com/effect-ts/docgen/blob/main/src/test.ts#L6)

Since v1.0.0`
      )
    );

    it("should handle a single re-export", () => {
      project.createSourceFile("a.ts", `export const a = 1`);
      const sourceFile = project.createSourceFile(
        "b.ts",
        `import { a } from './a'
        const b = a
        export {
          /**
            * @since 1.0.0
            */
          b
        }`
      );
      const actual = runSyncInLayer(makeParserTestLayer(sourceFile), Parser.parseExports);
      expect(actual).toEqual([
        Domain.Export.new(
          "b",
          Domain.Doc.new(undefined, {
            since: ["1.0.0"],
            deprecated: [],
            examples: [],
            category: [],
            throws: [],
            sees: [],
            tags: {
              since: ["1.0.0"],
            },
          }),
          {
            signature: "declare const b: 1",
            position: Domain.Position.new(7, 11),
            isNamespaceExport: false,
          }
        ),
      ]);
    });

    it("should handle `export * from ...`", () => {
      project.createSourceFile("example.ts", `export const a = 1`, { overwrite: true });

      const sourceFile = project.createSourceFile(
        "export-all.ts",
        `
         /**
          * @since 1.0.0
          */
         export * from './example'
        `
      );

      const actual = runSyncInLayer(makeParserTestLayer(sourceFile), Parser.parseExports);

      expect(actual).toEqual([
        Domain.Export.new(
          "'./example'",
          Domain.Doc.new("Re-exports all named exports from the './example' module.", {
            since: ["1.0.0"],
            deprecated: [],
            examples: [],
            category: [],
            throws: [],
            sees: [],
            tags: {
              since: ["1.0.0"],
            },
          }),
          {
            signature: "export * from './example'",
            position: Domain.Position.new(5, 10),
            isNamespaceExport: true,
          }
        ),
      ]);
    });

    it("should handle `export * as ... from ...`", () => {
      project.createSourceFile("example.ts", `export const a = 1`, { overwrite: true });

      const sourceFile = project.createSourceFile(
        "export-all-namespace.ts",
        `
          /**
           * @since 1.0.0
           */
          export * as example from './example'
        `
      );

      const actual = runSyncInLayer(makeParserTestLayer(sourceFile), Parser.parseExports);

      expect(actual).toEqual([
        Domain.Export.new(
          "example",
          Domain.Doc.new("Re-exports all named exports from the './example' module as `example`.", {
            since: ["1.0.0"],
            deprecated: [],
            examples: [],
            category: [],
            throws: [],
            sees: [],
            tags: {
              since: ["1.0.0"],
            },
          }),
          {
            signature: "export * as example from './example'",
            position: Domain.Position.new(5, 11),
            isNamespaceExport: true,
          }
        ),
      ]);
    });

    it("should ignore empty export markers", () => {
      const sourceFile = project.createSourceFile("empty-export.ts", `export {};`, { overwrite: true });

      const actual = runSyncInLayer(makeParserTestLayer(sourceFile), Parser.parseExports);

      expect(actual).toEqual([]);
    });
  });

  describe("parseInterfaces", () => {
    it.effect("should return no interfaces if the file is empty", () => expectMarkdown(Parser.parseInterfaces, "", ""));

    it.effect("should return no interfaces if there are no exported interfaces", () =>
      expectMarkdown(Parser.parseInterfaces, "interface A {}", "")
    );

    it.effect("should return an interface", () =>
      expectMarkdown(
        Parser.parseInterfaces,
        `/**
      * a description...
      * @since 1.0.0
      * @deprecated
      */
      export interface A {}`,
        `## ~~A~~ (interface)

a description...

**Signature**

\`\`\`ts
export interface A {}
\`\`\`

[Source](https://github.com/effect-ts/docgen/blob/main/src/test.ts#L6)

Since v1.0.0`
      )
    );
  });

  describe("parseNamespaces", () => {
    it.effect("should return no namespaces if the file is empty", () => expectMarkdown(Parser.parseNamespaces, "", ""));

    it.effect("should return no namespaces if there are no exported namespaces", () =>
      expectMarkdown(Parser.parseNamespaces, "namespace A {}", "")
    );

    it.effect("should parse an empty Namespace", () =>
      expectMarkdown(
        Parser.parseNamespaces,
        `
      /**
       * @since 1.0.0
       */
      export namespace A {}
      `,
        `## A (namespace)

[Source](https://github.com/effect-ts/docgen/blob/main/src/test.ts#L5)

Since v1.0.0`
      )
    );

    describe("namespace > interfaces", () => {
      it.effect("should ignore not exported interfaces", () =>
        expectMarkdown(
          Parser.parseNamespaces,
          `
        /**
         * @since 1.0.0
         */
        export namespace A {
          interface C {}
        }
        `,
          `## A (namespace)

[Source](https://github.com/effect-ts/docgen/blob/main/src/test.ts#L5)

Since v1.0.0`
        )
      );

      it.effect("should parse an interface", () =>
        expectMarkdown(
          Parser.parseNamespaces,
          `
/**
 * @since 1.0.0
 */
export namespace A {
  /**
   * @since 1.0.1
   */
  export interface B {
    readonly d: boolean
  }
}
        `,
          `## A (namespace)

[Source](https://github.com/effect-ts/docgen/blob/main/src/test.ts#L5)

Since v1.0.0

### B (interface)

**Signature**

\`\`\`ts
export interface B {
    readonly d: boolean
  }
\`\`\`

[Source](https://github.com/effect-ts/docgen/blob/main/src/test.ts#L9)

Since v1.0.1`
        )
      );
    });

    describe("namespace > type aliases", () => {
      it.effect("should ignore not exported type aliases", () =>
        expectMarkdown(
          Parser.parseNamespaces,
          `
        /**
         * @since 1.0.0
         */
        export namespace A {
          type C = number
        }
        `,
          `## A (namespace)

[Source](https://github.com/effect-ts/docgen/blob/main/src/test.ts#L5)

Since v1.0.0`
        )
      );

      it.effect("should parse a type alias", () =>
        expectMarkdown(
          Parser.parseNamespaces,
          `
        /**
         * @since 1.0.0
         */
        export namespace A {
          /**
           * @since 1.0.1
           */
          export type B = string
        }
        `,
          `## A (namespace)

[Source](https://github.com/effect-ts/docgen/blob/main/src/test.ts#L5)

Since v1.0.0

### B (type alias)

**Signature**

\`\`\`ts
type B = string
\`\`\`

[Source](https://github.com/effect-ts/docgen/blob/main/src/test.ts#L9)

Since v1.0.1`
        )
      );
    });

    describe("namespace > nested namespaces", () => {
      it.effect("should ignore not exported namespaces", () =>
        expectMarkdown(
          Parser.parseNamespaces,
          `
        /**
         * @since 1.0.0
         */
        export namespace A {
          namespace B {}
        }
        `,
          `## A (namespace)

[Source](https://github.com/effect-ts/docgen/blob/main/src/test.ts#L5)

Since v1.0.0`
        )
      );

      it.effect("should parse a namespace", () =>
        expectMarkdown(
          Parser.parseNamespaces,
          `
        /**
         * @since 1.0.0
         */
        export namespace A {
          /**
           * @since 1.0.1
           */
          export namespace B {
            /**
             * @since 1.0.2
             */
            export type C = string
          }
        }
        `,
          `## A (namespace)

[Source](https://github.com/effect-ts/docgen/blob/main/src/test.ts#L5)

Since v1.0.0

### B (namespace)

[Source](https://github.com/effect-ts/docgen/blob/main/src/test.ts#L9)

Since v1.0.1

#### C (type alias)

**Signature**

\`\`\`ts
type C = string
\`\`\`

[Source](https://github.com/effect-ts/docgen/blob/main/src/test.ts#L13)

Since v1.0.2`
        )
      );
    });
  });

  describe("parseClasses", () => {
    it.effect("should ignore `@internal` classes", () =>
      expectMarkdown(Parser.parseClasses, `/** @internal */export class MyClass {}`, "")
    );

    it.effect("should ignore `@ignore` classes", () =>
      expectMarkdown(
        Parser.parseClasses,
        `
        /** @ignore */
        export class MyClass {}
        `,
        ""
      )
    );

    it.effect("should ignore not exported classes", () =>
      expectMarkdown(
        Parser.parseClasses,
        `
        class MyClass {}
        `,
        ""
      )
    );

    it.effect("should skip ignored properties", () =>
      expectMarkdown(
        Parser.parseClasses,
        `/**
      * @since 1.0.0
      */
      export class MyClass<A> {
        /**
         * @ignore
         */
        readonly _A!: A
      }`,
        `## MyClass (class)

**Signature**

\`\`\`ts
declare class MyClass<A>
\`\`\`

[Source](https://github.com/effect-ts/docgen/blob/main/src/test.ts#L4)

Since v1.0.0`
      )
    );

    it.effect("should skip the constructor body", () =>
      expectMarkdown(
        Parser.parseClasses,
        `/**
      * description
      * @since 1.0.0
      */
      export class C { constructor() {} }`,
        `## C (class)

description

**Signature**

\`\`\`ts
declare class C { constructor() }
\`\`\`

[Source](https://github.com/effect-ts/docgen/blob/main/src/test.ts#L5)

Since v1.0.0`
      )
    );

    it("should get a constructor declaration signature", () => {
      const sourceFile = project.createSourceFile(
        `test-${testCounter++}.ts`,
        `
      /**
       * @since 1.0.0
       */
      declare class A {
        constructor()
      }
    `
      );

      const constructorDeclaration = sourceFile.getClass("A")!.getConstructors()[0];

      expect(Parser.getConstructorDeclarationSignature(constructorDeclaration)).toEqual("constructor()");
    });

    it.effect("should handle non-readonly properties", () =>
      expectMarkdown(
        Parser.parseClasses,
        `/**
      * description
      * @since 1.0.0
      */
      export class C {
        /**
         * @since 1.0.0
         */
        a: string
      }`,
        `## C (class)

description

**Signature**

\`\`\`ts
declare class C
\`\`\`

[Source](https://github.com/effect-ts/docgen/blob/main/src/test.ts#L5)

Since v1.0.0

### a (property)

**Signature**

\`\`\`ts
a: string
\`\`\`

[Source](https://github.com/effect-ts/docgen/blob/main/src/test.ts#L9)

Since v1.0.0`
      )
    );

    it.effect("should parse public getters and exclude ignored, private, and static getters", () =>
      expectMarkdown(
        Parser.parseClasses,
        `/**
      * description
      * @since 1.0.0
      */
      export class C {
        /**
         * visible getter
         * @since 1.1.0
         */
        get value(): string { return "value" }
        /** @ignore */
        get ignored(): string { return "ignored" }
        private get secret(): string { return "secret" }
        static get version(): number { return 1 }
      }`,
        `## C (class)

description

**Signature**

\`\`\`ts
declare class C
\`\`\`

[Source](https://github.com/effect-ts/docgen/blob/main/src/test.ts#L5)

Since v1.0.0

### value (property)

visible getter

**Signature**

\`\`\`ts
readonly value: string
\`\`\`

[Source](https://github.com/effect-ts/docgen/blob/main/src/test.ts#L10)

Since v1.1.0`
      )
    );

    it.effect("should return a `Class`", () =>
      expectMarkdown(
        Parser.parseClasses,
        `/**
      * a class description...
      * @since 1.0.0
      * @deprecated
      */
      export class Test {
        /**
         * a property...
         * @since 1.1.0
         * @deprecated
         */
        readonly a: string
        private readonly b: number
        /**
         * a static method description...
         * @since 1.1.0
         * @deprecated
         */
        static f(): void {}
        constructor(readonly value: string) { }
        /**
         * a method description...
         * @since 1.1.0
         * @deprecated
         */
        g(a: number, b: number): { [key: string]: number } {
          return { a, b }
        }
      }`,
        `## ~~Test~~ (class)

a class description...

**Signature**

\`\`\`ts
declare class Test { constructor(readonly value: string) }
\`\`\`

[Source](https://github.com/effect-ts/docgen/blob/main/src/test.ts#L6)

Since v1.0.0

### ~~f~~ (static method)

a static method description...

**Signature**

\`\`\`ts
declare const f: () => void
\`\`\`

[Source](https://github.com/effect-ts/docgen/blob/main/src/test.ts#L19)

Since v1.1.0

### ~~g~~ (method)

a method description...

**Signature**

\`\`\`ts
declare const g: (a: number, b: number) => { [key: string]: number; }
\`\`\`

[Source](https://github.com/effect-ts/docgen/blob/main/src/test.ts#L26)

Since v1.1.0

### ~~a~~ (property)

a property...

**Signature**

\`\`\`ts
readonly a: string
\`\`\`

[Source](https://github.com/effect-ts/docgen/blob/main/src/test.ts#L12)

Since v1.1.0`
      )
    );

    it.effect("should handle method overloadings", () =>
      expectMarkdown(
        Parser.parseClasses,
        `/**
      * a class description...
      * @since 1.0.0
      * @deprecated
      */
      export class Test<A> {
        /**
         * a static method description...
         * @since 1.1.0
         * @deprecated
         */
        static f(x: number): number
        static f(x: string): string
        static f(x: any): any {}
        constructor(readonly value: A) { }
        /**
         * a method description...
         * @since 1.1.0
         * @deprecated
         */
        map(f: (a: number) => number): Test
        map(f: (a: string) => string): Test
        map(f: (a: any) => any): any {
          return Test.make(f(this.value))
        }
      }`,
        `## ~~Test~~ (class)

a class description...

**Signature**

\`\`\`ts
declare class Test<A> { constructor(readonly value: A) }
\`\`\`

[Source](https://github.com/effect-ts/docgen/blob/main/src/test.ts#L6)

Since v1.0.0

### ~~f~~ (static method)

a static method description...

**Signature**

\`\`\`ts
declare const f: { (x: number): number; (x: string): string; }
\`\`\`

[Source](https://github.com/effect-ts/docgen/blob/main/src/test.ts#L14)

Since v1.1.0

### ~~map~~ (method)

a method description...

**Signature**

\`\`\`ts
declare const map: { (f: (a: number) => number): Test; (f: (a: string) => string): Test; }
\`\`\`

[Source](https://github.com/effect-ts/docgen/blob/main/src/test.ts#L23)

Since v1.1.0`
      )
    );

    it.effect("should ignore internal/ignored methods (#42)", () =>
      expectMarkdown(
        Parser.parseClasses,
        `/**
      * a class description...
      * @since 1.0.0
      */
      export class Test<A> {
        /**
         * @since 0.0.1
         * @internal
         **/
        private foo(): void {}
        /**
         * @since 0.0.1
         * @ignore
         **/
        private bar(): void {}
      }`,
        `## Test (class)

a class description...

**Signature**

\`\`\`ts
declare class Test<A>
\`\`\`

[Source](https://github.com/effect-ts/docgen/blob/main/src/test.ts#L5)

Since v1.0.0`
      )
    );
  });

  describe("parseFile", () =>
    it.effect("should not parse a non-existent file", () =>
      Effect.gen(function* () {
        const file = Domain.File.new("non-existent.ts", "", { isOverwritable: false });
        const project = new ast.Project({ useInMemoryFileSystem: true });

        const error = runSyncInLayer(Path.layer, Parser.parseFile(project)(file).pipe(Effect.flip));
        expect(error).toEqual(["Unable to locate file: non-existent.ts"]);
      })
    ));

  describe("utils", () =>
    it("parseComment", () => {
      expect(Parser.parseComment("")).toEqual({
        description: undefined,
        tags: {},
      });

      expect(Parser.parseComment("/** description */")).toEqual({
        description: "description",
        tags: {},
      });

      expect(Parser.parseComment("/** description\n * @since 1.0.0\n */")).toEqual({
        description: "description",
        tags: {
          since: ["1.0.0"],
        },
      });

      expect(Parser.parseComment("/** description\n * @deprecated\n */")).toEqual({
        description: "description",
        tags: {
          deprecated: [""],
        },
      });

      expect(Parser.parseComment("/** description\n * @category instance\n */")).toEqual({
        description: "description",
        tags: {
          category: ["instance"],
        },
      });
    }));
});
