import test from 'node:test';
import assert from 'node:assert/strict';
import {learningProgress,nextExperimentAction,newAutomaticObservation} from '../public/student-journey.mjs';

test('旧草稿按现有证据恢复到合适步骤，预测错误仍可做实验',()=>{
 assert.equal(learningProgress({},[{complete:false}]).initialStep,'predict');
 assert.equal(learningProgress({prediction:'no'},[{complete:false}]).initialStep,'experiment');
 const record={prediction:'no',diagram:{input:'sound',compute:'compare',output:'light'},transfer:'strength'};
 assert.equal(learningProgress(record,[{complete:true},{complete:true}]).initialStep,'explain');
 assert.equal(learningProgress(record,[{complete:false},{complete:true}]).readyToSubmit,false);
 assert.equal(learningProgress(record,[{complete:true},{complete:true}]).readyToSubmit,true);
});

test('实验指令指向可操作区域，自动记录后不再要求寻找记录按钮',()=>{
 assert.equal(nextExperimentAction('road',[{id:'red',complete:false}],{signal:'red'}).selector,'#red');
 assert.equal(nextExperimentAction('door',[{id:'far',complete:false}]).selector,'#far');
 assert.equal(nextExperimentAction('sound',[{id:'quiet',complete:false}],{source:'simulation'}).selector,'#quiet');
 assert.equal(nextExperimentAction('sound',[{id:'quiet',complete:false}],{source:'microphone',micListening:false}).selector,'#mic-start');
 assert.equal(nextExperimentAction('sound',[{id:'quiet',complete:false}],{source:'microphone',micListening:true}).selector,null);
});

test('自动记录只保存已发生的有效状态，延时保持或停止采声不能冒充未触发',()=>{
 assert.equal(newAutomaticObservation('sound',[],{active:true,source:'simulation',level:0,lamp:true}),null);
 assert.equal(newAutomaticObservation('sound',[],{active:false,source:'microphone',level:0,lamp:false}),null);
 const low=newAutomaticObservation('sound',[],{active:true,source:'simulation',level:0,lamp:false,at:1});
 assert.equal(low.lamp,false);
 assert.equal(newAutomaticObservation('sound',[low],{active:true,source:'simulation',level:0,lamp:false}),null);
 assert.equal(newAutomaticObservation('door',[],{x:.1,open:true}),null);
 assert.equal(newAutomaticObservation('door',[],{x:.1,open:false}).open,false);
 assert.equal(newAutomaticObservation('door',[],{x:.8,open:true}).open,true);
});
