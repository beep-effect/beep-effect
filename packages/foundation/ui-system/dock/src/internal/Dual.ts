export type Dual2<Self, That, Result> = {
  (self: Self, that: That): Result;
  (that: That): (self: Self) => Result;
};

export type Dual3<Self, First, Second, Result> = {
  (self: Self, first: First, second: Second): Result;
  (first: First, second: Second): (self: Self) => Result;
};
