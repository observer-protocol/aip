# Agentic Identity Protocol — Specification v0.9

**Observer Protocol**
**Status:** Draft 1 — published for technical review
**Date:** June 2026
**Co-designer:** @Jonta254 (HumanChain reference implementation)

This document extends [AIP v0.8](./aip-v0.8-draft-1.md), which extends [v0.7](./aip-v0.7-draft-1.md) and [v0.6](./aip-v0.6-draft-1.md). v0.9 adds one thing on top of v0.8:

- A new credential type, `WorldIDLinkageCredential`, which binds an Observer Protocol agent's credential to a World ID proof-of-personhood, composing Worldcoin's sybil-resistant human verification with OP's existing identity, delegation, and payment-attestation layers.

v0.9 is purely additive to v0.6–v0.8. Existing verifiers continue to operate without modification; v0.9 capability is opt-in by issuing or reading the new credential type. No existing credential, schema, or verification flow changes. Revisions will be published as numbered drafts in this repository with visible diff.

---

## Executive summary

AIP establishes, through v0.6–v0.8, *who an agent is* (the v0.6 credential chain: verified principal → agent DID → delegation credential), *what it is authorized to do* (v0.6 `actionScope`, v0.7 `tradingMandate`), and *whether a proposed action falls within that authority* (v0.8 `PolicyEvaluationCredential`). None of these layers answer a question that sybil-resistance-sensitive verifiers increasingly ask: *is there exactly one real human behind this agent, and is that human distinct from the humans behind every other agent?*

World ID answers precisely that question. v0.9 defines how an agent's OP credential is linked to a World ID proof-of-personhood so that the two compose, with the smallest possible addition to the protocol:

- `WorldIDLinkageCredential` is a new revocable Verifiable Credential, issued by Observer Protocol, that records "Observer Protocol verified a valid World ID proof for this agent's principal, yielding this nullifier." It is held alongside the agent's existing credentials (`PrincipalAttestationCredential`, `ObserverDelegationCredential`, `PolicyEvaluationCredential`) and presented selectively.
- Worldcoin remains the authoritative source of personhood. OP composes the signal; it does not re-issue personhood. No change is required on Worldcoin's side.
- No World ID identity material (no `identity_secret`, no raw proof beyond what is needed for one-time verification) is persisted by OP. The credential carries only the nullifier hash, the action, and the verification metadata.

The integration's load-bearing invariant is **OP-global nullifier scoping** to a single `(rp_id, action)` (§3): one human who claims multiple agents across all OP surfaces produces the *same* nullifier, which is what makes proof-of-personhood composable with delegation, payment history, and reputation across the protocol — rather than fragmented per surface.

---

## 1. Relationship to v0.6–v0.8

v0.9 changes nothing about v0.6, v0.7, or v0.8. It introduces one new credential type and reuses, without modification:

- The v0.6 identity model (did:web agents and principals), credential lifecycle (§5), and verification flow (§6). `WorldIDLinkageCredential` is a **revocable** credential in the sense of v0.6 §5.1: revocation is recorded in the OP revocation registry and surfaced via `credentialStatus`; the signed credential body is immutable.
- The v0.6 categorical attestation taxonomy (§4). The placement of `WorldIDLinkageCredential` in that taxonomy is given in §8.
- The v0.6 §7 bridging model for non-OP-native trust signals. World ID is exactly such a signal; §8 documents the binding as a fourth bridging pattern (ZK proof-of-personhood verification) alongside the three patterns in v0.6 §7.
- The eddsa-jcs-2022 signing surface in force across OP issuance. `WorldIDLinkageCredential` is signed identically to every other v0.9-era OP credential — a `DataIntegrityProof` with `cryptosuite: "eddsa-jcs-2022"` over the JCS-canonical credential — using an `assertionMethod`-valid key (§9).

A verifier that does not read `WorldIDLinkageCredential` is unaffected by its presence in an agent's credential set.

> **Cross-draft note (proof representation).** v0.9 worked examples and the v0.9 schema use the `DataIntegrityProof` / `eddsa-jcs-2022` proof shape that OP issuance and verification use as of the 2026-06 signing-surface migration. The v0.6–v0.8 worked examples and the `delegation/v2.x.json` schemas still depict the earlier `Ed25519Signature2026` shape and predate that migration; those drafts SHOULD be realigned to the current proof shape in a future editorial revision. That realignment is independent of v0.9 and does not affect v0.9 conformance.

---

## 2. The `WorldIDLinkageCredential`

### 2.1 Purpose

A `WorldIDLinkageCredential` is a Verifiable Credential issued by Observer Protocol that records the outcome of verifying a World ID proof-of-personhood and binds the resulting nullifier hash to an OP agent DID and the human principal behind it. It is the protocol-native form of the claim *"Observer Protocol verified a valid World ID proof for action `observer-protocol-agent-link`, producing this nullifier, and binds it to this agent."*

The credential is created at the human-claim step in the reference Sovereign implementation, where the human↔agent relationship is established (§5). It is **optional**: an agent is fully conformant without one. Linking is link-on-first-use and non-blocking — a human may claim and operate an agent with no World ID binding and add one later.

