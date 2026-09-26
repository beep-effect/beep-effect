# @beep/ffmpeg

Driver-level native FFmpeg wrapper for product-neutral media processing.

## Scope

`@beep/ffmpeg` owns the technical boundary around the native `ffmpeg` and
`ffprobe` binaries. It exposes schema-first request/result models, a typed
`FFmpegError`, and an Effect `FFmpeg` service that can be layered into tools or
slice adapters.

The first supported workflow extracts PNG frames from a video into a directory:

```ts
import { ExtractFramesRequest, FFmpeg } from "@beep/ffmpeg"
import * as O from "effect/Option"

const request = new ExtractFramesRequest({
  fps: 1,
  manifestPath: O.none(),
  outDir: "./frames",
  overwrite: false,
  prefix: O.none(),
  videoPath: "./input.mp4",
})

const layer = FFmpeg.makeLayer()

void request
void layer
```

## Runtime

The package uses native binaries through `effect/process`, not WASM.
The default executable names are `ffmpeg` and `ffprobe`; callers may override
them with `FFmpeg.makeLayer(new FFmpegConfigInput(...))`.
