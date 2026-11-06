/**
 * Filter-first projections into four fixed named graphs.
 * @packageDocumentation
 * @since 0.0.0
 */
import { makeLiteral, serializeTerm } from "@beep/rdf/Rdf";
import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as Str from "effect/String";
import { selectKb } from "./Kb.service.ts";
import type { Assertion, KbClaim, KbView } from "./Kb.schemas.ts";

const kb = "urn:beep:kb:";
const iri = (id: string): string => `<${kb}${encodeURIComponent(id)}>`;
const term = (name: string): string => `<${kb}${name}>`;
const literal = (value: string): string => serializeTerm(makeLiteral(value, "http://www.w3.org/2001/XMLSchema#string"));
const standardPredicates: Readonly<Record<string, string>> = {
  type: "<http://www.w3.org/1999/02/22-rdf-syntax-ns#type>",
  comment: "<http://www.w3.org/2000/01/rdf-schema#comment>",
};
const quad = (subject: string, predicate: string, object: string, graph: string): string =>
  `${subject} ${O.getOrElse(R.get(standardPredicates, predicate), () => term(predicate))} ${object} ${term(`graph:${graph}`)} .`;

type Selector = Assertion["selector"];

// A claim enters the current graph only when accepted, unexpired, not superseded and backed by captured evidence.
const isCurrent = (c: KbClaim, claims: ReadonlyArray<KbClaim>, evidence: ReadonlyArray<Assertion>): boolean =>
  c.review._tag === "Accepted" &&
  c.knowledge.expiredAt._tag === "None" &&
  !A.some(claims, (candidate) => O.exists(candidate.supersedes, (id) => id === c.id)) &&
  A.some(
    evidence,
    (a) => a.claimId === c.id && A.contains(c.supportedBy, a.id) && a.review === "accepted" && a.outcome === "captured"
  );
const claimQuads = (
  c: KbClaim,
  claims: ReadonlyArray<KbClaim>,
  evidence: ReadonlyArray<Assertion>
): ReadonlyArray<string> => {
  const id = iri(c.id);
  const p = c.proposition;
  const base = [
    quad(id, "type", term("Claim"), "claims"),
    quad(id, "review", literal(c.review._tag), "claims"),
    quad(id, "text", literal(p.text), "claims"),
    quad(id, "assertsSubject", iri(p.subject), "claims"),
    quad(id, "assertsPredicate", term(p._tag), "claims"),
    quad(id, "assertsObject", iri(p.object), "claims"),
  ];
  return isCurrent(c, claims, evidence)
    ? A.appendAll(base, [
        `${iri(p.subject)} ${term(p._tag)} ${iri(p.object)} ${term("graph:current")} .`,
        quad(id, "authorizedBy", id, "current"),
      ])
    : base;
};
const selectorQuads = (id: string, selector: Selector): ReadonlyArray<string> =>
  A.appendAll(
    selector._tag === "TextQuote"
      ? [
          quad(id, "exact", literal(selector.exact), "provenance"),
          quad(id, "prefix", literal(selector.prefix), "provenance"),
          quad(id, "suffix", literal(selector.suffix), "provenance"),
          quad(id, "offsetUnit", literal("UTF-16"), "provenance"),
        ]
      : [],
    [
      quad(id, "selectorKind", literal(selector._tag), "provenance"),
      quad(id, "start", literal(`${selector.start}`), "provenance"),
      quad(id, "end", literal(`${selector.end}`), "provenance"),
    ]
  );
const assertionQuads = (a: Assertion): ReadonlyArray<string> => {
  const id = iri(a.id);
  return A.appendAll(
    [
      quad(id, "claim", iri(a.claimId), "provenance"),
      quad(id, "capture", iri(a.captureId), "provenance"),
      quad(id, "quote", literal(a.quote), "provenance"),
      quad(id, "audience", literal(a.audience), "provenance"),
      quad(id, "locator", literal(a.sourceRef.locator), "provenance"),
      quad(id, "sha256", literal(a.sourceRef.sha256), "provenance"),
      quad(id, "quoteDigest", literal(a.quoteDigest), "provenance"),
      quad(id, "sourceKind", literal(a.sourceRef.kind), "provenance"),
      quad(id, "review", literal(a.review), "provenance"),
      quad(id, "outcome", literal(a.outcome), "provenance"),
      quad(id, "derivationBasis", literal(a.derivation.basis), "provenance"),
      quad(id, "derivationRef", literal(a.derivation.ref), "provenance"),
    ],
    selectorQuads(id, a.selector)
  );
};

/**
 * Render an already validated ledger, filtering claims and evidence before constructing artifacts.
 * **Example** (Project an empty outward ledger)
 * ```ts
 * import { projectKb } from "@beep/repo-cli/commands/Kb"
 * console.log(projectKb([], [], "outward")["INDEX.md"])
 * ```
 * @category projections
 * @since 0.0.0
 */
export const projectKb: {
  (
    claims: ReadonlyArray<KbClaim>,
    assertions: ReadonlyArray<Assertion>,
    view: KbView
  ): Readonly<Record<string, string>>;
  (
    assertions: ReadonlyArray<Assertion>,
    view: KbView
  ): (claims: ReadonlyArray<KbClaim>) => Readonly<Record<string, string>>;
} = dual(
  3,
  (
    claims: ReadonlyArray<KbClaim>,
    assertions: ReadonlyArray<Assertion>,
    view: KbView
  ): Readonly<Record<string, string>> => {
    const { claims: selected, assertions: evidence } = selectKb(claims, assertions, view);
    const terms = HashSet.fromIterable(A.map(selected, (c) => c.proposition._tag));
    const lines = A.flatten([
      A.map(["claims", "provenance", "current", "schema"], (graph) =>
        quad(term(`graph:${graph}`), "graphKind", literal(graph), graph)
      ),
      A.flatMap(selected, (c) => claimQuads(c, claims, evidence)),
      A.flatMap(evidence, assertionQuads),
      A.map(A.fromIterable(terms), (t) => quad(term(t), "comment", literal(`Reviewed ${t} relationship.`), "schema")),
    ]);
    return {
      "dataset.nq": `${A.join(A.sort(A.fromIterable(HashSet.fromIterable(lines)), Str.Order), "\n")}\n`,
      "INDEX.md": `# Knowledge ledger\n\nView: ${view}\n\n${A.join(
        A.sort(
          A.map(selected, (c) => `- ${c.id} (${c.review._tag})`),
          Str.Order
        ),
        "\n"
      )}\n`,
      "SCHEMA.md": `# Schema\n\nSlice 1 vocabulary stub. SHACL shapes and entity pages follow in slice 2.\n\n${A.join(
        A.sort(
          A.map(A.fromIterable(terms), (t) => `- ${kb}${t}: Reviewed ${t} relationship.`),
          Str.Order
        ),
        "\n"
      )}\n`,
    };
  }
);

/**
 * Canary tripwire over every generated artifact, including ids, locators and Markdown.
 * **Example** (Detect an internal token)
 * ```ts
 * import { hasKbCanary } from "@beep/repo-cli/commands/Kb"
 * console.log(hasKbCanary({ "INDEX.md": "CANARY-INTERNAL-test" }))
 * ```
 * @param artifacts - Every generated output file keyed by its relative name.
 * @returns Whether any output contains an internal canary marker.
 * @category validation
 * @since 0.0.0
 */
export const hasKbCanary = (artifacts: Readonly<Record<string, string>>): boolean =>
  A.some(R.values(artifacts), Str.includes("CANARY-INTERNAL-"));