### 2.2 Subject and bindings

The credential's subject is the agent (`credentialSubject.id` is the agent DID); the credential additionally names the human principal it binds, in `humanSubject`.

This differs from the `PrincipalAttestationCredential` and the `ObserverDelegationCredential` in an important way. In both of those, the human principal is the **issuer** — the principal self-issues, signing with their own did:web key over an agent subject (the principal anoints/delegates to its agent). A `WorldIDLinkageCredential` cannot follow that pattern: the attested fact is *"OP verified a World ID proof,"* which only OP can assert, so **OP is the issuer**. The human principal is therefore carried as a claim field (`humanSubject`) rather than the issuer. A verifier confirms the binding refers to the agent's actual principal by matching `humanSubject` against the `issuer` of that agent's `PrincipalAttestationCredential` (which the principal self-issues). `humanSubject` holds the principal's own did:web DID — the same value that appears as that credential's `issuer`.

`credentialSubject` carries:

| Field | Type | Description |
|---|---|---|
| `id` | string (DID) | The OP agent DID this binding belongs to, e.g. `did:web:observerprotocol.org:agents:{agent_id}`. |
| `humanSubject` | string (DID) | The human principal's own did:web DID — identical to the `issuer` of the agent's self-issued `PrincipalAttestationCredential` (§2.2). The binding asserts that this principal completed World ID verification. |
| `worldIdNullifier` | string | The World ID nullifier hash returned by IDKit. Private; exposure is governed by §4. |
| `worldIdRpId` | string | The World ID 4.0 relying-party identifier (`rp_…`) the nullifier is scoped to. Under 4.0 a nullifier is only meaningful relative to `(rp_id, action)`, so the credential records the `rp_id` as the nullifier's **namespace anchor** — a nullifier without its `rp_id` is not independently interpretable. Single OP-controlled value across all OP surfaces (§3). |
| `worldIdAction` | string | The Worldcoin action the proof was generated for. In v0.9 this is the single OP-global value `observer-protocol-agent-link` (§3). The nullifier is scoped to `(worldIdRpId, worldIdAction)`. |
| `worldIdAppId` | string | The Worldcoin Developer Portal `app_id` (`app_…`) under which the action is registered — the portal/config identifier (deep links, portal settings), **not** the nullifier namespace (that is `worldIdRpId`). (§3, §13). |
| `verificationPath` | string | `"on-chain"` or `"off-chain"` — how OP verified the proof at bind time (§7). |
| `proofType` | string | `"action_proof"` (first issuance) or `"session_proof"` (every subsequent bind or re-bind). Assurance signal distinguishing a fresh one-time World ID action proof from OP re-asserting the stored nullifier via a session proof (§5.5). Not derivable from `priorBindingId`. |
| `verifiedAt` | string | ISO 8601 timestamp of when OP verified the proof and created the binding. |
| `priorBindingId` | string \| null | Nullable. On a re-bind after revocation, the `id` of the prior (revoked) `WorldIDLinkageCredential`. Absent or `null` on a first bind (§6). |

The credential top-level carries the standard envelope (`@context`, `id`, `type`, `issuer`, `validFrom`, `credentialSchema`, `proof`) plus an optional `credentialStatus` (§6). The credential `id` (a `urn:uuid`) is the **binding identifier** — it is the referent used by `priorBindingId` on a subsequent re-bind.

A `WorldIDLinkageCredential` has no intrinsic expiry: personhood does not lapse on a timer. `validUntil` is therefore optional and normally omitted. Withdrawal of the binding is handled by revocation (§6), not expiry.

### 2.3 What the credential does and does not assert

The credential asserts a narrow, cryptographically-verifiable fact: a valid World ID proof for the OP-global action was presented and verified by OP, yielding the recorded nullifier. It does **not** assert, and verifiers MUST NOT read it as asserting, that the underlying human is of any particular jurisdiction, identity, or standing. The personhood assurance itself originates from Worldcoin's orb-verification system; per v0.6 §6.2, AIP makes the binding verifiable and the verifier decides how much to trust Worldcoin's personhood guarantee for its use case.

---

## 3. Nullifier scoping: OP-global `(rp_id, action)`

Under World ID 4.0 a nullifier is scoped to the pair `(rp_id, action)`. v0.9 fixes both to single, stable, OP-global values: one OP-controlled relying-party identifier `rp_id`, and the action

```
observer-protocol-agent-link
```

The same human presenting for the same `(rp_id, action)` yields the **same** nullifier, everywhere. Fixing both to OP-global values means a human who claims multiple agents — on `sovereign.agenticterminal.io`, the enterprise surface, or any future OP surface — produces the **same** nullifier across all of them. This is the foundational invariant that makes sybil-resistance hold protocol-wide rather than per-surface.

Normative requirements:

