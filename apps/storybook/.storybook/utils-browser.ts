/**
 * Browser-safe `@beep/utils` subset for Storybook browser tests.
 *
 * The package root also exports Node-only FileSystem and Path helpers. Vitest's
 * browser optimizer evaluates namespace re-exports eagerly, so alias the root
 * import to only the utilities used by UI stories.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

export * as A from "@beep/utils/Array";
export * as Bool from "@beep/utils/Bool";
export * as DateTime from "@beep/utils/DateTime";
export * from "@beep/utils/DrainableWorker";
export * as Eq from "@beep/utils/Equal";
export * as Err from "@beep/utils/Errors";
export * from "@beep/utils/GlobalValue";
export * as Html from "@beep/utils/Html";
export * as N from "@beep/utils/Number";
export * as O from "@beep/utils/Option";
export * as P from "@beep/utils/Predicate";
export * from "@beep/utils/Random";
export * as R from "@beep/utils/Record";
export * as Str from "@beep/utils/Str";
export * as Stream from "@beep/utils/Stream";
export * as Struct from "@beep/utils/Struct";
export * as Text from "@beep/utils/Text";
export * from "@beep/utils/thunk";
export * as Utils from "@beep/utils/Utils";
export { dual, flow, identity, pipe } from "effect/Function";
