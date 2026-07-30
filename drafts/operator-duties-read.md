# Operator duties: a read across four rails

One question, asked of every rail walked: **what must the operator DO, as distinct from what the agent
may not EXCEED?**

Run because the SEPA pre-notification duty was found by accident while scoping payer consent, and a
structural gap found by accident has no reason to be the only one.

## The result in one line

x402 and L402 have no operator duties. Cards have disclosure duties, one of which changes reversal
outcomes. Payouts have **deadline duties**, which are a class nothing in the vocabulary can express and
which interact badly with a control that denies.

## x402: none, and the absence explains the vocabulary's shape

Nothing in EIP-3009 or the x402 flow requires the payer to do anything before or after authorising. No
receipt, no notice, no disclosure, no deadline. The authorization is bounded by `validBefore` and that is
a bound, not a duty.

**This is a finding rather than a null result.** The vocabulary was designed against x402, and x402 is
the one rail with no operator duties at all. A bounds-only vocabulary is complete for x402, which is
exactly why the gap stayed invisible: the first rail could not have surfaced it.

Every subsequent rail has been a widening, and the widenings were read as new requirements rather than as
evidence that the original scope was narrow.

## L402 and Lightning: none

Same answer, same reason. Preimage revelation is protocol mechanics, not a duty owed to a counterparty.
No consumer-protection layer attaches.

## Cards: disclosure duties, and one of them changes reversal exposure

Card network rules require the merchant to disclose a refund policy at the time of purchase, to provide a
transaction receipt, and for stored credentials to disclose terms and obtain cardholder agreement at
initial storage.

**The refund-policy disclosure is the one with reach:** an undisclosed refund policy means the cardholder
wins the dispute by default. So a duty the collector may or may not have performed changes the outcome of
a reversal, which is a second field-crossing coupling of the same kind found in SEPA.

**No new field.** The stored-credential disclosure IS the consent artifact for cards, so
`requiredPayerConsent` already covers it, and the reversal consequence is a property of the consent type
which that field already carries as load-bearing. Saying so is worth more than adding a field that
duplicates one.

## Payouts: deadline duties, and this is the class we cannot express

Claims payouts carry statutory deadlines. Prompt-pay statutes require payment within a fixed period of
determination. Unfair claims settlement practices acts require notifying a claimant of a decision and
giving reasons on denial.

**Every field in this vocabulary says NOT MORE THAN. A prompt-pay statute says NOT LATER THAN.** That is
not a bound with the sign flipped, it is a different kind of clause: a bound constrains an action that is
happening, a deadline constrains the absence of one.

**And it collides with fail-closed.** A cap that correctly denies a payment can leave the principal in
breach of a statutory obligation to pay. The control is working exactly as designed and the outcome is a
violation. This already appeared once, in the uniqueness clause, where counting a bounced payment as a
duplicate blocked a payor from a statutory duty to pay. That was read as a defect in the uniqueness
proxy. It was also the first sighting of this.

**What the protocol can and cannot do here.** It cannot discharge a duty to act; no signed artifact makes
a late payment timely. What it can do is refuse to be silent: a denial that blocks a deadlined payment
and persists is information somebody needs, and nothing in a mandate says who.

`approvers` names who can unblock. Nothing names **who must be told when a block persists**, and those
are different parties: the person authorised to raise a cap is not necessarily the person accountable for
a missed statutory deadline.

So: one field, `blockedPaymentNotice`.

## What this does to the `approvers` observation

`approvers` is no longer the sole exception. It is the first member of a class that now has three
shapes:

- **Preconditions**: something must have happened first. `approvers`, and the SEPA notification duty
  which remains inexpressible and is scoped as such.
- **Artifact requirements**: something must exist elsewhere. `requiredPayerConsent`.
- **Deadline duties**: something must happen by a time, and a denial can prevent it.
  `blockedPaymentNotice`, which addresses the visibility of the collision rather than the duty itself.

The vocabulary is bounds plus a small and now-enumerated set of duty-shaped fields. That is the shape,
documented before the mint rather than discovered after it.
