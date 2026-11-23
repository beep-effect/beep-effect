---
title: "P2: webAnnotationTargetToTextAnchor refuses ill-formed text on every path, so a decoded anchor always re-encodes"
date: 2026-11-22
lane: "goals/text-knowledge-stack-rebuild-p2-text"
reversal: "Drop the code-point check on the quote-only path of webAnnotationTargetToTextAnchor by a decision file; quote-only targets over ill-formed text then decode to anchors the encoder refuses."
---

Section 4.1 converts every position selector through convertPosition, which refuses a lone surrogate before the range end as ill-formed-text, but a quote-only target goes through resolve, which reads UTF-16 and accepts such text. The two paths would then disagree: a quote-only target over ill-formed text would decode to a candidate anchor that textAnchorToWebAnnotationTarget refuses, so decoding then encoding would not be total on what decodes. The quote-only path therefore converts its resolved range to code points as the encoder does and returns the same ill-formed-text refusal. Every anchor the decoder returns now encodes again. Text after the range end is not checked on either path, as convertPosition does not check it.
