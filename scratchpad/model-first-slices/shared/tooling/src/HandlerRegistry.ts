import * as Domain from "@alchemy.run/domain";
import * as A from "@beep/utils/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { dual, pipe } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as O from "@beep/utils/Option";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import * as Str from "@beep/utils/Str";
import { thunkEmptyStr } from "@beep/utils"

/**
 * A model member needs a handler and no `<Member>.handler.ts` exists.
 *
 * @category errors
 * @since 0.0.0
 */
export class MissingHandler extends S.TaggedError<MissingHandler, { readonly brand: unique symbol }>()("MissingHandler", { member: S.String }) {}

/**
 * A `.handler.ts` file names no member of the model.
 *
 * @category errors
 * @since 0.0.0
 */
export class UnregisteredHandler extends S.TaggedError<UnregisteredHandler, { readonly brand: unique symbol }>()("UnregisteredHandler", {
  file: S.String,
}) {}

/**
 * The registry on disk differs from what the model generates.
 *
 * @category errors
 * @since 0.0.0
 */
export class RegistryDrift extends S.TaggedError<RegistryDrift, { readonly brand: unique symbol }>()("RegistryDrift", { file: S.String }) {}

/**
 * A model as the generator reads it. `sagas` is read off the class: the
 * Model's public type does not list them (`Model.ts` `ModelClass`).
 *
 * @category models
 * @since 0.0.0
 */
export type ModelLike = Domain.Model.Any & { readonly sagas?: ReadonlyArray<{ readonly sagaName: string }> };

/**
 * Where a model's registry lives and what it exports.
 *
 * @category models
 * @since 0.0.0
 */
export interface Options {
  /** The model to read. */
  readonly model: ModelLike;
  /** The name the model is exported as, for the generated header. */
  readonly modelExport: string;
  /** The model package's `src` directory, absolute. */
  readonly srcDir: string;
  /** The registry file, relative to `srcDir`, e.g. `Party.handlers.ts`. */
  readonly output: string;
  /** The Layer the registry exports, e.g. `PartyHandlers`. */
  readonly exportName: string;
}

/**
 * Every member of a model that needs a handler Layer, in model order: guarded
 * views and streams (a `validate`), policies, sagas, projections and queries.
 * The same rule the Model's `layer` type applies (`HandledBy`).
 *
 * @category getters
 * @since 0.0.0
 */
export const handledMembers = (model: ModelLike): ReadonlyArray<string> => [
  ...pipe(
    model.definitions.views,
    A.filter((view) => Domain.Read.isGuarded(view.definition)),
    A.map((view) => view.viewName),
  ),
  ...pipe(
    model.definitions.streams,
    A.filter((stream) => Domain.Read.isGuarded(stream.definition)),
    A.map((stream) => stream.streamName),
  ),
  ...A.map(model.definitions.policies, (policy) => policy.policyName),
  ...A.map(model.sagas ?? [], (saga) => saga.sagaName),
  ...A.map(model.definitions.projections, (projection) => projection.projectionName),
  ...A.map(model.definitions.queries ?? [], (query) => query.queryName),
];

const HANDLER = ".handler.ts";

const render = (options: Options, entries: ReadonlyArray<{ readonly member: string; readonly file: string }>) => {
  const imports = pipe(
    entries,
    A.sort(Order.mapInput(Order.String, (entry: { readonly file: string }) => entry.file)),
    A.map(({ member, file }) => `import { ${member}Live } from "./${file}";`),
  );
  return A.join(
    [
    `// Generated from ${options.modelExport} by scripts/handlers.ts. Do not edit:`,
    "// `bun run handlers` rewrites it, and `bun run handlers --check` fails on drift.",
    'import * as Layer from "effect/Layer";',
    ...imports,
    "",
    "/**",
    ` * Every handler ${options.modelExport} needs, as one Layer, in model order.`,
    " *",
    " * @category handlers",
    " * @since 0.0.0",
    " */",
    `export const ${options.exportName} = Layer.mergeAll(`,
    ...A.map(entries, ({ member }) => `  ${member}Live,`),
    ");",
    "",
    ],
    "\n",
  );
};

/**
 * The registry the model generates: find each member's `<Member>.handler.ts`
 * under `srcDir` (any Module folder), refuse a missing or unregistered one,
 * and render the file.
 *
 * @category generators
 * @since 0.0.0
 */
export const plan = Effect.fn("HandlerRegistry.plan")(function* (options: Options) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const files = yield* fs.readDirectory(options.srcDir, { recursive: true });
  const handlerFiles = A.filter(files, Str.endsWith(HANDLER));
  const byMember = HashMap.fromIterable(A.map(handlerFiles, (file) => [path.basename(file, HANDLER), file] as const));
  const members = handledMembers(options.model);
  const entries = yield* Effect.forEach(members, (member) =>
    O.match(HashMap.get(byMember, member), {
      onNone: () => Effect.fail(MissingHandler.make({ member })),
      onSome: (file) => Effect.succeed({ member, file }),
    }),
    { concurrency: 1 },
  );
  yield* Effect.forEach(
    A.filter(handlerFiles, (file) => !A.contains(members, path.basename(file, HANDLER))),
    (file) => Effect.fail(UnregisteredHandler.make({ file })),
    { concurrency: 1, discard: true },
  );
  return render(options, entries);
});

/**
 * Write the generated registry.
 *
 * @category generators
 * @since 0.0.0
 */
export const write = Effect.fn("HandlerRegistry.write")(function* (options: Options) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const registry = yield* plan(options);
  yield* fs.writeFileString(path.join(options.srcDir, options.output), registry);
});

/**
 * Fail with `RegistryDrift` unless the registry on disk is exactly what the
 * model generates.
 *
 * @category generators
 * @since 0.0.0
 */
export const check = Effect.fn("HandlerRegistry.check")(function* (options: Options) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const file = path.join(options.srcDir, options.output);
  const expected = yield* plan(options);
  const actual = yield* fs.readFileString(file).pipe(Effect.orElseSucceed(thunkEmptyStr));
  return yield* actual === expected ? Effect.void : Effect.fail(RegistryDrift.make({ file: options.output }));
});

/**
 * The generator's command line: `--check` checks, anything else writes.
 *
 * @category generators
 * @since 0.0.0
 */
export const main: {
  (argv: ReadonlyArray<string>): (options: Options) => ReturnType<typeof check> | ReturnType<typeof write>;
  (options: Options, argv: ReadonlyArray<string>): ReturnType<typeof check> | ReturnType<typeof write>;
} = dual(2, (options: Options, argv: ReadonlyArray<string>) => (A.contains(argv, "--check") ? check(options) : write(options)));