1. `credentialSubject.worldIdAction` MUST equal `observer-protocol-agent-link`, and `credentialSubject.worldIdRpId` MUST equal OP's single OP-global `rp_id`, for all v0.9 `WorldIDLinkageCredential`s. A credential carrying any other action or `rp_id` value is not a conforming v0.9 binding.
2. All OP surfaces issuing v0.9 bindings MUST present under that same OP-controlled `rp_id`, so that the nullifier — scoped to `(rp_id, action)` — is genuinely OP-global and not silently re-fragmented per surface. The action is registered in the Worldcoin Developer Portal under an OP-controlled `app_id`; the `app_id` is the portal/config identifier and does **not** scope the nullifier (that is the `rp_id`). See §13 open items.
3. Within OP, "same nullifier ⇒ same human" is an intended, composable property — not a privacy leak to be defended against. The anti-correlation boundary is OP as a whole; §4 governs exposure *outside* that boundary.

**Alternative considered and rejected.** Per-surface `rp_id` scoping would give stronger privacy isolation between OP surfaces, but the resulting per-surface nullifiers would make "one nullifier = one human" hold only within a single surface, fragmenting sybil-resistance and defeating the composable-identity property OP is built on. Per-surface scoping fights OP's architecture; a single OP-global `rp_id` aligns with it. Multi-action schemes are out of scope for v0.9 (§11).

---

## 4. Exposure: the nullifier hash is private

The `worldIdNullifier` is recorded inside the (signed, gated) `WorldIDLinkageCredential` and is available to verifiers with a legitimate reason to check it, via scoped credential exchange. It is **not** exposed on the public agent profile.

The public agent profile (`GET /agents/{agent_id}/profile` in the reference implementation, §A.2) surfaces only:

- `human_verified`: a boolean, `true` iff the agent holds at least one `WorldIDLinkageCredential` that is not revoked (§6).
- The issuer of the binding (Observer Protocol).
- The binding timestamp (`verifiedAt`).
- The revocation state, as resolved from the registry (§6).

Normative requirements:

1. The `WorldIDLinkageCredential` is a **gated credential**: it is held holder-canonically (v0.6 §5.1) and disclosed only to verifiers via scoped Verifiable Presentation. OP MUST NOT serve the credential body, or the raw `worldIdNullifier`, from any unauthenticated public endpoint.
2. The public profile MUST expose only the derived `human_verified` boolean and the non-correlating metadata above. It MUST NOT expose `worldIdNullifier`, `humanSubject`, or `worldIdAppId`.
3. A verifier that obtains the credential through scoped exchange MAY read `worldIdNullifier` to test the sybil-resistance invariant (e.g. "is this the same human as agent X?"). This is the intended use; it is available only to parties the holder has chosen to present to.

**Rationale.** OP-global scoping derives its sybil-resistance value from the *invariant* ("one human = one nullifier within OP"), not from publishing the nullifier. Keeping the value out of public view prevents trivial correlation by any third party scraping agent profiles, while preserving the property for verifiers that have been presented the credential. This preserves as much of World ID's privacy intent as the OP-global mechanic allows.

---

## 5. Binding flow: IDKit on-device, no server-side identity custody

The link-on-first-use flow at the human-claim step in the reference Sovereign implementation:

1. The human initiates linking from the agent-claim screen in Sovereign, after they have claimed the agent and signed the `PrincipalAttestationCredential`.
2. Sovereign invokes IDKit; the native World App opens.
3. The human confirms with biometric. World App generates a zero-knowledge proof **on-device** for the OP-global action.
4. The proof and nullifier hash are returned to Sovereign.
5. Sovereign POSTs the proof to the OP binding endpoint (§A.1).
6. OP's binding endpoint verifies the proof using Worldcoin's verifier — on-chain or off-chain (§7).
7. On successful verification, OP issues the `WorldIDLinkageCredential` (§2), signing it with the binding key (§9).
8. The binding is recorded holder-canonically; the public profile's derived `human_verified` becomes `true`.

Normative requirements:

1. World ID identity material MUST NOT be persisted by OP. The `identity_secret` never leaves the device; the raw proof is retained only as long as needed to complete verification in step 6 and is not stored thereafter. The only World ID-derived value persisted is the `worldIdNullifier` recorded in the credential.
2. Proof generation MUST occur on-device in World App (steps 2–3). OP MUST NOT request, receive, or reconstruct the `identity_secret`.
3. Verification (step 6) MUST succeed before the credential is issued. A binding credential MUST NOT be issued for an unverified or failed proof.

**Surface friction: mini-app vs. external web app.** Proof-generation friction depends on where the human initiates linking. In an in-World-App mini-app context the IDKit prompt is native to World App and near-zero friction: the human is already inside the app, holding their World ID, and confirms in place. An external web app cannot invoke World App inline. On desktop it renders a QR code the human scans with their phone; on mobile it hands off via a deep link. Either path requires the human to have their phone with World App present to complete the proof. The reference Sovereign implementation is an external web app and takes the QR/deep-link route; the binding flow (steps 1 to 8) and the issued credential are identical across both surfaces, only the on-device handoff in steps 2 to 4 differs.

### 5.5 Proof model: one action proof, then session proofs (World ID 4.0)

World ID 4.0 makes nullifiers strictly **one-time-use** per `(rp_id, action)`. This shapes how binding and re-binding work, and is the load-bearing constraint for §6.

**Two proof types.**

