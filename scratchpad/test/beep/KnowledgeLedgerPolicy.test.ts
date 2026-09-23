import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/unstable/arbitrary/Arbitrary";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import {
  LEDGER_SLOT_DEFINITIONS,
  LedgerSlotDefinition,
  NegativeProfileBudget,
  PLAYBOOK_HANDLE_CHARACTER_LIMIT,
  PLAYBOOK_INDEX_CHARACTER_BUDGET,
  PROFILE_CHARACTER_BUDGET,
  PROFILE_LINE_CHARACTER_LIMIT,
  UnsupportedLedgerSlot,
  canonicalizeLedgerSlot,
  ledgerAuthorityRank,
  ledgerSlotForLegacyPredicate,
  normalizePlaybookHandle,
  normalizeSlotToken,
  renderBoundedProfile,
  selectProfileSlotWinners,
} from "../../beep/KnowledgeLedgerPolicy.ts";

const encodeLedgerSlotDefinition = S.encodeEffect(LedgerSlotDefinition);
const isUnsupportedLedgerSlot = S.is(UnsupportedLedgerSlot);
const isNegativeProfileBudget = S.is(NegativeProfileBudget);

const decode = <A>(schema: S.ConstraintDecoder<A>, input: unknown): A =>
  Effect.runSync(S.decodeUnknownEffect(schema)(input));

const decodeFails = (schema: S.Codec<unknown, unknown, never, unknown>, input: unknown): boolean =>
  Effect.runSyncExit(S.decodeUnknownEffect(schema)(input))._tag === "Failure";

const failure = <A, E>(effect: Effect.Effect<A, E>): E => effect.pipe(Effect.flip, Effect.runSync);

const at = (iso: string) => DateTime.makeUnsafe(iso);

const row = (patch: Record<string, unknown>): object => ({
  id: "row",
  slot: "home_city",
  content: "Seattle",
  writeReason: "onboarding",
  ...patch,
});

