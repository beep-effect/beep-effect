---
title: "Member Views and operator diagnostics share one key policy"
date: 2026-11-07
reversal: "Introduce a separately named View for any changed audience"
---

VaultSyncStatus, OpenConflicts and DestinationList require current workspace membership. OperationQueue requires admin or operator grants. History is authorized per key under the same policy; aggregate and raw stream history are not exposed.
