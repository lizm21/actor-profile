import test from 'node:test';
import assert from 'node:assert/strict';
import {newIdentity,managementLink,parseManagementLink,profileLink,publicProfileLink} from '../dist/cloud.mjs';
test('management links restore capabilities without trusting stale version metadata',()=>{
  const identity={...newIdentity(),version:99,fingerprint:'stale'};
  const link=managementLink('https://example.test/actor/index.html?tracking=1',identity);
  assert.equal(new URL(link).pathname,'/actor/');assert.equal(new URL(link).search,'');
  assert.deepEqual(parseManagementLink(link),{id:identity.id,editKey:identity.editKey,viewKey:identity.viewKey,version:0,fingerprint:''});
  assert.ok(!new URL(link).pathname.includes(identity.editKey));
});
test('public and download links cannot be mistaken for management credentials',()=>{
  const identity=newIdentity();
  assert.equal(parseManagementLink(publicProfileLink('https://example.test/',identity.id)),null);
  assert.equal(parseManagementLink(profileLink('https://example.test/',identity.id,identity.viewKey)),null);
  assert.throws(()=>parseManagementLink('not a link'));
  assert.throws(()=>parseManagementLink('javascript:alert(1)'));
  assert.throws(()=>parseManagementLink(`https://example.test/#manage=${identity.id}&edit=${identity.viewKey}&view=${identity.viewKey}`));
  assert.throws(()=>parseManagementLink(`https://example.test/#manage=${identity.id}&edit=${identity.editKey}`));
});
