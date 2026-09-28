import test, { beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { Microphone } from '../public/microphone.mjs';

let originalGlobals, statuses, samples, microphones, now, amplitude, trackStops, contextCloses, connections;
const globalNames = ['window', 'document', 'navigator', 'performance', 'requestAnimationFrame', 'cancelAnimationFrame'];

beforeEach(() => {
  originalGlobals = new Map(globalNames.map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
  statuses = []; samples = []; microphones = [];
  now = 1000; amplitude = .001; trackStops = 0; contextCloses = 0; connections = 0;
  const replace = (name, value) => Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
  replace('document', { hidden: false, addEventListener() {}, removeEventListener() {} });
  replace('performance', { now: () => now });
  replace('requestAnimationFrame', () => 1);
  replace('cancelAnimationFrame', () => {});
  replace('navigator', { mediaDevices: { getUserMedia: async () => ({ getTracks: () => [{ stop() { trackStops++; } }] }) } });
  class AudioContextStub {
    state = 'running';
    async resume() {}
    createMediaStreamSource() {
      return { connect() { connections++; }, disconnect() {} };
    }
    createAnalyser() {
      return {
        fftSize: 1024,
        getFloatTimeDomainData(data) {
          for (let index = 0; index < data.length; index++) data[index] = Math.sin(index * .12) * amplitude;
        },
        disconnect() {}
      };
    }
    async close() { contextCloses++; this.state = 'closed'; }
  }
  replace('window', { isSecureContext: true, AudioContext: AudioContextStub });
});

afterEach(() => {
  microphones.forEach(microphone => microphone.destroy());
  originalGlobals.forEach((descriptor, name) => {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else delete globalThis[name];
  });
});

function microphone() {
  const instance = new Microphone({ onStatus: status => statuses.push(status), onSample: sample => samples.push(sample) });
  microphones.push(instance);
  return instance;
}

test('不安全的访问地址给出错误，不申请麦克风或伪造模拟采样', async () => {
  window.isSecureContext = false;
  let requests = 0;
  navigator.mediaDevices.getUserMedia = async () => { requests++; };
  await microphone().start();
  assert.equal(requests, 0);
  assert.equal(statuses.at(-1).state, 'error');
  assert.match(statuses.at(-1).message, /localhost/);
  assert.equal(samples.length, 0);
});

test('设备缺失提供具体提示并保持停止状态', async () => {
  navigator.mediaDevices.getUserMedia = async () => { throw Object.assign(new Error('no input'), { name: 'NotFoundError' }); };
  const instance = microphone();
  await instance.start();
  assert.equal(statuses.at(-1).state, 'error');
  assert.match(statuses.at(-1).message, /没有可用麦克风/);
  assert.equal(instance.context, null);
  assert.equal(samples.length, 0);
});

test('权限拒绝给出回到浏览器授权或模拟模式的入口说明', async () => {
  navigator.mediaDevices.getUserMedia = async () => { throw Object.assign(new Error('denied'), { name: 'NotAllowedError' }); };
  await microphone().start();
  assert.equal(statuses.at(-1).state, 'error');
  assert.match(statuses.at(-1).message, /权限未开启/);
  assert.equal(samples.length, 0);
});

test('先校准背景噪声，完成后由真实样本振幅产生相对响度', async () => {
  const instance = microphone();
  await instance.start();
  assert.equal(statuses.at(-1).state, 'calibrating');
  assert.equal(samples.at(-1).level, 0);
  now = 1800; instance.read(instance.session);
  assert.equal(samples.at(-1).level, 0);
  now = 2600; instance.read(instance.session);
  assert.equal(statuses.at(-1).state, 'listening');
  now = 2700; instance.read(instance.session);
  assert.equal(samples.at(-1).level, 0, '稳定背景噪声不触发响度');
  amplitude = .1;
  now = 2800; instance.read(instance.session);
  assert.ok(samples.at(-1).level > .55, '明显超过底噪的声音能达到声控规则输入范围');
  assert.ok(samples.at(-1).level <= 1);
  assert.equal(samples.at(-1).source, 'microphone');
  assert.ok(samples.at(-1).raw > 0);
  assert.equal(connections, 1, '只连接分析器，无扬声器回放');
});

test('停止采声释放设备和音频上下文，后续读取不再采样', async () => {
  const instance = microphone();
  await instance.start();
  instance.stop();
  assert.equal(trackStops, 1);
  assert.equal(contextCloses, 1);
  assert.equal(instance.context, null);
  assert.equal(samples.at(-1).level, 0);
  assert.equal(statuses.at(-1).state, 'stopped');
  const count = samples.length;
  now = 4000; instance.read(instance.session);
  assert.equal(samples.length, count);
});

test('权限请求未完成时停止，迟到的设备流立即释放且不恢复采声', async () => {
  let resolveStream;
  navigator.mediaDevices.getUserMedia = () => new Promise(resolve => { resolveStream = resolve; });
  const instance = microphone();
  const pending = instance.start();
  instance.stop();
  resolveStream({ getTracks: () => [{ stop() { trackStops++; } }] });
  await pending;
  assert.equal(trackStops, 1);
  assert.equal(contextCloses, 0);
  assert.equal(instance.context, null);
  assert.equal(statuses.at(-1).state, 'stopped');
  assert.equal(samples.at(-1).level, 0);
});
