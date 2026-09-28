import test from 'node:test';
import assert from 'node:assert/strict';
import {summarizeClass} from '../public/teacher-stats.mjs';
const stages=[{id:'road',name:'红灯'},{id:'sound',name:'声控灯'},{id:'text',name:'汉字'},{id:'door',name:'自动门'}];
function learner(id, classId, {entered=false,awards=[],submitted={}}={}){
 const records=Object.fromEntries(stages.map(s=>[s.id,{firstSubmitted:null,lastSubmitted:null}]));
 for(const [stage,values] of Object.entries(submitted))records[stage]={firstSubmitted:{assessment:{pass:values[0]}},lastSubmitted:{assessment:{pass:values[1]}}};
 return {student:{id,classId,name:id},updated:entered?'2026-09-28T09:00:00.000Z':null,awards:awards.map(stage=>({stage})),records,points:awards.length*10,quizAttempts:[]};
}
test('一个班的状态人数互斥且总和等于名单人数，手动加入同班也计入',()=>{
 const students=[learner('未进入','601'),learner('进行中','601',{entered:true,awards:['road']}),learner('完成','601',{entered:true,awards:['road','sound','text','door']})];
 const s=summarizeClass({classId:'601',students},stages);
 assert.deepEqual(s.status,{notEntered:1,inProgress:1,complete:1});
 assert.equal(s.total,3);
 assert.equal(s.stages[0].complete,2);
 assert.equal(s.stages[3].complete,1);
});
test('目标表现只在正式提交者中统计，首答和最近答共享同一分母',()=>{
 const students=[learner('A','601',{entered:true,submitted:{road:[false,true]}}),learner('B','601',{entered:true,submitted:{road:[true,true]}}),learner('C','601',{entered:true})];
 const s=summarizeClass({classId:'601',students},stages);
 assert.deepEqual(s.stages[0].assessment,{submitted:2,firstPassed:1,latestPassed:2,unanswered:1});
 assert.deepEqual(s.stages[1].assessment,{submitted:0,firstPassed:0,latestPassed:0,unanswered:3});
});
test('空班级返回零和无证据；缺少班级或混班数据不被默默合并',()=>{
 const zero=summarizeClass({classId:'603',students:[]},stages);
 assert.equal(zero.total,0);
 assert.equal(zero.stages[0].assessment.submitted,0);
 assert.throws(()=>summarizeClass({classId:'601',students:[learner('错班','602')]},stages),/班级/);
 assert.throws(()=>summarizeClass({classId:'601',students:null},stages),/学生/);
});

test('图表显示明确人数和分母，空班级显示无证据且不产生NaN', async()=>{
 const {renderClassCharts}=await import('../public/teacher-charts.mjs');
 const sample=summarizeClass({classId:'601',students:[learner('A','601',{entered:true,awards:['road'],submitted:{road:[false,true]}}),learner('B','601')]},stages);
 const html=renderClassCharts(sample);
 assert.match(html.statusHtml,/未进入.*1 人 · 50%/s);
 assert.match(html.stageHtml,/红灯.*1\/2 · 50%/s);
 assert.match(html.evidenceHtml,/已提交 1\/2 · 未提交 1/);
 assert.match(html.evidenceHtml,/首次符合.*0\/1.*最近符合.*1\/1/s);
 const empty=renderClassCharts(summarizeClass({classId:'606',students:[]},stages));
 assert.match(empty.evidenceHtml,/尚无提交证据/);
 assert.doesNotMatch(Object.values(empty).join(''),/NaN|Infinity/);
});
