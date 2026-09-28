import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,pressSignal,replayRound,retryRound,nextRound} from '../public/reward-game.mjs';

test('灯光序列从观察到逐位比较，输入、计算、输出都对应真实点击',()=>{
  let game=createGame(()=>2);
  assert.deepEqual(game.gameSeq,['blue']);
  assert.equal(game.status,'input');
  game=pressSignal(game,'blue');
  assert.equal(game.status,'review');
  assert.deepEqual(game.last,{input:'blue',expected:'blue',position:1,match:true,output:'success'});
  game=nextRound(game,()=>0);
  assert.deepEqual(game.gameSeq,['blue','red']);
  game=pressSignal(game,'blue');
  assert.equal(game.status,'input');
  assert.equal(game.last.output,'continue');
  game=pressSignal(game,'green');
  assert.equal(game.status,'retry');
  assert.deepEqual(game.last,{input:'green',expected:'red',position:2,match:false,output:'warning'});
  assert.deepEqual(game.userSeq,['blue','green']);
});

test('错误后重试同一序列，不增加关卡，也不因乱点进入下一关',()=>{
  const first=createGame(()=>0);
  const wrong=pressSignal(first,'green');
  assert.equal(nextRound(wrong,()=>1),wrong);
  assert.equal(pressSignal(wrong,'red'),wrong);
  const retry=retryRound(wrong);
  assert.deepEqual(retry.gameSeq,['red']);
  assert.deepEqual(retry.userSeq,[]);
  assert.equal(pressSignal(retry,'red').status,'review');
});

test('输入一半时重播从第一个信号重新开始',()=>{
  let game=createGame(()=>0);
  game=nextRound(pressSignal(game,'red'),()=>2);
  game=pressSignal(game,'red');
  const replay=replayRound(game);
  assert.deepEqual(replay.gameSeq,['red','blue']);
  assert.deepEqual(replay.userSeq,[]);
  assert.equal(replay.last,null);
  assert.equal(pressSignal(replay,'red').last.position,1);
});
