# Agentic Identity Protocol — Specification v0.8

**Observer Protocol**
**Status:** Draft 1 — published for technical review
**Date:** May 2026

This document extends [AIP v0.7](./aip-v0.7-draft-1.md), which itself extends [v0.6](./aip-v0.6-draft-1.md). v0.8 adds two things on top of v0.7:

- A small set of additional optional sub-objects on `credentialSubject.tradingMandate` (`counterparty`, `temporal`, `geographic`, `velocity`) that express counterparty controls, time-window constraints, jurisdictional restrictions, and volume velocity — alongside the existing v0.7 fields.
- A new credential type, `PolicyEvaluationCredential`, which is the protocol-native record of "a proposed action was evaluated against a delegation, and here is the signed decision."

v0.8 is purely additive to v0.7. Existing v0.7-conformant verifiers continue to operate; v0.8 capabilities are opt-in by issuing or reading the new sub-objects and the new credential type. Revisions will be published as numbered drafts in this repository with visible diff.

---

## Executive summary

v0.7 introduced `tradingMandate` as a cryptographically-bound expression of *what an agent is authorized to do*. It did not specify how to express counterparty, temporal, geographic, or velocity constraints — and it did not define the protocol-native shape of a *decision* about whether a specific proposed action falls within the mandate.

v0.8 closes both gaps with the smallest set of additions that lets the protocol express enforcement policy and emit cryptographically-verifiable enforcement decisions:

- `tradingMandate` gains four additional optional sub-objects, all expressed inside the existing `ObserverDelegationCredential` envelope. The credential remains the authoritative scope of authority — there is no separate mutable policy store.
- `PolicyEvaluationCredential` is a new Verifiable Credential type that wraps an enforcement decision (allow or deny, with a structured reason on deny) and binds it to the specific proposed action and the specific delegation it was evaluated against. Issuance uses an on-server assertionMethod-valid key (`#key-3`); see §3.4.

These two additions, together, make the *Policy / Approval* control in the buyer mapping (v0.7 §5) cryptographically realisable rather than aspirational.

---

## 1. Relationship to v0.6 and v0.7

v0.8 changes nothing about v0.6 or v0.7. It defines additional optional sub-objects inside the v0.7 `tradingMandate` and introduces one new credential type. Existing verifiers operate without modification.

- v0.6 envelope and verification flow — unchanged.
- v0.7 `tradingMandate` fields (`allowedVenues`, `allowedInstruments`, `maxNotionalPerOrder`, `maxPosition`, `unit`, `dailyDrawdownCap`) — unchanged.
- v0.7 schema (`delegation/v2.json`) — extended in place. `credentialSubject.tradingMandate` already inherits `additionalProperties: true`, so the new sub-objects are accepted without a breaking schema change.

A credential carrying only v0.7 fields is a valid v0.8 credential. A credential adding any of the v0.8 sub-objects remains a valid v0.7 credential to any verifier that does not read the new fields.

---

## 2. The expanded `tradingMandate` sub-object

All v0.8 additions are optional. When present, they express specific dimensions of authority constraint that v0.7 left undefined. Casing is camelCase, consistent with v0.7.

### 2.1 `counterparty`

Constrains which counterparties an action may transact with.

| Field | Type | Description |
|---|---|---|
| `allowList` | array of strings | Closed list of permitted counterparties. Entries SHOULD be DIDs (preferred); raw rail-specific addresses are accepted as a fallback. If `allowList` is present, a counterparty not present is denied. |
| `blockList` | array of strings | Closed list of denied counterparties. Same DID-or-address shape. If a counterparty matches `blockList`, the action is denied regardless of `allowList`. |
| `requireIssuerClassIn` | array of strings | The counterparty's OP-tracked `issuer_class` (per v0.6 §4.1) MUST be an element of this set. Valid set elements: `op_first_party`, `sovereign_self_attested`, `third_party_kyb`, `partner`, `peer_agent`. |

Notes:
- DID-form entries in `allowList`/`blockList` resolve to rail-specific wallet addresses via the OP wallet-binding registry. Verifiers operating without OP connectivity treat DID-form entries as unresolved and SHOULD fail-closed for `allowList`; raw-address entries continue to evaluate directly.
- `requireIssuerClassIn` is set-membership, not a numeric tier. The legacy notion of "Tier N or higher" maps onto a specific set; e.g., "OP-verified or partner-attested" is `["op_first_party", "third_party_kyb", "partner"]`.

### 2.2 `temporal`

Constrains *when* an action may occur, beyond the credential's existing `validUntil` envelope.

