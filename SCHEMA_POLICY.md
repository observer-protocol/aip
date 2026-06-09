# Schema Immutability Policy

**Observer Protocol**
**Applies to:** all JSON Schema documents published under `https://observerprotocol.org/schemas/`
**Status:** binding from 2026-06-03; first applied to the v0.7→v0.8 delegation-schema transition.

## Policy

Once a schema URL under `observerprotocol.org/schemas/` has been published and referenced by an issued credential, **the bytes at that URL are immutable**. The URL serves the same document forever. New schema content — additive, breaking, or in-between — is published at a **new URL**.

## Why

A `credentialSchema.id` URL inside a verifiable credential is a load-bearing reference: the verifier fetches it and validates the credential against whatever bytes the URL returns. If the bytes change after the credential is signed:

- Credentials previously signed against the old shape may stop validating, even though their content and proof are unchanged.
- Verifiers cannot trust that two parties fetching the same URL at different times got the same schema, which is what `credentialSchema` is supposed to guarantee.
- The signer's commitment becomes ambiguous: "I issued a credential conforming to *what was at this URL when I signed*" is a different claim than "I issued a credential conforming to *whatever is at this URL now*."

The W3C VC Data Model treats `credentialSchema.id` as a pointer to a stable, addressable schema document. We honour that by enforcing the stability ourselves.

## Mechanics

- **New version → new URL.** Field additions, renames, enum tightenings, closure of `additionalProperties`, or any other change get a new URL. Naming convention: minor revisions of a stable envelope are `.N+1.json` siblings (e.g. `v2.json` → `v2.1.json`); whole-envelope changes get a new major (`v3.json`).
- **Old URLs stay live.** The previous URL keeps serving its previous bytes for as long as credentials issued under it may still be in circulation — i.e. effectively forever. We do not delete or 301-redirect old schema URLs.
- **Issuance updates to the new URL.** When a new schema version is published, the issuer code embeds the new URL in `credentialSchema.id` for newly-issued credentials. Already-issued credentials keep their pinned URL and continue to validate against it.
- **Spec and adapter pinning.** AIP draft documents reference schema URLs by exact version (no floating "latest" link). Downstream adapters (e.g. WDK integration) SHOULD pin the expected `credentialSchema.id` to a specific URL they were built against, and SHOULD reject credentials carrying a `credentialSchema.id` they do not recognise rather than fetching arbitrary URLs.
- **Schema-source repository.** Schema documents are authored in this repository (`observer-protocol/aip`) under `schemas/<credential-type>/<version>.json`, and are the single source of truth. Deployment to `observer-protocol/observerprotocol-website` under `schemas/` is a **verbatim byte-for-byte copy** — the deployed file and its `aip` source MUST be identical (same `sha256`). The served `$id` therefore always matches the file's own `$id`. No edits are made on the website side; any change starts in `aip`.

## Cross-references

- AIP v0.8 draft-1 §1 (the v0.7→v0.8 transition that first applied this policy).
- `observerprotocol.org/schemas/delegation/v2.json` — frozen at v0.7 content; used by the maxi-0001 demo credential.
- `observerprotocol.org/schemas/delegation/v2.1.json` — current v0.8 schema; used by Sovereign issuance from 2026-06-03 forward.

## Open question (not policy-blocking)

This policy is silent on URLs that *were* published but never referenced by any issued credential — i.e. URLs we could safely repurpose. We do not currently distinguish, and treat all published URLs as immutable by default. If a case ever arises where this matters, the policy may be revised to add an explicit "withdrawn before use" carve-out; until then, the conservative default holds.
