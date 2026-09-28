import test from 'node:test';
import assert from 'node:assert/strict';
import {chooseHintTarget} from '../public/hint-guide.mjs';

const complete = {
  prediction: 'stop',
  trials: [{signal: 'red', action: 'stop'}, {signal: 'green', action: 'check'}],
  diagram: {input: 'red', compute: 'wait', output: 'stop'},
  transfer: 'check'
};

test('预测、实验、解释、迁移与提交依次指向可执行的下一步', () => {
  assert.equal(chooseHintTarget('road', {}).selector, '#prediction-panel button:not(:disabled)');
  assert.equal(chooseHintTarget('road', {prediction: 'go'}).selector, '#stop-person');
  assert.equal(chooseHintTarget('road', {prediction: 'go', trials: [{signal: 'red', action: 'stop'}]}, {signal: 'red'}).selector, '#green');
  assert.equal(chooseHintTarget('road', {prediction: 'go', trials: complete.trials}).selector, '#diagram-input');
  assert.equal(chooseHintTarget('road', {...complete, transfer: ''}).selector, '#transfer-choice');
  assert.equal(chooseHintTarget('road', complete).selector, '#submit');
  assert.equal(chooseHintTarget('road', {...complete, submitted: true}, {passed: true}).selector, '#next');
});

test('不同场景按当前操作状态选择按钮，待记录时引导记录', () => {
  assert.equal(chooseHintTarget('sound', {prediction: 'yes'}, {source: 'simulation'}).selector, '#quiet');
  assert.equal(chooseHintTarget('sound', {prediction: 'yes', trials: [{level: 0, lamp: false, source: 'simulation'}]}, {source: 'simulation'}).selector, '#loud');
  assert.equal(chooseHintTarget('door', {prediction: 'open'}, {observationPending: true}).selector, '#record');
  assert.equal(chooseHintTarget('text', {prediction: 'same'}, {hasTextOutput: true}).selector, '#capture-text');
});

test('检验后的回学指向待修订位置，不透露正确选项', () => {
  const wrong = {...complete, diagram: {...complete.diagram, input: 'eye'}};
  const target = chooseHintTarget('road', wrong, {reviewErrors: ['输入描述需再检查：记录的是信息，还是设备？']});
  assert.equal(target.selector, '#diagram-input');
  assert.match(target.label, /输入/);
  assert.doesNotMatch(target.label, /红灯亮起的信息/);
});
