# Per-Agent Key Scoping

**Observer Protocol**
**Applies to:** `https://api.observerprotocol.org/agents/{agent_id}/key-scoping.json`
**Status:** v1, unsigned, live from 2026-08-05.
**Audience:** anyone verifying a signature made by an Observer Protocol agent.

This document tells you what the file obliges you to do. It is a companion to the issuer-level
policy at `/.well-known/key-scoping.json`, which scopes Observer Protocol's own keys; this one
scopes an individual agent's.

## What problem it solves

An agent's DID document tells you which key to verify against. It does not tell you **when that key
was valid**.

Without that, two situations are indistinguishable:

- A signature made last year with a key that was correct at the time and has since been rotated out.
- A signature made today with a key that was rotated out last year and should never have been used.

Both present as "a signature that verifies against a key in the document" or, if the key has been
removed, as "a signature that verifies against nothing." Neither answer is the one you want.

This file carries the missing dimension: `rotated_out_at` and `legitimate_assertion_window`, the
same fields and the same meanings as the issuer-level policy.

## The document

```json
{
  "scoping_version": 1,
  "subject": "did:web:api.observerprotocol.org:agents:acme:04aa54bf…",
  "declaration": "predates-carrier | no-rotations | declared",
  "declaration_note": "…",
  "signed": false,
  "trust_direction": "…",
  "agent": { "status": "unknown | active | revoked", "…": "…" },
  "keys": [
    {
      "id": "did:web:…#key-1",
      "status": "active | deprecated | revoked",
      "rotated_out_at": "2026-08-05T00:00:00Z",
      "legitimate_assertion_window": { "from": "genesis", "until": "2026-08-05T00:00:00Z", "note": "…" },
      "notes": "…"
    }
  ]
}
```

## THE RULE: unsigned metadata may narrow trust, never widen it

**v1 is unsigned. This is a decision, not an omission, and it constrains what you may do with the
file.**

**You MAY act on anything here that causes you to reject more.** A `revoked` status, a
`rotated_out_at` in the past — honour them. Refusing more on the strength of an unauthenticated
hint is fail-closed, and there is no attack in which someone benefits from making you stricter
about an agent you were already willing to trust.

**You MUST NOT accept a signature you would otherwise reject because of anything here.** In
particular: do not use a `legitimate_assertion_window` to rehabilitate a signature that fails your
existing checks. That direction is where an attacker travels — a forged window turns a signature
that should have failed into one that passes, and nothing in this file is signed, so a forged
window and a real one are identical to you.

If you need the widening direction — accepting an archival credential *because* it falls inside a
window — you need a proof this document does not carry. Ask us; do not infer it.

### Why it is not simply signed

If this file were signed by an Observer Protocol key, and that key later rotated, the file's own
proof would need exactly the treatment the file exists to provide. You would need key-scoping to
verify key-scoping. The issuer-level document at `/.well-known/key-scoping.json` is unsigned for the
same reason, and describes itself as *"Informational only; the protocol does not enforce these
constraints cryptographically."*

When signing arrives it will be by the **organisation** key and never the agent's own — the agent's
key is the subject under discussion and cannot vouch for its own retirement.

## `declaration` — three states, and two of them look identical

`keys` is empty in two different states that mean opposite things. **Do not derive the state from
`keys.length`.** Read `declaration`.

### `predates-carrier`

The agent was registered before per-agent key scoping existed.

**This obliges you to treat the record as absent, not clean.** No rotation is recorded because
nothing was recording. An agent whose key was rotated — or whose credentials were revoked — before
this file existed is indistinguishable from one that never rotated at all.

What to do: verify the signature against the DID document as you otherwise would, and **do not
represent the absence to your users as evidence of anything**. If your interface has a "key history"
affordance, this state is "unknown", not "none". `agent.status` is `unknown` in this state for the
same reason, and is never `active`.

This is the common case. Every agent registered before 2026-08-05 is in it.

### `no-rotations`

The agent is covered, and nothing has rotated.

**This is a positive statement** and is the one that differs from the state above: there, nobody was
looking; here, someone looked and there is nothing to report. You may represent this to a user as
"no key changes recorded" — a claim you cannot make from `predates-carrier`.

### `declared`

There are rotation or revocation records. Read `keys` and `agent`, and apply the trust-direction
rule to both.

## Revocation is a status, not a deletion

A revoked agent's DID document is **retained and still resolves**, and the retired key stays in
`verificationMethod`.

This is deliberate and it affects how you read a revocation:

- Signatures made **before** `agent.revoked_at` remain checkable against the key and its window.
  Revocation is not retroactive invalidation of everything the agent ever signed.
- Signatures made **after** it should not be accepted.
- If we deleted the document instead, every prior signature would break, and you — holding a cached
  copy or hitting a 404 — could not distinguish a revocation from an outage. A status tells you
  which. A missing file does not.

By convention a retired key entry SHOULD carry `"MUST NOT be used to sign any new credential"` in
its `notes`, the same language the issuer-level policy uses for `#key-1`. **Do not depend on that
string.** `notes` is free prose written per entry and nothing enforces its content; the fields you
branch on are `status`, `rotated_out_at` and `legitimate_assertion_window`. As of this writing no
agent has a `keys` entry, so there is no live example to pattern-match against.

## Where it is served — read this before you construct the URL

**The carrier is served from the API host only:**

```
https://api.observerprotocol.org/agents/{agent_id}/key-scoping.json
```

`https://api.agenticterminal.io/...` fronts the same application and serves it identically.

**Do not construct the URL from the DID's host.** A flat agent DID is
`did:web:observerprotocol.org:agents:{id}`, whose `did.json` resolves at the **apex**. The apex does
**not** serve `key-scoping.json`: that path hits a catch-all which returns **`200 text/html`** — a
success status with a web page in it.

This is the failure mode this whole family of documents exists to prevent, so it is worth stating
plainly:

- **A 200 is not an answer.** Check `Content-Type: application/json` and parse before you conclude
  anything.
- **HTML from the apex does not mean the agent has no key scoping.** It means you asked the wrong
  host. Ask the API host before you record an absence.

Verified 2026-08-05: apex returns `200 text/html`; API host returns `200 application/json`. Aligning
the apex is a known follow-up, and until it lands this asymmetry is the deployment's behaviour
rather than a bug in your client.

## HTTP behaviour

| Case | Response |
|---|---|
| Agent exists, any state | **200 `application/json`**, with `declaration` carrying the state |
| Agent id names nothing | **404** |
| Wrong host (apex) | **200 `text/html`** — not an answer; see above |

**A known agent never returns 404.** If you get a 404 for an agent you believe exists, treat it as
an error condition — a broken deployment or a wrong id — and not as "no key scoping". The states
above are the only ways this file reports an absence, and all of them are 200.

**A nonexistent agent returns 404 rather than `predates-carrier`.** Returning a state would be
asserting something about a subject that does not exist, and would make every typo look like a
valid answer.

## What this file does not do

- It does not tell you whether a signature is valid. Verify against the DID document; this tells
  you whether the key was allowed to be used at the time.
- It does not enforce anything cryptographically. Like the issuer-level policy, it is a declaration
  a verifier MAY consume, bounded by the trust-direction rule above.
- It does not cover credential revocation. That is the status list; this is about keys.

## Related

- `/.well-known/key-scoping.json` — the issuer-level policy this mirrors, and the source of the
  `rotated_out_at` and `legitimate_assertion_window` field definitions.
- `SCHEMA_POLICY.md` — why published URLs do not change their bytes.
