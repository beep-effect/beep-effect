# Research

<!--
Stage 1. Ground the capture in reality. Two halves: what exists outside the
repo (cited), and what exists inside it (so we compose bricks instead of
rebuilding them). Date sections; research goes stale.
-->

## External Landscape

<Prior art, comparable products, libraries, methodologies. Every claim gets a
link. Note license/maintenance/fit concerns inline.>

## In-Repo Capability Inventory

<What we already have that this exploration would build on. Search live source
and barrels first with `rg -n "export (const|function|class|type|interface)
.*<intent>" packages --glob '**/src/**/*.{ts,tsx}' --glob '!**/*.test.*'` and
`rg -n "<intent>" packages --glob '**/src/index.ts'`, then consult local docs;
cite package + path. Mark gaps explicitly as NOT FOUND.>

## Constraints Discovered

<Hard limits surfaced by research: technical, legal, architectural, cost.>
