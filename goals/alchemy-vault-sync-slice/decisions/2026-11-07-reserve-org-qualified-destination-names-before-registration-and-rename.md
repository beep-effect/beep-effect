---
title: "Reserve org-qualified destination names before registration and rename"
date: 2026-11-07
reversal: "Replace the reservation aggregate when the pinned kernel provides Unique"
---

beta.85 has no Unique primitive. DestinationNameReservation uses orgId:normalizedName and rejects another destination. Policy order is claim, register or rename, then release the prior claim.
