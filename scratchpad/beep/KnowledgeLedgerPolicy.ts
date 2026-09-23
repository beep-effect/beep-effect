/**
 * Stable slot and rendering policy for `knowledge_ledger.v1` facts.
 *
 * **Details**
 *
 * The policy is pure: models, prompt projections, and tests share one
 * contract without a database or runtime client. Canonical slot names stay
 * snake_case because that is the released wire shape. New names are
 * append-only.
 *
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Rec from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as P from "effect/Predicate";
import { Model, pg, text } from "./Kit.ts";

const $I = $ScratchpadId.create("beep/KnowledgeLedgerPolicy");

/**
 * Character budget for a rendered profile.
 *
 * **Example** (Read the profile budget)
 *
 * ```ts
 * import { PROFILE_CHARACTER_BUDGET } from "@beep/scratchpad/beep/KnowledgeLedgerPolicy"
 *
 * console.log(PROFILE_CHARACTER_BUDGET) // 2400
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const PROFILE_CHARACTER_BUDGET = 2400;

/**
 * Character budget for a playbook index.
 *
 * **Example** (Read the playbook index budget)
 *
 * ```ts
 * import { PLAYBOOK_INDEX_CHARACTER_BUDGET } from "@beep/scratchpad/beep/KnowledgeLedgerPolicy"
 *
 * console.log(PLAYBOOK_INDEX_CHARACTER_BUDGET) // 800
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const PLAYBOOK_INDEX_CHARACTER_BUDGET = 800;

/**
 * Character limit for one playbook handle.
 *
 * **Example** (Read the handle limit)
 *
 * ```ts
 * import { PLAYBOOK_HANDLE_CHARACTER_LIMIT } from "@beep/scratchpad/beep/KnowledgeLedgerPolicy"
 *
 * console.log(PLAYBOOK_HANDLE_CHARACTER_LIMIT) // 360
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const PLAYBOOK_HANDLE_CHARACTER_LIMIT = 360;

/**
 * Character limit for one rendered profile line's content.
 *
 * **Example** (Read the line limit)
 *
 * ```ts
 * import { PROFILE_LINE_CHARACTER_LIMIT } from "@beep/scratchpad/beep/KnowledgeLedgerPolicy"
 *
 * console.log(PROFILE_LINE_CHARACTER_LIMIT) // 360
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const PROFILE_LINE_CHARACTER_LIMIT = 360;

/**
 * One released profile slot.
 *
 * **Details**
 *
 * `name` is the canonical snake_case wire name. `rendererOrder` is prompt
 * order and is independent of curation. `aliases` are spelling aliases, not
 * extra slots.
 *
 * **Example** (Construct a slot)
 *
 * ```ts
 * import { LedgerSlotDefinition } from "@beep/scratchpad/beep/KnowledgeLedgerPolicy"
 *
 * const slot = LedgerSlotDefinition.make({ name: "home_city", rendererOrder: 50, aliases: ["city"] })
 * console.log(slot.name) // "home_city"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class LedgerSlotDefinition extends Model<LedgerSlotDefinition>("LedgerSlotDefinition")(
  {
    name: text("name"),
    rendererOrder: S.Int.pipe(pg.integer(), pg.columnName("renderer_order")),
    aliases: S.Array(S.String).pipe(
      S.withConstructorDefault(Effect.succeed([])),
      pg.jsonb(),
      pg.columnName("aliases"),
    ),
  },
  $I.annote("LedgerSlotDefinition", {
    description: "Append-only knowledge-ledger profile slot: canonical name, prompt order, and spelling aliases.",
  }),
) {}

/**
 * Encoded ledger slot definition.
 *
 * @see {@link LedgerSlotDefinition} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace LedgerSlotDefinition {
  export type Encoded = S.Codec.Encoded<typeof LedgerSlotDefinition>;
}

const slot = (name: string, rendererOrder: number, aliases: ReadonlyArray<string> = []) =>
  LedgerSlotDefinition.make({ name, rendererOrder, aliases: A.fromIterable(aliases) });

/**
 * Append-only profile slot registry.
 *
 * **Details**
 *
 * Order is prompt order: preferred_name, pronouns, primary_language,
 * age_years, timezone, home_city, work_city, occupation, employer,
 * communication_style, dietary_preferences, current_focus.
 *
 * **Example** (Read the first slot)
 *
 * ```ts
 * import { LEDGER_SLOT_DEFINITIONS } from "@beep/scratchpad/beep/KnowledgeLedgerPolicy"
 *
 * console.log(LEDGER_SLOT_DEFINITIONS[0]?.name) // "preferred_name"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const LEDGER_SLOT_DEFINITIONS: ReadonlyArray<LedgerSlotDefinition> = [
  slot("preferred_name", 10, ["name", "display_name", "called_name"]),
  slot("pronouns", 20, ["preferred_pronouns"]),
  slot("primary_language", 30, ["language", "preferred_language"]),
  slot("age_years", 35, ["age"]),
  slot("timezone", 40, ["time_zone", "user_timezone"]),
  slot("home_city", 50, ["city", "home_location", "residence_city"]),
  slot("work_city", 60, ["office_city", "work_location"]),
  slot("occupation", 70, ["job", "job_title", "role"]),
  slot("employer", 80, ["company", "workplace"]),
  slot("communication_style", 90, ["preferred_communication_style"]),
  slot("dietary_preferences", 100, ["diet", "dietary_restrictions"]),
  slot("current_focus", 110, ["current_priority", "primary_focus"]),
];

/**
 * Released legacy predicates that become current profile slots.
 *
 * **Example** (Map resides_in)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import { ledgerSlotForLegacyPredicate } from "@beep/scratchpad/beep/KnowledgeLedgerPolicy"
 *
 * console.log(O.getOrNull(ledgerSlotForLegacyPredicate("resides_in"))) // "home_city"
 * ```
 *
 * @category getters
 * @since 0.0.0
 */
