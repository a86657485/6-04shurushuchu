const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
test('后台声音处理只输出响度标量，音频输出始终静音',()=>{
 let Processor;const messages=[];
 const context=vm.createContext({sampleRate:48000,AudioWorkletProcessor:class{port={postMessage:value=>messages.push(value)};},registerProcessor:(_name,constructor)=>Processor=constructor});
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../public/microphone-level-worklet.js'),'utf8'),context);
 const processor=new Processor(),input=Float32Array.from({length:128},(_,i)=>i%2?.2:-.2),output=new Float32Array(128).fill(1);
 for(let i=0;i<14;i++)assert.equal(processor.process([[input]],[[output]]),true);
 assert.ok(messages.length>0);assert.ok(Math.abs(messages[0].raw-.2)<1e-6);assert.deepEqual(Object.keys(messages[0]),['raw']);assert.ok(output.every(v=>v===0));
});
