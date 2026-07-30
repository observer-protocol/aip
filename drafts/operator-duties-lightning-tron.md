# Operator duties: Lightning and TRON/USDT

The last two rails we ship adapters for, walked with the same question: **what must the operator DO, as
distinct from what the agent may not EXCEED?**

Expectation going in was null for both. **The result is null for both, and the walk sharpened the class
definition and confirmed the outcome union against a fifth and sixth rail on the way.**

## Lightning: no operator duties

No consumer-protection layer, no scheme rulebook, no statutory timing obligation. BOLT specs are
protocol, not conduct rules. Invoice expiry is a bound, not a duty. There is no refund right to disclose
because there is no refund mechanism to have a policy about.

**One near-miss, and it refines the class rather than joining it.** Lightning is full of deadlines. An
HTLC must be resolved before its timeout. A channel counterparty broadcasting a revoked state must be
answered inside `to_self_delay` or the funds are gone.

Those are deadline-shaped and they are **owed to nobody**. Missing one costs the operator money; it does
not put them in breach of an obligation to a counterparty, and no party can claim against them for it.

So the class test is not *is there a deadline*. It is:

> **A deadline duty requires a party who can claim breach.** A deadline whose only victim is the
> operator is a risk, not a duty, and it produces no field.

That distinction was implicit in the payout case and would have been easy to lose. Prompt-pay statutes
have a claimant. An HTLC timeout has a counterparty who profits and no one who is wronged.

## TRON/USDT: no rail duties, and two things worth recording

No consumer protection, no scheme rulebook, no timing obligation on the sender.

**The issuer freeze is not a duty and not a new outcome.** Tether can blacklist an address. A payment to
an address frozen after settlement moved money that the recipient cannot spend.

Checked against the outcome union deliberately, because the union carries a recorded prediction that a
third rail should need no new states and this is the sixth. **It holds.** The axes are *did money commit*
and *do we know*, and both answers are unchanged: the money committed and we know it did. That is
`settled`. Whether the recipient can subsequently spend the asset is a property of the asset after
settlement, not an outcome of the payment. A rail where the answer differed would need a sixth state, and
this is not one.

**Sanctions screening is a precondition duty, it is real, and it gets no field.** A regulated operator
must screen before paying. That is *this must have happened first*, which is the precondition shape.

Two reasons it produces nothing here. It is not rail-specific: it attaches to the operator on every rail
including x402, so calling it a TRON finding would be wrong. And we cannot evidence it. A field asserting
screening occurred would be the collector attesting to its own compliance, which is the exact defect that
sent payer consent to Model B, and there is no third-party artifact to bind to the way a SEPA mandate
exists to be referenced.

**So it is recorded where the SEPA notification duty is recorded: inexpressible, and named as
inexpressible.** `geographicAllowedOnly` bounds which jurisdictions are permitted, which is a different
claim and should not be read as evidence anyone screened.

## Result

Six rails walked. **Every operator duty found lives on cards, SEPA, and payouts. The three
crypto-adjacent rails have none at all.**

That is consistent with the reason the gap stayed invisible: duties come from consumer-protection layers,
scheme rulebooks, and statutes, and x402, Lightning and TRON have none of the three. The vocabulary was
not carelessly scoped. It was scoped correctly for the rails it was designed against, and the rails it
was designed against happen to be the ones where bounds are sufficient.

**No new fields. The vocabulary is complete for every rail we currently support**, with two duties named
as inexpressible rather than silently absent: SEPA pre-notification and sanctions screening.
