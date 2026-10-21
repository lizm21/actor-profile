import test from 'node:test';
import assert from 'node:assert/strict';
import {handoffState} from '../dist/handoff.mjs';
test('browser handoff never presents an unsaved or in-flight profile as ready',()=>{
  const base={sharedLink:'https://example.test/#profile=test',cloudDirty:false,cloudBusy:false,viewOnly:false};
  assert.equal(handoffState(base).link,base.sharedLink);
  assert.equal(handoffState({...base,cloudDirty:true}).link,null);
  assert.equal(handoffState({...base,cloudBusy:true}).link,null);
  assert.equal(handoffState({...base,sharedLink:null}).link,null);
  assert.equal(handoffState({...base,cloudDirty:true,viewOnly:true}).link,base.sharedLink);
});
