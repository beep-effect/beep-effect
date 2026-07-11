# @beep/cosmos

Driver wrapper for the ontology visualizer spike. The package probes WebGL2 at
runtime, renders with `@cosmos.gl/graph` when viable, and falls back to
sigma.js + graphology when WebGL2 is unavailable.

The entrypoint is browser-safe: importing `@beep/cosmos` does not read
`window`, `document`, or WebGL globals, and does not import renderer packages
until `renderCosmosGraph` is called.
