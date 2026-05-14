# Agentic Identity Protocol — Specification v0.6

**Observer Protocol**
**Status:** Draft 1 — published for technical review
**Date:** May 2026

This document is a working draft. Substantive revisions may follow review by additional technical advisors. Implementations consuming this draft should expect non-breaking refinements before v0.6 final. Revisions will be published as numbered drafts in this repository with visible diff.

---

## Executive summary

The Agentic Identity Protocol (AIP) defines the minimal primitives needed to verify the identity of, and credentials about, autonomous agents transacting across payment rails. AIP is rail-agnostic: it operates uniformly whether the underlying settlement is Bitcoin/Lightning, EVM-based stablecoin, TRON, or any other supported rail. AIP is product-agnostic: it defines the cryptographic and structural primitives that any product can build on, without prescribing scoring, reputation interpretation, or attestation taxonomy beyond a categorical baseline.

AIP follows the W3C Decentralized Identifier (DID) and Verifiable Credential (VC) standards. Credentials are held by their subjects (holders), not by the protocol. The Observer Protocol server functions as resolver, verifier, and revocation infrastructure — not as a credential repository.

This specification covers the AIP scope, the categorical attestation taxonomy, the credential lifecycle for revocable and non-revocable credentials, the verification flow, and worked examples of how products built on AIP bridge non-OP-native trust signals into the protocol's verification framework.

Version 0.6 finalizes the migration to holder-canonical storage for delegation credentials. This is an architectural commitment made in earlier work and now consistently reflected in the protocol specification and reference implementations.

---

## 1. Protocol scope

AIP defines:

- DID-based identity for agents and other protocol participants, using did:web as the primary method
- The categorical attestation taxonomy: five attestor trust levels and eight scope types
- A revocable credential primitive (currently used for delegation credentials), with holder-canonical storage and server-side revocation registry
- A non-revocable credential primitive (currently used for attestation credentials), holder-canonical with no server-side storage
- Cryptographic verification of signed credentials and signed payment receipts
- DID resolution and revocation status APIs

AIP does not define:

- Attestation content schemas beyond the categorical taxonomy (specific schemas are product-layer concerns)
- Reputation scoring or interpretation logic
- Storage architecture for credentials issued by products built on AIP (products choose their own storage models)
- The trust judgments verifiers make about presented credentials (verifiers apply their own policy)
- Settlement rail mechanics (AIP operates uniformly across rails)
- Onboarding flows for non-OP-native attestors (bridging mechanisms are product-layer concerns, examples in Section 7)

The intent is a minimal protocol that is rail-agnostic, product-agnostic, and adoptable by any party building identity and credential infrastructure for autonomous agents.

## 2. Protocol and product separation

AIP is the protocol. Observer Protocol is the open-source reference implementation of AIP, providing the resolver, verifier, and revocation registry infrastructure. Agentic Terminal is one product built on AIP, providing attestation issuance, reputation scoring, and enterprise integration. AT is one of potentially many products that could be built on AIP. Other products — internal trust modules at institutional custodians, wallet-side policy engines, competing attestation services — can build on the same primitives.

The protocol-product separation matters for adoption. A party evaluating AIP as infrastructure should be able to adopt the protocol without depending on any specific product. The protocol's role is to make credentials verifiable. The product's role is to issue meaningful credentials and to interpret them for specific use cases. AIP makes the former possible; products compete on the latter.

A useful analogy: AIP is to agent credentials as DNS is to domain resolution. DNS resolves and verifies; it doesn't decide whether a domain is trustworthy. AIP resolves and verifies credentials; it doesn't decide whether an agent is trustworthy. Trust judgments belong to verifiers and the products that inform them.

## 3. Identity

### 3.1 DIDs and DID documents

Protocol participants are identified by Decentralized Identifiers per the W3C DID Core specification. The reference implementation uses did:web as the primary DID method. A DID resolves to a DID document containing public keys, verification methods, and service endpoints.

