import * as A from "effect/Array";
import * as Str from "effect/String";
import { sha256TextSync } from "@/schema/Digest";
import type { RdfsRuleId } from "@/schema/Reasoning";

interface Triple {
  readonly object: string;
  readonly predicate: string;
  readonly subject: string;
}

interface Case {
  readonly asserted: ReadonlyArray<Triple>;
  readonly conclusion: Triple;
  readonly id: string;
  readonly rule: RdfsRuleId;
}

const rdfType = "<http://www.w3.org/1999/02/22-rdf-syntax-ns#type>";
const domain = "<http://www.w3.org/2000/01/rdf-schema#domain>";
const range = "<http://www.w3.org/2000/01/rdf-schema#range>";
const subClass = "<http://www.w3.org/2000/01/rdf-schema#subClassOf>";
const subProperty = "<http://www.w3.org/2000/01/rdf-schema#subPropertyOf>";
const broader = "<http://www.w3.org/2004/02/skos/core#broaderTransitive>";
const triple = (subject: string, predicate: string, object: string): Triple => ({ object, predicate, subject });

const cases: ReadonlyArray<Case> = [
  {
    id: "rdfs2-domain",
    rule: "rdfs2",
    asserted: [triple("<urn:p>", domain, "<urn:C>"), triple("<urn:s>", "<urn:p>", "<urn:o>")],
    conclusion: triple("<urn:s>", rdfType, "<urn:C>"),
  },
  {
    id: "rdfs3-range",
    rule: "rdfs3",
    asserted: [triple("<urn:p>", range, "<urn:C>"), triple("<urn:s>", "<urn:p>", "<urn:o>")],
    conclusion: triple("<urn:o>", rdfType, "<urn:C>"),
  },
  {
    id: "rdfs5-subproperty",
    rule: "rdfs5",
    asserted: [triple("<urn:p>", subProperty, "<urn:q>"), triple("<urn:q>", subProperty, "<urn:r>")],
    conclusion: triple("<urn:p>", subProperty, "<urn:r>"),
  },
  {
    id: "rdfs7-property",
    rule: "rdfs7",
    asserted: [triple("<urn:p>", subProperty, "<urn:q>"), triple("<urn:s>", "<urn:p>", "<urn:o>")],
    conclusion: triple("<urn:s>", "<urn:q>", "<urn:o>"),
  },
  {
    id: "rdfs9-subclass",
    rule: "rdfs9",
    asserted: [triple("<urn:C>", subClass, "<urn:D>"), triple("<urn:s>", rdfType, "<urn:C>")],
    conclusion: triple("<urn:s>", rdfType, "<urn:D>"),
  },
  {
    id: "rdfs11-subclass",
    rule: "rdfs11",
    asserted: [triple("<urn:C>", subClass, "<urn:D>"), triple("<urn:D>", subClass, "<urn:E>")],
    conclusion: triple("<urn:C>", subClass, "<urn:E>"),
  },
  {
    id: "skos-broader-transitive",
    rule: "skos-broader-transitive",
    asserted: [triple("<urn:a>", broader, "<urn:b>"), triple("<urn:b>", broader, "<urn:c>")],
    conclusion: triple("<urn:a>", broader, "<urn:c>"),
  },
];

const rulesPath = new URL("../fixtures/gold/v1/g-entailment-rdfs.n3", import.meta.url).pathname;
const childPath = new URL("../test/helpers/EyeOracleChild.ts", import.meta.url).pathname;
const n3 = (value: Triple): string => `${value.subject} ${value.predicate} ${value.object}.`;
const inline = (value: string): string => `base64:${Buffer.from(value).toString("base64")}`;
const normalizeProof = (proof: string): string =>
  `${Str.trim(Str.replace(/https:\/\/eyereasoner\.github\.io\/\.well-known\/genid\/[^#>]+#/gu, "urn:eye:proof#")(proof))}\n`;

const generatedCases = A.map(cases, (testCase) => {
  const data = `${A.join(A.map(testCase.asserted, n3), "\n")}\n`;
  const query = `{ ${n3(testCase.conclusion)} } => { ${n3(testCase.conclusion)} }.\n`;
  const child = Bun.spawnSync([process.execPath, "run", childPath, rulesPath, inline(data), inline(query), "proof"], {
    stderr: "inherit",
    stdout: "pipe",
  });
  const proof = child.stdout.toString("utf8");
  return {
    asserted: testCase.asserted,
    expectedDerived: [testCase.conclusion],
    id: testCase.id,
    proofs: [
      {
        conclusion: testCase.conclusion,
        eyeProofDigest: sha256TextSync(normalizeProof(proof)),
        premises: testCase.asserted,
        rule: testCase.rule,
      },
    ],
  };
});

const generated = `${JSON.stringify(
  {
    cases: generatedCases,
    oracle: {
      engine: "EYE",
      eyeVersion: "11.24.5",
      package: "eyereasoner",
      packageVersion: "21.1.18",
      restricted: true,
    },
    rulesSha256: sha256TextSync(await Bun.file(rulesPath).text()),
    schemaVersion: "g-entailment-rdfs/v1",
  },
  undefined,
  2
)}\n`;

if (A.contains(process.argv, "--write")) {
  await Bun.write(new URL("../fixtures/gold/v1/g-entailment-rdfs.json", import.meta.url), generated);
} else {
  process.stdout.write(generated);
}
