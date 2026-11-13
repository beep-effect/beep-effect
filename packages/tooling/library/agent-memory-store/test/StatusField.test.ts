import {
  lifecycleOf,
  replaceStatusValue,
  StatusFields,
  StatusLifecycle,
  StatusValue,
  statusValueIn,
} from "@beep/agent-memory-store";
import { describe, expect, it } from "@effect/vitest";
import { assertInstanceOf, assertNone, assertSome } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

const inProgress = StatusValue.make("in-progress");
const progress = StatusValue.make("progress");
const done = StatusValue.make("done");

const decodeFields = S.decodeUnknownEffect(StatusFields);

const lifecycle = StatusLifecycle.make({ field: "status", order: [progress, inProgress, done] });

describe("StatusField", () => {
  it.effect(
    "reads a status value only when the text holds exactly one whole token of the lifecycle",
    Effect.fnUntraced(function* () {
      assertSome(statusValueIn(lifecycle, "| P2 | in-progress |"), inProgress);
      assertSome(statusValueIn("status: done\n")(lifecycle), done);
      assertNone(statusValueIn(lifecycle, "| P2 | in-progress | done |"));
      assertNone(statusValueIn(lifecycle, "| P2 | progressing |"));
      assertNone(statusValueIn(lifecycle, "No status at all."));
    })
  );

  it.effect(
    "replaces exactly the status token and splices the new value literally",
    Effect.fnUntraced(function* () {
      const dollar = StatusValue.make("$&-$1");
      expect(replaceStatusValue("| P2 | in-progress |", inProgress, done)).toBe("| P2 | done |");
      expect(replaceStatusValue(inProgress, dollar)("status: in-progress")).toBe("status: $&-$1");
      expect(replaceStatusValue("| P2 | progressing |", progress, done)).toBe("| P2 | progressing |");
    })
  );

  it.effect(
    "finds a field's lifecycle and refuses two lifecycles for one field",
    Effect.fnUntraced(function* () {
      const fields = StatusFields.make({ lifecycles: [lifecycle] });
      assertSome(lifecycleOf(fields, "status"), lifecycle);
      assertNone(lifecycleOf("phase")(fields));

      const error = yield* Effect.flip(
        decodeFields({
          lifecycles: [
            { field: "status", order: ["draft"] },
            { field: "status", order: ["active"] },
          ],
        })
      );
      assertInstanceOf(error, S.SchemaError);
    })
  );
});
