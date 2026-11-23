---
title: A bump past MAX_SAFE_INTEGER throws a defect instead of failing typed
date: 2026-11-22
reversal: Make SemVerBump methods return Effect or Result and surface SemVerBumpOverflowError in the error channel.
governs:
  - src/SemVer.ts#SemVerBumpOverflowError
  - src/SemVer.ts#overflow
  - src/SemVer.ts#SemVerBump
enforcedBy: []
---

When a bump would push a component past `Number.MAX_SAFE_INTEGER`, `overflow`
throws `SemVerBumpOverflowError` in place of `SemVer.make`'s raw schema failure,
which rides along as `cause`.

This is an arithmetic invariant, not malformed input: `SemVerBump` only
increments components already validated on the receiver. Every other `SemVer`
and `SemVerBump` method is synchronous and returns no `Effect`, so the bump
methods keep that signature and the overflow stays a defect.

Rejected: a typed `Effect` failure on every bump method, which would force every
caller of a total-in-practice operation into the error channel.