- **Action proof (first issuance).** The initial bind presents a World ID *action proof* for the OP-global action `observer-protocol-agent-link`. This is the one-time proof; the nullifier it yields is the canonical `worldIdNullifier` recorded in the credential (§2.2) and is the value that carries OP-global sybil-resistance (§3). Verifying it also **opens a session** for that human against OP.
- **Session proof (every subsequent bind or re-bind).** Once a session is open, each later bind — a second agent for the same human, or a re-bind after revocation — is a World ID *session proof* against that session's `session_id`. Session proofs use a randomized action, so they return a `session_nullifier` that is unique per proof and enforces **no** uniqueness constraint: they never collide, and they never consume the one-time action nullifier.

**OP re-asserts; it does not re-prove.** Because the action proof is one-time and cannot be re-derived, a session-proof binding does not carry a freshly-proven nullifier. OP looks up the human's canonical nullifier from its session store (keyed by `session_id`) and **re-asserts** it as the `worldIdNullifier` of the new binding. The nullifier is stable across a human's bindings because OP records it once and vouches for it thereafter — not because it is re-proven.

**`session_id` is internal to OP verifier state and never appears in the credential body.** It would otherwise be a stable correlation handle across every agent a human binds — the same linkability surface §4 gates the nullifier to prevent. Same-human lineage is already available to authorized verifiers via the gated `worldIdNullifier` plus the `priorBindingId` chain (§6); exposing `session_id` would add only leakage, not auditability.

**`proofType` is carried in the credential body** (§2.2) so a verifier can tell a fresh one-time proof from an OP re-assertion: `action_proof` for first issuance, `session_proof` for every subsequent bind. An `action_proof` binding rests on a fresh one-time Worldcoin proof; a `session_proof` binding rests on OP's session state. This is **not** derivable from `priorBindingId` — a *second agent* for the same human is a first bind (`priorBindingId: null`) issued via a session proof. Adding this field is a schema change: `worldid-linkage-v1.json` is `additionalProperties: false`, so v0.9 issues against `worldid-linkage-v2.json` with v1 frozen per the schema-immutability policy.

**Session lifetime is indefinite at the Worldcoin layer; recency is an OP-layer concern.** Periodic re-proof via a fresh *action* proof is not available: a second action proof from the same human collides on the one-time nullifier and the authenticator refuses it. The only way to obtain periodic fresh action proofs is to *rotate the action*, which v0.9 rejects because it fragments the one-human-one-nullifier invariant the design rests on (§3). A fresh *session* proof re-proves nothing about personhood. The legitimate need behind expiry — *how recently was this link asserted* — is served at the OP layer by `verifiedAt` and re-bind recency along the `priorBindingId` chain (§6). This matches the protocol layering: **World ID answers "same human," OP answers "current standing."**

**Durability, not a lockout cliff.** The session layer is recoverable by design: a lost `session_id` can be re-created with a fresh `oprf_seed`, yielding a new session with no one-time consumption. What is genuinely one-time is the canonical action nullifier, which OP records in the (holder-canonical, v0.6 §5.1) credential at first issuance. OP's `session_id → canonical-nullifier` map is therefore **load-bearing for issuance integrity**: losing it does not lock the human out at the Worldcoin layer — a session is re-creatable and the holder retains their binding credential — but it does break OP's ability to correlate an ongoing session back to the canonical nullifier without the holder re-presenting that credential. OP **MUST** persist this map durably, backed up alongside the issuance-key custody posture. True unrecoverability requires a *two-sided* loss — OP's map **and** the holder's credential both gone — because the action nullifier cannot be re-derived. Account recovery does not change this: recovery re-registers authenticators while preserving the account's `leafIndex`, from which the nullifier derives, so it reproduces the *same* nullifier rather than resetting it.

**Assurance note: one-time-use is authenticator-enforced.** The one-time guarantee is enforced by the **authenticator**, which queries the Oblivious Nullifier Pool and declines to emit a repeat proof — not by pool-side or RP-side rejection of a submitted proof. It therefore rests on an honest-authenticator assumption, within Worldcoin's trust model. A `WorldIDLinkageCredential` attests that OP verified a valid proof under that model; verifiers weighing assurance SHOULD account for it.

---

## 6. Revocation: monotonic at the World ID layer, OP overlays binding state

This is the section that requires the most care, because the underlying constraint shapes the model.

**Constraint.** A World ID nullifier, once issued for a given action, is permanent. There is no protocol-level mechanism to revoke a nullifier on Worldcoin's side. The `(human, action)` → nullifier mapping is monotonic and exists forever in Worldcoin's domain once verified.

**OP's model.** OP layers a revocable binding-state construct on top of the monotonic World ID layer, using the existing v0.6 §5.1 revocation machinery rather than a mutable field:

- The `WorldIDLinkageCredential` body is **immutable** once signed. Its active/revoked state is **not** a field inside the credential; it is recorded in the OP revocation registry and referenced from the credential via `credentialStatus` (a `BitstringStatusListEntry`, identical in mechanism to delegation-credential revocation).
- "Active" vs. "revoked" is therefore a **derived** state: a verifier resolves it by checking the status list referenced by `credentialStatus`, exactly as in the v0.6 §6 verification flow step 4. This keeps the signed credential immutable and consistent with how every other revocable OP credential is handled.

