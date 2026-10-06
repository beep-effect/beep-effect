import {
  attributeDocuments,
  buildMatterTables,
  isRecycleStubPath,
  PracticeKgAttributeDocumentsInput,
  PracticeKgCatalogRow,
  PracticeKgDocketReferenceRow,
  PracticeKgEdgeRow,
  PracticeKgEnrichmentRow,
  PracticeKgMatterGraph,
  PracticeKgNodeRow,
  PracticeKgNumberMentionRow,
  PracticeKgResolveAnchorsInput,
  reconcileAnchors,
  resolveAnchors,
} from "@beep/law-practice-server";
import { describe, expect, it } from "@effect/vitest";
import * as A from "effect/Array";

const catalogRow = (
  digest: string,
  fields: Partial<{ client: string; docket: string; path: string; restored: boolean }> = {}
): PracticeKgCatalogRow =>
  PracticeKgCatalogRow.make({
    category: "docket",
    client: fields.client ?? null,
    digest,
    docket: fields.docket ?? null,
    docketFamily: "20001",
    effectiveName: `${digest}.txt`,
    mtimeIso: "2026-01-02T03:04:05.000Z",
    organizedRelativePath: null,
    restored: fields.restored ?? false,
    runLabel: "base",
    sizeBytes: 1,
    sourceLabel: "fixture",
    sourceOriginChain: "base:fixture",
    sourceRelativePath: fields.path ?? `dockets/20001/${digest}.txt`,
  });

const reference = (digest: string, client: string, docket: string, family = "20001"): PracticeKgDocketReferenceRow =>
  PracticeKgDocketReferenceRow.make({ client, digest, docket, family });

const enrichment = (
  candidate: string,
  applicationNumber: string | null,
  patentNumber: string | null,
  parents = ""
): PracticeKgEnrichmentRow =>
  PracticeKgEnrichmentRow.make({
    applicationNumber,
    candidate,
    docketFamilies: "20001",
    firstApplicantName: null,
    firstInventorName: null,
    inventionTitle: null,
    parentApplicationNumbers: parents,
    patentNumber,
    status: "resolved",
  });

const attribute = (
  rows: ReadonlyArray<PracticeKgCatalogRow>,
  references: ReadonlyArray<PracticeKgDocketReferenceRow>
) => attributeDocuments(PracticeKgAttributeDocumentsInput.make({ catalogRows: rows, docketReferences: references }));

describe("practice KG family attribution", () => {
  it("recognises recycle-bin stubs by file name under either path separator", () => {
    expect(isRecycleStubPath("recycle/$RX7K2P1.docx")).toBe(true);
    expect(isRecycleStubPath("C:\\$Recycle.Bin\\$RABC.pdf")).toBe(true);
    expect(isRecycleStubPath("$RTOP.txt")).toBe(true);
    expect(isRecycleStubPath("dockets/$Recycle/response.docx")).toBe(false);
  });

  it("walks every attribution source in precedence order", () => {
    const rows = [
      catalogRow("own", { docket: "20001US01" }),
      catalogRow("family-level"),
      catalogRow("mapped", { client: "mapped-client", docket: "20001US02" }),
      catalogRow("consensus", { docket: "20001US03" }),
      catalogRow("restored", { docket: "20001US04", restored: true }),
    ];
    const attributions = attribute(
      [...rows, PracticeKgCatalogRow.make({ ...catalogRow("lonely", { docket: "30002US01" }), docketFamily: "30002" })],
      [
        reference("own", "11111", "20001US01"),
        reference("family-level", "11111", "20001EP09"),
        // a reference to another family, and one from a digest the catalog does not hold, are ignored
        reference("own", "99999", "40004US01", "40004"),
        reference("unknown-digest", "99999", "20001US01"),
      ]
    );
    expect(A.map(attributions, (row) => [row.digest, row.attributionSource, row.familyKey])).toStrictEqual([
      ["consensus", "family-consensus", "11111.20001"],
      ["family-level", "text-reference", "11111.20001"],
      ["lonely", "filename", "30002"],
      ["mapped", "client-map", "mapped-client.20001"],
      ["own", "text-reference", "11111.20001"],
      ["restored", "family-consensus", "11111.20001"],
    ]);
  });

  it("falls back to the restored-name source when no client evidence exists", () => {
    const [restored] = attribute([catalogRow("restored", { docket: "20001US04", restored: true })], []);
    expect([restored?.attributionSource, restored?.client, restored?.docketKey]).toStrictEqual([
      "restored-name",
      null,
      "20001US04",
    ]);
  });

  it("reconciles application-keyed, patent-keyed, and number-less enrichment rows", () => {
    const anchors = reconcileAnchors([
      enrichment("87654321", "87654321", null, "76543210"),
      enrichment("12345678", "87654321", "12345678", "76543210 | 65432109"),
      enrichment("55555555", null, "55555555"),
      enrichment("44444444", null, null),
      PracticeKgEnrichmentRow.make({ ...enrichment("33333333", "33333333", null), status: "not-found" }),
    ]);
    expect(
      A.map(anchors, (anchor) => [anchor.applicationNumber, anchor.patentNumber, anchor.numbers, anchor.candidates])
    ).toStrictEqual([
      [null, null, ["44444444"], ["44444444"]],
      [null, "55555555", ["55555555"], ["55555555"]],
      ["87654321", "12345678", ["12345678", "87654321"], ["12345678", "87654321"]],
    ]);
    expect(A.map(anchors, (anchor) => anchor.parentApplicationNumbers)).toStrictEqual([
      [],
      [],
      ["65432109", "76543210"],
    ]);
  });

  it("makes an anchor a member only of one client-keyed family and labels the source", () => {
    const attributions = attribute(
      [
        catalogRow("alpha", { docket: "20001US01" }),
        catalogRow("beta", { docket: "20001US02" }),
        catalogRow("bare", { docket: "20001US09" }),
      ],
      [reference("alpha", "11111", "20001US01"), reference("beta", "22222", "20001US02")]
    );
    const mention = (digest: string, number: string, source: "filename" | "text") =>
      PracticeKgNumberMentionRow.make({ digest, number, source });
    const resolutions = resolveAnchors(
      PracticeKgResolveAnchorsInput.make({
        anchors: reconcileAnchors([
          enrichment("10000001", "10000001", null),
          enrichment("10000002", "10000002", null),
          enrichment("10000003", "10000003", null),
          enrichment("10000004", "10000004", null),
          enrichment("10000005", "10000005", null),
        ]),
        attributions,
        numberMentions: [
          mention("alpha", "10000001", "filename"),
          mention("beta", "10000002", "text"),
          mention("alpha", "10000003", "filename"),
          mention("beta", "10000003", "text"),
          mention("bare", "10000004", "text"),
          mention("not-in-catalog", "10000005", "text"),
        ],
      })
    );
    expect(
      A.map(resolutions, (resolution) => [
        resolution.anchor.applicationNumber,
        resolution.attributionSource,
        resolution.memberFamilyKey,
        resolution.memberDocketKeys,
        resolution.mentionedFamilyKeys,
      ])
    ).toStrictEqual([
      ["10000001", "filename", "11111.20001", ["11111.20001US01"], ["11111.20001"]],
      ["10000002", "text-reference", "22222.20001", ["22222.20001US02"], ["22222.20001"]],
      ["10000003", "mention", null, [], ["11111.20001", "22222.20001"]],
      ["10000004", "mention", null, [], ["20001"]],
      ["10000005", "mention", null, [], []],
    ]);
  });
});

