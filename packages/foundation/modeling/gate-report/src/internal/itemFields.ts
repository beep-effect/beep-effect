/**
 * Item fields shared by the item schema and the interchange extension bag.
 *
 * @since 0.0.0
 */
import * as S from "effect/Schema";
import { ItemKey } from "../ItemKey.ts";
import { DurationMs, Text } from "../Scalars.ts";
import { FailureKind, HistoryLabel, ItemOutcome, Severity } from "../Vocabulary.ts";
import { optionalSlot } from "./slots.ts";

/**
 * Where an item sits: its key, its unit, its path segments and its label.
 *
 * @since 0.0.0
 */
export const itemIdentityFields = {
  key: ItemKey,
  unit: Text,
  path: S.Array(S.String),
  name: S.String,
};

/**
 * What an item carries beside its outcome, location and detail.
 *
 * @since 0.0.0
 */
export const itemAnnotationFields = {
  code: optionalSlot(Text),
  rule: optionalSlot(Text),
  severity: optionalSlot(Severity),
  failureKind: optionalSlot(FailureKind),
  signature: optionalSlot(Text),
  attempts: optionalSlot(ItemOutcome.pipe(S.NonEmptyArray)),
  durationMs: optionalSlot(DurationMs),
  label: optionalSlot(HistoryLabel),
};
