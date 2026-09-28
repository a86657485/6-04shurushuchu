const test=require('node:test'),assert=require('node:assert/strict'),R=require('../public/rules.js');
test('草稿即使解释正确也不计完成，提交后才可验证',()=>{assert.equal(R.assess('sound',{...R.examples.sound,submitted:false}).pass,false)});
