---
title: "The check hash names the record's producer sources as inputs, not a package dependency"
date: 2026-11-19
lane: "feat/gate-report-wiring"
pullRequest: 3419
reversal: "Replace the listed inputs with a transit dependency on the gate-run library and accept the wider invalidation."
---

A cached check record must be invalidated when the code that builds it changes. The check task lists those sources as root inputs: the gate-run library, the repo CLI's Gate command directory, the unbuilt-reference probe, the output bound, and the tsconfig loader with its extends resolver. A transit dependency on the gate-run library was rejected because its package closure reaches the repo CLI kit and its drivers, so an edit to an unrelated driver would re-key every check. Known gap: the tsconfig parsing libraries under the loader are not listed, so a change in tsconfig parsing does not re-key check. A test fails when a source file of the Gate directory or the gate-run library is not matched by the inputs. For the test task the adapter's transit already covers its whole writer.