**Two layers, two use cases.** Verifiers choose which layer to trust:

- **Sybil-resistance use case** — trust the World ID layer. A *revoked* binding still proves "this human was verified into OP at least once," which is sufficient to prevent the same human from quietly creating a second, ostensibly-unlinked OP identity. The nullifier's existence is the signal.
- **Liveness use case** — trust the OP binding state. A revoked binding means the human has withdrawn consent for this binding; downstream systems that gate on *currently-active* personhood (e.g. the merchant-directory trust tiers) MUST treat a revoked binding as unverified.

**Re-binding.** A re-bind does **not** re-run the World ID action proof. Under World ID 4.0 the action nullifier for `observer-protocol-agent-link` is one-time-use and cannot be re-derived (§5.5), so OP instead **re-asserts the stored canonical nullifier** for that human — from its session store, via a session proof — and issues a new binding carrying that same `worldIdNullifier`. The nullifier is stable across a human's bindings not because it is re-proven, but because OP records it once at first issuance and vouches for it thereafter. v0.9 permits re-binding, with an audit-trail requirement:

1. A re-bind MUST be issued as a **new** `WorldIDLinkageCredential` (new `id`), with `priorBindingId` set to the `id` of the prior, revoked binding. It MUST NOT mutate the prior credential.
2. Where a human has bound, revoked, and re-bound more than once (credentials A → B → C), `priorBindingId` MUST reference the **immediately preceding** binding (C → B → A), not the original. The bindings therefore form a singly-linked list walkable from newest to oldest; a verifier reconstructs the full history by following `priorBindingId` until it reaches a binding whose `priorBindingId` is `null` (the first bind).
3. A verifier seeing a binding with a non-null `priorBindingId` can distinguish a re-bind from a first bind and can walk the chain of prior bindings for a complete, publicly-auditable history.
4. The prior credential is retained (its registry entry remains `revoked`); it is not deleted. Historical verification against it continues to resolve correctly.

**What revocation looks like in practice.**

- **User-initiated.** From Sovereign, the human revokes their binding. OP marks the binding revoked in the registry (`credentialStatus` resolves to revoked), retains the credential for historical verification, and the public profile's derived `human_verified` reverts to `false`.
- **Protocol-initiated.** Out of scope for v0.9 — no protocol-side revocation conditions are defined (§11).

---

## 7. Verification path: on-chain vs. off-chain

OP verifies the World ID proof (step 6 of §5) by one of two paths, recorded in `verificationPath`:

- **Off-chain.** OP's binding endpoint verifies the proof via World's cloud verification API — `POST https://developer.world.org/api/v4/verify/{rp_id}` (World ID 4.0; `rp_id` is the path parameter, `app_id` accepted only for backward compatibility). Faster and cheaper; suitable for the interactive link-on-first-use flow. **This is the v0.9 default at link time.**
- **On-chain.** OP's binding endpoint calls Worldcoin's on-chain verifier contract. Higher assurance, slower, incurs gas cost.

Normative requirements:

1. `verificationPath` MUST record which path was used (`"off-chain"` or `"on-chain"`), so a downstream verifier can weigh the binding's assurance.
2. Off-chain is the default for the initial bind. On-chain verification is available as an option for verifiers downstream who require stronger guarantees, but is not required for the initial bind.
3. A verifier consuming a binding MAY apply policy based on `verificationPath` (e.g. require `on-chain` for high-value flows). This is a verifier-policy decision (v0.6 §6.2), outside protocol scope.

**Verifier reliability and path selection.** Off-chain verification via the World Developer Portal endpoint (above) is the default: lower latency and operationally simpler, which suits the interactive link-on-first-use flow. On-chain verification of the Semaphore proof on World Chain is the trustless fallback for verifiers that require it, at the cost of latency and gas. Because the path actually used is recorded in the credential body (`verificationPath`, §2.2), a verifier can read it to weigh each binding's trust level rather than relying on an out-of-band claim, and OP can migrate its default verification path over time without re-issuing existing bindings: every credential self-describes how it was verified, so bindings issued under different paths remain individually interpretable side by side.

---

## 8. Placement in the attestation taxonomy

`WorldIDLinkageCredential` sits in the v0.6 §4 categorical taxonomy as follows:

- **Trust level: Level 5 (Protocol attested).** OP verifies the World ID ZK proof cryptographically and can confirm, from the proof itself, that a valid proof for the OP-global action was presented — without trusting any attestor's say-so. The binding fact is therefore protocol-attested in the v0.6 §4.1 sense.
- **Scope: Identity.** The claim is about who is behind the agent (a verified, unique human principal).

This is a careful, narrow placement. Level 5 applies to *the cryptographic fact that a valid World ID proof was verified*, not to a protocol guarantee that the human is "real" in any richer sense — that assurance is Worldcoin's, and verifiers weigh it themselves (§2.3). The binding constitutes a **fourth bridging pattern** beyond the three in v0.6 §7:

> **§7.x (informative) ZK proof-of-personhood verification.** A non-OP-native personhood system (Worldcoin) issues a zero-knowledge proof to a human on-device. An OP-resolvable issuer (Observer Protocol) verifies that proof cryptographically and issues an AIP-native credential binding the resulting nullifier to an agent. Unlike wrapper attestation (§7.1), OP does not restate an external party's claim on trust — it verifies a cryptographic proof directly. Unlike counterparty challenge-response (§7.2), the proven property is personhood, not control of a payment destination. Verifiers trust the binding to the extent they trust Worldcoin's personhood system, which is surfaced (not decided) by OP.

---

## 9. Signing key (`#key-4`)

`WorldIDLinkageCredential` is issued by the OP server at the moment of binding (step 7 of §5), on an interactive path that cannot wait on an offline-custody signer. It therefore cannot be signed by the offline-custody `#key-2`. The v0.8 server key `#key-3` is, by governance norm (v0.8 §3.4), scoped to `PolicyEvaluationCredential` issuance only and MUST NOT be reused here.

v0.9 introduces a scoped on-server signing key, `did:web:observerprotocol.org#key-4`, with the following properties (mirroring v0.8 §3.4):

- Added to the issuer DID document's `assertionMethod` array, alongside `#key-2` (offline) and `#key-3` (policy evaluator).
- Held only on the OP binding server, under restricted file permissions.
- Scoped by governance to `WorldIDLinkageCredential` issuance only. Other credential types continue to be signed by their existing keys (`ObserverDelegationCredential` / `OrganizationalMembershipCredential` by offline `#key-2`; `PolicyEvaluationCredential` by `#key-3`).
- Rotated independently. Compromise of `#key-4` invalidates binding credentials issued by it but does not threaten delegation, organizational, or policy-evaluation credentials.

The scoping is a governance norm, not a cryptographic enforcement. The OP issuer's key-scoping policy at `https://observerprotocol.org/.well-known/key-scoping.json` is extended to enumerate `#key-4 → WorldIDLinkageCredential`. Verifiers concerned with operational scoping MAY check a binding's `proof.verificationMethod` against that policy.

**Operational prerequisite.** Provisioning `#key-4` — generating the key on the binding server, adding it to the issuer DID document's `assertionMethod`, and publishing the updated `key-scoping.json` — is an operational prerequisite to issuing v0.9 bindings in production. Until `#key-4` is live in the DID document's `assertionMethod`, binding credentials will not pass v0.6 §6 verification.

---

## 10. Verification

v0.9 introduces no new credential-verification flow. A `WorldIDLinkageCredential` is verified using the standard v0.6 §6 procedure:

1. Parse the credential; extract issuer DID, subject (agent) DID, `humanSubject`, credential type, `validFrom`, and the binding fields.
2. Resolve the issuer DID (`did:web:observerprotocol.org`).
3. Validate the proof (`DataIntegrityProof` / `eddsa-jcs-2022`) against the key named in `proof.verificationMethod` (`#key-4`), which MUST be present in the issuer DID document's `assertionMethod` array.
4. Resolve revocation state via `credentialStatus` (§6). A revoked binding is handled per the verifier's use case (§6, sybil-resistance vs. liveness).
5. Confirm `validFrom` is in the past (and `validUntil`, if present, is in the future).
6. Apply verifier-specific policy: how much to trust Worldcoin's personhood assurance (§2.3), whether `verificationPath` is sufficient (§7), and how to treat a revoked binding (§6).

Steps 2–5 are protocol-level; step 6 is verifier-specific and outside protocol scope, consistent with v0.6 §6.2.

The proof of personhood itself (the World ID ZK proof) is verified **once**, by OP, at bind time (§5 step 6). Downstream verifiers do not re-verify the ZK proof; they verify OP's signed `WorldIDLinkageCredential` attesting that OP performed that verification. A verifier wanting independent assurance MAY require `verificationPath: "on-chain"` and independently inspect the on-chain verification, but that is a policy choice, not a protocol requirement.

---

## 11. Scope boundary (what v0.9 does NOT define)

v0.9 is the credential-and-binding layer for World ID linkage. It does NOT define:

- **Protocol-side revocation triggers.** v0.9 defines only user-initiated revocation (§6). Conditions under which the protocol itself would revoke a binding are not defined.
- **Cross-protocol nullifier composition.** Combining OP's World ID nullifier with other proof-of-personhood signals (e.g. BrightID, Gitcoin Passport) into a composite personhood score is out of scope.
- **On-chain anchoring of `WorldIDLinkageCredential`s.** Committing binding credentials or their hashes on-chain is deferred (see the v0.6 §11 audit-anchoring direction and the ERC-8004 work).
- **Multi-action schemes.** Per-surface or per-purpose action scoping is deliberately rejected in favour of the single OP-global action (§3).
- **Worldcoin-side changes.** v0.9 requires none and defines none. Worldcoin remains the authoritative, unmodified personhood source.
- **Identity-material custody.** OP holds no World ID identity material (§5); how World App custodies the `identity_secret` is Worldcoin's concern.
- **Personhood semantics.** v0.9 does not define what "a verified human" entitles an agent to. Whether a verifier requires `human_verified`, and what it grants on the strength of it, is verifier policy.