describe("practice KG matter tables", () => {
  const node = (
    kind: PracticeKgNodeRow["kind"],
    naturalKey: string,
    fields: Partial<{ client: string; docketFamily: string }> = {}
  ): PracticeKgNodeRow =>
    PracticeKgNodeRow.make({
      attributionSource: "text-reference",
      iri: `iri:${kind}:${naturalKey}`,
      kind,
      label: naturalKey,
      naturalKey,
      payload: {},
      provenanceKind: "organize-row",
      provenanceRef: naturalKey,
      ...fields,
    });
  const edge = (subject: PracticeKgNodeRow, predicate: PracticeKgEdgeRow["predicate"], object: PracticeKgNodeRow) =>
    PracticeKgEdgeRow.make({
      objectIri: object.iri,
      predicate,
      provenanceKind: "organize-row",
      provenanceRef: "fixture",
      subjectIri: subject.iri,
    });

  it("derives matters, bare dockets, and filed numbers from membership edges only", () => {
    const keyed = node("docket_family", "11111.20001", { client: "11111", docketFamily: "20001" });
    const bare = node("docket_family", "20001", { docketFamily: "20001" });
    const empty = node("docket_family", "30002");
    const keyedDocket = node("docket", "11111.20001US01", { client: "11111", docketFamily: "20001" });
    const bareDocket = node("docket", "20001US09", { docketFamily: "20001" });
    const application = node("application", "87654321");
    const patent = node("patent", "12345678");
    const directPatent = node("patent", "55555555");
    const document = node("document", "sha256:a");
    const tables = buildMatterTables(
      PracticeKgMatterGraph.make({
        edges: [
          edge(keyed, "has_docket", keyedDocket),
          edge(bare, "has_docket", bareDocket),
          edge(keyedDocket, "files_as", application),
          edge(keyedDocket, "files_as", directPatent),
          edge(application, "granted_as", patent),
          edge(keyedDocket, "has_document", document),
          edge(keyed, "family_document", document),
          edge(application, "mentioned_in_family", bare),
        ],
        nodes: [keyed, bare, empty, keyedDocket, bareDocket, application, patent, directPatent, document],
      })
    );
    expect(
      A.map(tables.matters, (matter) => [
        matter.familyKey,
        matter.family,
        matter.client,
        matter.docketCount,
        matter.documentCount,
      ])
    ).toStrictEqual([
      ["11111.20001", "20001", "11111", 1, 2],
      ["20001", "20001", null, 1, 0],
      ["30002", "30002", null, 0, 0],
    ]);
    expect(
      A.map(tables.dockets, (docket) => [
        docket.docketKey,
        docket.docket,
        docket.applicationNumbers,
        docket.patentNumbers,
      ])
    ).toStrictEqual([
      ["11111.20001US01", "20001US01", ["87654321"], ["12345678", "55555555"]],
      ["20001US09", "20001US09", [], []],
    ]);
  });
});
