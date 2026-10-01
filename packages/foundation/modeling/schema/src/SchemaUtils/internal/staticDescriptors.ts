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

const shouldInstallDescriptor = (
  target: object,
  key: string,
  nextValue: unknown,
  preserveExisting?: ExistingStaticPreserver
): boolean => {
  const existing = Reflect.getOwnPropertyDescriptor(target, key);
  if (existing === undefined) {
    return true;
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

const defineStaticDescriptor = (target: object, key: string, descriptor: PropertyDescriptor): void => {
  if (!Reflect.defineProperty(target, key, descriptor)) {
    throw StaticDescriptorRedefinitionError.make({ key, message: `Cannot define static '${key}'.` });
  }
};

/**
 * Internal installer behind `withStatics`.
 *
 * **Details**
 *
 * Copies each static's own descriptor onto the target. An existing property
 * with the same value, or one the caller marks as schema-owned, is kept; a
 * conflicting non-configurable property raises an internal tagged error.
 *
 * **Example** (Install a static descriptor)
 *
 * ```ts
 * import { staticDescriptorInstaller } from "@beep/schema/SchemaUtils/internal/staticDescriptors"
 *
 * const target = staticDescriptorInstaller.install({}, { isReady: true })
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
    preserveExisting?: ExistingStaticPreserver
  ): WithStatics<Target, Statics> {
    for (const [key, descriptor] of R.toEntries(Object.getOwnPropertyDescriptors(statics))) {
      if (shouldInstallDescriptor(target, key, descriptorValue(statics, key, descriptor), preserveExisting)) {
        defineStaticDescriptor(target, key, descriptor);
      }
    }

    return target as Target & Statics;
  },
};
