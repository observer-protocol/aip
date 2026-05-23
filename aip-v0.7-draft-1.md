# Agentic Identity Protocol — Specification v0.7

**Observer Protocol**
**Status:** Draft 1 — published for technical review
**Date:** May 2026

This document is a working draft of an additive extension to [AIP v0.6](./aip-v0.6-draft-1.md). It introduces a single optional sub-object on the existing `ObserverDelegationCredential`. It does not introduce a new credential type, a new layer, or any change to the existing payment-delegation path or to the verification flow defined in v0.6. Revisions will be published as numbered drafts in this repository with visible diff.

---

## Executive summary

AIP v0.7 adds a minimal trading-domain mandate vocabulary to the delegation credential defined in v0.6, in the form of a single optional `tradingMandate` sub-object nested inside `credentialSubject`.

The purpose of v0.7 is to make delegation credentials *expressive* about trading authority — which venues an agent may act on, what instruments, how much per order and in aggregate, and what loss ceiling, if breached, places the action outside the mandate. v0.7 covers issuance and verification of these scoped credentials only. It does not yet define a per-trade attestation, a trade-shaped audit record, or a domain-specific rule evaluator inside the policy engine. Those are explicit v1 design-partner work; v0.7's scope is intentionally narrow so that what the protocol claims and what is live coincide exactly.

The extension is purely additive: the existing payment-delegation path, the locked submission-verification contract, and previously issued credentials are unchanged. A credential carrying `tradingMandate` remains a valid v0.6 credential to any verifier that does not read the new field.

---

## 1. Relationship to v0.6

v0.7 changes nothing about v0.6. It defines exactly one optional field, nested inside the credential subject, that v0.6 verifiers ignore and v0.7-aware verifiers may read.

- Credential type — unchanged: `ObserverDelegationCredential`.
- Envelope (`@context`, `type`, `issuer`, `validFrom`, `validUntil`, `credentialSchema`, `proof`) — unchanged.
- `credentialSubject` required fields — unchanged (`id`, `actionScope`, `delegationScope`, `enforcementMode`, `authorizationLevel`).
- Verification flow defined in v0.6 §6 — unchanged. Signature is computed over the JCS-canonicalized whole credential; the new field is signed automatically by virtue of being inside the credential.
- Holder-canonical storage model from v0.6 — unchanged.

A credential that does not carry `tradingMandate` is a valid v0.7 credential. The field is optional at the schema level.

---

## 2. The `tradingMandate` sub-object

`tradingMandate` is an optional object placed at `credentialSubject.tradingMandate`. When present, it expresses the trading-domain scope of the delegation.

### 2.1 Fields

All field names use camelCase, consistent with the existing v0.6 credential vocabulary (`actionScope`, `delegationScope`, `enforcementMode`, `authorizationLevel`). All fields are optional at the schema level; a credential carrying `tradingMandate` SHOULD populate the core set defined below.

| Field | Type | Description |
|---|---|---|
| `allowedVenues` | array of strings | Venue identifiers the agent MAY transact on. Closed list: a venue not present is implicitly denied. |
| `allowedInstruments` | array of strings | Permitted assets, pairs, or instrument classes. Closed list: an instrument not present is implicitly denied. |
| `maxNotionalPerOrder` | integer | Maximum notional value of any single order, denominated by `unit`. |
| `maxPosition` | integer | Maximum aggregate open exposure under this mandate, denominated by `unit`. |
| `unit` | string | The denomination for `maxNotionalPerOrder` and `maxPosition`. REQUIRED whenever either of those fields is present (units MUST NOT be implicit). |
| `dailyDrawdownCap` | object | Loss ceiling that, if breached, places further action outside the mandate. Shape: `{ "limit": <number>, "type": "percent" | "absolute", "window": <duration string> }`. |

The credential's existing `validUntil` field serves as the mandate expiry; v0.7 does not duplicate it.

### 2.2 Constraints

