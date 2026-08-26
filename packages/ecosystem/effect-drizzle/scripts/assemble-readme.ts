/**
 * Assembles the README's generated API reference from docgen output.
 *
 * Run `bun run docgen` first, then `bun run readme`. The section between the
 * `<!-- docgen:api-reference:start -->` and `<!-- docgen:api-reference:end -->`
 * markers is replaced wholesale from `docs/modules/**`; everything outside the
 * markers is hand-written and preserved.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { BunRuntime } from "@effect/platform-bun";
import * as BunServices from "@effect/platform-bun/BunServices";
import { Console, Effect, FileSystem, Layer, Path } from "effect";
import * as A from "effect/Array";
import * as S from "effect/Schema";
import * as Str from "effect/String";

class ReadmeAssemblyError extends S.TaggedError<ReadmeAssemblyError>("@beep/effect-drizzle/ReadmeAssemblyError")(
  "ReadmeAssemblyError",
  { message: S.String }
) {}

const START_MARKER = "<!-- docgen:api-reference:start -->";
const END_MARKER = "<!-- docgen:api-reference:end -->";

type ModuleEntry = {
  readonly doc: string;
  readonly importPath: string;
  readonly label: string;
};

const modules: ReadonlyArray<ModuleEntry> = [
  { doc: "index.ts.md", importPath: "@beep/effect-drizzle", label: "Root entrypoint" },
  { doc: "kit.ts.md", importPath: "@beep/effect-drizzle", label: "Kit constructor" },
  { doc: "pg/index.ts.md", importPath: "@beep/effect-drizzle/pg", label: "PostgreSQL entrypoint" },
  { doc: "pg/kit.ts.md", importPath: "@beep/effect-drizzle/pg", label: "PostgreSQL kit" },
  { doc: "pg/combinators.ts.md", importPath: "@beep/effect-drizzle/pg", label: "PostgreSQL column combinators" },
  { doc: "pg/extras.ts.md", importPath: "@beep/effect-drizzle/pg", label: "PostgreSQL table extras" },
  { doc: "pg/model.ts.md", importPath: "@beep/effect-drizzle/pg", label: "PostgreSQL models" },
  { doc: "pg/schema.ts.md", importPath: "@beep/effect-drizzle/pg", label: "PostgreSQL schema assembly" },
  { doc: "pg/table.ts.md", importPath: "@beep/effect-drizzle/pg", label: "PostgreSQL table projection" },
  { doc: "pg/Column.ts.md", importPath: "@beep/effect-drizzle/pg", label: "PostgreSQL column descriptors" },
  { doc: "pg/derive.ts.md", importPath: "@beep/effect-drizzle/pg", label: "PostgreSQL column derivation" },
  { doc: "sqlite/index.ts.md", importPath: "@beep/effect-drizzle/sqlite", label: "SQLite entrypoint" },
  { doc: "sqlite/kit.ts.md", importPath: "@beep/effect-drizzle/sqlite", label: "SQLite kit" },
  { doc: "sqlite/combinators.ts.md", importPath: "@beep/effect-drizzle/sqlite", label: "SQLite column combinators" },
  { doc: "sqlite/extras.ts.md", importPath: "@beep/effect-drizzle/sqlite", label: "SQLite table extras" },
  { doc: "sqlite/model.ts.md", importPath: "@beep/effect-drizzle/sqlite", label: "SQLite models" },
  { doc: "sqlite/schema.ts.md", importPath: "@beep/effect-drizzle/sqlite", label: "SQLite schema assembly" },
  { doc: "sqlite/table.ts.md", importPath: "@beep/effect-drizzle/sqlite", label: "SQLite table projection" },
  { doc: "sqlite/Column.ts.md", importPath: "@beep/effect-drizzle/sqlite", label: "SQLite column descriptors" },
  { doc: "sqlite/derive.ts.md", importPath: "@beep/effect-drizzle/sqlite", label: "SQLite column derivation" },
  { doc: "core/Meta.ts.md", importPath: "@beep/effect-drizzle", label: "Core: field metadata" },
  { doc: "core/Field.ts.md", importPath: "@beep/effect-drizzle", label: "Core: field carriers" },
  { doc: "core/model.ts.md", importPath: "@beep/effect-drizzle", label: "Core: model contract" },
  { doc: "core/variant.ts.md", importPath: "@beep/effect-drizzle", label: "Core: model variants" },
  { doc: "core/repository.ts.md", importPath: "@beep/effect-drizzle", label: "Core: optimistic repositories" },
  { doc: "core/names.ts.md", importPath: "@beep/effect-drizzle", label: "Core: SQL naming invariants" },
  { doc: "core/assembly.ts.md", importPath: "@beep/effect-drizzle", label: "Core: assembly contracts" },
  { doc: "core/classification.ts.md", importPath: "@beep/effect-drizzle", label: "Core: encoded classification" },
  { doc: "core/entity-id.ts.md", importPath: "@beep/effect-drizzle", label: "Core: EntityId statics" },
  { doc: "core/literals.ts.md", importPath: "@beep/effect-drizzle", label: "Core: literal collection" },
];

const stripFrontmatter = (lines: ReadonlyArray<string>): ReadonlyArray<string> => {
  if (!A.isReadonlyArrayNonEmpty(lines) || A.headNonEmpty(lines) !== "---") return lines;
  const closing = A.findFirstIndex(A.drop(lines, 1), (line) => line === "---");
  return closing._tag === "Some" ? A.drop(lines, closing.value + 2) : lines;
};

const stripNavigation = (lines: ReadonlyArray<string>): ReadonlyArray<string> => {
  const start = A.findFirstIndex(lines, (line) => line === "## Exports Grouped by Category");
  if (start._tag === "None") return lines;
  const rest = A.drop(lines, start.value + 1);
  const end = A.findFirstIndex(rest, (line) => line === "---");
  return end._tag === "None"
    ? A.take(lines, start.value)
    : A.appendAll(A.take(lines, start.value), A.drop(rest, end.value + 1));
};

const isNoiseLine = (line: string): boolean =>
  line === "---" || Str.startsWith("Added in v")(line) || Str.startsWith("Since v")(line);

const demote = (entry: ModuleEntry) => (line: string) => {
  if (Str.startsWith("## ")(line) && Str.endsWith(" overview")(line)) {
    return `### ${entry.label} — \`${entry.importPath}\``;
  }
  if (Str.startsWith("## ")(line)) return `##### ${line.slice(3)}`;
  if (Str.startsWith("# ")(line)) return `#### ${line.slice(2)}`;
  return line;
};

type RenderState = { readonly inCode: boolean; readonly out: ReadonlyArray<string> };

const renderModule = (entry: ModuleEntry, content: string): string => {
  const lines = stripNavigation(stripFrontmatter(Str.split(content, "\n")));
  const rendered = A.reduce(lines, { inCode: false, out: A.empty<string>() } as RenderState, (state, line) => {
    if (Str.startsWith("```")(line)) return { inCode: !state.inCode, out: A.append(state.out, line) };
    if (state.inCode) return { inCode: state.inCode, out: A.append(state.out, line) };
    if (isNoiseLine(line)) return state;
    return { inCode: state.inCode, out: A.append(state.out, demote(entry)(line)) };
  });
  return rendered.out.join("\n").replaceAll("\n\n\n\n", "\n\n").replaceAll("\n\n\n", "\n\n").trim();
};

const program = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const packageRoot = path.resolve(import.meta.dirname, "..");
  const readmePath = path.join(packageRoot, "README.md");
  const readme = yield* fs.readFileString(readmePath);

  const startIndex = readme.indexOf(START_MARKER);
  const endIndex = readme.indexOf(END_MARKER);
  if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) {
    return yield* ReadmeAssemblyError.make({
      message: `README.md must contain '${START_MARKER}' followed by '${END_MARKER}'.`,
    });
  }

  const sections = yield* Effect.forEach(
    modules,
    Effect.fnUntraced(function* (entry) {
      const content = yield* fs.readFileString(path.join(packageRoot, "docs", "modules", entry.doc));
      return renderModule(entry, content);
    }),
    { concurrency: 8 }
  );

  const generated = [
    START_MARKER,
    "",
    "## API reference",
    "",
    "Generated from the package JSDoc by `bun run docgen && bun run readme` — edit the",
    "source doc comments, never this section.",
    "",
    sections.join("\n\n"),
    "",
    END_MARKER,
  ].join("\n");

  const next = readme.slice(0, startIndex) + generated + readme.slice(endIndex + END_MARKER.length);
  yield* fs.writeFileString(readmePath, next);
  yield* Console.log(`README API reference assembled from ${modules.length} modules.`);
});

const main = Effect.scoped(Layer.build(Layer.effectDiscard(program).pipe(Layer.provide(BunServices.layer))));

BunRuntime.runMain(main);
