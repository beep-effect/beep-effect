import * as Domain from "@alchemy.run/domain";
import * as Catalog from "@beep/contract-kit/Catalog";
import { groupShape } from "@beep/contract-kit/Parity";
import { describe, expect, it } from "@effect/vitest";
import * as S from "effect/Schema";

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
