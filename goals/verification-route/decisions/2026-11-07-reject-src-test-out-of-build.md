---
title: "Reject src:test out of build"
date: 2026-11-07
lane: "feat/verification-route-slice-2"
reversal: "Admit it per package once app builds stop type-checking test/"
---

Census rank 3 is unsound as stated: apps/docket-intake, apps/labs/ciops and others build with tsrs -p tsconfig.check.json, which includes test/, and their package-local turbo.json re-includes test/ in build inputs.