| Field | Type | Description |
|---|---|---|
| `allowedTimeWindows` | array of objects | Action MUST occur within at least one of the listed windows. If absent or empty, no time-of-day restriction applies. |

Each window object:
- `start` (string, `HH:MM` 24-hour format)
- `end` (string, `HH:MM` 24-hour format)
- `timezone` (string, IANA timezone name, e.g. `UTC`, `America/New_York`)
- `daysOfWeek` (array of strings, optional; subset of `["mon","tue","wed","thu","fri","sat","sun"]`; defaults to all days)

Time-window evaluation is against the **verifier's local clock**, in the window's stated timezone. Verifiers SHOULD NOT depend on a network-sourced clock for this check.

### 2.3 `geographic`

Constrains which jurisdictions a counterparty may belong to. Requires counterparty attestation data carrying jurisdiction; if unavailable, see fail-mode rules below.

| Field | Type | Description |
|---|---|---|
| `blockedJurisdictions` | array of strings | ISO 3166-1 alpha-2 country codes; counterparty MUST NOT belong to any. |
| `allowedJurisdictionsOnly` | array of strings | ISO 3166-1 alpha-2 country codes; if present, counterparty MUST belong to one of these. |

Fail modes:
- `blockedJurisdictions` is **fail-open** when counterparty jurisdiction is unavailable — the rule is skipped and the credential's `evaluatedWithAttestations` flag (see §3.2) reflects this.
- `allowedJurisdictionsOnly` is **fail-closed** — if counterparty jurisdiction cannot be determined, the action is denied.

### 2.4 `velocity`

Constrains *aggregate volume over time*, distinct from v0.7's `dailyDrawdownCap` (which is P&L-based).

| Field | Type | Description |
|---|---|---|
| `dailyVolumeCap` | integer | Maximum aggregate transacted volume in any 24-hour rolling window. Denominated by the v0.7 `unit` field. |
| `monthlyVolumeCap` | integer | Maximum aggregate transacted volume in any 30-day rolling window. Denominated by the v0.7 `unit` field. |

Velocity is necessarily stateful. The protocol does not specify where the running counter is maintained — it is an evaluator concern. Wallet-embedded evaluators without persistent state SHOULD skip velocity rules and rely on server-side re-evaluation (§3.3) for enforcement. Velocity caps SHOULD therefore not be the sole enforcement boundary for a high-trust mandate; they complement the per-order ceilings in v0.7.

---

## 3. The `PolicyEvaluationCredential`

### 3.1 Purpose

A `PolicyEvaluationCredential` is a Verifiable Credential issued by the policy evaluator that records the outcome of evaluating a specific proposed action against a specific delegation credential. It is the protocol-native form of the cryptographic *"the action was checked and the decision was X"* claim.

Issuance happens at one or both layers (defense-in-depth):

- **Pre-settlement (wallet-embedded):** the evaluator runs inside the wallet/agent SDK before any signature over the underlying transaction. A denial here means the underlying transaction is never signed.
- **Post-submission (OP server):** the evaluator runs again at the OP submission boundary, independently of any wallet-issued decision. The OP-server-issued credential is the canonical record.

Each layer MAY emit its own `PolicyEvaluationCredential`. Verifiers consuming an evaluation credential SHOULD treat the OP-server-issued credential as authoritative for audit; wallet-issued credentials are pre-flight evidence.

### 3.2 Shape

```
type:       ["VerifiableCredential", "PolicyEvaluationCredential"]
issuer:     a DID controlling an assertionMethod-valid key (see §3.4)
validFrom:  evaluation timestamp
proof:      Ed25519Signature2026 over the JCS-canonical form of the credential
```

The `credentialSubject` carries the decision and its bindings:

| Field | Type | Description |
|---|---|---|
| `decision` | string | `"allow"` or `"deny"`. |
| `denyReason` | object | REQUIRED iff `decision == "deny"`. Carries `ruleType`, `ruleField`, `message`, and optionally `currentValue` / `proposedValue` (see below). Omitted on allow. |
| `evaluatedAgainst.delegationCredentialId` | string | The `id` of the `ObserverDelegationCredential` whose `tradingMandate` was evaluated. |
| `evaluatedAgainst.delegationCredentialHash` | string | SHA-256 hex of the JCS-canonical bytes of the delegation credential, binding the decision to that exact credential body. |
| `proposal.proposalHash` | string | SHA-256 hex of the canonical bytes of the proposed action. The exact canonicalization is rail-specific; see §3.3. |
| `proposal.rail` | string | Identifier of the settlement rail (e.g. `ethereum-mainnet`, `liquid`, `tron`, `lightning`). |
| `evaluator.id` | string | Identifier of the evaluator instance. URN form RECOMMENDED: `urn:observer-protocol:evaluator:{implementation-id}`. This identifier is for evaluator software/version tracking and is distinct from DID document key references. |
| `evaluator.version` | string | Version string of the evaluator implementation. |
| `evaluatedAt` | string | ISO 8601 timestamp. |
| `evaluatedWithAttestations` | boolean | Whether OP attestation data was available during evaluation. If `false`, attestation-dependent rules (e.g. `counterparty.requireIssuerClassIn`, `geographic.*`) were skipped per §2.3 fail modes. |

