import {
  applyPracticeKgPathEvidence,
  attributeDocuments,
  buildMatterTables,
  isRecycleStubPath,
  PracticeKgAttributeDocumentsInput,
  PracticeKgCatalogRow,
  PracticeKgDocketReferenceRow,
  PracticeKgDocketRegisterRow,
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
  references: ReadonlyArray<PracticeKgDocketReferenceRow>,
  registerRows: ReadonlyArray<PracticeKgDocketRegisterRow> = []
) =>
  attributeDocuments(
    PracticeKgAttributeDocumentsInput.make({ catalogRows: rows, docketReferences: references, registerRows })
  );

const registerRow = (client: string, docket: string, clientName: string | null = null): PracticeKgDocketRegisterRow =>
  PracticeKgDocketRegisterRow.make({ client, clientName, docket });

// A row as the catalog query returns it for a folded-in run: unsorted, no docket, no family.
const runRow = (digest: string, path: string): PracticeKgCatalogRow =>
  PracticeKgCatalogRow.make({
    ...catalogRow(digest, { path }),
    category: "unsorted",
    docketFamily: null,
    runFolded: true,
    runLabel: "2026-10-working-files",
  });

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

  it("reads one docket and one client from a folded-in run row's folder path", () => {
    const rows = applyPracticeKgPathEvidence([
      runRow("keyed", "Clients/Example Client 11111/20001US01 - 11111.00012/Filing receipt.txt"),
      runRow("no-client", "Loose files/40004ZA01/Notice.txt"),
      runRow("cited-elsewhere", "Clients/Example Client 11111/20001US01 - 11111.00012/re 22222.30002US01.txt"),
      runRow("two-dockets", "Clients/Example Client 11111/20001US01 and 20001US02/Combined.txt"),
      runRow("no-docket", "Clients/Example Client 11111/General/Engagement letter.txt"),
    ]);
    expect(
      A.map(rows, (row) => [row.digest, row.category, row.docket, row.docketFamily, row.folderClient])
    ).toStrictEqual([
      ["keyed", "docket", "20001US01", "20001", "11111"],
      ["no-client", "docket", "40004ZA01", "40004", null],
      // the file name cites another client's matter: the folder's docket stands, no client is taken
      ["cited-elsewhere", "docket", "20001US01", "20001", null],
      // ambiguous paths are left exactly as they were
      ["two-dockets", "unsorted", null, null, null],
      ["no-docket", "unsorted", null, null, null],
    ]);
  });

  it("leaves organizer rows and rows that already carry a docket or family untouched", () => {
    const path = "Clients/Example Client 11111/20001US01 - 11111.00012/Filing receipt.txt";
    const organized = PracticeKgCatalogRow.make({ ...runRow("organized", path), runFolded: false });
    const docketed = PracticeKgCatalogRow.make({ ...runRow("docketed", path), docket: "30002US01" });
    const familied = PracticeKgCatalogRow.make({ ...runRow("familied", path), docketFamily: "30002" });
    expect(applyPracticeKgPathEvidence([organized, docketed, familied])).toStrictEqual([organized, docketed, familied]);
  });

  it("ranks the folder path over text references, and keeps the register for families nobody has named", () => {
    const inFamily = (digest: string, docket: string, family: string, folderClient: string | null = null) =>
      PracticeKgCatalogRow.make({ ...catalogRow(digest, { docket }), docketFamily: family, folderClient });
    const attributions = attribute(
      [
        inFamily("folder-wins", "20001US02", "20001", "22222"),
        // the register may only speak for a family with no folder or text client at all
        inFamily("register-applies", "30002US01", "30002"),
        inFamily("register-national-stage", "30002WO05-US1", "30002"),
        inFamily("register-shared", "30002US04", "30002"),
        inFamily("register-unlisted", "30002US09", "30002"),
        // a family-level document has no docket for the register to name
        PracticeKgCatalogRow.make({ ...catalogRow("family-level"), docketFamily: "50005" }),
        inFamily("consensus", "40004US02", "40004"),
        inFamily("consensus-voter", "40004US01", "40004", "44444"),
      ],
      [reference("folder-wins", "33333", "20001US02")],
      [
        registerRow("11111", "30002us01 "),
        registerRow("66666", "30002WO05"),
        // listed under two clients: the register cannot decide this docket
        registerRow("11111", "30002US04"),
        registerRow("55555", "30002US04"),
        // the register is not consulted where the family already has a consensus
        registerRow("77777", "40004US02"),
      ]
    );
    expect(A.map(attributions, (row) => [row.digest, row.attributionSource, row.familyKey])).toStrictEqual([
      ["consensus", "family-consensus", "44444.40004"],
      ["consensus-voter", "folder-path", "44444.40004"],
      ["family-level", "filename", "50005"],
      ["folder-wins", "folder-path", "22222.20001"],
      ["register-applies", "docket-register", "11111.30002"],
      ["register-national-stage", "docket-register", "66666.30002"],
      ["register-shared", "filename", "30002"],
      ["register-unlisted", "filename", "30002"],
    ]);
  });

  it("never lets the register override or outvote a document's own client evidence", () => {
    // Regression: bare docket codes are reused across clients and the register
    // lists only current dockets. Register-first moved an older document whose
    // text names 33333 for 20001US01 onto 11111, the code's current holder.
    const register = [registerRow("11111", "20001US01"), registerRow("11111", "20001US07")];
    const attributions = attribute(
      [
        catalogRow("own-text", { docket: "20001US01" }),
        catalogRow("same-docket-no-evidence", { docket: "20001US01" }),
        catalogRow("other-docket-no-evidence", { docket: "20001US07" }),
      ],
      [reference("own-text", "33333", "20001US01")],
      register
    );
    expect(A.map(attributions, (row) => [row.digest, row.attributionSource, row.familyKey])).toStrictEqual([
      // the family's one vote is 33333, so its other documents follow that vote, never the register
      ["other-docket-no-evidence", "family-consensus", "33333.20001"],
      ["own-text", "text-reference", "33333.20001"],
      ["same-docket-no-evidence", "family-consensus", "33333.20001"],
    ]);

    // Two clients vote in the family: no consensus, and still no register.
    const contested = attribute(
      [
        catalogRow("own-text", { docket: "20001US01" }),
        catalogRow("second-client", { docket: "20001US02" }),
        catalogRow("same-docket-no-evidence", { docket: "20001US01" }),
      ],
      [reference("own-text", "33333", "20001US01"), reference("second-client", "44444", "20001US02")],
      register
    );
    expect(A.map(contested, (row) => [row.digest, row.attributionSource, row.familyKey])).toStrictEqual([
      ["own-text", "text-reference", "33333.20001"],
      ["same-docket-no-evidence", "filename", "20001"],
      ["second-client", "text-reference", "44444.20001"],
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
    const renamed = node("docket_family", "22222.20001", { client: "22222", docketFamily: "20001" });
    const unnamed = node("docket_family", "33333.20001", { client: "33333", docketFamily: "20001" });
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
        nodes: [
          keyed,
          renamed,
          unnamed,
          bare,
          empty,
          keyedDocket,
          bareDocket,
          application,
          patent,
          directPatent,
          document,
        ],
        registerRows: [
          registerRow("11111", "20001US01", " Example Client "),
          registerRow("11111", "20001US02", "Example Client"),
          registerRow("11111", "20001US03"),
          // one client number under two names is left unnamed rather than guessed
          registerRow("22222", "20001US04", "Second Client"),
          registerRow("22222", "20001US05", "Second Client LLC"),
          registerRow("33333", "20001US06", "  "),
        ],
      })
    );
    expect(A.map(tables.matters, (matter) => [matter.familyKey, matter.clientName])).toStrictEqual([
      ["11111.20001", "Example Client"],
      ["20001", null],
      ["22222.20001", null],
      ["30002", null],
      ["33333.20001", null],
    ]);
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
      ["22222.20001", "20001", "22222", 0, 0],
      ["30002", "30002", null, 0, 0],
      ["33333.20001", "20001", "33333", 0, 0],
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