export const ledgerSlotForLegacyPredicate = (predicate: string): O.Option<string> => {
  if (predicate === "resides_in") return O.some("home_city");
  if (predicate === "works_at") return O.some("employer");
  if (predicate === "age_years") return O.some("age_years");
  return O.none();
};

const authorityRank: Rec.ReadonlyRecord<string, number> = {
  direct_user_statement: 600,
  explicit_remember: 600,
  onboarding: 500,
  agent_reusable_conclusion: 400,
  daily_reconciliation: 300,
  legacy_migration: 200,
  recurring_workflow: 100,
  standing_trigger: 100,
};

/**
 * Unsupported profile slot name.
 *
 * **Example** (Fail a strict canonicalize)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import { UnsupportedLedgerSlot, canonicalizeLedgerSlot } from "@beep/scratchpad/beep/KnowledgeLedgerPolicy"
 *
 * const exit = Effect.runSyncExit(canonicalizeLedgerSlot(O.some("not_a_slot")))
 * console.log(exit._tag === "Failure") // true
 * console.log(UnsupportedLedgerSlot.make({ slot: "not_a_slot" }).slot) // "not_a_slot"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class UnsupportedLedgerSlot extends S.TaggedError<UnsupportedLedgerSlot>()(
  "UnsupportedLedgerSlot",
  { slot: S.String },
  $I.annoteError<UnsupportedLedgerSlot>("UnsupportedLedgerSlot", {
    description: "A knowledge-ledger slot name is not in the released registry.",
  }),
) {}

/**
 * Encoded unsupported-slot error.
 *
 * @see {@link UnsupportedLedgerSlot} for the runtime error.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace UnsupportedLedgerSlot {
  export type Encoded = S.Codec.Encoded<typeof UnsupportedLedgerSlot>;
}

/**
 * Negative profile character budget.
 *
 * **Example** (Reject a negative budget)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import { NegativeProfileBudget, renderBoundedProfile } from "@beep/scratchpad/beep/KnowledgeLedgerPolicy"
 *
 * const exit = Effect.runSyncExit(renderBoundedProfile([], { characterBudget: -1 }))
 * console.log(exit._tag === "Failure") // true
 * console.log(NegativeProfileBudget.make({ characterBudget: -1 }).characterBudget) // -1
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class NegativeProfileBudget extends S.TaggedError<NegativeProfileBudget>()(
  "NegativeProfileBudget",
  { characterBudget: S.Int },
  $I.annoteError<NegativeProfileBudget>("NegativeProfileBudget", {
    description: "A profile render was asked for a negative character budget.",
  }),
) {}

/**
 * Encoded negative-budget error.
 *
 * @see {@link NegativeProfileBudget} for the runtime error.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace NegativeProfileBudget {
  export type Encoded = S.Codec.Encoded<typeof NegativeProfileBudget>;
}

/**
 * Normalizes slot spelling without admitting an unknown slot.
 *
 * **Details**
 *
 * Lowercase, replace runs of non-alphanumeric characters with `_`, and strip
 * leading and trailing underscores.
 *
 * **Example** (Normalize a spaced alias)
 *
 * ```ts
 * import { normalizeSlotToken } from "@beep/scratchpad/beep/KnowledgeLedgerPolicy"
 *
 * console.log(normalizeSlotToken(" Home-City ")) // "home_city"
 * ```
 *
 * @category normalization
 * @since 0.0.0
 */
