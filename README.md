# Agentic Identity Protocol (AIP) Specification

This repository hosts the specification for the Agentic Identity Protocol — the open protocol for verifying the identity of, and credentials about, autonomous agents transacting across payment rails.

## Status

AIP is under active development. Four specifications are currently published in this repository, three as drafts and one ratified:

- `aip-v0.6-draft-1.md` — the core protocol (DIDs, credential lifecycle, verification flow, attestation taxonomy).
- `aip-v0.7-draft-1.md` — a lightweight additive extension to v0.6 introducing an optional `tradingMandate` sub-object on `ObserverDelegationCredential` for scoped trading-agent authorization.
- `aip-v0.8-draft-1.md` — additive policy mandate extensions (`counterparty`, `temporal`, `geographic`, `velocity` sub-objects under `tradingMandate`) and the new `PolicyEvaluationCredential` type for signed enforcement decisions.
- `aip-v0.9-worldid-linking.md` — additive World ID linkage: the new `WorldIDLinkageCredential` type binding an OP agent's credential to a Worldcoin proof-of-personhood, composing sybil-resistance with the existing identity, delegation, and attestation layers. **Ratified 2026-07-25** and tagged `v0.9`; review record in [PR #1](https://github.com/observer-protocol/aip/pull/1).

Draft status means each document reflects committed architectural decisions but is subject to revision based on feedback from technical advisors, reference implementation experience, and community input. Substantive changes will be reflected as numbered draft revisions with visible diff.

Ratified status means review is complete: the document's status line records the ratification date and links the review record, the repository is tagged at the ratifying merge (tag `vX.Y`), and the ratified text is frozen. Subsequent substantive changes land as a new numbered draft revision or a new version, never as silent edits to a ratified document.

v0.7, v0.8, and v0.9 are all purely additive to v0.6. Implementations conforming to v0.6 remain conforming without modification; v0.7–v0.9 capabilities are opt-in by issuing or reading the new sub-objects and credential types. Implementations consuming any draft should expect non-breaking refinements before final.

## Current documents

- [`aip-v0.6-draft-1.md`](./aip-v0.6-draft-1.md) — core protocol (May 2026). Draft.
- [`aip-v0.7-draft-1.md`](./aip-v0.7-draft-1.md) — trading delegation profile (May 2026). Builds on v0.6; not a replacement. Draft.
- [`aip-v0.8-draft-1.md`](./aip-v0.8-draft-1.md) — policy mandate extensions + `PolicyEvaluationCredential` (May 2026). Builds on v0.7; not a replacement. Draft.
- [`aip-v0.9-worldid-linking.md`](./aip-v0.9-worldid-linking.md) — World ID linkage + `WorldIDLinkageCredential` (June 2026). Builds on v0.8; not a replacement. Ratified 2026-07-25, tag `v0.9`.

Previous versions of AIP (v0.3.1, v0.5) are not maintained in this repository. v0.6 supersedes them, with the migration path documented in Section 10. v0.7, v0.8, and v0.9 extend v0.6 rather than superseding it.

## Review and feedback

Technical feedback on the draft is welcome. Two paths:

- Open an issue in this repository for specific points (architectural questions, W3C alignment concerns, ambiguities)
- For broader feedback or discussion, contact the Observer Protocol team directly

Feedback is reviewed in the context of preparing the next draft revision. Not all feedback will result in changes, but all of it is considered.

## Implementation

The reference implementation of AIP is Observer Protocol, available at [observerprotocol.org](https://observerprotocol.org). Other implementations are welcome and encouraged; the protocol is designed to support multiple conforming implementations.

## About this repository

This repository is for protocol specification work in progress. Public-facing protocol documentation, ecosystem materials, and adoption resources are at [observerprotocol.org](https://observerprotocol.org). Documents published here are working drafts maintained for technical reviewers.

## License

This specification is licensed under [Creative Commons Attribution 4.0 International (CC-BY-4.0)](./LICENSE). You are free to share and adapt the material for any purpose, including commercially, provided appropriate attribution is given.
