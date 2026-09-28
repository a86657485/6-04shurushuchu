const test=require('node:test'),assert=require('node:assert/strict'),R=require('../public/rules.js');
test('直行位置来自同一速度时间规则，不以动画快慢判断计算结果',()=>{assert.equal(typeof R.robotDistance,'function');assert.equal(R.robotDistance(2,3),6);assert.equal(R.robotDistance(3,2),6);assert.equal(R.robotDistance(2,0),0)});
