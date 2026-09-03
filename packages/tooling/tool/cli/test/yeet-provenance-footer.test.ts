import {
  persistPrSessionRecord,
  renderPrProvenance,
  splicePrProvenanceFooter,
  toPublicPrProvenance,
} from "@beep/repo-cli/test/Yeet";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import * as O from "effect/Option";
import { makeRecord, repository } from "./yeet-pr-fixtures.ts";

const footer = renderPrProvenance(toPublicPrProvenance([makeRecord()], O.some(42), true));

describe("Yeet provenance footer splice", () => {
  it("is idempotent for current markers", () => {
    const once = splicePrProvenanceFooter("Body", footer);
    expect(splicePrProvenanceFooter(once, footer)).toBe(once);
  });

  it("replaces a legacy v1 block", () => {
    const legacy =
      'Body\n\n---\n\n## Provenance\n\n- Branch: <code>old</code>\n- Harness: `codex`\n\n<!-- yeet-provenance\n{"schemaVersion":1,"branch":"old","harness":"codex"}\n-->\n';
    const next = splicePrProvenanceFooter(legacy, footer);
    expect(next).not.toContain('"schemaVersion":1');
    expect(next).toContain('"schemaVersion": 2');
  });

  it("preserves foreign trailing text", () => {
    const existing = `${splicePrProvenanceFooter("Body", footer)}\nForeign tail\n`;
    expect(splicePrProvenanceFooter(existing, footer)).toContain("Foreign tail");
  });

  it.effect("mirrors when registry append is denied", () =>
    Effect.gen(function* () {
      const result = yield* persistPrSessionRecord(repository, Effect.fail("append denied"), Effect.void);
      expect(result.registryRowExists).toBe(false);
      expect(result.mirrorWritten).toBe(true);
      expect(result.repository).toStrictEqual(repository);
    })
  );

  it.effect("retains a registry row when mirroring fails", () =>
    Effect.gen(function* () {
      const result = yield* persistPrSessionRecord(repository, Effect.void, Effect.fail("mirror failed"));
      expect(result.registryRowExists).toBe(true);
      expect(result.mirrorWritten).toBe(false);
      expect(result.repository).toStrictEqual(repository);
    })
  );
});
