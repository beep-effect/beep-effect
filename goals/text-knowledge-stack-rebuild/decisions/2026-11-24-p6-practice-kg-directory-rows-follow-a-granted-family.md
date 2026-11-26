---
title: "P6: kg_clients and correspondents return only rows reached through a granted family; the unattributed clients row is dropped"
date: 2026-11-24
lane: "p6"
reversal: "Return every client and correspondent row again and restore the unattributed kg_clients row"
---

kg_clients inner-joins the client nodes to granted docket_family nodes, so a client appears only with at least one granted family, and the former unattributed row (documents with no client) is dropped because no client-qualified key can grant it. Correspondent links that carry a family_key are visible when that key is granted; a link with only a client (no family) is visible when the client owns a granted family, because a client-level correspondent is shared by that client's matters. Contacts, candidates and linked matters are returned only through such a link or a granted candidate, never as a free directory read. Candidate claims join their document node by provenance_ref = sourceDocumentDigest and, when the digest is filed in more than one docket, by the snapshot docket, then filter by the granted family key; the join stays a LEFT JOIN so a claim whose document node is absent keeps its row under an Unwalled read.