Public claims of these capabilities under v0.9 are NOT supported.

---

## 12. Implementation and conformance

A conforming v0.9 implementation:

1. Issues `WorldIDLinkageCredential`s per §2, with `worldIdAction` fixed to the OP-global `observer-protocol-agent-link` and `worldIdRpId` to OP's single OP-global `rp_id` (§3); the action is registered in the Worldcoin Developer Portal under an OP-controlled `app_id` (portal config, not the nullifier namespace).
2. Performs World ID proof verification (§7) before issuance, persists no World ID identity material beyond the nullifier hash (§5), and does not expose the nullifier via any public endpoint (§4).
3. Signs binding credentials with an `assertionMethod`-valid key scoped to this credential type (`#key-4`, §9), using `DataIntegrityProof` / `eddsa-jcs-2022` over the JCS-canonical credential.
4. Records revocation via the OP revocation registry / `credentialStatus` (§6), never by mutating the signed credential, and issues re-binds as new credentials carrying `priorBindingId` (§6).
5. Derives the public `human_verified` boolean from the presence of at least one non-revoked binding (§4), and exposes nothing more on the public profile.
6. Verifies binding credentials per v0.6 §6 / §10.

---

## 13. Reference implementation and open items

HumanChain (by @Jonta254 — a World mini-app in active development) is the first reference implementation. HumanChain's Worldcoin Developer Portal submission has cleared: the World ID RP registration is **registered** on both mainnet and staging, with a live `app_id`. OP separately registered its own relying party per requirement 2 of §3 — `worldIdRpId: rp_181fddac15a80f71`, `worldIdAppId: app_0a7331ee5fd466ed5452e57ce01b587a` — and these are the real values used throughout this spec and in the Appendix B worked examples. The `worldIdAppId` field is no longer a placeholder.

Status of the points raised in Brian's review:

1. **Action registration mechanics — resolved.** OP registers `observer-protocol-agent-link` under its own OP-controlled `app_id`/`rp_id` (§3, §5.5), not per OP product surface. HumanChain remains the surface app and routes proofs through OP's binding endpoint (§A.1) rather than verifying independently.
2. **`rp_id` semantics across OP surfaces — specified, partially confirmed.** §3 requirement 2 normatively fixes a single OP-controlled `rp_id` for all OP surfaces. This is live and verified for Sovereign. It remains to be confirmed operationally as the enterprise surface and `agenticterminal.ai` come online, that they present under the same `rp_id` rather than registering their own.
3. **Proof-generation UX for non-mini-app contexts — resolved.** §5 now carries the friction note: the IDKit prompt is native and near-zero friction in a World App mini-app, while an external web app (the reference Sovereign surface) renders a QR on desktop or a deep link on mobile and requires the user's phone with World App present.
4. **Verifier reliability and latency — resolved.** §7 now fixes off-chain Developer Portal verification as the lower-latency default and on-chain Semaphore verification on World Chain as the trustless fallback, with the path recorded in `verificationPath` so verifiers can weigh assurance per binding. Empirical characterization of off-chain SDK behaviour under load remains a Sovereign deployment-time concern, not a spec gap.
5. **Portal-submission constraints — resolved.** No constraints from the Worldcoin Developer Portal registration process ended up shaping the binding flow or schema beyond what §2–§9 already specify.

---

## Appendix A — Reference implementation binding API (informative)

The endpoint shapes below are how the reference Sovereign / OP-server implementation realises §5–§6. They are **informative**, not normative: AIP defines the credential and its lifecycle (§2–§10); the transport is an implementation concern (v0.6 §1).

### A.1 Bind

`POST /api/v1/worldid/bind`

Request:
- `agent_did` — target agent DID
- `proof` — World ID ZK proof from IDKit
- `nullifier_hash`
- `merkle_root`
- `verification_path` — `on-chain | off-chain` (default `off-chain`)

Response (success):
- `binding_id` — the issued credential's `id`
- `credential` — the signed `WorldIDLinkageCredential`

Idempotency and multiplicity:
- **Same human, same agent, existing *active* binding:** idempotent — return the existing binding; do not issue a new credential.
- **Same human, same agent, existing *revoked* binding:** this is a re-bind, not an idempotent return. Issue a new credential with `priorBindingId` set to the revoked binding (§6).
- **Same human (same nullifier), *different* agent:** permitted. One human MAY bind multiple agents; the same nullifier is referenced by multiple `WorldIDLinkageCredential`s with different `credentialSubject.id`. This is the intended consequence of OP-global scoping (§3) — not an error.

Failure modes: invalid proof; verifier unreachable; action mismatch (proof generated for an action other than `observer-protocol-agent-link`).

### A.2 Revoke

`POST /api/v1/worldid/revoke`

Authorization: the caller MUST be authenticated as the `humanSubject` of the binding. Marks the binding revoked in the registry (§6). Idempotent.

### A.3 Read binding

`GET /api/v1/worldid/binding/{binding_id}`

Returns the `WorldIDLinkageCredential`, with `worldIdNullifier` visibility gated per §4 (scoped exchange only).

### A.4 Public profile

`GET /agents/{agent_id}/profile`

