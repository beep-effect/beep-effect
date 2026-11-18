import * as Domain from "@alchemy.run/domain";
import * as Catalog from "@beep/contract-kit/Catalog";
import { groupShape } from "@beep/contract-kit/Parity";
import { describe, expect, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as S from "effect/Schema";
import type * as Rpc from "effect/rpc/Rpc";

const NoteId = S.String.pipe(S.brand("NoteId"));

class NoteCreated extends Domain.Event("NoteCreated", { title: S.String }) {}

class CreateNote extends Domain.Command("CreateNote", {
  target: NoteId,
  input: { title: S.String },
  events: [NoteCreated],
}) {}

class Note extends Domain.Aggregate("Note", {
  id: NoteId,
  state: S.Struct({ title: S.NullOr(S.String) }),
  initial: { title: null },
  commands: [CreateNote],
  decide: { CreateNote: (_state, command) => [NoteCreated.make({ title: command.title })] },
  evolve: { NoteCreated: (_state, event) => ({ title: event.title }) },
}) {}

class NotesModel extends Domain.Model("Notes", { aggregates: [Note] }) {}

class NotesApi extends Domain.Api("NotesApi", {
  model: NotesModel,
  commands: ["CreateNote"],
  views: [],
  queries: [],
  streams: [],
}) {}

const NotesCatalog = Catalog.make({ name: "Notes", commands: [CreateNote], views: [], queries: [] });

class NotesContract extends Domain.Api("NotesContract", {
  model: NotesCatalog,
  commands: ["CreateNote"],
  views: [],
  queries: [],
  streams: [],
}) {}

describe("Catalog.make", () => {
  it("holds the context's commands, views and queries and no aggregate", () => {
    expect(NotesCatalog.kind).toBe("Model");
    expect(NotesCatalog.modelName).toBe("Notes");
    expect(NotesCatalog.aggregates).toEqual([]);
    expect(NotesCatalog.commands).toEqual([CreateNote]);
    expect(NotesCatalog.definitions.aggregates).toEqual([]);
    expect(NotesCatalog.definitions.policies).toEqual([]);
  });

  it("builds the same RPC group as an Api over the real model", () => {
    const expected = groupShape(NotesApi.group);
    expect(expected.length).toBe(1);
    expect(groupShape(NotesContract.group)).toEqual(expected);
  });
});

describe("Catalog.waitsOnProjection", () => {
  it("names a projection by its name", () => {
    const waits = Catalog.waitsOnProjection("NoteIndex");
    expect(waits.kind).toBe("Projection");
    expect(waits.projectionName).toBe("NoteIndex");
  });
});

class WaitingNoteIndex extends Domain.Query("NoteIndex", {
  input: { title: S.String },
  success: NoteId,
  waitsFor: [Catalog.waitsOnProjection("NoteIndex")],
}) {}

class ImmediateNoteIndex extends Domain.Query("NoteIndex", {
  input: { title: S.String },
  success: NoteId,
}) {}

const queryRpcOf = (query: typeof WaitingNoteIndex | typeof ImmediateNoteIndex) => {
  class IndexContract extends Domain.Api("IndexContract", {
    model: Catalog.make({ name: "Notes", commands: [], views: [], queries: [query] }),
    commands: [],
    views: [],
    queries: ["NoteIndex"],
    streams: [],
  }) {}
  return A.map(A.fromIterable(IndexContract.group.requests.values()), (rpc) => rpc as unknown as Rpc.AnyWithProps);
};

const timeout = Domain.ConsistencyTimeout.make({ view: "NoteIndex", key: "note_1", stream: "Note/note_1", version: 1 });

describe("a contract query that waits on a projection", () => {
  it("fails with ConsistencyTimeout on the wire; the same query without a wait cannot", () => {
    const waiting = queryRpcOf(WaitingNoteIndex);
    const immediate = queryRpcOf(ImmediateNoteIndex);
    expect(waiting.length).toBe(1);
    expect(immediate.length).toBe(1);
    expect(A.every(waiting, (rpc) => S.is(rpc.errorSchema)(timeout))).toBe(true);
    expect(A.some(immediate, (rpc) => S.is(rpc.errorSchema)(timeout))).toBe(false);
  });
});
