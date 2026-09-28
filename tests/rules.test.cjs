const test=require('node:test'),assert=require('node:assert/strict');
let R;try{R=require('../public/rules.js')}catch{R={};}
test('静音不触发灯；一次声音持续触发、保持、到期熄灭',()=>{
 assert.equal(typeof R.stepSound,'function'); let s=R.newSound();s=R.stepSound(s,0,100);assert.equal(s.lamp,false);
 s=R.stepSound(s,.9,200);s=R.stepSound(s,.9,300);assert.equal(s.lamp,true);assert.equal(s.triggerCount,1);
 s=R.stepSound(s,.1,5000);assert.equal(s.lamp,true);s=R.stepSound(s,.1,5301);assert.equal(s.lamp,false);
});
test('连续声音延长保持、停声后新声音只记一次触发',()=>{
 assert.equal(typeof R.newSound,'function');let s=R.newSound();s=R.stepSound(s,.8,100);s=R.stepSound(s,.8,200);s=R.stepSound(s,.8,4500);s=R.stepSound(s,.2,8000);assert.equal(s.lamp,true);assert.equal(s.triggerCount,1);
 s=R.stepSound(s,.8,8100);s=R.stepSound(s,.8,8300);assert.equal(s.triggerCount,2);
});
test('门在人物检测区保持开启；离开后延时关闭',()=>{assert.equal(typeof R.stepDoor,'function');let s=R.stepDoor({until:0},.1,0);assert.equal(s.doorOpen,false);s=R.stepDoor(s,.8,100);assert.equal(s.doorOpen,true);s=R.stepDoor(s,.8,5000);s=R.stepDoor(s,.1,6000);assert.equal(s.doorOpen,true);s=R.stepDoor(s,.1,6600);assert.equal(s.doorOpen,false)});
test('不能凭空图示或一次亮灯拿积分；解释及对照证据是必需条件',()=>{assert.equal(typeof R.assess,'function');assert.equal(R.assess('sound',{}).pass,false);let r=R.examples.sound;assert.equal(R.assess('sound',r).pass,true);assert.equal(R.assess('sound',{...r,diagram:{...r.diagram,input:'lamp'}}).pass,false);assert.equal(R.assess('sound',{...r,trials:r.trials.filter(x=>x.lamp)}).pass,false)});
test('各关示例符合目标；改错后的当前版本须重新验证',()=>{assert.ok(R.stages);for(const s of R.stages){assert.equal(R.assess(s.id,R.examples[s.id]).pass,true);assert.equal(R.assess(s.id,{...R.examples[s.id],transfer:'wrong'}).pass,false)}});
