/** Attach typed static helpers without a runtime type assertion. */
export function assignStatics<Self extends object, Statics extends object>(
  self: Self,
  statics: Statics,
): Self & Statics;
export function assignStatics(self: object, statics: object): object {
  return Object.assign(self, statics);
}

/** Compute and attach typed statics to a value. */
export const withStatics = <Self extends object, Statics extends object>(
  self: Self,
  make: (self: Self) => Statics,
): Self & Statics => assignStatics(self, make(self));
