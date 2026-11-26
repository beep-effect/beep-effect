---
title: "P6: the gateway's Box Drive reads stay outside the matter wall; Box's own sharing is their authority"
date: 2026-11-24
lane: "p6"
reversal: "Add Box path prefixes to MatterScope and authorize box_list and box_read through MatterAuthority"
---

Independent review of the P6 design. The P0 access-path map lists the gateway's Box reads under source retrieval, 'path confined to the Box folder' (research/consumer-census.md:595). box_list and box_read read the local Box Drive folder (apps/practice-gateway/src/BoxDriveTools.ts:1-4), which holds only what Box's sharing grants the signed-in user's account; Box is the caller-independent authority for those bytes, the stack holds no copy of them, and they carry no matter key the stack could bind. The matter wall protects material the stack holds and serves across principals. A Box file whose text enters the stack is captured under a scopeRef and is walled by path 1 from then on. The two-matter test makes no Box assertion. If a host ever serves Box bytes to a principal other than the Box account's owner, this decision is reversed.