DID documents are hosted at standard did:web URLs and served by the OP server. This is consistent with the did:web specification, which mandates HTTPS-hosted DID documents. The OP server's role here is registry-and-resolver, not custodian of credential data.

### 3.2 Identity versus credentials

A DID document establishes that a public key exists and is associated with an identifier. It does not establish anything about the identified entity's authorization, reputation, or attested attributes. Those claims live in Verifiable Credentials issued by other parties (organizations, KYB providers, the protocol itself in narrow cases).

This separation is intentional. Identity is a stable property of a participant; credentials are time-bound and context-specific assertions about a participant. Mixing them produces brittle architectures where revoking a credential requires revoking an identity, which is rarely the intent.

## 4. The categorical attestation taxonomy

### 4.1 Five attestor trust levels

AIP defines five categorical trust levels describing the source of an attestation. The level indicates *who* is attesting; it does not encode any judgment about the truth or quality of the attestation itself. Verifiers and products built on AIP apply their own interpretation to the categorical signal.

| Level | Name | Meaning |
|-------|------|---------|
| 1 | Self-attested | The agent or principal is attesting about itself |
| 2 | Counterparty attested | A counterparty to a verified transaction is attesting about the agent |
| 3 | Partner attested | A third-party service (typically a KYB or compliance provider) has attested about the agent |
| 4 | Organization attested | A legal entity cryptographically asserts that the agent operates under its authority |
| 5 | Protocol attested | The Observer Protocol itself has cryptographically verified the claim |

Levels 1-4 represent attestations made by entities about the agent. Level 5 is reserved for assertions the protocol can verify directly from cryptographic evidence — typically payment-receipt verification from on-chain or on-network proofs, where the protocol can independently confirm an event occurred without trusting any attestor.

The distinction between Level 3 and Level 4 is worth making explicit: Level 3 (partner attested) means a third party has verified something *about* the agent without claiming authority over the agent. A KYB provider performing identity verification produces a Level 3 attestation. Level 4 (organization attested) means an organization cryptographically asserts the agent operates under its authority. A company authorizing an agent to act on its behalf produces a Level 4 attestation. The trust posture is different: Level 3 vouches for verification work performed; Level 4 takes responsibility for the agent's actions.

### 4.2 Eight attestation scope types

AIP defines eight scope types describing *what* an attestation is about. The scope is orthogonal to the level: a partner-attested attestation about compliance and an organization-attested attestation about identity are both meaningful, but they carry different categorical signals.

| Scope | Description |
|-------|-------------|
| Identity | Claims about who or what the agent is |
| Legal | Legal-entity claims, jurisdiction, regulatory standing |
| Compliance | Compliance verifications (KYB, KYC where applicable, regulatory checks) |
| Reputation | Behavioral or performance claims about the agent |
| Capability | Claims about what the agent can do or has been authorized to do |
| Transaction | Claims about specific past transactions involving the agent |
| Infrastructure | Claims about the agent's operational infrastructure |
| Custom | Product-defined attestation types that don't fit the above |

Not every combination of level and scope is meaningful. A self-attested compliance claim, for example, carries minimal weight because compliance is precisely the kind of claim that requires third-party verification to be useful. Protocol-attested legal claims are nonsensical because the protocol is not a regulated entity and has no standing to make legal assertions. Verifiers should expect the matrix of meaningful combinations to be sparse, and products built on AIP should constrain issuance to combinations that make sense in their domain.

### 4.3 What the taxonomy is and is not

The taxonomy defines categorical metadata that travels with every credential issued under AIP. It is not a scoring system. A Level 4 attestation is not "better than" a Level 3 attestation in any absolute sense — they describe different kinds of claims with different trust postures. A verifier evaluating an agent for a particular interaction may care more about a Level 3 KYB attestation than a Level 4 organization attestation, depending on what the interaction requires.

The taxonomy is intentionally minimal. Specific attestation schemas (what fields appear in a KYB credential, what data structure represents a transaction attestation) are out of AIP scope and belong to the products that issue specific credential types.

