/**
 * Provenance stamping from several request-context shapes: genesis import's
 * actor context and the Session middleware's v1 request context each get a
 * mapping, an unmapped context leaves the columns NULL, and the single
 * `provenance` mapping behaves as it always has.
 */
import * as Domain from "@alchemy.run/domain";
import { AlchemyPostgresConfig, AlchemyPostgresPlatform, ProvenanceMapping } from "@beep/alchemy-postgres";
import { PgliteTestLayer } from "@beep/pglite/Pglite.test-layer";
import { describe, layer } from "@effect/vitest";
import { deepStrictEqual } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import { flow } from "effect/Function";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as SqlClient from "effect/sql/SqlClient";

const NoteId = S.String.pipe(S.brand("ProvenanceNoteId"));
class NoteWritten extends Domain.Event("NoteWritten", { text: S.String }) {}
class WriteNote extends Domain.Command("WriteNote", {
  target: NoteId,
  input: { text: S.String },
  events: [NoteWritten],
}) {}
class Note extends Domain.Aggregate("Note", {
  id: NoteId,
  state: S.Union([S.TaggedStruct("Blank", {}), S.TaggedStruct("Written", { text: S.String })]),
  initial: { _tag: "Blank" },
  commands: [WriteNote],
  decide: { WriteNote: (_state, command) => [NoteWritten.make({ text: command.text })] },
  evolve: { NoteWritten: (_state, event) => ({ _tag: "Written" as const, text: event.text }) },
}) {}
class Notes extends Domain.Model("Notes", { aggregates: [Note] }) {}

/** Genesis import's legacy audit actor. */
class GenesisActor extends Domain.RequestContext<GenesisActor>()(
  "Provenance/GenesisActor",
  S.Struct({ principal: S.String, sourceKind: S.String })
) {}

/** The Session middleware's v1 request context: a string principal key and a source kind. */
class SessionContext extends Domain.RequestContext<SessionContext>()(
  "Provenance/SessionContext",
  S.Struct({ version: S.Literal(1), principalKey: S.String, sourceKind: S.String })
) {}

/** An actor whose principal is not a string. */
class NumericActor extends Domain.RequestContext<NumericActor>()(
  "Provenance/NumericActor",
  S.Struct({ principal: S.Finite, sourceKind: S.String })
) {}

/** A request context no mapping names. */
class TraceContext extends Domain.RequestContext<TraceContext>()(
  "Provenance/TraceContext",
  S.Struct({ principal: S.String, sourceKind: S.String })
) {}

const genesisMapping = ProvenanceMapping.make({
  contextKey: GenesisActor.key,
  principalField: "principal",
  sourceKindField: "sourceKind",
});
const sessionMapping = ProvenanceMapping.make({
  contextKey: SessionContext.key,
  principalField: "principalKey",
  sourceKindField: "sourceKind",
});

const numericMapping = ProvenanceMapping.make({
  contextKey: NumericActor.key,
  principalField: "principal",
  sourceKindField: "sourceKind",
});

const asNumeric = Effect.provideService(NumericActor, { principal: 7, sourceKind: "batch" });
const asGenesis = Effect.provideService(GenesisActor, { principal: "legacy:alice", sourceKind: "import" });
const asSession = Effect.provideService(SessionContext, { version: 1, principalKey: "User:5", sourceKind: "api" });
const asTrace = Effect.provideService(TraceContext, { principal: "trace", sourceKind: "probe" });

const StoredRow = S.Struct({ principal: S.NullOr(S.String), source_kind: S.NullOr(S.String) });
const decodeStoredRows = S.decodeUnknownEffect(S.Array(StoredRow));

/** Send one note to `id`; the caller provides the request context. */
const send = Effect.fn("test.send")(function* (id: string) {
  const notes = yield* Note;
  return yield* notes.send(NoteId.make(id), WriteNote.make({ text: "hello" }));
});

