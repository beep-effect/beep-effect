/**
 * Byte-pinned, curated SPAR vocabulary acquisition and generation.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import * as A from "effect/Array";
import * as Crypto from "effect/Crypto";
import * as Effect from "effect/Effect";
import * as Hex from "effect/encoding/Hex";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { fetchSource, formatJson, normalizeJson, outputFile, sourceMetadata } from "../internal/Source.ts";
import { SyncDataTargetMetadata, SyncDataTargetProjection, SyncDataToTsError } from "../SyncDataToTs.schemas.ts";
import type { SyncDataTarget } from "../SyncDataToTs.schemas.ts";

const $I = $RepoCliId.create("commands/SyncDataToTs/targets/SparTerms");
const targetId = "spar-terms";
const outputDir = "packages/foundation/modeling/rdf/src/Vocab/generated";
const canonicalPath = `${outputDir}/spar-terms.data.json`;
class SparPin extends S.Class<SparPin>($I`SparPin`)(
  {
    prefix: S.NonEmptyString,
    module: S.NonEmptyString,
    commit: S.NonEmptyString,
    release: S.NonEmptyString,
    version: S.NonEmptyString,
    iri: S.NonEmptyString,
    url: S.NonEmptyString,
    sha256: S.NonEmptyString,
    semanticSha256: S.NonEmptyString,
    terms: S.Array(S.NonEmptyString),
    ontologyIri: S.NonEmptyString,
    versionIri: S.NonEmptyString,
    licenseIri: S.NonEmptyString,
    attribution: S.NonEmptyString,
  },
  $I.annote("SparPin", { description: "Immutable acquisition pin and explicit curated term filter." })
) {}
const pins = [
  SparPin.make({
    prefix: "doco",
    ontologyIri: "http://purl.org/spar/doco",
    versionIri: "http://purl.org/spar/doco/2026-06-25",
    licenseIri: "https://creativecommons.org/licenses/by/4.0/legalcode",
    attribution:
      "Doco by David Shotton and Silvio Peroni. Contributors: Sebastian Barzaghi. CC BY 4.0. Curated term names projected to TypeScript.",
    module: "Doco",
    commit: "4c4109a64148c207f80d48a611a79a2d996a44b4",
    release: "2026-06-25",
    version: "1.4.0",
    iri: "http://purl.org/spar/doco/",
    url: "https://raw.githubusercontent.com/SPAROntologies/doco/4c4109a64148c207f80d48a611a79a2d996a44b4/docs/2026-06-25/doco.ttl",
    sha256: "616c0f7611168d4ff8325ce361ab79625f9664aead7bfe6bf8e0c66982f7c4ae",
    semanticSha256: "d01a7e4eaa8ede7c08c76c324ac0dc0ff8f24576df48d5d65e45d9cddf39a79d",
    terms: ["Section", "SectionTitle", "Paragraph", "List", "Figure", "Title"],
  }),
  SparPin.make({
    prefix: "deo",
    ontologyIri: "http://purl.org/spar/deo",
    versionIri: "http://purl.org/spar/deo/2026-08-14",
    licenseIri: "http://creativecommons.org/licenses/by/4.0/",
    attribution:
      "Deo by David Shotton and Silvio Peroni. Contributors: Sebastian Barzaghi. CC BY 4.0. Curated term names projected to TypeScript.",
    module: "Deo",
    commit: "dfaa0904b1b7905cd8293dc2f1b9992c2871d0d4",
    release: "2026-08-14",
    version: "1.2.0",
    iri: "http://purl.org/spar/deo/",
    url: "https://raw.githubusercontent.com/SPAROntologies/deo/dfaa0904b1b7905cd8293dc2f1b9992c2871d0d4/docs/2026-08-14/deo.ttl",
    sha256: "c66ac7523cef1d57b88fbb8d8e5bb3fe81e8ce2932e24167700f0aafd89126cc",
    semanticSha256: "bae13b8cd5aa68e5273b6a94053dbe4859ec7ddecd25ebd2fab19199e2842283",
    terms: ["Introduction", "Methods"],
  }),
  SparPin.make({
    prefix: "fabio",
    ontologyIri: "http://purl.org/spar/fabio",
    versionIri: "http://purl.org/spar/fabio/2026-09-03",
    licenseIri: "https://creativecommons.org/licenses/by/4.0/legalcode",
    attribution:
      "Fabio by David Shotton and Silvio Peroni. Contributors: Paolo Ciccarese, Sebastian Barzaghi and Tim Clark. CC BY 4.0. Curated term names projected to TypeScript.",
    module: "Fabio",
    commit: "ea5b2cd49a7a8f4dc695d633c76bb05608c085db",
    release: "2026-09-03",
    version: "2.3.1",
    iri: "http://purl.org/spar/fabio/",
    url: "https://raw.githubusercontent.com/SPAROntologies/fabio/ea5b2cd49a7a8f4dc695d633c76bb05608c085db/docs/2026-09-03/fabio.ttl",
    sha256: "86523bded037828b13c3d2083c6eccdb0daa223009d4ed8ddd70ff1a4d1789ea",
    semanticSha256: "b6ce788d9786917c9d19adaa0d904213365607c7f683d7277f508dcf142b4cc2",
    terms: ["Report"],
  }),
  SparPin.make({
    prefix: "cito",
    ontologyIri: "http://purl.org/spar/cito",
    versionIri: "http://purl.org/spar/cito/2026-09-03",
    licenseIri: "https://creativecommons.org/licenses/by/4.0/legalcode",
    attribution:
      "Cito by David Shotton and Silvio Peroni. Contributors: Paolo Ciccarese, Sebastian Barzaghi and Tim Clark. CC BY 4.0. Curated term names projected to TypeScript.",
    module: "Cito",
    commit: "d34b42e8d4d1c9d45bc530599328897805116994",
    release: "2026-09-03",
    version: "2.9.0",
    iri: "http://purl.org/spar/cito/",
    url: "https://raw.githubusercontent.com/SPAROntologies/cito/d34b42e8d4d1c9d45bc530599328897805116994/docs/2026-09-03/cito.ttl",
    sha256: "1b0570e2126525365d325771d1c8cf3ba399f6dfd829cb69fd2851f42802d7b0",
    semanticSha256: "7b748150bdc75159bc015a93e17523e93158d7421422bce8a36547e4f1b81669",
    terms: ["cites", "citesAsEvidence"],
  }),
];

// This extractor is intentionally limited to the subject declarations emitted by
// these byte-pinned releases. It is not a general-purpose Turtle parser.
const project = Effect.fn("SyncDataToTs.SparTerms.project")(function* (pin: SparPin) {
  const source = yield* fetchSource(targetId, pin.prefix, pin.url);
  const fail = (message: string) => Effect.fail(SyncDataToTsError.make({ targetId, message, file: pin.url }));
  if (source.sha256 !== pin.sha256) return yield* fail("SPAR artifact SHA-256 does not match the immutable pin.");
  if (
    !Str.includes(`owl:versionIRI ${pin.prefix}:${pin.release}`)(source.text) ||
    !Str.includes(`dcterms:license <${pin.licenseIri}>`)(source.text)
  ) {
    return yield* fail("SPAR release metadata does not match its pinned version/license.");
  }
  const terms = A.sort(pin.terms, Str.Order);
  for (const term of terms) {
    const declaration = new RegExp(
      `^${pin.prefix}:${term} a owl:(?:Class|ObjectProperty|DatatypeProperty|AnnotationProperty)\\b`,
      "gmu"
    );
    if (!A.some(A.fromIterable(Str.matchAll(declaration)(source.text)), () => true)) {
      return yield* fail(`Curated SPAR term has no explicit class/property declaration: ${term}`);
    }
  }
  const crypto = yield* Crypto.Crypto;
  const digest = yield* crypto
    .digest("SHA-256", new TextEncoder().encode(A.join(terms, "\n")))
    .pipe(SyncDataToTsError.mapError("Failed to hash SPAR selected terms", targetId));
  if (Hex.encode(digest) !== pin.semanticSha256) return yield* fail("SPAR curated semantic digest mismatch.");
  return { pin, terms, source: sourceMetadata(source, { version: pin.version, published: pin.release }) };
});

const render = (pin: SparPin, terms: ReadonlyArray<string>): string => {
  const constant = Str.toUpperCase(pin.prefix);
  const describe = (name: string, prose: string) => `/**
 * ${prose}
 *
 * **Example** (Read ${name})
 *
 * \`\`\`ts
 * import { ${name} } from "@beep/rdf/Vocab/generated/${pin.module}.terms"
 * console.log(${name})
 * \`\`\`
 *
 * @category constants
 * @since 0.0.0
 */`;
  return `/**
 * Generated by \`bun run beep sync-data-to-ts --target spar-terms\`.
 * Source: ${pin.url}
 * CC BY 4.0; David Shotton and Silvio Peroni, SPAR Ontologies.
 * Curated local names only. Do not edit by hand.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
${describe(`${constant}_NAMESPACE`, "Pinned namespace IRI.")}
export const ${constant}_NAMESPACE = "${pin.iri}" as const;
${describe(`${constant}_TERMS`, "Selected upstream class/property names.")}
export const ${constant}_TERMS = ${Str.trim(formatJson(terms))} as const;
`;
};

/**
 * Generates pinned SPAR term inventories and the identity registry from upstream bytes.
 *
 * **Example** (Inspect SPAR acquisition)
 *
 * ```ts
 * import { sparTermsTarget } from "@beep/repo-cli/commands/SyncDataToTs/targets/SparTerms"
 * console.log(sparTermsTarget.id) // "spar-terms"
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const sparTermsTarget: SyncDataTarget = {
  ...SyncDataTargetMetadata.make({
    id: targetId,
    access: "public",
    description: "Pinned attributed DOCO, DEO, FaBiO and CiTO term inventories.",
    sourceUrls: A.map(pins, (pin) => pin.url),
  }),
  acquire: Effect.gen(function* () {
    const rows = yield* Effect.forEach(pins, project, { concurrency: 2 });
    const canonical = yield* normalizeJson(
      targetId,
      A.map(rows, ({ pin, terms }) => ({ ...pin, terms }))
    );
    const registry = A.join(
      A.map(rows, ({ pin, terms }) => `  ${pin.prefix}: { iri: "${pin.iri}", terms: ${Str.trim(formatJson(terms))} },`),
      "\n"
    );
    const identity = `/**
 * Generated by \`bun run beep sync-data-to-ts --target spar-terms\`.
 * SPAR Ontologies by David Shotton and Silvio Peroni; CC BY 4.0.
 * Do not edit by hand.
 * @packageDocumentation
 * @since 0.0.0
 */
/**
 * Pinned SPAR namespace inventories, projected from immutable upstream artifacts.
 *
 * **Example** (Read SPAR section inventory)
 *
 * \`\`\`ts
 * import { SparVocab } from "@beep/identity"
 * console.log(SparVocab.doco.iri)
 * \`\`\`
 *
 * @category constants
 * @since 0.0.0
 */
export const SparTerms = {
${registry}
} as const;
`;
    return SyncDataTargetProjection.make({
      canonicalPath,
      canonical,
      files: [
        ...A.map(rows, ({ pin, terms }) => outputFile(`${outputDir}/${pin.module}.terms.ts`, render(pin, terms))),
        outputFile("packages/foundation/modeling/identity/src/internal/generated/SparTerms.ts", identity),
        outputFile(canonicalPath, formatJson(canonical)),
      ],
      sources: A.map(rows, (row) => row.source),
      recordCount: A.reduce(rows, 0, (count, row) => count + A.length(row.terms)),
      summary: "Pinned curated SPAR inventories with byte and semantic digest proof.",
    });
  }),
};
