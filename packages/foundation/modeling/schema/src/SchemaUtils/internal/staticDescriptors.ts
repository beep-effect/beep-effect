/**
 * Shared descriptor installation for schema companion statics.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $SchemaId } from "@beep/identity/packages";
import * as R from "effect/Record";
import * as S from "effect/Schema";

const $I = $SchemaId.create("SchemaUtils/internal/staticDescriptors");

type WithStatics<Target extends object, Statics extends Record<string, unknown>> = Target & Statics;
type StaticDescriptorMode = "legacy" | "strict";
type StrictConflictHandler = (key: string) => never;
type ExistingStaticPreserver = (key: string) => boolean;

class StaticDescriptorRedefinitionError extends S.TaggedError<StaticDescriptorRedefinitionError>(
  $I`StaticDescriptorRedefinitionError`
)(
  "StaticDescriptorRedefinitionError",
  {
    key: S.String,
    message: S.String,
  },
  $I.annoteError<StaticDescriptorRedefinitionError>("StaticDescriptorRedefinitionError", {
    description: "Raised when schema statics would redefine a protected property with a different value.",
  })
) {}

const descriptorValue = (source: object, key: string, descriptor: PropertyDescriptor): unknown =>
  "value" in descriptor ? descriptor.value : Reflect.get(source, key);

const failDefinition = (key: string, message: string, onStrictConflict?: StrictConflictHandler): never => {
  if (onStrictConflict !== undefined) {
    return onStrictConflict(key);
  }
  throw StaticDescriptorRedefinitionError.make({ key, message });
};

const shouldInstallDescriptor = (
  target: object,
  key: string,
  nextValue: unknown,
  mode: StaticDescriptorMode,
  onStrictConflict?: StrictConflictHandler,
  preserveExisting?: ExistingStaticPreserver
): boolean => {
  const existing = Reflect.getOwnPropertyDescriptor(target, key);
  if (existing === undefined) {
    return true;
  }
  if (mode === "strict") {
    return failDefinition(key, `Cannot redefine existing static '${key}' in strict mode.`, onStrictConflict);
  }
  if (preserveExisting?.(key) === true) {
    return false;
  }
  if (Object.is(descriptorValue(target, key, existing), nextValue)) {
    return false;
  }
  if (existing.configurable === false) {
    throw StaticDescriptorRedefinitionError.make({
      key,
      message: `Cannot redefine non-configurable static '${key}'.`,
    });
  }
  return true;
};

const descriptorForMode = (descriptor: PropertyDescriptor, mode: StaticDescriptorMode): PropertyDescriptor => {
  if (mode === "legacy") {
    return descriptor;
  }
  return "value" in descriptor
    ? { ...descriptor, enumerable: false, writable: false, configurable: false }
    : { ...descriptor, enumerable: false, configurable: false };
};

const defineStaticDescriptor = (
  target: object,
  key: string,
  descriptor: PropertyDescriptor,
  onStrictConflict?: StrictConflictHandler
): void => {
  if (!Reflect.defineProperty(target, key, descriptor)) {
    failDefinition(key, `Cannot define static '${key}'.`, onStrictConflict);
  }
};

/**
 * Internal installer shared by legacy and strict schema-static helpers.
 *
 * **Details**
 *
 * Legacy mode retains `withStatics` collision behavior. Strict mode rejects
 * every existing property and installs hidden, immutable descriptors.
 *
 * **Example** (Install a strict static descriptor)
 *
 * ```ts
 * import { staticDescriptorInstaller } from "@beep/schema/SchemaUtils/internal/staticDescriptors"
 *
 * const target = staticDescriptorInstaller.install({}, { isReady: true }, "strict")
 * console.log(target.isReady) // true
 * ```
 *
 * @internal
 * @category utilities
 * @since 0.0.0
 */
export const staticDescriptorInstaller = {
  install<Target extends object, Statics extends Record<string, unknown>>(
    target: Target,
    statics: Statics,
    mode: StaticDescriptorMode = "legacy",
    onStrictConflict?: StrictConflictHandler,
    preserveExisting?: ExistingStaticPreserver
  ): WithStatics<Target, Statics> {
    for (const [key, descriptor] of R.toEntries(Object.getOwnPropertyDescriptors(statics))) {
      if (
        !shouldInstallDescriptor(
          target,
          key,
          descriptorValue(statics, key, descriptor),
          mode,
          onStrictConflict,
          preserveExisting
        )
      ) {
        continue;
      }
      defineStaticDescriptor(target, key, descriptorForMode(descriptor, mode), onStrictConflict);
    }

    return target as Target & Statics;
  },
};