describe("KnowledgeLedgerPolicy", () => {
  it("exposes the budgets and the released slot registry", () => {
    assert.strictEqual(PROFILE_CHARACTER_BUDGET, 2400);
    assert.strictEqual(PLAYBOOK_INDEX_CHARACTER_BUDGET, 800);
    assert.strictEqual(PLAYBOOK_HANDLE_CHARACTER_LIMIT, 360);
    assert.strictEqual(PROFILE_LINE_CHARACTER_LIMIT, 360);
    assert.strictEqual(LEDGER_SLOT_DEFINITIONS.length, 12);
    assert.strictEqual(LEDGER_SLOT_DEFINITIONS[0]?.name, "preferred_name");
    assert.deepStrictEqual(LEDGER_SLOT_DEFINITIONS[1]?.aliases, ["preferred_pronouns"]);
  });

  it("derives arbitraries and decodes a slot definition", () => {
    for (const schema of [LedgerSlotDefinition, UnsupportedLedgerSlot, NegativeProfileBudget]) {
      assert.notStrictEqual(schema.pipe(Arbitrary.schema), undefined);
    }
    const decoded = decode(LedgerSlotDefinition, { name: "timezone", rendererOrder: 40, aliases: ["tz"] });
    assert.strictEqual(decoded.rendererOrder, 40);
    assert.deepStrictEqual(decoded.aliases, ["tz"]);
    assert.strictEqual(decodeFails(LedgerSlotDefinition, { name: "timezone", rendererOrder: 4.5, aliases: [] }), true);
    const made = LedgerSlotDefinition.make({ name: "x", rendererOrder: 1 });
    assert.deepStrictEqual(made.aliases, []);
    const encoded = Effect.runSync(encodeLedgerSlotDefinition(made));
    assert.deepStrictEqual(encoded, { name: "x", rendererOrder: 1, aliases: [] });
  });

  it("maps legacy predicates to slots", () => {
    assert.strictEqual(O.getOrNull(ledgerSlotForLegacyPredicate("resides_in")), "home_city");
    assert.strictEqual(O.getOrNull(ledgerSlotForLegacyPredicate("works_at")), "employer");
    assert.strictEqual(O.getOrNull(ledgerSlotForLegacyPredicate("age_years")), "age_years");
    assert.strictEqual(O.isNone(ledgerSlotForLegacyPredicate("prefers")), true);
  });

  it("normalizes slot tokens and playbook handles", () => {
    assert.strictEqual(normalizeSlotToken("  Home-City! "), "home_city");
    assert.strictEqual(normalizeSlotToken("__x__"), "x");
    assert.strictEqual(normalizeSlotToken("!!!"), "");
    assert.strictEqual(normalizePlaybookHandle(null), "");
    assert.strictEqual(normalizePlaybookHandle(undefined), "");
    assert.strictEqual(normalizePlaybookHandle(false), "");
    assert.strictEqual(normalizePlaybookHandle(0), "");
    assert.strictEqual(normalizePlaybookHandle(""), "");
    assert.strictEqual(normalizePlaybookHandle("  weekly   review\n plan "), "weekly review plan");
    assert.strictEqual(normalizePlaybookHandle(42), "42");
    assert.strictEqual(normalizePlaybookHandle(true), "true");
    assert.strictEqual(normalizePlaybookHandle({ a: "b c" }), '{"a":"b c"}');
  });

  it("canonicalizes slots through aliases and rejects unknown slots when strict", () => {
    const slotOf = (value: O.Option<string>) => canonicalizeLedgerSlot(value).pipe(Effect.runSync);
    const noSlot = O.none<string>();
    const blank = O.some("  ");
    const city = O.some("City");
    const employer = O.some("employer");
    const shoeSize = O.some("Shoe Size");
    assert.strictEqual(noSlot.pipe(slotOf, O.isNone), true);
    assert.strictEqual(blank.pipe(slotOf, O.isNone), true);
    assert.strictEqual(city.pipe(slotOf, O.getOrNull), "home_city");
    assert.strictEqual(employer.pipe(slotOf, O.getOrNull), "employer");
    const strict = shoeSize.pipe(canonicalizeLedgerSlot, failure);
    assert.strictEqual(isUnsupportedLedgerSlot(strict), true);
    assert.strictEqual(strict.slot, "shoe_size");
    const loose = Effect.runSync(canonicalizeLedgerSlot(O.some("shoe size"), { strict: false }));
    assert.strictEqual(O.isNone(loose), true);
  });

  it("ranks write reasons and unwraps enum-like values", () => {
    assert.strictEqual(ledgerAuthorityRank("direct_user_statement"), 600);
    assert.strictEqual(ledgerAuthorityRank({ value: "onboarding" }), 500);
    assert.strictEqual(ledgerAuthorityRank("legacy_migration"), 200);
    assert.strictEqual(ledgerAuthorityRank("unknown_reason"), 0);
    assert.strictEqual(ledgerAuthorityRank(null), 0);
    assert.strictEqual(ledgerAuthorityRank({ value: 3 }), 0);
  });

  it("selects one winner per slot by authority, timestamp, weight, then identity", () => {
    const rows = [
      row({ id: "a", writeReason: "legacy_migration", content: "Austin" }),
      row({ id: "b", writeReason: "onboarding", content: "Seattle", validFrom: at("2026-01-01T00:00:00Z") }),
      row({ id: "c", writeReason: "onboarding", content: "Portland", validFrom: at("2026-02-01T00:00:00Z") }),
      row({ id: "d", writeReason: "onboarding", content: "Denver", validFrom: at("2026-02-01T00:00:00Z"), curationWeight: 2.7 }),
      row({ id: "e", writeReason: "onboarding", content: "Boise", validFrom: at("2026-02-01T00:00:00Z"), curationWeight: 2 }),
      row({ memoryId: "f", writeReason: "onboarding", content: "Reno", validFrom: at("2026-02-01T00:00:00Z"), curationWeight: 2 }),
      row({ id: "n", slot: "display_name", content: "Ada", writeReason: "explicit_remember" }),
      row({ id: "z", slot: "shoe_size", content: "9" }),
      row({ id: "y", slot: 7, content: "?" }),
    ];
    const winners = selectProfileSlotWinners(rows);
    assert.deepStrictEqual(
      winners.map(([slot, winner]) => [slot, Reflect.get(winner, "content")]),
      [
        ["preferred_name", "Ada"],
        ["home_city", "Reno"],
      ],
    );
    assert.deepStrictEqual(selectProfileSlotWinners([]), []);
  });

  it("renders a bounded profile and rejects a negative budget", () => {
    const rows = [
      row({ id: "n", slot: "preferred_name", content: "  Ada   Lovelace " }),
      row({ id: "h", slot: "home_city", content: "Seattle" }),
      row({ id: "e", slot: "employer", content: "" }),
      row({ id: "o", slot: "occupation", content: "x".repeat(400) }),
    ];
    const full = Effect.runSync(renderBoundedProfile(rows));
    const lines = full.split("\n");
    assert.strictEqual(lines[0], "preferred_name: Ada Lovelace");
    assert.strictEqual(lines[1], "home_city: Seattle");
    assert.strictEqual(lines[2]?.length, "occupation: ".length + PROFILE_LINE_CHARACTER_LIMIT);
    assert.strictEqual(lines.length, 3);
    const tight = Effect.runSync(renderBoundedProfile(rows, { characterBudget: 30 }));
    assert.strictEqual(tight, "preferred_name: Ada Lovelace");
    assert.strictEqual(Effect.runSync(renderBoundedProfile(rows, { characterBudget: 0 })), "");
    const negative = failure(renderBoundedProfile(rows, { characterBudget: -1 }));
    assert.strictEqual(isNegativeProfileBudget(negative), true);
    assert.strictEqual(negative.characterBudget, -1);
  });
});