`denyReason` shape (RECOMMENDED structure for machine-readable denial inspection):

| Field | Type | Description |
|---|---|---|
| `ruleType` | string | One of: `amountLimits`, `counterparty`, `temporal`, `geographic`, `velocity`. |
| `ruleField` | string | The specific field that failed, e.g. `maxNotionalPerOrder`, `requireIssuerClassIn`, `dailyVolumeCap`. |
| `message` | string | Human-readable explanation. |
| `currentValue` | any | Optional. The state value at evaluation time (e.g. current rolling daily volume). |
| `proposedValue` | any | Optional. The proposed change (e.g. the proposed transaction notional). |

### 3.3 Decision binding

The decision is bound to the proposed action via `proposal.proposalHash`. The canonicalization of "the proposed action" is rail-specific:

- **EVM rails:** the SHA-256 of the canonical RLP encoding of the unsigned transaction (the same bytes that a signer would normally hash to produce the txid pre-signature).
- **Bitcoin/Lightning:** the SHA-256 of the canonical sighash preimage.
- **TRON, Solana, Liquid, others:** the SHA-256 of the rail-native canonical pre-sign bytes.

This binding ensures that a decision cannot be repurposed to authorise a different action.

**Normative requirement.** Any implementation issuing `PolicyEvaluationCredential` for a given rail MUST publish a canonicalisation specification describing exactly how `proposalHash` is computed from the proposed action on that rail. This specification SHOULD be publicly accessible and version-controlled. For example, the OP reference implementation publishes its rail-specific canonicalisation rules at `https://docs.observerprotocol.org/policy/canonicalization/{rail}`. Verifiers MAY refuse to trust evaluation credentials whose issuer has not published such a specification for the named rail.

### 3.4 Signing key (`#key-3`)

Issuance of `PolicyEvaluationCredential` requires sub-100ms signing on the hot evaluation path, which is incompatible with an offline-custody signer. v0.8 introduces a scoped on-server signing key, `did:web:observerprotocol.org#key-3`, with the following properties:

- Added to the issuer DID document's `assertionMethod` array, alongside the offline-custody `#key-2`.
- Held only on the policy evaluator server, under restricted file permissions.
- Scoped by governance to `PolicyEvaluationCredential` issuance only. Other credential types — including `ObserverDelegationCredential` and `OrganizationalMembershipCredential` — continue to be signed offline by `#key-2`.
- Rotated independently of `#key-2`. Compromise of `#key-3` invalidates evaluation credentials issued by it but does not threaten delegation credentials.

The scoping is a governance norm, not a cryptographic enforcement; the DID document cannot declare that a key may only sign a specific credential type. Verifiers concerned with operational scoping MAY check the `proof.verificationMethod` of an evaluation credential against the issuer's published key-scoping policy.

The OP issuer's key-scoping policy is published at `https://observerprotocol.org/.well-known/key-scoping.json` and enumerates, for each key in the issuer's DID document, which credential types that key is governance-authorised to sign. The document is informational; the protocol does not enforce it cryptographically. Verifiers MAY consume it to detect mis-scoped issuance (e.g. an `ObserverDelegationCredential` signed by `#key-3`). The document is versioned and updated alongside any key rotation.

`#key-1` is retained in `verificationMethod` only (to verify historical credentials issued under it) and is removed from `assertionMethod`; it MUST NOT be used to sign new credentials.

---

## 4. Verification

v0.8 introduces no new verification flow. `PolicyEvaluationCredential` is verified using the standard verification procedure from v0.6 §6: schema validation, DID resolution, signature verification, validity period check. The credential's `proof.verificationMethod` resolves to `#key-3` in the issuer DID document; that key must be in the `assertionMethod` array.

The expanded `tradingMandate` sub-objects in §2 are verified by the policy evaluator at the moment of action evaluation; they are not part of credential verification proper. A delegation credential carrying the new sub-objects passes credential verification under v0.6 §6 regardless of evaluator behaviour.

---

## 5. Buyer mapping update

This refines the v0.7 §5 buyer-mapping table for the four authorisation controls articulated by senior infrastructure operators (notably BitGo, April 2026):