export const normalizeSlotToken = (value: string): string =>
  Str.replace(/^_+|_+$/g, "")(Str.replace(/[^a-z0-9]+/g, "_")(Str.toLowerCase(Str.trim(value))));

/**
 * Collapses a playbook description to one single-line handle.
 *
 * **Details**
 *
 * Falsy values (`null`, `undefined`, `false`, `0`, and `""`) become an empty
 * string, matching `str(value or "")`. Other strings, numbers, and booleans
 * are collapsed. Objects use JSON text because this port has no Python `str`.
 *
 * **Example** (Collapse whitespace)
 *
 * ```ts
 * import { normalizePlaybookHandle } from "@beep/scratchpad/beep/KnowledgeLedgerPolicy"
 *
 * console.log(normalizePlaybookHandle("  keep   short  ")) // "keep short"
 * ```
 *
 * @category normalization
 * @since 0.0.0
 */
export const normalizePlaybookHandle = (value: unknown): string => {
  if (value === null || value === undefined || value === false || value === 0 || value === "") return "";
  if (P.isString(value) || P.isNumber(value) || P.isBoolean(value)) {
    return A.join(" ")(A.filter(Str.split(/\s+/u)(String(value)), (part) => part.length > 0));
  }
  return A.join(" ")(A.filter(Str.split(/\s+/u)(JSON.stringify(value)), (part) => part.length > 0));
};

const slotByName = A.reduce(LEDGER_SLOT_DEFINITIONS, Rec.empty<string, LedgerSlotDefinition>(), (acc, definition) =>
  Rec.set(acc, definition.name, definition),
);

const slotByAlias = A.reduce(LEDGER_SLOT_DEFINITIONS, Rec.empty<string, string>(), (acc, definition) =>
  A.reduce([definition.name, ...definition.aliases], acc, (inner, alias) =>
    Rec.set(inner, normalizeSlotToken(alias), definition.name),
  ),
);

const lookupAlias = (normalized: string): O.Option<string> =>
  Rec.has(slotByAlias, normalized) ? O.some(slotByAlias[normalized] ?? normalized) : O.none();

/**
 * Returns one released canonical slot name.
 *
 * **Details**
 *
 * `None` and blank tokens stay `None`. Unknown slots fail in strict mode.
 * Read projections pass `strict: false` so historic names stay stored but do
 * not enter a prompt under an invented order.
 *
 * **Example** (Canonicalize an alias)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import { canonicalizeLedgerSlot } from "@beep/scratchpad/beep/KnowledgeLedgerPolicy"
 *
 * const decoded = Effect.runSync(canonicalizeLedgerSlot(O.some("city")))
 * console.log(O.getOrNull(decoded)) // "home_city"
 * ```
 *
 * @category normalization
 * @since 0.0.0
 */
