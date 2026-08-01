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

## Candidate 2: the payor slot

**Unscoped.** Surfaced by the payout walkthrough: on a claims payout the artifact is signed by the PAYOR,
who is neither the counterparty nor the agent. v2.6 corrected `requiredPurchaseTerms`'s description to say
"signed by a party that is not the agent", which was the honest repair of a wrong characterisation.

**What is unscoped** is whether the payor is a NAMED slot in the credential rather than an implication of
an artifact type. That is a modelling question, not a wording one, and it has not been asked yet.

## Not candidates

**The two uncalled controls** (`assertTightenOnly`, `assertNetworkAllowed`) are implementation, not
schema. **The MCP-surface guard gap** is a build, not a version.
