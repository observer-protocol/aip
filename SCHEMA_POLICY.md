# Schema Immutability Policy

**Observer Protocol**
**Applies to:** all JSON Schema documents published under `https://observerprotocol.org/schemas/`
**Status:** binding from 2026-06-03; first applied to the v0.7→v0.8 delegation-schema transition.

## Policy

Once a schema URL under `observerprotocol.org/schemas/` has been published and referenced by an issued credential, **the bytes at that URL are immutable**. The URL serves the same document forever. New schema content — additive, breaking, or in-between — is published at a **new URL**.

## Why

A `credentialSchema.id` URL inside a verifiable credential is a load-bearing reference: the verifier fetches it and validates the credential against whatever bytes the URL returns. If the bytes change after the credential is signed:

- Credentials previously signed against the old shape may stop validating, even though their content and proof are unchanged.
- Verifiers cannot trust that two parties fetching the same URL at different times got the same schema, which is what `credentialSchema` is supposed to guarantee.
- The signer's commitment becomes ambiguous: "I issued a credential conforming to *what was at this URL when I signed*" is a different claim than "I issued a credential conforming to *whatever is at this URL now*."

The W3C VC Data Model treats `credentialSchema.id` as a pointer to a stable, addressable schema document. We honour that by enforcing the stability ourselves.

## Mechanics

- **New version → new URL.** Field additions, renames, enum tightenings, closure of `additionalProperties`, or any other change get a new URL. Naming convention: minor revisions of a stable envelope are `.N+1.json` siblings (e.g. `v2.json` → `v2.1.json`); whole-envelope changes get a new major (`v3.json`).
- **Old URLs stay live.** The previous URL keeps serving its previous bytes for as long as credentials issued under it may still be in circulation — i.e. effectively forever. We do not delete or 301-redirect old schema URLs.
- **Issuance updates to the new URL.** When a new schema version is published, the issuer code embeds the new URL in `credentialSchema.id` for newly-issued credentials. Already-issued credentials keep their pinned URL and continue to validate against it.
- **Spec and adapter pinning.** AIP draft documents reference schema URLs by exact version (no floating "latest" link). Downstream adapters (e.g. WDK integration) SHOULD pin the expected `credentialSchema.id` to a specific URL they were built against, and SHOULD reject credentials carrying a `credentialSchema.id` they do not recognise rather than fetching arbitrary URLs.
- **Schema-source repository.** Schema documents are authored in this repository (`observer-protocol/aip`) under `schemas/<credential-type>/<version>.json`, and are the single source of truth. Deployment to `observer-protocol/observerprotocol-website` under `schemas/` is a **verbatim byte-for-byte copy** — the deployed file and its `aip` source MUST be identical (same `sha256`). The served `$id` therefore always matches the file's own `$id`. No edits are made on the website side; any change starts in `aip`.

## When the source and the published bytes disagree

**The served bytes win, and the canonical source is corrected to match.**

Immutability inverts the usual direction. The repository is normally authoritative over what
gets deployed; it is *not* authoritative over a document whose URL can never change and which
issued credentials already reference. Publishing the repo copy over a divergent served file
would silently replace an artifact that signed credentials point at, which is the one outcome
this policy exists to prevent.

So the repair for a missing or divergent source is a **byte-identical backfill from the served
URL**, verified by `sha256`, with the file's own `$id` checked against the URL it was fetched
from. Never the reverse.

Applied 2026-07-28 to `v2.2.json` and `v2.4.json`, which were live, referenced by issued
credentials, present in shipped adapter allowlists, and absent from this repository. The
instinct in that moment is to push the repo copy and call it a fix; that would have been a
silent replacement.

**The mechanism, not just the instances.** The schema-versus-engine conformance check carries
a row for this: *for every schema URL appearing in any shipped allowlist, a byte-identical
source exists in this repository.* It runs against served URLs, like the other rows, and it
would have caught both.

## Cross-references

- AIP v0.8 draft-1 §1 (the v0.7→v0.8 transition that first applied this policy).
- `observerprotocol.org/schemas/delegation/v2.json` — frozen at v0.7 content; used by the maxi-0001 demo credential.
- `observerprotocol.org/schemas/delegation/v2.1.json` — current v0.8 schema; used by Sovereign issuance from 2026-06-03 forward.

## Open question (not policy-blocking)

This policy is silent on URLs that *were* published but never referenced by any issued credential — i.e. URLs we could safely repurpose. We do not currently distinguish, and treat all published URLs as immutable by default. If a case ever arises where this matters, the policy may be revised to add an explicit "withdrawn before use" carve-out; until then, the conservative default holds.

---

