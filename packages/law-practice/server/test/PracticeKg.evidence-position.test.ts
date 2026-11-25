import { PracticeKgQueries, PracticeKgReadScope } from "@beep/law-practice-server";
import { PgliteTestLayer } from "@beep/pglite";
import { it } from "@beep/test-runner";
import { expect } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as SqlClient from "effect/sql/SqlClient";

const unwalledRead = PracticeKgReadScope.cases.Unwalled.make({});

it.layer(PgliteTestLayer, { timeout: "30 seconds" })("mixed practice-KG evidence positions", (it) => {
  it.effect("reads legacy and v2 locator offsets and preserves family filters", () =>
    Effect.gen(function* () {
      const sql = (yield* SqlClient.SqlClient).withoutTransforms();
      yield* sql.unsafe("CREATE TABLE epistemic_candidate_claim (snapshot JSONB, public_id TEXT)");
      yield* sql.unsafe("CREATE TABLE epistemic_evidence (span JSONB, span_fixture_key TEXT)");
      yield* sql.unsafe(
        "CREATE TABLE kg_node (client TEXT, docket_family TEXT, kind TEXT, natural_key TEXT, provenance_ref TEXT, payload JSONB)"
      );
      yield* sql.unsafe(`INSERT INTO epistemic_candidate_claim VALUES
        ('{"evidenceFixtureKey":"legacy","family":"legacy"}', 'candidate-1'),
        ('{"evidenceFixtureKey":"current","family":"current"}', 'candidate-2')`);
      yield* sql.unsafe(`INSERT INTO epistemic_evidence VALUES
        ('{"startChar":2,"endChar":7,"quote":"older","confidence":0}', 'legacy'),
        ('{"version":"evidence-position/v2","position":{"startChar":10,"endChar":13,"quote":"new"},"extractorConfidence":{"_tag":"Absent","reason":"not-assessed"}}', 'current')`);
      const both = yield* sql.unsafe(PracticeKgQueries.candidateClaims(unwalledRead), [null, null, null]);
      expect(both).toHaveLength(2);
      expect(both).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ startChar: 2, endChar: 7, evidenceQuote: "older", family: "legacy" }),
          expect.objectContaining({ startChar: 10, endChar: 13, evidenceQuote: "new", family: "current" }),
        ])
      );
      const selected = yield* sql.unsafe(PracticeKgQueries.candidateClaims(unwalledRead), [null, "current", null]);
      expect(selected).toHaveLength(1);
      expect(selected).toEqual([expect.objectContaining({ evidenceQuote: "new", family: "current" })]);
    })
  );
});
