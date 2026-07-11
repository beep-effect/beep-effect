import { $ScratchpadId } from "@beep/identity";
import * as S from "effect/Schema";
import { Effect, Layer } from "effect";
import { BunRuntime, BunServices } from '@effect/platform-bun';

const $I = $ScratchpadId.create("index");




const displayCodec = Effect.gen(function* () {

});


const program = Effect.scoped(
  Layer.build(BunServices.layer).pipe(
    Effect.flatMap((ctx) => displayCodec.pipe(Effect.provide(ctx))),
  )
)
BunRuntime.runMain(program);
