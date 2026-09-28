const test=require('node:test'),assert=require('node:assert/strict'),R=require('../public/rules.js');
test('明显的短声音也能触发，而不用保持发声到超长时间',()=>{let s=R.newSound();s=R.stepSound(s,.9,100);s=R.stepSound(s,0,130);assert.equal(s.lamp,true);assert.equal(s.triggerCount,1);s=R.stepSound(s,0,5200);assert.equal(s.lamp,false)});
