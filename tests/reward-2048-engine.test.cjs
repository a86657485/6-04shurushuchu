const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'../public/vendor/2048/js');
function load(context,file){vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context,{filename:file});}

test('原版2048实际滑动与合并后，向课堂页面报告真实结果',()=>{
  const events=[];
  const context=vm.createContext({window:{parent:{postMessage:data=>events.push(data)},location:{origin:'http://classroom.local'}}});
  context.FakeInput=function(){this.on=()=>{};};
  context.FakeActuator=function(){this.actuate=()=>{};this.continueGame=()=>{};};
  context.FakeStorage=function(){this.getGameState=()=>null;this.getBestScore=()=>0;this.setBestScore=()=>{};this.setGameState=()=>{};this.clearGameState=()=>{};};
  for(const file of ['tile.js','grid.js','game_manager.js'])load(context,file);
  vm.runInContext('var game=new GameManager(4,FakeInput,FakeActuator,FakeStorage);game.grid=new Grid(4);game.grid.insertTile(new Tile({x:0,y:0},2));game.grid.insertTile(new Tile({x:1,y:0},2));game.score=0;game.move(3);',context);
  assert.equal(events.at(-1)?.type,'lesson4-2048-move');
  assert.deepEqual(JSON.parse(JSON.stringify(events.at(-1))),{type:'lesson4-2048-move',direction:3,moved:true,merges:1,scoreDelta:4});
  events.length=0;
  vm.runInContext('game.grid=new Grid(4);game.grid.insertTile(new Tile({x:0,y:0},2));game.score=0;game.move(3);',context);
  assert.deepEqual(JSON.parse(JSON.stringify(events.at(-1))),{type:'lesson4-2048-move',direction:3,moved:false,merges:0,scoreDelta:0});
});

test('2048本机续玩记录按学生和轮次隔离',()=>{
  const data=new Map(),storage={setItem:(k,v)=>data.set(k,v),getItem:k=>data.get(k),removeItem:k=>data.delete(k)};
  const context=vm.createContext({window:{location:{search:'?player=a%3Ar1'},localStorage:storage},URLSearchParams});
  load(context,'local_storage_manager.js');
  const a=vm.runInContext('new LocalStorageManager()',context);
  context.window.location.search='?player=b%3Ar1';
  const b=vm.runInContext('new LocalStorageManager()',context);
  assert.notEqual(a.gameStateKey,b.gameStateKey);
  assert.notEqual(a.bestScoreKey,b.bestScoreKey);
});
