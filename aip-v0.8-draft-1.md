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

v0.7 introduced `tradingMandate` as a cryptographically-bound expression of *what an agent is authorized to do* on trading-domain actions, complementing the v0.6 `actionScope` construct which expresses payment/spending authority. v0.7 did not specify how to express counterparty, temporal, geographic, or velocity constraints on `tradingMandate` — and neither v0.6 nor v0.7 defined the protocol-native shape of a *decision* about whether a specific proposed action falls within either mandate surface.

v0.8 closes both gaps with the smallest set of additions that lets the protocol express enforcement policy and emit cryptographically-verifiable enforcement decisions:

- `tradingMandate` gains four additional optional sub-objects, all expressed inside the existing `ObserverDelegationCredential` envelope. The credential remains the authoritative scope of authority — there is no separate mutable policy store.
- `PolicyEvaluationCredential` is a new Verifiable Credential type that wraps an enforcement decision (allow or deny, with a structured reason on deny) and binds it to the specific proposed action and the specific delegation it was evaluated against. It is uniform across both mandate surfaces — the same credential type carries verdicts on `actionScope` (spending) and `tradingMandate` (trading) actions. Issuance uses an on-server assertionMethod-valid key (`#key-3`); see §3.4.

These two additions, together, make the *Policy / Approval* control in the buyer mapping (v0.7 §5) cryptographically realisable rather than aspirational.

---

## 1. Relationship to v0.6 and v0.7

v0.8 changes nothing about v0.6 or v0.7. It defines additional optional sub-objects inside the v0.7 `tradingMandate` and introduces one new credential type. Existing verifiers operate without modification.

- v0.6 envelope and verification flow — unchanged.
- v0.6 `actionScope` fields expressing payment/spending authority — vocabulary canonicalised in v0.8 to snake_case (the casing already deployed in the reference Sovereign implementation): `allowed_rails`, `per_transaction_ceiling`, `allowed_transaction_categories`, gated by the sibling `authorizationLevel` / `authorizationConfig` pair that distinguishes one-time / recurring / policy-driven payments. v0.5's camelCase names (`rails`, `maxTransactionValue`, `allowedActions`) are deprecated; verifiers MAY accept them for credentials issued under earlier drafts.
- v0.7 `tradingMandate` fields (`allowedVenues`, `allowedInstruments`, `maxNotionalPerOrder`, `maxPosition`, `unit`, `dailyDrawdownCap`) — unchanged (camelCase, consistent with v0.7).
- v0.7 schema (`delegation/v2.json`) — frozen at its published content. v0.8 ships a new sibling URL, `delegation/v2.1.json`, carrying: the v0.8 sub-objects on `tradingMandate` (`counterparty`, `temporal`, `geographic`, `velocity`); the v0.8 fields on `actionScope` (notably `cumulative_budget`, plus the reserved-advisory fields in §1.3); and `additionalProperties: false` closed on both `actionScope` and `credentialSubject` — silent extension of either object is disallowed; future field additions require a numbered-draft schema update at a new URL. Credentials previously issued against `delegation/v2.json` continue to validate against `delegation/v2.json` forever; new v0.8-conformant credentials carry `credentialSchema.id = delegation/v2.1.json`. See `SCHEMA_POLICY.md` in this repository for the schema immutability policy.

A credential carrying only v0.7 fields is a valid v0.8 credential. A credential adding any of the v0.8 sub-objects remains a valid v0.7 credential to any verifier that does not read the new fields.

### 1.1 Mandate surfaces

`credentialSubject` carries two parallel mandate surfaces, either or both of which MAY be present in a single `ObserverDelegationCredential`:

| Surface | Domain | Defined in | Key fields |
|---|---|---|---|
| `actionScope` | Payment / spending | v0.6 (envelope), v0.5 (initial field vocabulary), v0.8 (snake_case canonicalisation + `cumulative_budget`) | `allowed_rails`, `per_transaction_ceiling`, `allowed_transaction_categories`, `cumulative_budget` (§1.2); gated by sibling `authorizationLevel` + `authorizationConfig` |
| `tradingMandate` | Trading | v0.7, extended by v0.8 §2 | `allowedVenues`, `allowedInstruments`, `maxNotionalPerOrder`, `maxPosition`, `unit`, `dailyDrawdownCap`, plus v0.8 `counterparty` / `temporal` / `geographic` / `velocity` |

The surfaces are siblings, not alternatives — a delegation that authorises both spending and trading carries both. The `PolicyEvaluationCredential` defined in §3 emits verdicts against whichever surface(s) the proposed action engages; the verdict format (§3.2) is uniform across surfaces, with `denyReason.ruleType` and `denyReason.ruleField` disambiguating which surface and which field within it produced the denial.

