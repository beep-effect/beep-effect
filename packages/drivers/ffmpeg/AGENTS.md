# Agent Guide

`@beep/ffmpeg` is a flat `drivers` package. Keep it product-neutral: it may
wrap native FFmpeg process behavior, expose typed technical errors, and return
schema-first media-processing models, but it must not import slice or shared
domain concepts.

Use `ChildProcess` from `effect/process` inside scoped effects. Keep
child-process stdin ignored, stdout/stderr piped, and force-kill timeouts set
so interrupted runs do not leave native processes alive.

Frame extraction writes into a temporary directory first, then commits final
PNG names and the manifest only after the process succeeds.
