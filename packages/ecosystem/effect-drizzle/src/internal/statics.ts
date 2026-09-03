/**
 * Attach typed static helpers without a runtime type assertion.
 *
 * @internal
 * @category utilities
 * @since 0.0.0
 */
export const assignStatics: {
  <Statics extends object>(statics: Statics): <Self extends object>(self: Self) => Self & Statics;
  <Self extends object, Statics extends object>(self: Self, statics: Statics): Self & Statics;
} = dual(2, <Self extends object, Statics extends object>(self: Self, statics: Statics): Self & Statics =>
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
  <Self extends object, Statics extends object>(make: (self: Self) => Statics): (self: Self) => Self & Statics;
  <Self extends object, Statics extends object>(self: Self, make: (self: Self) => Statics): Self & Statics;
} = dual(2, <Self extends object, Statics extends object>(self: Self, make: (self: Self) => Statics): Self & Statics =>
  assignStatics(self, make(self))
);

import { dual } from "effect/Function";
