import test from 'node:test';
import assert from 'node:assert/strict';
import {renderExamReview} from '../public/quiz.mjs';

test('wrong questions appear first with the chosen answer, correct answer, and explanation',()=>{
  const feedback=[
    {goal:'输入信息',prompt:'正确题',options:['甲','乙'],answer:0,chosen:0,correct:true,explanation:'正确题理由'},
    {goal:'计算处理',prompt:'错题',options:['灯亮','按规则判断'],answer:1,chosen:0,correct:false,explanation:'根据输入信号判断是否亮灯。'}
  ];
  const html=renderExamReview(feedback);
  assert.ok(html.indexOf('错题')<html.indexOf('正确题'));
  assert.match(html,/<details open>/);
  assert.match(html,/你的选择：灯亮/);
  assert.match(html,/正确答案：按规则判断/);
  assert.match(html,/解析：根据输入信号判断是否亮灯。/);
  assert.match(html,/错题 1 道/);
});
