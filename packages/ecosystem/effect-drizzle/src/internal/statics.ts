/**
 * Attach typed static helpers without a runtime type assertion.
 *
 * @internal
 * @category utilities
 * @since 0.0.0
 */
type WithStatics<Self extends object, Statics extends object> = Self & Statics;

export const assignStatics: {
  <Statics extends object>(statics: Statics): <Self extends object>(self: Self) => WithStatics<Self, Statics>;
  <Self extends object, Statics extends object>(self: Self, statics: Statics): WithStatics<Self, Statics>;
} = /* @__PURE__ */ dual(
  2,
  <Self extends object, Statics extends object>(self: Self, statics: Statics): WithStatics<Self, Statics> =>
    Object.assign(self, statics)
);

/**
 * Compute and attach typed statics to a value.
 *
 * @internal
 * @category utilities
 * @since 0.0.0
 */
export const withStatics: {
  <Self extends object, Statics extends object>(
    make: (self: Self) => Statics
  ): (self: Self) => WithStatics<Self, Statics>;
  <Self extends object, Statics extends object>(self: Self, make: (self: Self) => Statics): WithStatics<Self, Statics>;
} = /* @__PURE__ */ dual(
  2,
  <Self extends object, Statics extends object>(
    self: Self,
    make: (self: Self) => Statics
  ): WithStatics<Self, Statics> => assignStatics(self, make(self))
);

import { dual } from "effect/Function";
