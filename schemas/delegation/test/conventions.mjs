// Does the schema contradict ITSELF? A different question from whether it covers the rails.
//
// WHY THIS EXISTS
//
// Three fields written weeks after the draft settled on typed identifiers used bare strings. The
// counterparty typing corrected the defect and did nothing to prevent its reintroduction, because
// A FIX DOES NOT PROPAGATE TO FIELDS WRITTEN AFTER IT: the convention lived in a decision rather
// than in a check.
//
// A rail walkthrough finds SCOPE errors, what the vocabulary was never asked to cover. This finds
// CONVENTION DRIFT, where the vocabulary contradicts itself. Neither finds the other, and only one
// of them was in the process.

import { readFileSync } from 'node:fs';
const schema = JSON.parse(readFileSync(new URL('../v2.5.json', import.meta.url), 'utf8'));
const scope = schema.properties.credentialSubject.properties.actionScope.properties;

let pass = 0, fail = 0;
const failures = [];
function assert(name, ok, detail = '') {
  if (ok) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; failures.push(name); console.log(`  FAIL  ${name}  <<< ${detail}`); }
}

// An identifier names a thing in a namespace. A bare string carries the name and drops the
// namespace, so an evaluator comparing it to a rail's answer compares two strings that were never
// in the same namespace.
const IDENTIFIER_FIELDS = ['settlementDestinations'];
const IDENTIFIER_SUBFIELDS = [['blockedPaymentNotice', 'notify']];

function isTypedIdentifier(s) {
  return s?.type === 'object' && s.additionalProperties === false
    && Array.isArray(s.required) && s.required.includes('kind') && s.required.includes('value')
    && s.properties?.kind?.pattern !== undefined;   // open kind, not an enum
}

console.log('\n── any field naming an account, address or party carries {kind, value} ──');
for (const f of IDENTIFIER_FIELDS) {
  assert(`${f} items are typed identifiers`, isTypedIdentifier(scope[f]?.items), JSON.stringify(scope[f]?.items));
}
for (const [f, sub] of IDENTIFIER_SUBFIELDS) {
  assert(`${f}.${sub} items are typed identifiers`, isTypedIdentifier(scope[f]?.properties?.[sub]?.items));
}

console.log('\n── and the check can FAIL, so a passing run means something ──');
{
  // BOTH OUTCOMES. A predicate that accepted anything would pass every line above while the
  // convention rotted underneath it, which is the inert-control failure this file exists to avoid.
  assert('a bare string is REJECTED by the predicate', !isTypedIdentifier({ type: 'string' }));
  assert('an open object is rejected', !isTypedIdentifier({ type: 'object', required: ['kind', 'value'], properties: { kind: { pattern: 'x' }, value: {} } }));
  assert('a CLOSED enum kind is rejected, because a new kind must not need a schema version',
    !isTypedIdentifier({ type: 'object', additionalProperties: false, required: ['kind', 'value'], properties: { kind: { enum: ['iban'] }, value: {} } }));
}

console.log('\n── open vocabularies stay open, and closed ones stay closed ──');
{
  // Vocabulary fields must be pattern-constrained, never enums: a new scheme must not require a
  // schema version. The engine's recognized set does the denying.
  for (const f of ['requiredPayerConsent', 'requiredPurchaseTerms']) {
    assert(`${f} is a pattern, not an enum`, scope[f]?.items?.pattern !== undefined && scope[f]?.items?.enum === undefined);
  }
  // And the one place a closed enum is deliberate.
  const basis = scope.obligationUniqueness?.properties?.basis;
  assert('obligationUniqueness.basis stays CLOSED to one value', Array.isArray(basis?.enum) && basis.enum.length === 1);
}

console.log('\n── every critical field denies on unavailable input and names its capability ──');
{
  const withCap = Object.entries(scope).filter(([, v]) => v?.['x-opRequiresCapability']);
  assert('at least a dozen fields declare a capability', withCap.length >= 12, String(withCap.length));
  for (const [k, v] of withCap) {
    assert(`${k} also denies on unavailable input`, v['x-opUnavailableInput'] === 'deny', v['x-opUnavailableInput']);
  }
}

console.log('\n── the schema agrees with its own filename ──');
{
  // Caught at the mint: the draft still carried the v2.4 title. On a frozen schema that is
  // permanent, and it is drift of exactly the kind this file exists to catch mechanically
  // rather than by someone happening to look.
  const version = new URL('../v2.5.json', import.meta.url).pathname.match(/(v\d+\.\d+)/)[1];
  assert(`$id names ${version}`, schema.$id?.endsWith(`/${version}.json`), schema.$id);
  assert(`title names ${version}`, schema.title?.endsWith(version), schema.title);
  assert('$id is on the published host', schema.$id?.startsWith('https://observerprotocol.org/schemas/delegation/'), schema.$id);
}

console.log(`\nconventions: ${pass} passed, ${fail} failed`);
if (fail) { console.log('\nFAILURES:'); for (const f of failures) console.log(`  ✗ ${f}`); process.exit(1); }
