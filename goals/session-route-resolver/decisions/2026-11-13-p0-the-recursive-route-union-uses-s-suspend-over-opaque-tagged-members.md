---
title: "P0: the recursive route union uses S.suspend over opaque tagged members"
date: 2026-11-13
kind: checkpoint
lane: "feat/session-route-resolver"
reversal: "Replace the via-parent member's suspended field with a flat parent route and a depth field."
---

Validated against the installed Effect v4 (node_modules/effect/dist/Schema.d.ts): S.suspend, S.TaggedStruct, S.Union with S.toTaggedUnion('_tag'). The repo pattern is packages/foundation/ui-system/dock/src/Dock.models-tree.ts: opaque members, a suspended reference typed S.Codec<X.Type, X.Encoded>, and an exported declare namespace carrying Type and Encoded.