/** Assert the provenance columns of the event rows of note `id` in `table`. */
const rowsIn = (table: string) =>
  Effect.fn("test.rowsIn")(function* (id: string, expected: ReadonlyArray<typeof StoredRow.Type>) {
    const sql = yield* SqlClient.SqlClient;
    const found = yield* sql`SELECT principal, source_kind FROM ${sql(table)}
      WHERE model = 'Notes' AND aggregate = 'Note' AND id = ${id}`.pipe(Effect.flatMap(decodeStoredRows));
    deepStrictEqual(found, expected);
  });

const hostedWith = (config: AlchemyPostgresConfig) =>
  Notes.layer(Layer.empty).pipe(
    Layer.provideMerge(AlchemyPostgresPlatform.layer(config)),
    Layer.provideMerge(PgliteTestLayer)
  );

const several = hostedWith(
  AlchemyPostgresConfig.make({
    tablePrefix: "several_",
    provenance: O.some(genesisMapping),
    provenanceMappings: [sessionMapping],
  })
);
const single = hostedWith(AlchemyPostgresConfig.make({ tablePrefix: "single_", provenance: O.some(genesisMapping) }));
const listed = hostedWith(
  AlchemyPostgresConfig.make({
    tablePrefix: "listed_",
    provenanceMappings: [genesisMapping, sessionMapping, numericMapping],
  })
);

describe("provenance mappings", () => {
  layer(several, { timeout: "30 seconds", excludeTestServices: true })("several mappings on PGlite", (it) => {
    const rows = rowsIn("several_aggregate_event");

    it.effect("stamps a genesis-shaped context from the genesis mapping", () =>
      Effect.gen(function* () {
        yield* asGenesis(send("genesis"));
        yield* rows("genesis", [{ principal: "legacy:alice", source_kind: "import" }]);
      })
    );

    it.effect("stamps a Session v1 context from its principalKey and sourceKind", () =>
      Effect.gen(function* () {
        yield* asSession(send("session"));
        yield* rows("session", [{ principal: "User:5", source_kind: "api" }]);
      })
    );

    it.effect("leaves both columns NULL for a context no mapping names", () =>
      Effect.gen(function* () {
        yield* asTrace(send("trace"));
        yield* rows("trace", [{ principal: null, source_kind: null }]);
        yield* send("bare");
        yield* rows("bare", [{ principal: null, source_kind: null }]);
      })
    );

    it.effect("takes the first matching mapping, `provenance` first, when two contexts are present", () =>
      Effect.gen(function* () {
        yield* flow(asSession, asGenesis)(send("both"));
        yield* rows("both", [{ principal: "legacy:alice", source_kind: "import" }]);
      })
    );
  });

  layer(listed, { timeout: "30 seconds", excludeTestServices: true })("a mapping list alone on PGlite", (it) => {
    const rows = rowsIn("listed_aggregate_event");

    it.effect("stamps each context shape from its own list entry", () =>
      Effect.gen(function* () {
        yield* asGenesis(send("genesis"));
        yield* rows("genesis", [{ principal: "legacy:alice", source_kind: "import" }]);
        yield* asSession(send("session"));
        yield* rows("session", [{ principal: "User:5", source_kind: "api" }]);
      })
    );

    it.effect("copies only string fields: a numeric principal stays NULL", () =>
      Effect.gen(function* () {
        yield* asNumeric(send("numeric"));
        yield* rows("numeric", [{ principal: null, source_kind: "batch" }]);
      })
    );
  });

  layer(single, { timeout: "30 seconds", excludeTestServices: true })("the single mapping on PGlite", (it) => {
    const rows = rowsIn("single_aggregate_event");

    it.effect("stamps the mapped context as before", () =>
      Effect.gen(function* () {
        yield* asGenesis(send("genesis"));
        yield* rows("genesis", [{ principal: "legacy:alice", source_kind: "import" }]);
      })
    );

    it.effect("leaves a Session v1 context unstamped, as before", () =>
      Effect.gen(function* () {
        yield* asSession(send("session"));
        yield* rows("session", [{ principal: null, source_kind: null }]);
      })
    );
  });
});