export const canonicalizeLedgerSlot = Effect.fn("canonicalizeLedgerSlot")(function* (
  value: O.Option<string>,
  options?: { readonly strict?: boolean },
) {
  if (O.isNone(value)) return O.none<string>();
  const normalized = normalizeSlotToken(value.value);
  if (normalized.length === 0) return O.none<string>();
  const canonical = lookupAlias(normalized);
  if (O.isNone(canonical) && (options?.strict ?? true)) {
    return yield* UnsupportedLedgerSlot.make({ slot: normalized });
  }
  return canonical;
});

const reasonText = (value: unknown): string => {
  if (P.isString(value)) return value;
  if (P.hasProperty(value, "value")) {
    const inner = Reflect.get(value, "value");
    if (P.isString(inner)) return inner;
  }
  return "";
};

/**
 * Authority rank for a write reason. Unknown and missing reasons are 0.
 *
 * **Details**
 *
 * Higher rank wins before recency or curation. Direct user statement and
 * explicit remember are 600. Curation cannot make an inference outrank a user.
 *
 * **Example** (Rank a user statement above migration)
 *
 * ```ts
 * import { ledgerAuthorityRank } from "@beep/scratchpad/beep/KnowledgeLedgerPolicy"
 *
 * console.log(ledgerAuthorityRank("direct_user_statement") > ledgerAuthorityRank("legacy_migration")) // true
 * ```
 *
 * @category getters
 * @since 0.0.0
 */
export const ledgerAuthorityRank = (reason: unknown): number => authorityRank[reasonText(reason)] ?? 0;

const read = (row: object, key: string): unknown => (key in row ? Reflect.get(row, key) : undefined);

const isTruthy = (value: unknown): boolean => value !== null && value !== undefined && value !== false && value !== 0 && value !== "";

const rowTimestamp = (row: object): number => {
  const stamps = ["validFrom", "validAt", "capturedAt", "createdAt"];
  const found = A.findFirst(stamps, (key) => isTruthy(read(row, key)));
  if (O.isNone(found)) return 0;
  const value = read(row, found.value);
  return DateTime.isDateTime(value) ? DateTime.toEpochMillis(value) / 1000 : 0;
};

const rowIdentity = (row: object): string => {
  const memoryId = read(row, "memoryId");
  if (P.isString(memoryId) && memoryId.length > 0) return memoryId;
  const id = read(row, "id");
  return P.isString(id) ? id : "";
};

const curationWeight = (row: object): number => {
  const value = read(row, "curationWeight");
  return P.isNumber(value) && Number.isFinite(value) ? Math.trunc(value) : 0;
};

const beats = (left: object, right: object): boolean => {
  const leftRank = ledgerAuthorityRank(read(left, "writeReason"));
  const rightRank = ledgerAuthorityRank(read(right, "writeReason"));
  if (leftRank !== rightRank) return leftRank > rightRank;
  const leftStamp = rowTimestamp(left);
  const rightStamp = rowTimestamp(right);
  if (leftStamp !== rightStamp) return leftStamp > rightStamp;
  const leftWeight = curationWeight(left);
  const rightWeight = curationWeight(right);
  if (leftWeight !== rightWeight) return leftWeight > rightWeight;
  return rowIdentity(left) > rowIdentity(right);
};

const definitionFor = (name: string): O.Option<LedgerSlotDefinition> => {
  const found = slotByName[name];
  return found === undefined ? O.none() : O.some(found);
};

/**
 * Chooses one current fact per canonical slot.
 *
 * **Details**
 *
 * Authority wins first, then the newest fact at that authority, then curation
 * weight, then stable row identity. The result is sorted by renderer order,
 * slot name, and identity. Unknown slots are skipped (`strict` false) rather
 * than failing the read.
 *
 * **Example** (Keep the higher authority row)
 *
 * ```ts
 * import { selectProfileSlotWinners } from "@beep/scratchpad/beep/KnowledgeLedgerPolicy"
 *
 * const winners = selectProfileSlotWinners([
 *   { slot: "home_city", writeReason: "legacy_migration", content: "old", id: "a" },
 *   { slot: "city", writeReason: "direct_user_statement", content: "new", id: "b" },
 * ])
 * console.log(winners[0]?.[1] && "content" in winners[0][1] ? winners[0][1].content : "") // "new"
 * ```
 *
 * @category getters
 * @since 0.0.0
 */