| Control | Address |
|---|---|
| Identity — *who is this agent, and who authorized it?* | v0.6 credential chain: verified principal → agent DID → delegation credential. **Live.** |
| Permissions — *what is it allowed to do?* | v0.7 `tradingMandate` core fields + v0.8 sub-objects (`counterparty`, `temporal`, `geographic`, `velocity`). **Live in v0.8.** |
| Policy / Approval — *did this action fall within the mandate?* | v0.8 `PolicyEvaluationCredential` — signed decision bound to the specific proposed action and the specific delegation. **Live in v0.8.** |
| Auditability — *what happened, provably?* | Ed25519-signed credential events on Observer Protocol; the chain of (delegation → evaluation decision → trade-shaped audit record) is available end-to-end. The trade-shaped audit record (v1) and holder-signed verifiable presentations remain in scope for subsequent work. |

Three of the four controls are now backed by cryptographically-verifiable credentials. Audit (the fourth) gains its mid-layer artifact (the evaluation credential); the final artifact (the trade-shaped record) is unchanged from v0.7.

---

## 6. Scope boundary (what v0.8 does NOT define)

v0.8 is the credential-and-decision layer. It does NOT define:

- **Wallet integration mechanics.** How a specific wallet implementation (WDK, Aqua/Liquid, others) invokes the evaluator, caches binding data, and surfaces denials to its user is an integration concern, not a protocol concern. Reference integration guides ship separately.
- **Evaluator state management.** Where running counters for velocity rules are maintained, how attestation data is fetched and cached, and how the evaluator interacts with the OP attestation registry are implementation concerns.
- **AT-ARS as a policy input.** Reputation-as-a-rule (e.g. "counterparty must have AT-ARS ≥ N") is reserved for a future revision. v0.8 does not include an `atArsMinimum` field; the existing `requireIssuerClassIn` is the assertion-source primitive.
- **Multi-sig policy approval workflows.** v0.8 expresses single-evaluator decisions. Multi-party policy approval is reserved.
- **Cross-chain unified policy.** A single mandate spanning multiple rails is expressible (omit rail-specific constraints), but cross-rail aggregate state (e.g. one velocity counter spanning EVM + TRON) is an evaluator concern not specified here.

Public claims of these capabilities under v0.8 are NOT supported.

---

## 7. Implementation and conformance

A conforming v0.8 implementation:

1. Issues `ObserverDelegationCredential`s whose `credentialSubject.tradingMandate` MAY carry any combination of `counterparty`, `temporal`, `geographic`, `velocity` sub-objects per §2, in addition to the v0.7 fields.
2. Signs delegation credentials per v0.6 §5 (Ed25519Signature2026 proof over the JCS-canonical form), using an `assertionMethod`-valid key — typically the offline-custody key (`#key-2` for the OP issuer).
3. Issues `PolicyEvaluationCredential`s per §3 from an `assertionMethod`-valid key, with `proposal.proposalHash` and `evaluatedAgainst.delegationCredentialHash` binding the decision to its inputs.
4. When acting as an evaluator on `tradingMandate.counterparty` / `geographic` rules and OP attestation data is unavailable, sets `credentialSubject.evaluatedWithAttestations: false` and applies the fail modes in §2.3.
5. Resolves DID-form entries in `counterparty.allowList`/`blockList` to per-rail addresses via the OP wallet-binding registry. Evaluators operating offline-of-OP fail-close DID-form `allowList` entries.

---

## Appendix A — Worked example: extended `ObserverDelegationCredential` (v0.8)

A scoped trading delegation carrying v0.7 fields plus v0.8 `counterparty`, `temporal`, `geographic`, and `velocity` sub-objects.

