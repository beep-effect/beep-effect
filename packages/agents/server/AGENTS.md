# @beep/agents-server Agent Guide

Server adapter package for the agents slice: assistant-turn streaming
primitives (`scanChunk` and friends) and the Layers that wrap them.

| Surface | Key exports | Notes |
| --- | --- | --- |
| entry module | `AssistantTurn` | public namespace for streaming helpers |
| AssistantTurn subpath | `ScanState`, `initialScanState`, `scanChunk` | incremental completed-block extractor, property-test-proven |
| test subpath | deterministic test seeds | test-only helpers |

Keep the `scanChunk` algorithm byte-for-byte stable; it is property-test-proven.
