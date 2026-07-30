// Do the two new couplings fire, and do they fire ONLY where they should?
//
// The base is a REAL signed delegation credential from x402-op-authorize, patched only with the
// two fields v2.5 newly requires. Hand-built fixtures failed three times on unrelated required
// properties, and each failure produced a rejection that LOOKED like the coupling firing. So a
// rejection here must also cite the rule under test: same false-pass mechanism as the scorer.
import Ajv from 'ajv';
import { readFileSync } from 'node:fs';

const schema = JSON.parse(readFileSync(new URL('../v2.6-draft.json', import.meta.url), 'utf8'));
const real = JSON.parse(readFileSync(new URL('./base-credential.json', import.meta.url), 'utf8'));
const ajv = new Ajv({ strict:false, allErrors:true });
const v = ajv.compile(schema);

// Every capability any field in the base credential couples to. A short list made the BASELINE
// fail, and that failure was indistinguishable from the coupling under test firing.
const CAPS = ["approval.budget-accounting", "approval.channel", "approval.redemption-binding", "authorization.grant-provenance","ledger.shared-counter", "budget.period-accounting", "jurisdiction.resolution", "notice.dispatch", "obligation.attribution", "payer-consent.verify", "settlement.destination-check", "velocity.counterparty"];
const REV = { onCertifiedReversal:'restore-headroom', onContestedReversal:'hold' };

function cred(extraScope) {
  const c = structuredClone(real);
  c.credentialStatus = [{ id:'https://x/l#0', type:'BitstringStatusListEntry', statusPurpose:'revocation', statusListIndex:'0', statusListCredential:'https://x/l' }];
  c.credentialSubject.actionScope = {
    ...c.credentialSubject.actionScope,
    requiredEnforcement: { capabilities: CAPS },
    ...extraScope,
  };
  return c;
}

let bad = 0;
function t(name, scope, want, mustCite) {
  const ok = v(cred(scope));
  const errs = (v.errors ?? []).map(e => `${e.instancePath} ${e.message}`).join(' | ');
  const cited = want === true || !mustCite || errs.includes(mustCite);
  const good = ok === want && cited;
  if (!good) bad++;
  console.log(`  ${good ? 'PASS' : 'FAIL'}  ${name}`);
  if (!good) console.log(`        ok=${ok}  ${errs.slice(0,150)}`);
  else if (!ok) console.log(`        rejected citing ${mustCite}`);
}

console.log('\n-- baseline: the unmodified credential is valid, so a rejection below means something --');
t('the real credential, patched only for v2.5 requirements', {}, true);

console.log('\n-- consent/reversal coupling FIRES, citing the right rule --');
t('collects + reversalHandling, NO consent type -> REJECTED',
  { settlementDestinations:[{kind:'iban',value:'DE00'}], reversalHandling:REV }, false, 'requiredPayerConsent');
t('...the same mandate WITH a consent type -> accepted',
  { settlementDestinations:[{kind:'iban',value:'DE00'}], reversalHandling:REV, requiredPayerConsent:['sepa-dd-core'] }, true);

console.log('\n-- and it is SILENT where it should be (both outcomes) --');
t('OUTBOUND: reversalHandling, no destinations, no consent -> accepted', { reversalHandling:REV }, true);
t('collects WITHOUT reversalHandling -> accepted', { settlementDestinations:[{kind:'iban',value:'DE00'}], requiredPayerConsent:['sepa-dd-core'] }, true);

console.log('\n-- notice/capability coupling, both outcomes --');
t('blockedPaymentNotice without notice.dispatch -> REJECTED',
  { blockedPaymentNotice:{ notify:[{kind:'role',value:'ops'}], afterDuration:'P2D' }, requiredEnforcement:{ capabilities:[] } }, false, 'capabilities');
t('...with the capability -> accepted',
  { blockedPaymentNotice:{ notify:[{kind:'role',value:'ops'}], afterDuration:'P2D' } }, true);

console.log(bad ? `\n${bad} FAILED` : '\nAll couplings: fire where they should, silent where they should not, right reasons.');
process.exit(bad ? 1 : 0);
