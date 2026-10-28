import {
  mergeSchemaFirstInventory,
  nullReturnEntryFromFunctionLike,
  SchemaFirstInventoryDocument,
  SchemaFirstInventoryEntry,
} from "@beep/repo-cli/test/Lint";
import { it } from "@beep/test-runner";
import { A } from "@beep/utils";
import { describe } from "@effect/vitest";
import { assertSome, deepStrictEqual, strictEqual } from "@effect/vitest/utils";
import * as O from "effect/Option";
import { Project } from "ts-morph";

const file = "packages/example/src/Users.ts";
const owner = "@beep/example";
const keptReason = "Kept: the null return mirrors a third-party callback contract.";

const findUserSource = A.join(["export function findUser(id: string): string | null {", "  return null;", "}"], "\n");

const liveNullReturnEntry = (sourceText: string): SchemaFirstInventoryEntry => {
  const project = new Project({ useInMemoryFileSystem: true });
  const sourceFile = project.createSourceFile(file, sourceText);
  const functionDeclaration = O.getOrThrow(A.head(sourceFile.getFunctions()));
  return O.getOrThrow(nullReturnEntryFromFunctionLike(functionDeclaration, { file, owner }));
};

const inventory = (entries: ReadonlyArray<SchemaFirstInventoryEntry>): SchemaFirstInventoryDocument =>
  SchemaFirstInventoryDocument.make({ version: 1, generatedOn: "2026-10-28", entries, backlog: [] });

const keptException = (entry: SchemaFirstInventoryEntry): SchemaFirstInventoryEntry =>
  SchemaFirstInventoryEntry.make({ ...entry, status: "exception", reason: keptReason });

describe("mergeSchemaFirstInventory", () => {
  it("keeps an exception and refreshes its line when a doc edit shifts the symbol", () => {
    const committed = keptException(liveNullReturnEntry(findUserSource));
    const shifted = liveNullReturnEntry(
      A.join(["/**", " * Look up a user by id.", " *", " * @since 0.0.0", " */", findUserSource], "\n")
    );
    strictEqual(committed.line, 1);
    strictEqual(shifted.line, 6);

    const merged = mergeSchemaFirstInventory(inventory([shifted]), O.some(inventory([committed])), []);

    deepStrictEqual(
      A.map(merged.entries, ({ status, reason, line, ruleId, symbol }) => ({ status, reason, line, ruleId, symbol })),
      [{ status: "exception", reason: keptReason, line: 6, ruleId: "SFV4-null-return", symbol: "findUser" }]
    );
  });

  it("returns the committed entry unchanged when the symbol has not moved", () => {
    const committed = keptException(liveNullReturnEntry(findUserSource));

    const merged = mergeSchemaFirstInventory(
      inventory([liveNullReturnEntry(findUserSource)]),
      O.some(inventory([committed])),
      []
    );

    assertSome(A.head(merged.entries), committed);
  });

  it("falls back to the line when one symbol carries several findings of the same rule", () => {
    const base = liveNullReturnEntry(findUserSource);
    const atLine = (line: number) => SchemaFirstInventoryEntry.make({ ...base, line });
    const committedFirst = keptException(atLine(10));
    const committedSecond = atLine(20);

    const merged = mergeSchemaFirstInventory(
      inventory([atLine(10), atLine(25)]),
      O.some(inventory([committedFirst, committedSecond])),
      []
    );

    deepStrictEqual(
      A.map(merged.entries, ({ status, line }) => ({ status, line })),
      [
        { status: "exception", line: 10 },
        { status: "advisory", line: 25 },
      ]
    );
  });
});
