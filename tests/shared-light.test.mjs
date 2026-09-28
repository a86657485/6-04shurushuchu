import test from 'node:test';
import assert from 'node:assert/strict';
import {readSharedLight} from '../public/shared-light.mjs';

test('局域网共享事件只在教师正在采声且最近同步时驱动学生灯光',()=>{
  const now=Date.parse('2026-09-28T10:00:00Z');
  assert.deepEqual(readSharedLight({at:new Date(now-500).toISOString(),active:true,lamp:true,level:.9},now),{fresh:true,lamp:true,level:.9});
  assert.deepEqual(readSharedLight({at:new Date(now-6000).toISOString(),active:true,lamp:true,level:.9},now),{fresh:false,lamp:false,level:0});
  assert.deepEqual(readSharedLight({at:new Date(now-500).toISOString(),active:false,lamp:true,level:.9},now),{fresh:false,lamp:false,level:0});
});


test('学生电脑时钟与教师电脑不同步时，仍以服务端事件年龄和本机接收年龄判断',()=>{
  const serverNow=Date.parse('2026-09-28T10:00:00Z');
  const studentNow=serverNow+60000;
  const event={at:new Date(serverNow-500).toISOString(),serverNow,clientReceivedAt:studentNow,active:true,lamp:true,level:.8};
  assert.deepEqual(readSharedLight(event,studentNow),{fresh:true,lamp:true,level:.8});
  assert.deepEqual(readSharedLight(event,studentNow+6000),{fresh:false,lamp:false,level:0});
});