### 1.2 Cumulative budget on the spending mandate

`actionScope` MAY carry an optional `cumulative_budget` sub-object expressing a total spend cap over the lifetime of the delegation. This deliverable is **expression-layer only**: issuers can declare a cap and verifiers MUST surface it, but the v0.8 protocol does NOT define cumulative enforcement. Per-transaction binding remains exclusively on `per_transaction_ceiling`.

Shape:

```jsonc
"actionScope": {
  "allowed_rails": ["lightning", "usdt_tron"],
  "allowed_transaction_categories": ["..."],
  "per_transaction_ceiling": { "amount": "25000", "currency": "USDT" },
  "cumulative_budget": {
    "amount": "250000",
    "currency": "USDT",
    "window": "credential_validity"
  }
}
```

| Field | Type | Description |
|---|---|---|
| `amount` | string | Decimal amount expressed as a string (avoids float coercion at the wire level). |
| `currency` | string | ISO 4217 code, settlement-rail token symbol (e.g. `USDT`, `BTC`), or rail-native unit (`sats`). |
| `window` | string | v0.8 defines exactly one allowed value: `"credential_validity"` — the cap applies cumulatively over `validFrom` → `validUntil`. |

The flat `{ amount, currency, window? }` shape is shared with `per_transaction_ceiling`; both inherit the same string-amount convention. A nested `amount: { value, currency }` shape is reserved for a future draft alongside per-rail denomination (§6).

Normative requirements:

1. The field is OPTIONAL. Credentials without it remain conformant and verifiable.
2. The `window` enum is closed in v0.8 to `"credential_validity"`. Rolling-window, calendar-period, timezone, and reset semantics are deferred to a future draft alongside binding enforcement. Implementations MUST reject any other `window` value as malformed.
3. Cumulative budget is **advisory only**. `PolicyEvaluationCredential` MUST NOT issue `decision: "deny"` on `cumulative_budget` grounds in v0.8. There is no `ruleType` value reserved for cumulative-budget violations (see §3.2). Verifiers and evaluators MAY surface an out-of-band advisory signal (e.g. an `over_budget_advisory` flag in their result envelope), but this signal is NOT a `PolicyEvaluationCredential` verdict.
4. `verify()` (or its equivalent in any conforming verifier) MUST surface the declared `cumulative_budget` in its result when the field is present.
5. **Same-currency only.** Where attestation history is available and a verifier computes an advisory spent/remaining figure, only prior settled spends in the same currency as `cumulative_budget.amount.currency` are summed. Cross-currency prior spends MUST be reported separately as uncountable; they MUST NOT be normalised, converted, or rate-translated. The v0.8 evaluator carries no FX or price oracle and MUST NOT acquire one for this purpose — doing so would import settlement truth into a credential layer whose role is verification.
6. The credential remains the authoritative scope of authority. Cumulative-spend accounting state lives outside the credential and is reconstructed from attestation history (see §3 `PolicyEvaluationCredential` and downstream settlement-attestation records). The cumulative figure surfaced by a verifier is a projection of that history, not a credential field.

Deliberately deferred (out of scope for v0.8, reserved for future draft):

- Binding cumulative enforcement (a `decision: "deny"` on cumulative grounds).
- Rolling-window or calendar-period semantics (`daily`, `monthly`, `2026-Q3`, etc.).
- Per-rail amount denomination for both `per_transaction_ceiling` and `cumulative_budget` (the single-scalar shape above is provisional; a per-rail-map variant is under discussion).
- Any cross-currency normalisation path.

### 1.3 Reserved advisory fields on the spending mandate

`actionScope` reserves two additional optional sub-objects in v0.8. Like `cumulative_budget` (§1.2) they are **expression-only, advisory** — verifiers MUST surface them when present, but they MUST NOT ground a `PolicyEvaluationCredential` deny in v0.8. Binding semantics for either is deferred to a future draft and will be introduced with explicit `ruleType` values at that point.

#### `allowed_counterparty_types`

Closed list of permitted counterparty classes. Constrained shape:

| Field | Type | Description |
|---|---|---|
| (top-level) | array of strings | Each entry is a counterparty-class label drawn from `verified_merchant`, `kyb_verified_org`, `peer_agent`, `sovereign_self_attested`. Future drafts may extend this enum; verifiers SHOULD ignore unknown values rather than fail. |

In v0.8 this is an advisory declaration of intent; it is not a deny grounds. Binding counterparty-class enforcement on the spending surface is reserved.

