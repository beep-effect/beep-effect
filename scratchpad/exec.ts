// import * as S from "effect/Schema";
// import * as Equivalence from "effect/Equivalence";
// import {$ScratchpadId} from "@beep/identity";
// import * as Effect from "effect/Effect";
// import * as BunRuntime from "@effect/platform-bun/BunRuntime";
// import * as A from "effect/Array";
// import {Console} from "effect";
// import {equivalence} from "@beep/utils/Str";
//
//
// const $I = $ScratchpadId.create("exec");
//
// const makeCauseError = (className: string) => {
//   try {
//     throw new Error(`Cause error: ${className}`);
//   } catch (e) {
//     return e;
//   }
// };
//
// export class MyTaggedError extends S.TaggedError<MyTaggedError>($I`MyTaggedError`)(
//   "MyTaggedError",
//   S.Struct({
//     message: S.String,
//     cause: S.Defect({
//       includeStack: true
//     })
//   }).pipe((self) => self.pipe(
//     S.annotate({
//       toEquivalence: Equivalence.make((a: typeof self.Type, b: typeof self.Type) => {
//         const equivalence = S.toEquivalence(self);
//
//         return equivalence(a, b);
//       })
//     })
//   ))
// ) {
// }
//
// const program = Effect.gen(function* () {
//   const xClass = MyTaggedError.make({
//     message: "x",
//     cause: makeCauseError("x")
//   });
//
//   const yClass = MyTaggedError.make({
//     message: "y",
//     cause: makeCauseError("x")
//   });
//
//   const equivalence = S.toEquivalence(MyTaggedError);
//
//   yield* Console.log(`structural equivalence: ${equivalence(xClass, yClass)}`);
// });
//
// export class MyTaggedError2 extends S.TaggedError<MyTaggedError2>($I`MyTaggedError2`)(
//   "MyTaggedError2",
//   S.Struct({
//     cause: S.Defect()
//   }),
//   {
//     toEquivalence: (eq) => Equivalence.make((a, b) => S.toEquivalence(self)(a, b))
//   }
// ) {
// }
//
// BunRuntime.runMain(program);