## 5. Credential lifecycle

AIP distinguishes between revocable and non-revocable credentials. The distinction is principled: a credential is revocable if the issuer or subject retains the standing to invalidate it, and non-revocable if the credential is a statement about a past event that cannot be undone.

### 5.1 Revocable credentials

Delegation credentials are the primary revocable credential type in current AIP usage. A delegation credential is a signed authorization from a principal to an agent, specifying what the agent is authorized to do, under what constraints, and for how long. The principal can revoke the delegation at any time prior to expiry.

**Issuance.** The principal signs a Verifiable Credential conforming to the W3C VC data model. The credential includes the principal's DID as issuer, the agent's DID as subject, the authorization claims, and validity dates. Signing is performed by the principal using their private key; the private key never leaves the principal's control.

**Server-side recording.** The OP server receives credential metadata: issuer DID, subject DID, credential type, validity window, credential hash. The server writes a revocation registry entry. Critically, the server does not receive or store the credential body itself. The credential, once signed, is returned to the holder for custody.

**Holder storage.** The holder (typically the agent, or a wallet operating on the agent's behalf) stores the credential in its own storage. AIP does not prescribe holder storage mechanics; browser-based agents typically use local browser storage, server-side agents typically use their own datastore. A holder may optionally publish the credential at a stable URL and register that URL with the OP server for discoverability; this is optional and controlled by the holder.

**Presentation.** When the holder needs to authorize an action with a verifier, it presents the credential to the verifier via standard W3C Verifiable Presentation mechanisms.

**Verification.** The verifier validates the credential by resolving the issuer's DID, validating the credential signature against the issuer's public key, and checking the revocation status by querying the OP server's revocation registry with the credential hash. If all three checks pass and the credential is within its validity window, the verifier accepts the credential.

**Revocation.** The principal initiates revocation by signing a revocation request with the same key used to sign the original credential and submitting it to the OP server. The server validates the revocation signature, updates the revocation registry entry, and notifies subscribed verifiers via webhooks. Subsequent verification queries against the credential hash return revoked status.

### 5.2 Non-revocable credentials

Attestation credentials are the primary non-revocable credential type. An attestation is a signed claim from an attestor about a subject — typically a counterparty attestation about a past transaction, a partner attestation about verification work performed, or an organization attestation about authority.

Non-revocable credentials reflect statements about past events. If the underlying facts change (the relationship between attestor and subject changes, the verification result is later disputed), the appropriate response is to issue a new attestation, not to revoke the old one. The historical record stands.

**Issuance.** The attestor signs a Verifiable Credential conforming to the W3C VC data model. The credential includes the attestor's DID as issuer, the subject's DID, the categorical metadata (trust level and scope), and the specific claims. Signing is performed by the attestor using a key bound to its DID.

**Storage and discoverability.** The credential is delivered to the subject (holder) for storage. The OP server does not store non-revocable credentials. Holders may publish credentials at stable URLs for discoverability or present them directly to verifiers via Verifiable Presentation mechanisms. Products built on AIP may operate their own indexes or registries for product-specific discoverability — those are product-level mechanisms, not AIP-level.

**Verification.** The verifier resolves the attestor's DID and validates the credential signature against the attestor's public key. Since the credential is non-revocable, no revocation check is required. The verifier evaluates the trust level and scope metadata to inform its trust judgment.

**No revocation flow.** There is no protocol-level revocation for non-revocable credentials. A correction or update is handled by issuing a new credential, which the verifier processes alongside (or in place of) older credentials according to its own policy.

### 5.3 Why the distinction matters

The revocable / non-revocable distinction directly governs what server-side infrastructure each credential type requires. Revocable credentials need a revocation registry; non-revocable credentials do not. By limiting server-side storage to what is strictly required, the protocol minimizes its custody footprint, reduces centralization risk, and aligns with the W3C VC data model's holder-canonical design.

This is the architectural principle that drove the v0.6 specification: the OP server holds revocation infrastructure for revocable VCs only. Everything else lives with the holder or with the product layer.

## 6. Verification

### 6.1 Verification flow

A verifier presented with a credential performs the following:

1. Parse the credential and extract the issuer DID, subject DID, credential type, validity window, and trust level / scope metadata
2. Resolve the issuer DID using standard DID resolution mechanisms
3. Validate the credential signature against the issuer's public key from the resolved DID document
4. For revocable credentials, query the OP revocation registry with the credential hash to check revocation status
5. Confirm the credential is within its validity window
6. Apply verifier-specific policy to the credential's claims and categorical metadata

Steps 2-5 are protocol-level operations supported by AIP infrastructure. Step 6 is verifier-specific and outside protocol scope.

### 6.2 What AIP guarantees, what verifiers decide

AIP guarantees that a credential's signature is cryptographically valid against an issuer's DID, that the credential is within its validity window, and (for revocable credentials) that it has not been revoked. These are the protocol's verification responsibilities.

AIP does not guarantee that the credential's claims are true. A signed attestation from Acme Corp asserting Agent X passed KYB is cryptographically verifiable as having come from Acme Corp — AIP confirms this — but whether Acme Corp's KYB process is rigorous, whether the claim accurately reflects reality, and whether the verifier should accept it for this particular use case are questions outside protocol scope.

This separation is deliberate. AIP makes credentials verifiable; verifiers make trust judgments. Products built on AIP can inform those trust judgments (a reputation product might aggregate attestations and produce a score; a compliance product might assert that certain attestors meet regulatory standards). But the protocol itself takes no position on trust beyond cryptographic verifiability.

## 7. Bridging non-OP-native trust signals

A consistent question for any agent-identity protocol is how to handle attestations from entities that do not natively participate in the protocol. Many real-world trust sources — established KYB providers, enterprise identity systems, regulatory data sources — are not OP-native and may never adopt AIP directly.

AIP does not define bridging mechanisms at the protocol level. Bridging is a product-layer concern. However, since this question arises frequently, this section documents three bridging patterns that products built on AIP can use.

### 7.1 Wrapper attestation

A product with an OP-resolvable DID can issue wrapper attestations that translate external trust signals into AIP-native credentials. For example, an attestation product receives KYB verification data from an external KYB provider, signs a wrapper attestation with the product's OP-resolvable DID, and issues that attestation to the agent. Verifiers trust the wrapped attestation to the extent they trust the product as an attestor, which is a function of the product's own reputation and accountability.

This is the most common bridging pattern. The product becomes the attestor of record. The external data source's involvement is documented in the attestation's claims but not directly verified by the protocol.

### 7.2 Counterparty challenge-response

A non-OP-native counterparty to a verified transaction can prove control of the payment destination (Lightning node pubkey, EVM address, etc.) by responding to a cryptographic challenge using the same key that controls the destination. The product issuing the attestation verifies the challenge-response and binds the attestation to the proven control.

This pattern is appropriate for Level 2 counterparty attestations where the counterparty is not OP-native but is provably the actual counterparty to a specific transaction. The cryptographic binding is strong even though the counterparty has not registered an OP DID.

### 7.3 Domain-control verification

A non-OP-native entity that operates a public web presence can prove control of a domain by publishing a verification document at a well-known endpoint, signed by a key the entity controls. Products can use domain control as a bridging mechanism for organization-level attestations from entities that do not have OP DIDs but have public web identity.

This pattern is weaker than the challenge-response pattern but more practical for organizations that lack the operational capacity to participate in cryptographic challenge-response flows. Products using this pattern typically assign lower categorical trust to the resulting attestations.

### 7.4 What this means for adoption

Products built on AIP can integrate with the existing trust ecosystem (KYB providers, enterprise IdPs, regulatory data sources) without requiring those parties to adopt AIP. The bridging mechanisms above show how external trust signals become AIP-native credentials signed by OP-resolvable products. This makes AIP adoptable in the actual operating environment for autonomous agents, which spans both crypto-native and traditional trust infrastructures.

## 8. Settlement rail neutrality

AIP operates uniformly across settlement rails. The protocol does not specify which rails are supported, what rail-specific data structures must be used, or how settlement events are observed. These are implementation concerns for products integrating AIP with specific rails.

The reference implementation currently supports x402/USDC on EVM-based chains, USDT on TRON, USDT on x402 protocols, and Bitcoin/Lightning via verified payment receipts. Additional rails can be added by implementing rail-specific receipt verification while keeping the credential and identity layer unchanged.

This neutrality is a deliberate design property. Protocols that bind identity infrastructure to a specific settlement rail force adopters to choose between rails. AIP allows adopters to choose rails based on their own commercial and technical needs while sharing the same identity and credential layer.

## 9. Implementation and conformance

The Observer Protocol open-source codebase is the reference implementation of AIP v0.6. Conformance to AIP requires:

- Implementing did:web (or a compatible DID method) for protocol participants
- Implementing W3C VC issuance and verification flows for revocable and non-revocable credentials
- Implementing a revocation registry that supports query by credential hash and signed revocation submissions
- Supporting the categorical attestation taxonomy (five levels, eight scope types) as credential metadata
- Implementing the verification flow specified in Section 6

Conforming implementations interoperate: credentials issued by one conforming product are verifiable by any other conforming verifier, subject to the verifier's policy on which issuers and which categorical signals it accepts.

## 10. Versioning and migration

AIP v0.6 supersedes v0.5. The primary changes from v0.5 to v0.6:

- Delegation credentials are holder-canonical. The OP server no longer stores the credential body for newly issued delegation credentials; it stores revocation registry entries only.
- Non-revocable attestation credentials are explicitly defined as holder-canonical with no server-side storage.
- The categorical attestation taxonomy is formalized in the specification.
- The protocol-product separation is documented explicitly.

Credentials issued under v0.5 patterns remain verifiable during a deprecation window. New credentials default to v0.6 patterns.

## 11. Open questions and future work

This specification reflects the state of AIP as of v0.6. Several questions remain open and may be addressed in future versions:

- **Multi-method DID support.** The reference implementation uses did:web. Other DID methods (did:key, did:peer, did:plc) may be added to support different deployment models, including offline-first agents and chain-native identity.
- **Audit anchoring.** Long-term audit infrastructure (committing credential hashes or revocation registry snapshots to immutable storage) is a candidate for future protocol work. Bitcoin-native commitment schemes such as OpenTimestamps are one approach under evaluation. No protocol commitment to a specific anchoring mechanism is made at this version.
- **Selective disclosure.** W3C VCs support selective disclosure of credential claims. AIP currently does not specify selective disclosure mechanisms; future versions may incorporate them as agent privacy requirements develop.
- **Cross-protocol federation.** Federation with other agent-identity protocols is a long-term direction worth exploring. AIP's W3C alignment makes federation feasible in principle.

These are surfaced for transparency about where the protocol is headed; they are not commitments to specific timelines or implementations.

---

## Appendix A: Glossary

**Agent.** An autonomous software process that transacts on a payment rail under cryptographic identity.

**AIP.** The Agentic Identity Protocol — the specification this document describes.

**Attestation.** A signed claim by one party (the attestor) about another party (the subject). Typically non-revocable.

**Credential.** A signed Verifiable Credential per the W3C VC data model. May be revocable (e.g., delegation) or non-revocable (e.g., attestation).

**DID.** Decentralized Identifier per the W3C DID Core specification.

**Holder.** The party that holds a credential and presents it to verifiers. Typically the credential's subject.

**Issuer.** The party that creates and signs a credential.

**Observer Protocol.** The open-source reference implementation of AIP.

**Principal.** A party (human or organization) that delegates authority to an agent.

**Subject.** The party a credential is about. For delegation credentials, the agent. For attestations, the agent.

**Verifier.** A party that receives and validates a presented credential.