# Designing constraint fields

A separate concern from immutability, recorded here because it governs what goes into a schema before
the immutability rule freezes it.

## A constraint whose boundary the constrained party sets is not a constraint

> **Any time a field lets the issuer parameterise the thing being enforced against, ask what the weakest
> legal value does. If the weakest legal value is "no constraint", the field is decorative.**

The trigger is recognisable in advance, which is what makes this worth stating rather than discovering
each time. Three instances:

**A settlement-finality window declared in the credential.** `obligationUniqueness` counts payments that
settled and stayed settled, which needs a period during which no reversal arrived. Had that period been a
field, an issuer could declare one shorter than the rail's actual return window and a payment would count
as final while it could still be reversed. **Fixed by deriving it from the rail**: an evaluator declaring
`obligation.attribution` declares it knows the settlement-finality window of the rails it evaluates, and
the credential says nothing about duration.

**`onMissingReference` defaulting to allow.** A payment carrying no obligation reference would skip the
uniqueness check entirely, so an agent could opt out of the control by omitting a field. **Fixed by
defaulting to deny**, which makes the reference mandatory in practice.

**`allowed_counterparty_types` declarable but unenforceable.** The property was defined in the spec,
accepted by three published schemas, recommended to issuers, and no engine could enforce it. An issuer
could satisfy their own review by declaring a constraint that did nothing. **Fixed by withdrawing it**
and denying credentials that carry it, with the reason stated rather than a silent ignore.

## The two ways out

**Derive it from something the constrained party does not control.** Second field derived this way after
the resolver's retention floor, which comes from the dispute windows of the rails involved rather than
from a number anyone chose. A derived bound survives someone asking why it is that value.

**Or default to the safe combination** so it is what an issuer gets rather than what they assemble.
`onlyIfTransient` on `reattemptAfterReturn` defaults to true, and `cancellationAuthority` defaults to
`granting-party`, for the same reason: the failure mode is an issuer who never thought about the field,
and the default is the whole control for them.

## And a vocabulary defect surfaces when a rail behaviour meets the field

Not when the field is reviewed. A field is correct on its own terms, which is exactly what makes a scope
error a scope error, so reviewing it finds nothing.

`obligationUniqueness` counted payments *attempted* and would have made a bounced payment permanent,
blocking a payor from a statutory duty to pay. Reviewing the field would never have surfaced that. Asking
what an ACH return does to the ledger did, because no rail with returns existed when the field was
written.

**So walk a rail's behaviours against the vocabulary before writing its adapter**, and expect scope
errors rather than inconsistencies. The procedure is in `op-mcp-payment-server/docs/RAIL-ADAPTER-PROCEDURE.md`.

### Before letting an issuer parameterise a constraint, evaluate the weakest legal value

A bound the constrained party sets is not always unsafe. It depends which way the weakest value points,
and that is a per-field question with no general answer.

**Evaluate the weakest legal value the field admits. If it WEAKENS the control, derive the bound instead
of accepting it. If it TIGHTENS the control, declaring it is safe.**

Two fields of the same shape, opposite answers:

- **Settlement finality**, declared, is unsafe. The weakest value is a short window, and a short window
  counts a payment final while it can still reverse. Derive it from the rail.
- **Uniqueness window**, declared, is safe. The weakest value is also a short window, and a short window
  treats MORE payments as potential duplicates rather than fewer. The failure mode is a redundant check,
  not a missed one.

Same shape, opposite safety direction. The general form of the earlier rule still holds and is narrower
than it first appeared: *a constraint whose boundary the constrained party sets is not a constraint* is
true precisely when the weakest legal value weakens the control. Apply the test, do not apply the
conclusion.

And note that deriving is not free. Deriving from the wrong property is worse than declaring: the
uniqueness window derived from finality was sound reasoning applied to the wrong rail property, and it
would have held obligations unpayable for eighteen months.

### A check whose pass condition is "something was rejected" must assert WHAT rejected it

The coupling check written to verify the consent/reversal dependency printed PASS twice while rejecting
fixtures over a missing top-level `id`. The rule under test never fired. The outcome was correct, the
reason was not, and nothing in the outcome could reveal that.

**A control that reports a verdict without citing its reason is unfalsifiable.** Fourth instance: the
runner label, the publish guard, a harness attributing a cause it had not tested, and now a schema check
verifying a rule it had not exercised. Every one of them agreed with the hypothesis being tested.

Two halves of the fix, both required:

1. **A rejection must cite the rule under test.** Assert on the error path or message, not on the
   boolean. `ok === false` is satisfied by any defect in the fixture.
