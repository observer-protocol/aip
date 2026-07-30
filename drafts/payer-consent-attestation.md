# Payer consent: scope

Status: scoping only. No code. Written before the mint so any coupling field it surfaces can be
reserved in the open v2.5 draft rather than costing a v2.6.

## The gap this closes

The inbound walkthrough found that nothing in the delegation vocabulary expresses the payer's consent to
being collected from. Every constraint in a mandate bounds what the agent may do on behalf of its
principal. On a collection, the party who needs protecting is the one the mandate does not represent.

A mandate can be fully satisfied while the payer never agreed to anything.

## Two models, and why the second is right

**Model A: a mandate issued by the payer.** The payer signs a delegation credential authorising
collection. Same object, same machinery, opposite direction, different principal. Most of the vocabulary
already applies and it is the elegant answer.

**Model B: an attestation referencing a consent that exists elsewhere.** A direct-debit mandate or a
stored-card consent is a real artifact governed by rail-specific rules. What gets issued is a signed
statement that such a consent exists, with its reference, not the consent itself.

**Model B, and the reason is the one the walkthrough already found.** A payer-consent credential we
issue is the principal asserting the payer's consent. That is the party who benefits from a control
supplying the evidence that the control was satisfied, which is the defect the whole inbound section was
about. Model A reproduces it with better structure.

Model B does not have the problem because the consent is governed by someone else's rules and we only
bind to it. The rail scheme, not the collector, decides whether the mandate is valid.

It is also the same shape as the decision attestation: **we attest to a thing something else produced,
and we do not produce the thing.** Second use of a pattern already scoped rather than a new one.

## Tested against SEPA direct debit

The test asked whether the attestation binds cleanly to a real consent artifact. It mostly does, and the
corrections are the value of having run it.

**1. The reference is composite, not a string.** A Unique Mandate Reference is unique per creditor, not
globally. Two creditors can both issue `UMR-0001`. A single `reference` field would let an attestation
bind to a mandate that is not the one it means. The binding is `(creditorIdentifier, mandateReference)`.

**2. Mandates mutate while keeping their reference.** SEPA permits amendment: the creditor changes, the
debtor changes IBAN, the scheme changes. The UMR survives all of it. So a binding to the reference alone
binds to something mutable, and an attestation issued before an amendment describes a mandate that no
longer exists under the same name. The attestation carries an amendment marker, or the drift is
undetectable.

**3. The consent type determines the reversal semantics, so it is load-bearing.** SEPA CORE gives the
debtor an unconditional refund for eight weeks and thirteen months for an unauthorised collection. SEPA
B2B gives no refund right at all. Same rail family, opposite reversal exposure.

That couples directly to `reversalHandling`. A collection under B2B has effectively no contested-reversal
window; a collection under CORE has eight weeks where the money can come back for no stated reason. An
evaluator that treats them alike will hold headroom that is free or release headroom that is not.

**4. Consent lapses without being revoked.** A CORE mandate is void after thirty six months without a
collection. Nobody cancels it and nothing announces it. The attestation is therefore a point-in-time
statement and needs the same freshness treatment as any other, not a permanent fact.

**5. What did NOT bind, and this is the finding.** SEPA requires the creditor to notify the debtor before
collecting, fourteen days by default. That is not a property of the consent artifact and the attestation
cannot carry it. It is a **duty on the collector**, discharged per collection.

The whole delegation vocabulary is bounds: ceilings, caps, allow lists, windows. A bound says *not more
than this*. A pre-notification requirement says *this must have happened first*, which is a different
kind of clause. `approvers` is the one existing field of that shape, and it is the exception rather than
the pattern.

And the evidence that the notification was sent is produced by the collector. So the self-attestation
problem does not disappear under Model B, it moves: the consent artifact is governed elsewhere and binds
cleanly, while the collector's ongoing duties around it are still self-reported.

**Scope statement: this attestation covers the existence and identity of a payer consent. It does not
cover the collector's per-collection duties, and nothing here should be read as evidence those were
performed.** That belongs in the artifact when it is built, not only in this document.

## Shape

```
PayerConsentAttestation
  consentType         sepa-dd-core | sepa-dd-b2b | card-stored-credential | ach-authorization | ...
  creditorIdentifier  scheme-assigned identity of the collecting party
  mandateReference    unique within that creditor, not globally
  amendmentMarker     the version this attestation describes
  signedAt            when the payer consented
  observedAt          when the issuer checked, because consent lapses silently
  scheme              the rule set that governs refund rights and dormancy
```

Deliberately not carried: the debtor's account details, name, or address. The attestation says a consent
exists and identifies it. It is not a copy of the consent, and copying the payer's banking details into a
credential the collector holds would be a worse artifact than the one it replaces.

## Coupling field on the mandate side

Reserved in the v2.5 draft as `requiredPayerConsent`. It names the consent types acceptable for
collections under the mandate. Critical, `deny` on unavailable input, same structure as
`settlementDestinations`.

The reason is the same reason. Without the field there is nothing to leave empty: an inbound deployment
against a mandate that requires no payer consent is indistinguishable from one where the question was
never asked. With it, the deployment is refused rather than permitted, and the absence is detectable.

## Open, for whoever builds it

- Who issues it. A collector attesting to its own payer consents is weaker than a bank or PSP attesting
  to mandates it holds, and the second is the version worth wanting.
- Whether `amendmentMarker` should be a digest of the mandate's material fields rather than a
  scheme-supplied version, since a digest detects drift the scheme does not version.
- Card stored-credential consent has no artifact resembling a UMR. The network token and its
  `initialTransactionId` are the closest, and they are held by the acquirer rather than the collector.
  Whether that binds as cleanly as SEPA is untested and should not be assumed from this document.
