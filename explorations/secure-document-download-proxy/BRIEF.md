# Secure Document Delivery — Brief

## Problem

Approval-gated professional documents need a revocable, auditable delivery
path. Today the product can authorize and fetch authoritative provider
documents, but it lacks a narrow boundary that can hand one approved document to
the desktop without exposing origin URLs, provider or matter identifiers, or PDF
bytes through renderer-visible state, browser history, referrers, or caches.
Authorization must remain with the product workflow; delivery must fail closed
after expiry, revocation, session change, or any malformed/tampered input.

## Appetite

**Proposed — ratify before commit: one focused goal covering the fixture-backed USPTO office-action vertical and its security gates; cut additional origins and viewer polish before extending the goal.**

This is a scope budget, not an estimate. The first goal may establish the
incubated capability and desktop binding, but it may not absorb Box, generic
fetching, a reusable crypto platform, or a full document viewer.

## Fat-Marker Sketch

**Mint → seal → gate → serve.**

1. The docketing approval spine authorizes one USPTO/ODP File-Wrapper
   office-action provider reference and supplies a purpose-bound TTL under the
   packet-owned maximum.
2. The secure-document-delivery capability mints an opaque CSPRNG token, seals
   the provider-reference mapping in a versioned AES-256-GCM envelope, and
   persists expiry, revocation, key id, and ciphertext through its port.
3. The desktop document route gates strict token shape, loopback/Host,
   per-launch session and audience, store expiry/revocation, envelope
   authentication/AAD, and product-owned authorization. Every rejection looks
   like the same 404.
4. The authorized USPTO adapter fetches the deterministic OA fixture and the
   route streams a bounded `application/pdf` response with cancellation and
   private/no-store, no-referrer, and nosniff headers. Range and HEAD behavior
   are explicit, not accidental.

The end-to-end proof is one authorized OA PDF. Live origin fetch stays behind
the guarded-fetch DNS-rebinding harness.

## Rabbit Holes

- Packaged webview cache, navigation, referrer, and authentication behavior may
  differ across Windows, macOS, and Linux; prove the selected HTTP contract and
  keep custom protocol only as fallback.
- `@azure/msal-node-extensions` portability must be proven in packaged builds,
  including locked/unavailable keyrings, rotation, deletion, and unrecoverable
  key material.
- Range and HEAD semantics can accidentally multiply fetches, buffer bytes, or
  leak existence; choose and test an explicit first-slice policy.
- TTL is purpose- and consumer-specific. The capability needs a maximum and
  typed policy input without inventing every consumer's duration.
- Revocation UX belongs to consumers, while the capability must expose a
  reliable revoke predicate and lifecycle evidence.

## No-Gos

- No generic crypto, signed-URL, capability-URL, or proxy platform.
- No raw-origin-URL persistence, capability input, or generic dereference path.
- No Tauri asset protocol or `tauri-plugin-localhost`; custom protocol is
  fallback only.
- No PDF bytes inside encrypted mapping envelopes or persistent document cache.
- No shared codec, keyset, or custody implementation with the credential vault.
- No provider authorization, provenance, or product approval workflow moving
  into the delivery capability.
- No Box, viewer, or additional-origin implementation in the first goal.
