import { toPgTable } from "@beep/effect-drizzle/pg";
import { Message, Thread, Turn } from "@beep/workspace-domain";
import { describe, expect, it } from "@effect/vitest";
import { getTableConfig } from "drizzle-orm/pg-core";

const indexNames = (config: { indexes: ReadonlyArray<{ config: { name?: string } }> }) =>
  config.indexes.map((index) => index.config.name);

describe("workspace entity materialization", () => {
  it("materializes model extras into table indexes", () => {
    const message = Message.pipe(toPgTable, getTableConfig);
    const thread = Thread.pipe(toPgTable, getTableConfig);
    const turn = Turn.pipe(toPgTable, getTableConfig);

    expect(indexNames(message)).toEqual(
      expect.arrayContaining([
        "workspace_message_role_lookup_idx",
        "workspace_message_thread_id_btree_idx",
        "workspace_message_turn_id_btree_idx",
      ])
    );
    expect(indexNames(thread)).toEqual(expect.arrayContaining(["workspace_thread_workspace_id_btree_idx"]));
    expect(indexNames(turn)).toEqual(
      expect.arrayContaining([
        "workspace_turn_parent_turn_id_btree_idx",
        "workspace_turn_thread_id_btree_idx",
        "workspace_turn_turn_index_btree_idx",
      ])
    );
  });
});