export const selectProfileSlotWinners = (rows: ReadonlyArray<object>): ReadonlyArray<readonly [string, object]> => {
  const winners = A.reduce(rows, HashMap.empty<string, object>(), (acc, row) => {
    const raw = read(row, "slot");
    const slotName = P.isString(raw) ? lookupAlias(normalizeSlotToken(raw)) : O.none();
    if (O.isNone(slotName)) return acc;
    const current = HashMap.get(acc, slotName.value);
    if (O.isNone(current) || beats(row, current.value)) return HashMap.set(acc, slotName.value, row);
    return acc;
  });
  const pairs = winners.pipe(HashMap.toEntries);
  return A.sort(
    pairs,
    Order.make((left: readonly [string, object], right: readonly [string, object]) => {
      const leftOrder = O.getOrElse(definitionFor(left[0]), () => LedgerSlotDefinition.make({ name: left[0], rendererOrder: 0 })).rendererOrder;
      const rightOrder = O.getOrElse(definitionFor(right[0]), () => LedgerSlotDefinition.make({ name: right[0], rendererOrder: 0 })).rendererOrder;
      if (leftOrder !== rightOrder) return leftOrder < rightOrder ? -1 : 1;
      if (left[0] !== right[0]) return left[0] < right[0] ? -1 : 1;
      const leftId = rowIdentity(left[1]);
      const rightId = rowIdentity(right[1]);
      if (leftId !== rightId) return leftId < rightId ? -1 : 1;
      return 0;
    }),
  );
};

const lineContent = (row: object): string => {
  const value = read(row, "content");
  const textValue = P.isString(value) ? value : "";
  return A.join(" ")(A.filter(Str.split(/\s+/u)(textValue), (part) => part.length > 0)).slice(
    0,
    PROFILE_LINE_CHARACTER_LIMIT,
  );
};

/**
 * Renders one profile line per winning slot inside a character budget.
 *
 * **Details**
 *
 * A negative budget fails. Each line is `{slot}: {content}`. Content is
 * collapsed and capped at 360 characters before the line is measured. A line
 * that would exceed the budget is skipped, not truncated, and later shorter
 * lines can still fit. Lines are joined with newlines.
 *
 * **Example** (Render one home city)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import { renderBoundedProfile } from "@beep/scratchpad/beep/KnowledgeLedgerPolicy"
 *
 * const rendered = Effect.runSync(
 *   renderBoundedProfile([{ slot: "home_city", writeReason: "onboarding", content: "Seattle", id: "a" }]),
 * )
 * console.log(rendered) // "home_city: Seattle"
 * ```
 *
 * @category formatting
 * @since 0.0.0
 */
export const renderBoundedProfile = Effect.fn("renderBoundedProfile")(function* (
  rows: ReadonlyArray<object>,
  options?: { readonly characterBudget?: number },
) {
  const characterBudget = options?.characterBudget ?? PROFILE_CHARACTER_BUDGET;
  if (characterBudget < 0) return yield* NegativeProfileBudget.make({ characterBudget });
  const rendered = A.reduce(
    selectProfileSlotWinners(rows),
    { lines: A.empty<string>(), used: 0 },
    (state, [slotName, row]) => {
      const content = lineContent(row);
      if (content.length === 0) return state;
      const line = `${slotName}: ${content}`;
      const separator = state.lines.length === 0 ? 0 : 1;
      if (state.used + separator + line.length > characterBudget) return state;
      return { lines: A.append(state.lines, line), used: state.used + separator + line.length };
    },
  );
  return A.join("\n")(rendered.lines);
});
