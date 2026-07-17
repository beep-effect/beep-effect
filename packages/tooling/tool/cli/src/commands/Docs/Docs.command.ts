/**
 * Docs discovery command suite for command-first policy lookup.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import { A, Str } from "@beep/utils";
import { Console, Effect, pipe, Tuple } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { Argument, Command } from "effect/unstable/cli";
import { printLines } from "../../internal/cli/Printer.ts";
import { docsAggregateCommand } from "./Docs.aggregate.ts";

const $I = $RepoCliId.create("docs");

const DocsSectionName = LiteralKit(["laws", "skills", "policies"]).pipe(
  $I.annoteSchema("DocsSectionName", {
    description: "Name of a docs section.",
  })
);

type DocsSectionName = typeof DocsSectionName.Type;

class DocsSectionLaws extends S.Class<DocsSectionLaws>($I`DocsSectionLaws`)(
  {
    name: S.tag("laws"),
    title: S.String,
    summary: S.String,
    lines: S.Array(S.String),
    keywords: S.Array(S.String),
  },
  $I.annote("DocsSectionLaws", {
    description: "Docs section for repository laws.",
  })
) {}

class DocsSectionSkills extends S.Class<DocsSectionSkills>($I`DocsSectionSkills`)(
  {
    name: S.tag("skills"),
    title: S.String,
    summary: S.String,
    lines: S.Array(S.String),
    keywords: S.Array(S.String),
  },
  $I.annote("DocsSectionSkills", {
    description: "Docs section for agent skills.",
  })
) {}

class DocsSectionPolicies extends S.Class<DocsSectionPolicies>($I`DocsSectionPolicies`)(
  {
    name: S.tag("policies"),
    title: S.String,
    summary: S.String,
    lines: S.Array(S.String),
    keywords: S.Array(S.String),
  },
  $I.annote("DocsSectionPolicies", {
    description: "Docs section for policy gates.",
  })
) {}

/**
 * Documentation section model.
 *
 * @returns Tagged union schema keyed by `name`.
 * @example
 * ```ts
 * console.log("DocsSection")
 * ```
 * @category models
 * @since 0.0.0
 */
export const DocsSection = DocsSectionName.mapMembers(
  Tuple.evolve([() => DocsSectionLaws, () => DocsSectionSkills, () => DocsSectionPolicies])
).pipe(
  S.toTaggedUnion("name"),
  $I.annoteSchema("DocsSection", {
    description: "A section of documentation.",
  })
);
/**
 * Documentation section model.
 *
 * @example
 * ```ts
 * console.log("DocsSection")
 * ```
 * @category models
 * @since 0.0.0
 */
export type DocsSection = typeof DocsSection.Type;

const DocsSections: ReadonlyArray<DocsSection> = [
  DocsSectionLaws.make({
    name: "laws",
    title: "Codebase Laws",
    summary: "Effect-first quality law summary and validation entry points.",
    lines: [
      "Use Effect-first APIs and aliases defined by repository law.",
      "Reusable functions that directly return Effect.gen must use Effect.fn or Effect.fnUntraced.",
      "Reject unsafe typing escapes and untyped runtime errors.",
      "Keep domain logic free of native mutable runtime containers.",
      "Finish only when check, lint, test, and docgen pass.",
      "Run: bun run beep laws effect-fn --check",
      "Run: bun run check",
      "Run: bun run lint",
      "Run: bun run test",
      "Run: bun run docgen",
    ],
    keywords: ["effect", "law", "laws", "quality", "lint", "check", "test", "docgen"],
  }),
  DocsSectionSkills.make({
    name: "skills",
    title: "Agent Skills",
    summary: "High-signal skills and usage expectations for coding agents.",
    lines: [
      "Use focused skills when a task clearly matches a specialized domain.",
      "Prefer minimal skill sets that directly match requested outcomes.",
      "Keep context tight and avoid broad, unfocused skill loading.",
      "Pair skills with verification commands before completion.",
      "Run: bun run beep docs find effect",
    ],
    keywords: ["skill", "skills", "agent", "workflow", "context"],
  }),
  DocsSectionPolicies.make({
    name: "policies",
    title: "Policy Gates",
    summary: "Operational policy checks for agent output and repo hygiene.",
    lines: [
      "Effect governance and allowlist checks are strict by default.",
      "Agent instruction surfaces must remain pathless and lightweight.",
      "Worktree runs must use isolated disposable worktrees when enabled.",
      "Run: bun run lint:effect-governance",
    ],
    keywords: ["policy", "policies", "allowlist", "worktree", "pathless", "compliance"],
  }),
];