```json
{
  "@context": ["https://www.w3.org/ns/credentials/v2"],
  "id": "urn:uuid:observer-delegation-example-v08-demo",
  "type": ["VerifiableCredential", "ObserverDelegationCredential"],
  "issuer": "did:web:observerprotocol.org",
  "validFrom": "2026-05-24T00:00:00Z",
  "validUntil": "2026-08-24T00:00:00Z",
  "credentialSubject": {
    "id": "did:web:observerprotocol.org:agents:example-trading-agent",
    "actionScope": {
      "allowed_rails": ["trading"],
      "allowed_counterparty_types": ["trading-venue"]
    },
    "delegationScope": { "may_delegate_further": false },
    "enforcementMode": "pre_transaction_check",
    "authorizationLevel": "policy",
    "authorizationConfig": {
      "policy": { "policy_id": "v08-extended-demo", "rail_preference": [] }
    },
    "tradingMandate": {
      "allowedVenues": ["CEX-A", "CEX-B"],
      "allowedInstruments": ["BTC", "ETH", "USDT-pairs"],
      "maxNotionalPerOrder": 25000,
      "maxPosition": 250000,
      "unit": "USD",
      "dailyDrawdownCap": { "limit": 5, "type": "percent", "window": "24h" },
      "counterparty": {
        "requireIssuerClassIn": ["op_first_party", "third_party_kyb", "partner"],
        "blockList": []
      },
      "temporal": {
        "allowedTimeWindows": [
          {
            "start": "09:00",
            "end": "17:00",
            "timezone": "America/New_York",
            "daysOfWeek": ["mon","tue","wed","thu","fri"]
          }
        ]
      },
      "geographic": {
        "blockedJurisdictions": ["KP", "IR", "CU"]
      },
      "velocity": {
        "dailyVolumeCap": 100000,
        "monthlyVolumeCap": 1500000
      }
    }
  },
  "credentialSchema": {
    "id": "https://observerprotocol.org/schemas/delegation/v2.json",
    "type": "JsonSchema"
  },
  "proof": {
    "type": "Ed25519Signature2026",
    "created": "2026-05-24T00:00:00Z",
    "verificationMethod": "did:web:observerprotocol.org#key-2",
    "proofPurpose": "assertionMethod",
    "proofValue": "z<base58btc-Ed25519-signature>"
  }
}
```

Venue/instrument labels are illustrative; not authorisations against any real venue.

## Appendix B — Worked examples: `PolicyEvaluationCredential`

### Allow case

```json
{
  "@context": ["https://www.w3.org/ns/credentials/v2"],
  "id": "urn:uuid:policy-eval-demo-allow",
  "type": ["VerifiableCredential", "PolicyEvaluationCredential"],
  "issuer": "did:web:observerprotocol.org",
  "validFrom": "2026-05-24T14:23:11Z",
  "credentialSubject": {
    "decision": "allow",
    "evaluatedAgainst": {
      "delegationCredentialId": "urn:uuid:observer-delegation-example-v08-demo",
      "delegationCredentialHash": "<sha256-hex of canonical delegation bytes>"
    },
    "proposal": {
      "proposalHash": "<sha256-hex of canonical proposed-action bytes>",
      "rail": "ethereum-mainnet"
    },
    "evaluator": {
      "id": "urn:observer-protocol:evaluator:policy-core-v1",
      "version": "policy-core-1.0.0"
    },
    "evaluatedAt": "2026-05-24T14:23:11Z",
    "evaluatedWithAttestations": true
  },
  "proof": {
    "type": "Ed25519Signature2026",
    "created": "2026-05-24T14:23:11Z",
    "verificationMethod": "did:web:observerprotocol.org#key-3",
    "proofPurpose": "assertionMethod",
    "proofValue": "z<base58btc-Ed25519-signature>"
  }
}
```

### Deny case

```json
{
  "@context": ["https://www.w3.org/ns/credentials/v2"],
  "id": "urn:uuid:policy-eval-demo-deny",
  "type": ["VerifiableCredential", "PolicyEvaluationCredential"],
  "issuer": "did:web:observerprotocol.org",
  "validFrom": "2026-05-24T14:24:02Z",
  "credentialSubject": {
    "decision": "deny",
    "denyReason": {
      "ruleType": "velocity",
      "ruleField": "dailyVolumeCap",
      "message": "Proposed transaction would exceed daily volume cap.",
      "currentValue": 92000,
      "proposedValue": 15000
    },
    "evaluatedAgainst": {
      "delegationCredentialId": "urn:uuid:observer-delegation-example-v08-demo",
      "delegationCredentialHash": "<sha256-hex of canonical delegation bytes>"
    },
    "proposal": {
      "proposalHash": "<sha256-hex of canonical proposed-action bytes>",
      "rail": "ethereum-mainnet"
    },
    "evaluator": {
      "id": "urn:observer-protocol:evaluator:policy-core-v1",
      "version": "policy-core-1.0.0"
    },
    "evaluatedAt": "2026-05-24T14:24:02Z",
    "evaluatedWithAttestations": false
  },
  "proof": {
    "type": "Ed25519Signature2026",
    "created": "2026-05-24T14:24:02Z",
    "verificationMethod": "did:web:observerprotocol.org#key-3",
    "proofPurpose": "assertionMethod",
    "proofValue": "z<base58btc-Ed25519-signature>"
  }
}
```

The values denominated as USD inherit the credential's `tradingMandate.unit` field; absent that, `denyReason.currentValue`/`proposedValue` are dimensionless and the human-readable `message` carries the unit context.