Extended to include `human_verified: bool`, derived from the presence of at least one non-revoked `WorldIDLinkageCredential` for the agent (§4). Exposes no nullifier, `humanSubject`, or `app_id`.

---

## Appendix B — Worked example: `WorldIDLinkageCredential`

A first bind (no `priorBindingId`), verified off-chain, issued by Observer Protocol to a claimed agent.

```json
{
  "@context": ["https://www.w3.org/ns/credentials/v2"],
  "id": "urn:uuid:worldid-linkage-example-v09-demo",
  "type": ["VerifiableCredential", "WorldIDLinkageCredential"],
  "issuer": "did:web:observerprotocol.org",
  "validFrom": "2026-06-06T14:00:00Z",
  "credentialSubject": {
    "id": "did:web:observerprotocol.org:agents:example-agent",
    "humanSubject": "did:web:example-principal.id",
    "worldIdNullifier": "0x2a3f...<nullifier-hash>",
    "worldIdRpId": "rp_181fddac15a80f71",
    "worldIdAction": "observer-protocol-agent-link",
    "worldIdAppId": "app_0a7331ee5fd466ed5452e57ce01b587a",
    "verificationPath": "off-chain",
    "proofType": "action_proof",
    "verifiedAt": "2026-06-06T14:00:00Z",
    "priorBindingId": null
  },
  "credentialSchema": {
    "id": "https://observerprotocol.org/schemas/worldid-linkage/v2.json",
    "type": "JsonSchema"
  },
  "credentialStatus": [
    {
      "id": "https://observerprotocol.org/status/worldid/1#42",
      "type": "BitstringStatusListEntry",
      "statusPurpose": "revocation",
      "statusListIndex": "42",
      "statusListCredential": "https://observerprotocol.org/status/worldid/1"
    }
  ],
  "proof": {
    "type": "DataIntegrityProof",
    "cryptosuite": "eddsa-jcs-2022",
    "created": "2026-06-06T14:00:00Z",
    "verificationMethod": "did:web:observerprotocol.org#key-4",
    "proofPurpose": "assertionMethod",
    "proofValue": "z<base58btc-Ed25519-signature>"
  }
}
```

A re-bind after revocation is identical except for a new `id`, a later `verifiedAt`, and `priorBindingId` set to the prior credential's `id`:

```json
{
  "id": "urn:uuid:worldid-linkage-example-v09-rebind",
  "credentialSubject": {
    "id": "did:web:observerprotocol.org:agents:example-agent",
    "humanSubject": "did:web:example-principal.id",
    "worldIdNullifier": "0x2a3f...<same-nullifier-as-before>",
    "worldIdRpId": "rp_181fddac15a80f71",
    "worldIdAction": "observer-protocol-agent-link",
    "worldIdAppId": "app_0a7331ee5fd466ed5452e57ce01b587a",
    "verificationPath": "off-chain",
    "proofType": "session_proof",
    "verifiedAt": "2026-07-01T09:30:00Z",
    "priorBindingId": "urn:uuid:worldid-linkage-example-v09-demo"
  }
}
```

The nullifier is identical across the original and the re-bind because OP **re-asserts the stored canonical nullifier** via a session proof (§5.5, §6) — it is not re-proven, since the one-time action proof cannot be re-run; the re-bind is issued with `proofType: "session_proof"`. The `priorBindingId` reference makes the re-bind distinguishable from a fresh bind and preserves the audit trail (§6). `worldIdRpId` is the nullifier's namespace anchor (§3); `worldIdAppId` is the portal/config identifier and does not scope the nullifier. The examples use OP's live `rp_id` / `app_id`.

A **second agent bound by the same human** is not a re-bind: it is a *first* bind for that agent (`priorBindingId: null`), but since the human's action-proof nullifier was already consumed at the first agent's bind, it is issued via a session proof rather than a fresh action proof:

```json
{
  "id": "urn:uuid:worldid-linkage-example-v09-second-agent",
  "credentialSubject": {
    "id": "did:web:observerprotocol.org:agents:example-agent-two",
    "humanSubject": "did:web:example-principal.id",
    "worldIdNullifier": "0x2a3f...<same-nullifier-as-before>",
    "worldIdRpId": "rp_181fddac15a80f71",
    "worldIdAction": "observer-protocol-agent-link",
    "worldIdAppId": "app_0a7331ee5fd466ed5452e57ce01b587a",
    "verificationPath": "off-chain",
    "proofType": "session_proof",
    "verifiedAt": "2026-07-10T11:15:00Z",
    "priorBindingId": null
  }
}
```

Note the combination that makes this case distinct from both examples above: `priorBindingId` is `null` (it is a first bind — for `example-agent-two`, not a re-bind of `example-agent`), yet `proofType` is `session_proof`, not `action_proof` (the human's one-time action-proof nullifier for `(rp_id, action)` was already spent binding `example-agent`, so this bind is OP re-asserting that same nullifier from session state, per §5.5). `priorBindingId` alone cannot distinguish this from the first worked example above; `proofType` is what carries that distinction, which is why it is a normative field in the credential body (§2.2, §5.5) rather than something a verifier could infer.