const printSection = Effect.fn(function* (section: DocsSection) {
  yield* Console.log(`${section.title}`);
  yield* Console.log(`${section.summary}`);
  yield* Effect.forEach(section.lines, (line) => Console.log(`- ${line}`), { discard: true });
});

const printDocsIndex = () =>
  printLines([
    "Docs discovery commands:",
    "- bun run beep docs laws",
    "- bun run beep docs skills",
    "- bun run beep docs policies",
    "- bun run beep docs find <topic>",
    "- bun run beep docs aggregate",
  ]);

const findSectionByName = (name: DocsSectionName): O.Option<DocsSection> =>
  A.findFirst(DocsSections, (entry) => Str.equivalence(entry.name, name));

const printSectionByName = (name: DocsSectionName) =>
  pipe(
    findSectionByName(name),
    O.map(printSection),
    O.getOrElse(() => Effect.void)
  );

const docsLawsCommand = Command.make(
  "laws",
  {},
  Effect.fn(function* () {
    yield* printSectionByName("laws");
  })
).pipe(Command.withDescription("Show compact repository law summary and validation commands"));

const docsSkillsCommand = Command.make(
  "skills",
  {},
  Effect.fn(function* () {
    yield* printSectionByName("skills");
  })
).pipe(Command.withDescription("Show compact skill usage guidance"));

const docsPoliciesCommand = Command.make(
  "policies",
  {},
  Effect.fn(function* () {
    yield* printSectionByName("policies");
  })
).pipe(Command.withDescription("Show policy gates and compliance commands"));

const docsFindCommand = Command.make(
  "find",
  {
    topic: Argument.string("topic").pipe(Argument.withDescription("Keyword to match against docs content")),
  },
  Effect.fn(function* ({ topic }) {
    const normalizedTopic = pipe(topic, Str.trim, Str.toLowerCase);
    const matches = A.filter(DocsSections, (section) => {
      if (Str.includes(normalizedTopic)(section.name)) {
        return true;
      }

      if (pipe(section.title, Str.toLowerCase, Str.includes(normalizedTopic))) {
        return true;
      }

      return A.some(section.keywords, Str.includes(normalizedTopic));
    });

    yield* A.match(matches, {
      onEmpty: Effect.fnUntraced(function* () {
        yield* Console.log(`No direct docs match for "${topic}".`);
        yield* printDocsIndex();
      }),
      onNonEmpty: Effect.fn(function* (sections) {
        yield* Effect.forEach(
          sections,
          Effect.fnUntraced(function* (section, index) {
            if (index > 0) {
              yield* Console.log("");
            }
            yield* printSection(section);
          }),
          { discard: true }
        );
      }),
    });
  })
).pipe(Command.withDescription("Find matching docs section by topic"));

/**
 * Command-first docs discovery entrypoint used by agent config surfaces.
 *
 * @example
 * ```ts
 * console.log("docsCommand")
 * ```
 * @category utilities
 * @since 0.0.0
 */
export const docsCommand = Command.make("docs", {}, printDocsIndex).pipe(
  Command.withDescription("Discover laws, skills, and policies without path references"),
  Command.withSubcommands([
    docsLawsCommand,
    docsSkillsCommand,
    docsPoliciesCommand,
    docsFindCommand,
    docsAggregateCommand,
  ])
);
