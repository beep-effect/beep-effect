---
title: "P2: unit conversion refuses ill-formed text with its own reason"
date: 2026-11-22
lane: "goals/text-knowledge-stack-rebuild-p2-text"
reversal: "Drop ill-formed-text from UnitConversionRefusal and let a lone surrogate count as one code point, by a decision file with the L1-2 row."
---

UnitConversionRefusal gains ill-formed-text beside split-boundary and out-of-range. A text with a lone surrogate has no UTF-8 encoding and no agreed code-point count, so the conversion cannot be a bijection on it; returning a number would be a silent wrong answer. verifySourceTextIdentity already refuses such text, so no verified capture reaches this case. langextract's convertTextOffsetRange keeps its own documented behaviour on ill-formed text until P3 re-expresses it.
