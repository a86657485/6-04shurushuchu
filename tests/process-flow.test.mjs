import test from 'node:test';
import assert from 'node:assert/strict';
import {activities} from '../public/activities.mjs';
import {renderProcessFlow} from '../public/process-flow.mjs';

test('四关都能把已有学习记录还原成三个相连节点，不依赖下拉框',()=>{
  for(const [stage,activity] of Object.entries(activities)){
    const values=Object.fromEntries(Object.entries(activity.diagram).map(([part,choices])=>[part,choices[0][0]]));
    const html=renderProcessFlow(activity.diagram,values,'input');
    assert.equal((html.match(/class="flow-node/g)||[]).length,3,stage);
    assert.equal((html.match(/class="flow-arrow/g)||[]).length,2,stage);
    assert.ok(html.indexOf('输入')<html.indexOf('计算')&&html.indexOf('计算')<html.indexOf('输出'),stage);
    for(const [part,choices] of Object.entries(activity.diagram)){
      assert.match(html,new RegExp(`id="diagram-${part}"`),stage);
      assert.ok(html.includes(choices[0][1]),stage+' restored choice '+part);
    }
    assert.doesNotMatch(html,/<select\b/i,stage);
  }
});

test('选择词卡不会预填答案，错误与未选内容仍可重新点节点修改',()=>{
  const html=renderProcessFlow(activities.sound.diagram,{input:'sensor',compute:'',output:''},'input');
  assert.match(html,/id="diagram-input"[\s\S]*声音检测装置/);
  assert.match(html,/id="diagram-compute"[\s\S]*点击选择/);
  assert.match(html,/data-flow-value="sound"/);
  assert.match(html,/data-flow-value="sensor"/);
});
