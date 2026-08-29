/**
 * Pure Markdown projection over an assembled ontology.
 *
 * Renders one deterministic document per assembly: an ontology header, one
 * section per class with identity and predicate tables, and the fact list
 * grouped by predicate. Anchors derive from IRI slugs.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { CoreVocab, contractOption } from "@beep/identity";
import { $OntologyId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema/LiteralKit";
import { flow, pipe } from "effect";
import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import type {
  AssembledClass,
  AssembledFact,
  AssembledOntology,
  AssembledPredicate,
  FactObject,
} from "./Fold.models.ts";

const $I = $OntologyId.create("Fold/markdown");

/**
 * Link rendering modes for the Markdown projection.
 *
 * **Example** (Guard a link mode literal)
 *
 * ```ts import.meta.vitest name="Guard a link mode literal"
 * import { MarkdownLinkMode } from "@beep/ontology"
 * import * as S from "effect/Schema"
 *
 * S.is(MarkdownLinkMode)("portable") // => true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const MarkdownLinkMode = LiteralKit(["portable", "obsidian"]).pipe(
  $I.annoteSchema("MarkdownLinkMode", {
    description: "Markdown link rendering mode: portable anchors or obsidian wiki links.",
  })
);

/**
 * Runtime type for {@link MarkdownLinkMode}.
 *
 * **Example** (Annotate a link mode value)
 *
 * ```ts
 * import type { MarkdownLinkMode } from "@beep/ontology"
 *
 * const mode: MarkdownLinkMode = "obsidian"
 * console.log(mode)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type MarkdownLinkMode = typeof MarkdownLinkMode.Type;

/**
 * Normalized options accepted by {@link toMarkdown}.
 *
 * **Example** (Construct portable link options)
 *
 * ```ts
 * import { MarkdownOptions } from "@beep/ontology"
 *
 * const options = MarkdownOptions.make({ linkMode: "portable" })
 * console.log(options.linkMode)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class MarkdownOptions extends S.Class<MarkdownOptions>($I`MarkdownOptions`)(
  {
    linkMode: MarkdownLinkMode,
  },
  $I.annote("MarkdownOptions", {
    description: "Normalized Markdown projection options: link rendering mode.",
  })
) {}

type MarkdownOptionsInput = {
  readonly linkMode?: MarkdownLinkMode | undefined;
};

const markdownText: (value: string) => string = Str.replace(/([\\`*_{}[\]()#+\-.!|>~])/g, "\\$1");

const obsidianAlias: (value: string) => string = flow(Str.replaceAll("|", "\\|"), Str.replaceAll("]", "\\]"));

const iriSlug: (iri: string) => string = flow(
  Str.replace(/^https?:\/\//, ""),
  Str.replace(/[^A-Za-z0-9]+/g, "-"),
  Str.replace(/^-+|-+$/g, ""),
  Str.toLowerCase,
  (slug) => (Str.isEmpty(slug) ? "iri" : slug)
);

const markdownLink = (label: string, iri: string, linkMode: MarkdownLinkMode): string =>
  linkMode === "obsidian" ? `[[${iri}|${obsidianAlias(label)}]]` : `[${markdownText(label)}](#${iriSlug(iri)})`;

const withNamespaceSeparator = (iri: string): string =>
  pipe(iri, Str.endsWith("/")) || pipe(iri, Str.endsWith("#")) ? iri : `${iri}/`;

const compactOwnedLabel = (ontology: AssembledOntology, iri: string): O.Option<string> => {
  const namespace = withNamespaceSeparator(ontology.baseIri);

  return pipe(
    O.liftPredicate(iri, Str.startsWith(namespace)),
    O.map(Str.slice(Str.length(namespace))),
    O.map((local) => `${ontology.prefix}:${local}`)
  );
};

const compactLabel = (ontology: AssembledOntology, iri: string): string =>
  pipe(
    contractOption(iri, CoreVocab),
    O.orElse(() => compactOwnedLabel(ontology, iri)),
    O.getOrElse(() => iri)
  );

const section = (title: string, lines: ReadonlyArray<string>): O.Option<string> =>
  A.isReadonlyArrayNonEmpty(lines) ? O.some(`### ${markdownText(title)}\n\n${pipe(lines, A.join("\n"))}`) : O.none();

const bullet = (label: string, value: string): string => `- ${markdownText(label)}: ${value}`;

const factObjectText = (ontology: AssembledOntology, object: FactObject, linkMode: MarkdownLinkMode): string => {
  if (P.isString(object)) {
    return markdownLink(compactLabel(ontology, object), object, linkMode);
  }

  const literal = markdownText(`${object.value}`);

  return pipe(
    O.map(object.language, (language) => `\`${literal}\`@${markdownText(language)}`),
    O.orElse(() =>
      O.map(
        object.datatypeIri,
        (datatypeIri) => `\`${literal}\` (\`${markdownText(compactLabel(ontology, datatypeIri))}\`)`
      )
    ),
    O.getOrElse(() => `\`${literal}\``)
  );
};

const predicateLine = (
  ontology: AssembledOntology,
  predicate: AssembledPredicate,
  linkMode: MarkdownLinkMode
): string =>
  pipe(
    [
      `- \`${predicate.key}\``,
      predicate.reverse ? "(reverse)" : "",
      `-> ${markdownLink(compactLabel(ontology, predicate.termIri), predicate.termIri, linkMode)}`,
      predicate.kind === "object"
        ? pipe(
            predicate.rangeIri,
            O.match({
              onNone: () => "(object)",
              onSome: (rangeIri) => `(object of ${markdownLink(compactLabel(ontology, rangeIri), rangeIri, linkMode)})`,
            })
          )
        : "(datatype)",
    ],
    A.filter(Str.isNonEmpty),
    A.join(" ")
  );

const classSection = (ontology: AssembledOntology, assembled: AssembledClass, linkMode: MarkdownLinkMode): string => {
  const identityLines = [
    bullet("IRI", `<${assembled.iri}>`),
    bullet("CURIE", `\`${markdownText(assembled.curie)}\``),
    ...pipe(
      assembled.skos,
      O.match({
        onNone: () => [],
        onSome: (marker) => [bullet("SKOS", `\`${marker === "concept" ? "skos:Concept" : "skos:ConceptScheme"}\``)],
      })
    ),
    ...pipe(
      assembled.description,
      O.match({
        onNone: () => [],
        onSome: (description) => [bullet("Description", markdownText(description))],
      })
    ),
  ];
  const predicateLines = pipe(
    assembled.predicates,
    A.map((predicate) => predicateLine(ontology, predicate, linkMode))
  );

  return pipe(
    [
      `## ${markdownText(assembled.name)} {#${iriSlug(assembled.iri)}}`,
      ...A.getSomes([section("Identity", identityLines), section("Predicates", predicateLines)]),
    ],
    A.join("\n\n")
  );
};

const factLine = (ontology: AssembledOntology, fact: AssembledFact, linkMode: MarkdownLinkMode): string =>
  `- ${markdownLink(compactLabel(ontology, fact.subjectIri), fact.subjectIri, linkMode)} \`${markdownText(
    compactLabel(ontology, fact.predicateIri)
  )}\`${fact.reverse ? " (reverse)" : ""} ${factObjectText(ontology, fact.object, linkMode)}`;

const decodeLinkMode = S.decodeUnknownOption(MarkdownLinkMode);

const toMarkdownImpl = (ontology: AssembledOntology, options: MarkdownOptionsInput = {}): string => {
  const normalized = MarkdownOptions.make({
    linkMode: pipe(
      decodeLinkMode(options.linkMode),
      O.getOrElse((): MarkdownLinkMode => "portable")
    ),
  });
  const linkMode = normalized.linkMode;
  const header = [
    `# ${markdownText(ontology.label)}`,
    "",
    bullet("Base IRI", `<${ontology.baseIri}>`),
    bullet("Prefix", `\`${markdownText(ontology.prefix)}\``),
  ];
  const classSections = pipe(
    ontology.classes,
    A.map((assembled) => classSection(ontology, assembled, linkMode))
  );
  const factLines = pipe(
    ontology.facts,
    A.map((fact) => factLine(ontology, fact, linkMode))
  );
  const warningLines = pipe(
    ontology.warnings,
    A.map((warning) =>
      bullet(
        warning.code,
        pipe(
          warning.subjectIri,
          O.match({
            onNone: () => markdownText(warning.message),
            onSome: (subjectIri) => `${markdownText(warning.message)} (<${subjectIri}>)`,
          })
        )
      )
    )
  );

  return pipe(
    [
      pipe(header, A.join("\n")),
      ...classSections,
      ...A.getSomes([section("Facts", factLines), section("Warnings", warningLines)]),
    ],
    A.join("\n\n")
  );
};

/**
 * Project an assembled ontology into deterministic Markdown.
 *
 * **Example** (Render a folded ontology as Markdown)
 *
 * ```ts
 * import { make } from "@beep/identity"
 * import { fold, toMarkdown } from "@beep/ontology"
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 *
 * const $I = make("beep", { authority: "https://ns.beep.sh/", prefix: "beep" }).$BeepId.create("patent")
 *
 * class Claim extends S.Class<Claim>($I`Claim`)(
 *   { text: S.String },
 *   $I.class("Claim", { description: "A patent claim." })
 * ) {}
 *
 * const markdown = toMarkdown(
 *   Effect.runSync(fold($I, { label: "Patent Core", schemas: [Claim], triples: [] }))
 * )
 * console.log(markdown.startsWith("# Patent Core")) // true
 * ```
 *
 * @category projections
 * @since 0.0.0
 */
export const toMarkdown: {
  (options?: MarkdownOptionsInput): (ontology: AssembledOntology) => string;
  (ontology: AssembledOntology, options?: MarkdownOptionsInput): string;
} = dual((args) => P.hasProperty(args[0], "baseIri"), toMarkdownImpl);