2. **Build fixtures from a real artifact, not by hand.** Three hand-built credentials failed on unrelated
   required properties before one validated. A real signed credential fails only for the reason under
   test, and a baseline case asserting it validates unmodified makes that checkable rather than assumed.

The second half is the same lesson as reading identifiers rather than writing better predicates: the
artifact knows things the author of the fixture does not.

**And where a test could be satisfied by its own setup, choose setup values the implementation cannot
produce.** Then a regression to pass-through is visibly wrong rather than quietly green. This and the
cite-the-rule requirement are the same concern from opposite ends: one asserts the reason, the other
poisons the shortcut. Mutation-check both directions, which is what makes either stick.

### Two checks, neither substituting for the other

A **rail walkthrough** asks *what did we never consider*. A **conventions check** asks *where do we
disagree with ourselves*. Both are cheap. Neither finds what the other finds.

Six rails and one framework were walked for v2.5 and they found every scope error: consent artifacts,
deadline duties, the destination gap, counterparty-stated terms. They found **neither** convention defect.

The conventions check, written an hour before the mint, found two. Three fields using bare strings weeks
after the draft settled on typed identifiers, and a **v2.4 title on the v2.5 schema** which on a frozen
document would have been permanent.

That retires the idea that walkthroughs were sufficient. They cannot see a vocabulary contradicting
itself, because self-contradiction is invisible from outside: every field is individually defensible.

**And the mechanism behind both defects is the same one: a fix does not propagate to work done after it.**
The typed-identifier decision corrected its instance. The version bump corrected its instance. Neither
prevented recurrence, because both lived in a decision rather than in a check. A convention that is not
asserted is a convention only for as long as the person who set it is reviewing.

### The mint commit is not the freeze. Publication is.

Immutability attaches when the URL serves bytes. A schema committed to this repository and not yet
deployed is still editable, and that window is the last chance to correct anything.

Stated because v2.5 was described as minted while its `$id` still returned 404, and the distinction is
easy to lose: the mint is the decision to close, publication is the act that makes closing permanent.
**Verify the URL serves before treating a schema as frozen, and make final corrections before deploying,
never after.**

**A document may name a schema version only once that version serves.** It reads as pedantry until the
version does not ship, and then it is a file asserting something no URL supports. A `DECLARED_UNENFORCEABLE`
entry naming "withdrawn at v2.5" was rejected on exactly this ground while v2.5 was a draft, and the same
entry naming the served versions is correct now, because publication made them facts. The rule paid off
within a day, in a file neither of us was looking at.

### When to close a schema, with the v2.5 evidence

The argument for closing early is that fields have stopped arriving. It was made for v2.5 eight days
before the mint. In those eight days the open draft absorbed:

- **six fields**: `obligationUniqueness`, `reattemptAfterReturn`, `reversalHandling`,
  `settlementDestinations`, `requiredPayerConsent`, `blockedPaymentNotice`, `requiredPurchaseTerms`
- **two renames**: `payee` to `counterparty`, and the uniqueness window split from the finality window
- **two convention defects**: bare-string identifiers, and a stale version title

Every field came from walking a rail. **None came from reviewing the field list**, which is what the extra
eight days would otherwise have been spent on. A rename in an open draft is free and a rename after the
mint is a whole version.

**The close condition is therefore not "have fields stopped arriving" but "have we walked every rail we
intend to support, and does the schema agree with itself".** Both are answerable. "Has it settled" is not.

### Publication procedure: three conditions, all checkable

Publication is the irreversible step. Run all three before deploying, not after.

1. **Fixtures against the exact file about to be served**, not against source. If they behave
   identically the deploy is a copy; if they diverge, this is the last moment anyone can tell. After
   publication the bytes are the definition and a difference is permanent rather than fixable. Re-run
   against the served bytes afterward.
2. **Byte-identical, `sha256` verified after serving**, and the canonical-source conformance row run
   against the post-deploy state. v2.2 and v2.4 were orphaned at exactly this step and the check exists
   because of them.
3. **Schemas only, additions only.** `scripts/publish-precheck.sh <website-repo>`.

**Condition 3 became a script because v2.5 satisfied it by luck.** The publication commit landed on a
session branch carrying unrelated work, in a repo whose default branch is `master` rather than `main`,
and nothing extra shipped only because the other commit was already upstream. Had it not been, unrelated
work would have deployed alongside an immutable schema and nothing in the process would have objected.

The check resolves `origin/HEAD` rather than assuming `main`, refuses any non-schema path, and refuses
any *modification* to a published schema, since a publication adds a URL and never changes one.

**Whoever runs the next mint will not have this session's context.** That is the whole argument for
turning each of these from an intention into a check.
