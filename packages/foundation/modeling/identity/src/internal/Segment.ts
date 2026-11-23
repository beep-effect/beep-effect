/**
 * The identity segment grammar shared by the composer and the registry minter.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { pipe } from "effect/Function";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import type { TString } from "@beep/types";

const MODULE_CHARACTERS = /^[A-Za-z0-9_-]+$/;
const MODULE_LEADING_ALPHA = /^[A-Za-z]/;
const BASE_CHARACTERS = /^[A-Za-z0-9](?:[A-Za-z0-9_-]*[A-Za-z0-9])?$/;

const SegmentCheck = S.makeFilterGroup(
  [
    S.isNonEmpty({
      identifier: "@beep/identity/check/non-empty-segment",
      message: "Identity segments cannot be empty.",
    }),
    S.makeFilter((segment: string) => !pipe(segment, Str.startsWith("/")), {
      identifier: "@beep/identity/check/no-leading-slash",
      message: 'Identity segments cannot start with "/".',
    }),
    S.makeFilter((segment: string) => !pipe(segment, Str.endsWith("/")), {
      identifier: "@beep/identity/check/no-trailing-slash",
      message: 'Identity segments cannot end with "/".',
    }),
  ],
  {
    title: "Identity Segment",
    description: "Identity segments are non-empty and do not start or end with a slash.",
  }
);

/**
 * Schema for one identity segment: non-empty, with no leading or trailing slash.
 *
 * @category validation
 * @since 0.0.0
 */
export const SegmentSchema = S.String.check(SegmentCheck);

const ModuleSegmentCheck = S.makeFilterGroup(
  [
    S.isPattern(MODULE_CHARACTERS, {
      identifier: "@beep/identity/check/module-characters",
      message: "Module segments must contain only alphanumeric characters, hyphens, or underscores.",
    }),
    S.isPattern(MODULE_LEADING_ALPHA, {
      identifier: "@beep/identity/check/module-leading-alpha",
      message: "Module segments must start with an alphabetic character to create valid accessors.",
    }),
  ],
  {
    title: "Identity Module Segment",
    description: "Module segments are identity segments that are safe for generated module accessor names.",
  }
);

/**
 * Schema for a module segment: an identity segment safe for a generated accessor name.
 *
 * @category validation
 * @since 0.0.0
 */
export const ModuleSegmentSchema = SegmentSchema.check(ModuleSegmentCheck);

/**
 * Schema for a normalized package base segment.
 *
 * @category validation
 * @since 0.0.0
 */
export const BaseSegmentSchema = S.String.check(
  S.isNonEmpty({
    identifier: "@beep/identity/check/non-empty-base",
    message: "Identity bases cannot be empty.",
  }),
  S.isPattern(BASE_CHARACTERS, {
    identifier: "@beep/identity/check/base-characters",
    message: "Identity bases must use alphanumeric, hyphen, or underscore characters and start/end with alphanumeric.",
  })
);

/**
 * Return the segment unchanged, or throw the schema error the segment grammar raises.
 *
 * @category validation
 * @since 0.0.0
 */
export const validateSegment = <const Segment extends TString.NonEmpty>(segment: Segment): Segment => {
  SegmentSchema.make(segment);
  return segment;
};

/**
 * Return the module segment unchanged, or throw the schema error the module grammar raises.
 *
 * @category validation
 * @since 0.0.0
 */
export const validateModuleSegment = <const Segment extends TString.NonEmpty>(segment: Segment): Segment => {
  ModuleSegmentSchema.make(segment);
  return segment;
};
