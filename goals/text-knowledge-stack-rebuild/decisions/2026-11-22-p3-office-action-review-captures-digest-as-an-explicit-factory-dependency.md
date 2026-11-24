---
title: "P3: office-action review captures Digest as an explicit factory dependency"
date: 2026-11-22
lane: "goals/text-knowledge-stack-rebuild-p3-annotation"
reversal: "Make the factory effectful and capture Digest during construction, updating its callers"
---

The pure office-action review factory receives the existing Digest service as an explicit dependency. The server layer captures the service and passes it to the factory so returned review methods keep no requirements. This supplies capture hashing without widening the existing public method environments.
