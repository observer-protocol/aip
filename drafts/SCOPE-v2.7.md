# Scope: v2.7 — two candidates, one sequence

**v2.7 carries BOTH so the next release is not a third sequence.** Publishing is irreversible and its
cost is a fixed sequence, so two ready things in one release is strictly cheaper than two releases.

## Candidate 1: `requiresDecisionAttestation` (§9)

**Scoped, not built.** The `DecisionAttestation` credential itself exists — §7's standalone shape, §8's
`inputsDigest`, §5's claims-as-data, §4's `self-declared` built with `independently-observed` expressed
and capability-gated.

**What §9 adds** is a field on `actionScope` requiring that a payment cite an attestation. It is a
BINDING constraint, `x-opUnavailableInput: deny`, and needs a capability name.

**Why it did not ship in v2.6:** it belongs to a surface with an open scope item. `acceptDecisionAttestation`
does not verify a signature — it gates on verifier capability and returns `accepted` — and there is no
consumer. Shipping a field that requires an attestation nothing verifies would put a control in a
credential ahead of the code that honours it.

**Open before it can mint:** the accept path needs to do more than gate on capability, and the field needs
a capability name that the engine recognises, or every credential using it denies.

### The same class as the unenforced chain link, in a second place

**Two credentials that mention each other with nothing resolving the link** is the defect Enterprise found
today. **A mandate that requires an attestation with nothing verifying it** is the same shape one layer up:
the constraint is expressed, the artifact is named, and no code turns the reference into a checked fact.

**Naming them as one class matters because the fix is the same in both:** a reference is not a link until
something resolves it, and a requirement is not a control until something verifies what satisfies it.
Shipping §9 before that would add a third instance rather than closing the second.

### What verification would take, scoped and NOT built

**1. Resolve the decider.** `attestation.decider` is a DID string today, unresolved. Verification means
resolving it and checking the signature came from a key in its `assertionMethod` — the same operation the
delegation path already performs for an issuer, so the mechanism exists and is not wired here.

**2. Verify the signature over the attestation.** `issueDecisionAttestation` signs
`JSON.stringify(attestation)`. **That is not a canonicalisation**, and the rest of this estate signs
`eddsa-jcs-2022`. Verification cannot be built on `JSON.stringify` — two semantically identical
attestations with different key order produce different bytes. **This is a change to issuance, not only to
verification**, and it is the largest single item.

**3. Bind the attestation to the payment that cites it.** `AttestationCitation.citesDecisionId` is a
caller-supplied string; nothing makes a payment depend on WHICH attestation it names. Scoped separately in
`SCOPE-preimage-v3-attestation.md` and deliberately held, because it shares a migration cost with the
unmade lapse-fingerprint decision.

**4. Decide what an unresolvable decider means.** Fail closed, consistent with every other identity gate
here: an attestation whose decider cannot be resolved is DECLINED, not accepted with a note. That is a
one-line decision and it should be made explicitly rather than inherited.

**5. Then the capability name**, so an evaluator that lacks it refuses the credential rather than
accepting a constraint it cannot perform.

**Order matters: 2 before 1.** Resolving a decider to check a signature over non-canonical bytes verifies
nothing. **Estimate: item 2 is the real work and it touches issuance.** The rest is wiring against
mechanisms that already exist.

## Candidate 2: the payor slot

**Unscoped.** Surfaced by the payout walkthrough: on a claims payout the artifact is signed by the PAYOR,
who is neither the counterparty nor the agent. v2.6 corrected `requiredPurchaseTerms`'s description to say
"signed by a party that is not the agent", which was the honest repair of a wrong characterisation.

**What is unscoped** is whether the payor is a NAMED slot in the credential rather than an implication of
an artifact type. That is a modelling question, not a wording one, and it has not been asked yet.

## Not candidates

**The two uncalled controls** (`assertTightenOnly`, `assertNetworkAllowed`) are implementation, not
schema. **The MCP-surface guard gap** is a build, not a version.
