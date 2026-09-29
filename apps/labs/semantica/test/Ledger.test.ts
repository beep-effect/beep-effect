// @vitest-environment node

import { it } from "@beep/test-runner";
import { provideScopedLayer } from "@beep/test-utils";
import * as BunServices from "@effect/platform-bun/BunServices";
import { describe, expect } from "@effect/vitest";
import { Effect, FileSystem, Result } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { F1FixtureId } from "@/fixtures/F1";
import { LedgerLive } from "@/layers/LedgerLive";
import { FixtureDeclaration, Origin, SourceDocument } from "@/schema/Document";
import { DocumentId, RunId } from "@/schema/Ids";
import { EventBody, makeProvenanceEventId, ProvenanceEvent } from "@/schema/Provenance";
import { ParseOutcome } from "@/schema/Text";
import { Ledger } from "@/services/Ledger";

const runId = RunId.make("a".repeat(64));
const documentId = DocumentId.make("b".repeat(64));
const ingestedBody = EventBody.cases.Ingested.make({ document: documentId, kind: "Ingested" });
const ingestedId = Result.getOrThrow(makeProvenanceEventId({ body: ingestedBody, prev: O.none() }));
const ingested = ProvenanceEvent.make({ body: ingestedBody, id: ingestedId, prev: O.none() });
const document = SourceDocument.make({
  acquired: ingested.id,
  bytes: S.Natural.make(7),
  id: documentId,
  mediaType: "text/markdown",
  origin: Origin.cases.Fixture.make({
    declared: FixtureDeclaration.make({ degradedKind: O.some("invalid-utf8"), expectation: "degraded" }),
    fixtureId: F1FixtureId.make("md-invalid-utf8"),
    kind: "Fixture",
    relativePath: "documents/md-invalid-utf8.md",
  }),
  sha256: documentId,
});

const degraded = (kind: "invalid-utf8" | "truncated") =>
  ParseOutcome.cases.Degraded.make({
    detail: `${kind} fixture`,
    document: document.id,
    kind,
    outcome: "Degraded",
  });
describe("C0 ledger", () => {
  it.layer(BunServices.layer, { timeout: "30 seconds", excludeTestServices: true })((it) => {
    it.effect("is idempotent for byte-identical content-addressed rows", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const ledgerRoot = yield* fs.makeTempDirectoryScoped({ prefix: "semantica-ledger-" });
        yield* Effect.gen(function* () {
          const ledger = yield* Ledger;
          yield* ledger.appendDocument(document, degraded("invalid-utf8"), O.none(), [], [ingested]);
          yield* ledger.appendDocument(document, degraded("invalid-utf8"), O.none(), [], [ingested]);
          const snapshot = yield* ledger.read(runId);

          expect(snapshot.documents).toHaveLength(1);
          expect(snapshot.events).toHaveLength(1);
          expect(snapshot.documents[0]?.outcome).toMatchObject({ kind: "invalid-utf8" });
        }).pipe(provideScopedLayer(LedgerLive({ ledgerRoot, mode: "replay", runId })));
      })
    );
  });

  it.layer(BunServices.layer, { timeout: "30 seconds", excludeTestServices: true })((it) => {
    it.effect("rejects a reused primary key whose canonical payload digest differs", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const ledgerRoot = yield* fs.makeTempDirectoryScoped({ prefix: "semantica-ledger-conflict-" });
        yield* Effect.gen(function* () {
          const ledger = yield* Ledger;
          yield* ledger.appendDocument(document, degraded("invalid-utf8"), O.none(), [], [ingested]);
          const committed = yield* ledger.read(runId);
          const error = yield* ledger
            .appendDocument(document, degraded("truncated"), O.none(), [], [ingested])
            .pipe(Effect.flip);

          expect(error).toMatchObject({ _tag: "LedgerFailed", reason: "conflicting-row" });
          const afterConflict = yield* ledger.read(runId);
          expect(afterConflict).toEqual(committed);
          expect(afterConflict.documents).toHaveLength(1);
          expect(afterConflict.documents[0]?.outcome).toEqual(degraded("invalid-utf8"));
          expect(afterConflict.events).toEqual([ingested]);
        }).pipe(provideScopedLayer(LedgerLive({ ledgerRoot, mode: "replay", runId })));
      })
    );
  });
});