- Verifiers that read `tradingMandate` MUST treat `allowedVenues` and `allowedInstruments` as closed lists (default-deny).
- Verifiers MUST NOT infer a value for `unit` when `maxNotionalPerOrder` or `maxPosition` is present and `unit` is absent. Such a credential SHOULD be treated as an incomplete mandate.
- `dailyDrawdownCap.type` MUST be one of `"percent"` or `"absolute"`. Other values are reserved.
- `dailyDrawdownCap.window` is a duration string. v0.7 reserves the canonical form `"<integer>h"` (e.g. `"24h"`). Implementations MAY accept ISO 8601 duration but SHOULD emit the canonical form.

---

## 3. Placement, schema, and additivity

`tradingMandate` is placed inside `credentialSubject`, not at the credential root, for two reasons:

1. **Schema-level:** the delegation credential schema (`/schemas/delegation/v2.json`) sets `additionalProperties: false` at the credential root. A sibling field at the root would be rejected by `jsonschema.validate`. `credentialSubject` inherits the JSON Schema default of `additionalProperties: true` and therefore accepts the new sub-object without schema modification.
2. **Semantic:** the mandate is data about the subject of the delegation — what this delegated agent is authorized to do — not metadata about the credential itself.

The active delegation schema is updated in this revision to document `tradingMandate` as an optional property of `credentialSubject`. The update is doc-clarity only; verification correctness holds with or without it because `credentialSubject` is already open to additional properties.

The Observer Protocol verifier (§6 of v0.6) reads delegation credentials by field path. It pulls only the fields it requires (subject id, scope, validity window, issuer, proof) and ignores unrecognized fields. `tradingMandate` is therefore inert to the existing verification path; products built on AIP that wish to act on the mandate do so by reading the field themselves.

---

## 4. Verification

There is no new verification step in v0.7. The verification flow defined in v0.6 §6 — schema validation, DID resolution, signature verification, validity-period check, revocation check — is sufficient and unchanged.

A credential carrying `tradingMandate` is verified identically to a credential without it. The signature covers the JCS-canonicalized whole credential, so the contents of `tradingMandate` are bound to the proof.

Per-trade enforcement — checking an individual executed order against the values in `tradingMandate` and emitting a verifiable attestation that the order fell within the mandate — is **explicitly out of scope** for v0.7. See §6.

---

## 5. Buyer mapping (informative)

The fields in v0.7 are designed to express, in protocol-native form, the four authorization controls publicly named by senior infrastructure operators (notably BitGo, April 2026) as the missing piece for agentic trading. This mapping is informative, not normative:

| Control | Address |
|---|---|
| Identity — *who is this agent, and who authorized it?* | Existing AIP v0.6 credential chain: verified principal → agent DID → delegation credential. **Live today**; verifiable via the OP membership-credential endpoint. |
| Permissions — *what is it allowed to do?* | `tradingMandate.allowedVenues`, `tradingMandate.allowedInstruments`, `tradingMandate.maxNotionalPerOrder`, `tradingMandate.maxPosition`. **Live in v0.7** — the credential expresses scoped trading authority. |
| Policy / approval — *did this action fall within the mandate?* | The Observer Protocol policy-engine substrate (registered per organization; consulted at the submission boundary; decisions signed and logged) **runs in production today** against payment-shaped actions. Trading-domain rule evaluation against `tradingMandate` is v1 design-partner work. |
| Auditability — *what happened, provably?* | Ed25519-signed credential events on Observer Protocol. **Foundation live today**; trade-shaped audit records and holder-signed verifiable presentations are v1. |

Of the four controls: identity and scoped permissions are live and curl-verifiable today; policy evaluation and per-trade audit run on live substrate and are the layer to build with design partners.

---

## 6. Scope boundary (what v0.7 does NOT define)

This boundary is load-bearing. v0.7 is the issuance-and-verification primitive for a scoped trading delegation. It is not the full enforcement capability. The following are explicitly v1, not v0.7:

- **Per-trade enforcement attestation.** The mechanism by which an individual executed trade is checked against the mandate and a verifiable proof is emitted. Resolving who signs the per-trade attestation (agent-side vs. venue-side) is open and is the substantive design-partner question for v1.
- **Trading-domain rule evaluator.** The OP policy-engine substrate exists and is consulted at the submission boundary today; it does not yet evaluate against `tradingMandate` semantics. Adding that evaluation logic is v1.
- **Trade-shaped audit record.** The current `verified_events` record is payment-shaped. A trade-shaped audit record (instrument, side, quantity, price, venue, order id, fill id, timestamps) is v1.
- **Counterparty-type restrictions, jurisdictional constraints, time-of-day windows beyond `validUntil`, excluded-instrument lists, order-type allowlists, leverage caps, multi-leg or structured-product semantics.** These are explicit roadmap items for a fuller trading-delegation specification beyond v0.7.

A public claim that Observer Protocol enforces per-trade adherence to the mandate is not supported by v0.7 and SHOULD NOT be made until the v1 work exists.

---

## 7. Implementation and conformance

A conforming implementation of v0.7:

1. Issues `ObserverDelegationCredential`s whose `credentialSubject` optionally carries a `tradingMandate` object as specified in §2.
2. Signs the credential per v0.6 §5: Ed25519Signature2026 proof over the JCS-canonicalized whole credential.
3. Verifies credentials per v0.6 §6, without modification. The `tradingMandate` field, if present, is signed under the existing proof.
4. When acting on `tradingMandate` values (e.g. in a downstream policy decision), treats `allowedVenues` and `allowedInstruments` as closed lists and refuses to infer units.

---

## Appendix A — Worked example

A scoped trading delegation issued by Observer Protocol to a delegated agent, valid for approximately three months, expressing the demo mandate:

```json
{
  "@context": [
    "https://www.w3.org/ns/credentials/v2"
  ],
  "id": "urn:uuid:observer-delegation-maxi-0001-trading-demo",
  "type": ["VerifiableCredential", "ObserverDelegationCredential"],
  "issuer": "did:web:observerprotocol.org",
  "validFrom": "2026-05-23T00:00:00Z",
  "validUntil": "2026-08-15T00:00:00Z",
  "credentialSubject": {
    "id": "did:web:observerprotocol.org:agents:maxi-0001",
    "actionScope": {
      "allowed_rails": ["trading"],
      "allowed_counterparty_types": ["trading-venue"]
    },
    "delegationScope": {
      "may_delegate_further": false
    },
    "enforcementMode": "pre_transaction_check",
    "authorizationLevel": "policy",
    "authorizationConfig": {
      "policy": {
        "policy_id": "trading-mandate-v07-demo",
        "rail_preference": []
      }
    },
    "tradingMandate": {
      "allowedVenues": ["CEX-A", "CEX-B"],
      "allowedInstruments": ["BTC", "ETH", "USDT-pairs"],
      "maxNotionalPerOrder": 25000,
      "maxPosition": 250000,
      "unit": "USD",
      "dailyDrawdownCap": {
        "limit": 5,
        "type": "percent",
        "window": "24h"
      }
    }
  },
  "credentialSchema": {
    "id": "https://observerprotocol.org/schemas/delegation/v2.json",
    "type": "JsonSchema"
  },
  "proof": {
    "type": "Ed25519Signature2026",
    "created": "2026-05-23T00:00:00Z",
    "verificationMethod": "did:web:observerprotocol.org#key-2",
    "proofPurpose": "assertionMethod",
    "proofValue": "z<base58btc-Ed25519-signature>"
  }
}
```

The proof shape above is the form Observer Protocol's issuer emits and its verifier accepts today: `Ed25519Signature2026` with no separate `cryptosuite` field, base58btc-encoded `proofValue`, and a JCS-style canonical form (not URDNA2015) over the credential with the proof excluded — matching the only verified credential in production at the time of writing (the L4 OrganizationalMembershipCredential). Venue and instrument labels are illustrative for demonstration purposes and are not authorizations against any real exchange.
