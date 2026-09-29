import test from 'node:test';
import assert from 'node:assert/strict';
import {describeMove} from '../public/reward-2048.mjs';

test('一次合并会把真实方向、规则处理和棋盘分数变化对应起来',()=>{
  assert.deepEqual(describeMove({direction:3,moved:true,merges:1,scoreDelta:4}),{
    input:'按下←，让数字向左移动',
    compute:'向左滑动；1组相同数字合并',
    output:'棋盘更新，补进新方块；本次得分 +4'
  });
});

test('没有合并和没有移动分别显示不同结果，不虚报得分',()=>{
  assert.deepEqual(describeMove({direction:0,moved:true,merges:0,scoreDelta:0}),{
    input:'按下↑，让数字向上移动',
    compute:'向上滑动；这次没有相同数字合并',
    output:'棋盘更新，补进新方块；本次未得分'
  });
  assert.deepEqual(describeMove({direction:1,moved:false,merges:0,scoreDelta:0}),{
    input:'按下→，让数字向右移动',
    compute:'这个方向上没有产生位置变化或合并',
    output:'棋盘和分数不变'
  });
});
