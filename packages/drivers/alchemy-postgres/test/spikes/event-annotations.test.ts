/**
 * P0 spike (goals/alchemy-vault-sync-slice): annotation propagation and the
 * event schema-version slot in `@alchemy.run/domain` 2.0.0-beta.86.
 *
 * Findings this test pins:
 * - field schemas keep their Effect annotations and `LiteralKit` identity;
 * - beta.86 Domain and Schema annotations are retained on the event class;
 * - the schema version remains a static read by the driver.
 */

import * as Domain from "@alchemy.run/domain";
import { LiteralKit } from "@beep/schema";
import { describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as R from "effect/Record";
import * as S from "effect/Schema";

const DestinationKind = LiteralKit(["box", "gdrive"]);
const DestinationName = S.String.annotate({
  identifier: "DestinationName",
  description: "Org-unique destination name",
});

class DestinationRegistered extends Domain.Event(
  "DestinationRegistered",
  { kind: DestinationKind, name: DestinationName },
  { description: "A destination was registered in the vault." }
) {
  static readonly schemaVersion = 2;
}

describe("alchemy beta.86 event annotations (P0 spike)", () => {
  it.effect("keeps field-level annotations and LiteralKit identity through Domain.Event", () =>
    Effect.sync(() => {
      const fields = DestinationRegistered.fields;
      expect(fields.kind).toBe(DestinationKind);
      expect(DestinationKind.is.box("box")).toBe(true);
      expect(fields.name.ast.annotations).toMatchObject({ identifier: "DestinationName" });
      expect(R.keys(fields)).toEqual(["_tag", "kind", "name"]);
    })
  );

  it.effect("exposes the tag, Domain annotations and the class identifier", () =>
    Effect.sync(() => {
      expect(DestinationRegistered.tag).toBe("DestinationRegistered");
      expect(DestinationRegistered.kind).toBe("Event");
      expect(DestinationRegistered.annotations.description).toBe("A destination was registered in the vault.");
      expect(DestinationRegistered.ast.annotations?.description).toBe("A destination was registered in the vault.");
      expect(DestinationRegistered.ast.annotations?.identifier).toBe("DestinationRegistered");
    })
  );

  it.effect("carries a schema version as a static the driver can read; the wire event has no version slot", () =>
    Effect.gen(function* () {
      expect(DestinationRegistered.schemaVersion).toBe(2);
      const encoded = yield* S.encodeEffect(DestinationRegistered)(
        DestinationRegistered.make({ kind: "box", name: "n" })
      );
      expect(encoded).toEqual({ _tag: "DestinationRegistered", kind: "box", name: "n" });
    })
  );
});
