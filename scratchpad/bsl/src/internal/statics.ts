/** Attach typed static helpers without a runtime type assertion. */
/** @internal */
export function assignStatics<Self extends object, Statics extends object>(
  self: Self,
  statics: Statics,
): Self & Statics;
/** @internal */
export function assignStatics(self: object, statics: object): object {
  return Object.assign(self, statics);
}

/** Compute and attach typed statics to a value. */
/** @internal */
export const withStatics = <Self extends object, Statics extends object>(
  self: Self,
  make: (self: Self) => Statics,
): Self & Statics => assignStatics(self, make(self));