#### `geographic_restriction`

Constrained shape:

| Field | Type | Description |
|---|---|---|
| `allowed` | array of strings | ISO 3166-1 alpha-2 country codes; if present, counterparty SHOULD belong to one of these. |
| `disallowed` | array of strings | ISO 3166-1 alpha-2 country codes; if present, counterparty SHOULD NOT belong to any. |

Same advisory-only status as above. Geographic enforcement on the **trading** surface (§2.3 `tradingMandate.geographic`) is binding under v0.8; the spending-surface counterpart is reserved.

#### Held: `allowed_merchant_categories`

A categories-namespace collision with `allowed_transaction_categories` is unresolved as of v0.8 draft-1 — broadly: whether the v0.8 spending mandate has one categories field describing the action ("what is being purchased") or two distinguishing action-category from merchant-category (e.g. MCC-style). The field is **not reserved** in v0.8 and MUST NOT appear in conforming credentials; a future draft will define exactly one of: (a) a single, renamed categories field; (b) two clearly-distinguished fields. Issuers that need a merchant-class taxonomy in the interim SHOULD encode it through `allowed_counterparty_types` (§1.3).

#### Closure

`actionScope` closes `additionalProperties: false` in v0.8. The complete enumerable property set is: `allowed_rails`, `per_transaction_ceiling`, `allowed_transaction_categories`, `cumulative_budget`, `allowed_counterparty_types`, `geographic_restriction`. Any other property is a schema violation.

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
| `ruleType` | string | One of: `amountLimits`, `actionScope`, `counterparty`, `temporal`, `geographic`, `velocity`, `authorization`. See enum semantics below. |
| `ruleField` | string | The specific field that failed, e.g. `maxNotionalPerOrder`, `maxTransactionValue`, `rails`, `allowedActions`, `requireIssuerClassIn`, `dailyVolumeCap`. |
| `message` | string | Human-readable explanation. |
| `currentValue` | any | Optional. The state value at evaluation time (e.g. current rolling daily volume). |
| `proposedValue` | any | Optional. The proposed change (e.g. the proposed transaction notional). |

`ruleType` enum semantics (the surface is implied; `ruleField` disambiguates within the surface):

| `ruleType` | Surface | Covers |
|---|---|---|
| `amountLimits` | both | Per-action amount-bound violations on either surface: `actionScope.per_transaction_ceiling` (spending) or `tradingMandate.maxNotionalPerOrder` / `tradingMandate.maxPosition` (trading). |
| `actionScope` | spending | Scope-list violations on `actionScope`: `allowed_rails`, `allowed_transaction_categories`. |
| `counterparty` | trading | `tradingMandate.counterparty.*` (§2.1). |
| `temporal` | trading | `tradingMandate.temporal.*` (§2.2). |
| `geographic` | trading | `tradingMandate.geographic.*` (§2.3). |
| `velocity` | trading | `tradingMandate.velocity.*` (§2.4). |
| `authorization` | spending | Violations of the `authorizationLevel` / `authorizationConfig` gate (e.g. a recurring-payment proposal whose terms exceed the recurring schedule, or a policy-level proposal that fails its policy-id binding). |

Verifiers consuming a deny credential SHOULD route on `ruleType` first and use `ruleField` for field-level handling. The enum is closed for v0.8; future ruleType values are added via a numbered draft.

**Currency-mismatch denials.** When a proposed action's amount currency differs from the relevant ceiling's currency (e.g. `proposal.amount.currency != actionScope.per_transaction_ceiling.amount.currency`), the action MUST be denied with `ruleType: amountLimits` and a `ruleField` naming the ceiling. The evaluator MUST NOT perform currency conversion to make the comparison succeed. The `message` SHOULD identify the mismatch explicitly. This rule applies symmetrically to `tradingMandate.unit`-denominated ceilings.

**Advisory-field exclusion.** No `ruleType` value is defined in v0.8 for any of the spending-surface advisory fields:

- `actionScope.cumulative_budget` (§1.2)
- `actionScope.allowed_counterparty_types` (§1.3)
- `actionScope.geographic_restriction` (§1.3)

