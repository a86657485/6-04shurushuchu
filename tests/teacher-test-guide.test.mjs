import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {activities} from '../public/activities.mjs';
import {renderStageReference,renderExamReference} from '../public/teacher-test-guide.mjs';

const rules=createRequire(import.meta.url)('../public/rules.js');

test('教师可查看四关标准操作、三环节答案和迁移判断',()=>{
  for(const [stage,activity] of Object.entries(activities)){
    const html=renderStageReference(stage,activity,rules.examples[stage]);
    assert.match(html,/标准操作/);
    for(const part of ['input','compute','output']){
      const value=rules.examples[stage].diagram[part];
      assert.ok(html.includes(activity.diagram[part].find(([key])=>key===value)[1]),stage+' '+part);
    }
    assert.ok(html.includes(activity.transfer.find(([key])=>key===rules.examples[stage].transfer)[1]),stage);
  }
  assert.match(renderStageReference('sound',activities.sound,rules.examples.sound),/安静|轻声/);
  assert.match(renderStageReference('sound',activities.sound,rules.examples.sound),/明显声音/);
});

test('教师参考答案列出整套题库、正确答案与解析',()=>{
  const questions=[{id:'q1',goal:'输入信息',prompt:'声音属于什么？',options:['输出','输入'],answer:1,explanation:'麦克风采集声音。'}];
  const html=renderExamReference(questions);
  assert.match(html,/题库参考答案/);
  assert.match(html,/正确答案：输入/);
  assert.match(html,/解析：麦克风采集声音/);
  assert.match(html,/共 1 题/);
});
