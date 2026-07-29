# Unreviewed, preserved rather than reviewed

`v1.json` existed on one machine, untracked, in no repository, and 404s at its own `$id`. It is
committed here to stop it being lost.

Unlike its sibling it is not self-marked as a draft, which makes it more dangerous rather than
less: a file named `v1.json` with a public `$id` reads as ready to serve. It has not been
reviewed and nothing references it.

**Before this is ever served:** per `SCHEMA_POLICY.md`, a schema URL is immutable once published
and referenced. Same review as any mint, and the pre-deploy byte-identity gate applies.
