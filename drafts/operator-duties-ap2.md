# Operator duties: AP2

The last unwalked surface, and the one flagged as able to bite. Same question: **what must the operator
DO, as distinct from what the agent may not EXCEED?**

**Result: one artifact requirement, which is a fourth MEMBER of the existing class and not a fourth
shape.** Mint proceeds. And the artifact it requires closes a gap already arriving from two other
directions, which is the part worth reading.

## What AP2 puts in the flow

An `IntentMandate` signed by the user describing what they want, possibly under-specified. A `CartMandate`
signed by the **merchant**, carrying exact items and an exact price, which the user approves in a
human-present flow or which the IntentMandate pre-authorises in a human-not-present one. A
`PaymentMandate` carrying evidence of both to the network.

## Duties, taken one at a time

**The merchant must present a cart the user approved, and must stand behind its price.** Both are duties
on the **counterparty**, not on our operator. Nothing for us to do and nothing to express.

**We must verify the cart before paying.** That is on our side, and it is a precondition: a signed
CartMandate must exist and verify before a payment is made against it. **This is the one finding.**

**Cart expiry is a bound, not a deadline duty.** A CartMandate has a TTL and a stale cart cannot be paid.
Applying the membership test: no party can claim breach. You simply re-request. Bound, like `validBefore`.
Third time the test has kept something out of the class that a looser reading would have admitted.

**Disputes defer to the underlying rail**, so card duties apply where the rail is a card, and cards are
walked. No AP2-level dispute duty.

**Record retention is real, cross-rail, and inexpressible.** A regulated entity has statutory retention
obligations, and failing to produce a mandate chain loses a dispute. But it attaches to the operator on
every rail, and we cannot evidence it. **Third member of the inexpressible set**, alongside SEPA
pre-notification and sanctions screening.

## The finding, and why it is larger than AP2

Nothing in a delegation mandate currently requires that the amount paid corresponds to terms the
**counterparty** stated. An agent can pay any permitted counterparty any amount inside the ceiling, for
anything at all, and every constraint passes.

On x402 that is fine: the 402 response *is* the price statement, and the payment answers it. On AP2 it is
the whole point of the protocol, because the merchant-signed cart is the price guarantee.

**And this is the third arrival of the same need.** It was reserved on `counterpartyVelocityCap.matchOn`
as the payee-supplied obligation identity. It was named again in `obligationUniqueness`, where the
expected amount is agent-supplied and therefore advisory against malice, with the note that the
non-forgeable version is payee-supplied. **A merchant-signed cart is that non-forgeable version**, and it
exists already as a real artifact rather than as something we would have to invent.

A field arriving from three independent directions is not speculative.

## Field reserved

`requiredPurchaseTerms`. Which counterparty-signed statements of what is being bought, and for how much,
are acceptable under this mandate. Artifact requirement, same shape as `requiredPayerConsent`, same
reasoning: **the artifact is produced by someone other than the party it constrains.**

The symmetry is worth stating. `requiredPayerConsent` covers collections and asks whether the party being
collected from agreed. `requiredPurchaseTerms` covers purchases and asks whether the party being paid
stated the price. Both close the same hole in opposite directions: **the agent asserting, unchallenged,
what the other party wanted.**

## Result

Six rails and one framework walked. **No fourth shape.** The class holds at three: preconditions,
artifact requirements, deadline duties.