A `PolicyEvaluationCredential` MUST NOT carry a `decision: "deny"` whose sole or primary justification is the violation of any of these fields. Their binding counterparts are reserved for a future draft and will introduce explicit `ruleType` values at that point. Verifiers MAY surface advisory signals out-of-band (e.g. on their own result envelopes), but those signals are not v0.8 verdicts.

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
| Permissions — *what is it allowed to do?* | v0.6 `actionScope` (spending: `allowed_rails`, `per_transaction_ceiling`, `allowed_transaction_categories`, gated by `authorizationLevel` / `authorizationConfig`; v0.8 adds optional advisory `cumulative_budget` per §1.2) and v0.7 `tradingMandate` core fields + v0.8 sub-objects (`counterparty`, `temporal`, `geographic`, `velocity`). Sibling mandate surfaces — see §1.1. **Both live in v0.8.** |
| Policy / Approval — *did this action fall within the mandate?* | v0.8 `PolicyEvaluationCredential` — signed decision bound to the specific proposed action and the specific delegation. **Live in v0.8.** |
| Auditability — *what happened, provably?* | Ed25519-signed credential events on Observer Protocol; the chain of (delegation → evaluation decision → trade-shaped audit record) is available end-to-end. The trade-shaped audit record (v1) and holder-signed verifiable presentations remain in scope for subsequent work. |

Three of the four controls are now backed by cryptographically-verifiable credentials. Audit (the fourth) gains its mid-layer artifact (the evaluation credential); the final artifact (the trade-shaped record) is unchanged from v0.7.

---

## 6. Scope boundary (what v0.8 does NOT define)

v0.8 is the credential-and-decision layer. It does NOT define:

- **Wallet integration mechanics.** How a specific wallet implementation (WDK, Aqua/Liquid, others) invokes the evaluator, caches binding data, and surfaces denials to its user is an integration concern, not a protocol concern. Reference integration guides ship separately.
- **Evaluator state management.** Where running counters for velocity rules are maintained, how attestation data is fetched and cached, and how the evaluator interacts with the OP attestation registry are implementation concerns.
- **Binding cumulative-budget enforcement.** v0.8 ships `cumulative_budget` as expression-only (§1.2). A future draft will define the rolling-window vocabulary, the reset/timezone semantics, and the binding-deny path; until that draft, claims of cumulative enforcement under v0.8 are NOT supported.
- **Currency conversion in evaluators.** The evaluator carries no FX or price oracle. Cross-currency amounts are denied (per §3.2) or reported as uncountable (per §1.2(5)); they are never normalised.
- **Per-rail amount denomination.** Whether `per_transaction_ceiling` and `cumulative_budget` SHOULD carry a single `{amount.value, amount.currency}` scalar or a per-rail map is under discussion. v0.8 specifies the scalar shape provisionally; a future draft may add the per-rail variant.
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
    "id": "https://observerprotocol.org/schemas/delegation/v2.1.json",
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

### Deny case — `actionScope` (spending mandate)

A proposed payment exceeds the per-transaction ceiling on the spending-mandate surface. The verdict shape is identical to the trading-mandate case — `ruleType` and `ruleField` route the consumer to the violated surface.

```json
{
  "@context": ["https://www.w3.org/ns/credentials/v2"],
  "id": "urn:uuid:policy-eval-demo-spending-deny",
  "type": ["VerifiableCredential", "PolicyEvaluationCredential"],
  "issuer": "did:web:observerprotocol.org",
  "validFrom": "2026-05-24T14:31:08Z",
  "credentialSubject": {
    "decision": "deny",
    "denyReason": {
      "ruleType": "amountLimits",
      "ruleField": "per_transaction_ceiling",
      "message": "Proposed payment exceeds actionScope.per_transaction_ceiling.",
      "currentValue": { "amount": "25000", "currency": "USDT" },
      "proposedValue": { "amount": "40000", "currency": "USDT" }
    },
    "evaluatedAgainst": {
      "delegationCredentialId": "urn:uuid:observer-delegation-spending-example",
      "delegationCredentialHash": "<sha256-hex of canonical delegation bytes>"
    },
    "proposal": {
      "proposalHash": "<sha256-hex of canonical proposed-action bytes>",
      "rail": "usdt_tron"
    },
    "evaluator": {
      "id": "urn:observer-protocol:evaluator:policy-core-v1",
      "version": "policy-core-1.0.0"
    },
    "evaluatedAt": "2026-05-24T14:31:08Z",
    "evaluatedWithAttestations": true
  },
  "proof": {
    "type": "Ed25519Signature2026",
    "created": "2026-05-24T14:31:08Z",
    "verificationMethod": "did:web:observerprotocol.org#key-3",
    "proofPurpose": "assertionMethod",
    "proofValue": "z<base58btc-Ed25519-signature>"
  }
}
```

Spending-mandate amount values carry their own `{ amount, currency }` shape per §1.2. They do not inherit the `tradingMandate.unit` field.

Note: no `cumulative_budget`-grounded deny example is given — by §1.2(3) and §3.2 the protocol does not emit one in v0.8.
