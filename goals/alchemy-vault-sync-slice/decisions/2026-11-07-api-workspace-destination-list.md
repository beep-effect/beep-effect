---
title: "DestinationList is workspace keyed at the public boundary"
date: 2026-11-07
reversal: "Introduce a separately authorized organization-wide View and migrate its callers"
---

The PR 3a organization-keyed DestinationList can contain destinations from workspaces beyond the caller grant. Change its key to an explicit org:workspace value before any Api publication. Session still resolves and checks ownership independently of key shape. This is a pre-publication View key break; no existing desktop caller uses the alchemy View yet.
