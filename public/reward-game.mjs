// Adapted from Ayush Verma's MIT-licensed Simon Says Game (sequence, flash, compare, retry).
// Source and license: public/vendor/simon-game-SOURCE.md and simon-game-LICENSE.
const signals=['red','yellow','blue','green'];
const names={red:'红',yellow:'黄',blue:'蓝',green:'绿'};
const choose=()=>Math.floor(Math.random()*signals.length);

export function createGame(pickIndex=choose){return {gameSeq:[signals[pickIndex()]],userSeq:[],status:'input',last:null};}
export function pressSignal(game,input){
  if(game.status!=='input')return game;
  const position=game.userSeq.length+1,expected=game.gameSeq[position-1],match=input===expected;
  const userSeq=[...game.userSeq,input];
  const output=!match?'warning':userSeq.length===game.gameSeq.length?'success':'continue';
  return {...game,userSeq,status:!match?'retry':output==='success'?'review':'input',last:{input,expected,position,match,output}};
}
export function retryRound(game){return game.status==='retry'?{...game,userSeq:[],status:'input',last:null}:game;}
export function replayRound(game){return game.status==='input'?{...game,userSeq:[],last:null}:game;}
export function nextRound(game,pickIndex=choose){return game.status==='review'?{gameSeq:[...game.gameSeq,signals[pickIndex()]],userSeq:[],status:'input',last:null}:game;}

export class RewardGame{
  constructor(container){this.container=container;this.game=null;this.playing=false;this.epoch=0;this.conceptCorrect=false;this.conceptError='';this.render();}
  destroy(){this.epoch++;this.container.innerHTML='';}
  async play(){
    const epoch=++this.epoch;this.playing=true;this.render();
    for(const color of this.game.gameSeq){
      await new Promise(resolve=>setTimeout(resolve,300));if(epoch!==this.epoch)return;
      const button=this.container.querySelector(`[data-signal="${color}"]`);button?.classList.add('lit');
      await new Promise(resolve=>setTimeout(resolve,550));if(epoch!==this.epoch)return;
      button?.classList.remove('lit');
    }
    this.playing=false;this.render();this.container.querySelector('[data-signal]')?.focus();
  }
  start(){this.game=createGame();this.conceptCorrect=false;this.conceptError='';this.play();}
  press(color){if(this.playing||!this.game||!signals.includes(color))return;this.game=pressSignal(this.game,color);this.conceptCorrect=false;this.conceptError='';this.render();}
  render(){
    const g=this.game,last=g?.last,round=g?.gameSeq.length||0,done=round===3&&g?.status==='review'&&this.conceptCorrect;
    const status=!g?'按开始，观察信号灯亮起的顺序。':this.playing?'请观察灯光，稍后按顺序点击。':g.status==='retry'?'顺序不同。观察计算结果，重播后再试。':g.status==='review'?'灯光顺序正确。说出系统如何计算，才进入下一轮。':`第 ${round} 轮：已输入 ${g.userSeq.length}/${round} 个信号。`;
    const input=last?`点击${names[last.input]}灯（第${last.position}个）`:'等待你点击信号灯';
    const compute=last?`目标是${names[last.expected]}灯，输入${names[last.input]}灯，${last.match?'相同':'不同'}`:'系统将逐位比较输入与目标顺序';
    const output=last?last.output==='warning'?'警示灯亮，等待重试':last.output==='success'?'成功灯亮，本轮完成':'确认灯亮，等待下一次输入':'等待比较结果';
    this.container.innerHTML=`<div class="reward-card"><p class="eyebrow">考核后奖励 · 信号控制台</p><h2>记住灯光，让系统回应你</h2><p>先看灯光序列，再按相同顺序点亮。每次点击都能看见“输入 → 计算 → 输出”。不计入考核分数。</p><p class="reward-status" role="status">${status}</p><div class="reward-signals" aria-label="四盏信号灯">${signals.map(color=>`<button type="button" class="reward-light ${color}" data-signal="${color}" aria-label="${names[color]}灯" ${!g||this.playing||g.status!=='input'?'disabled':''}><span>${names[color]}灯</span></button>`).join('')}</div><div class="reward-flow" aria-label="本次操作的输入、计算、输出"><div><b>输入</b><span>${input}</span></div><i aria-hidden="true">→</i><div><b>计算</b><span>${compute}</span></div><i aria-hidden="true">→</i><div><b>输出</b><strong class="reward-output-indicator ${last?.output||'off'}" aria-hidden="true"></strong><span>${output}</span></div></div><div class="choice-row reward-actions">${!g?'<button id="reward-start" class="primary">开始游戏</button>':''}${g&&!this.playing&&g.status==='input'?'<button id="reward-replay">重播灯光</button>':''}${g&&!this.playing&&g.status==='retry'?'<button id="reward-retry" class="primary">重播并重试</button>':''}${g?.status==='review'?`<div class="reward-question"><b>刚才“计算”做了什么？</b><div class="choice-row"><button data-concept="correct" ${this.conceptCorrect?'disabled':''}>逐位比较点击与目标信号</button><button data-concept="wrong" ${this.conceptCorrect?'disabled':''}>只看最后一盏灯的颜色</button></div><small role="status">${this.conceptError|| (this.conceptCorrect?'答对了。输入的顺序经过比较，决定输出哪种灯光。':'选出与刚才操作相符的处理过程。')}</small></div>${this.conceptCorrect?(done?'<button id="reward-restart" class="primary">三轮完成 · 再玩一次</button>':'<button id="reward-next" class="primary">进入下一轮</button>'):''}`:''}</div><p class="reward-credit">改编自开源 Simon Says Game（MIT 许可）；此处为本课的输入、计算、输出练习。</p></div>`;
    this.container.querySelectorAll('[data-signal]').forEach(button=>button.onclick=()=>this.press(button.dataset.signal));
    const bind=(id,fn)=>{const button=this.container.querySelector(id);if(button)button.onclick=fn;};
    bind('#reward-start',()=>this.start());bind('#reward-replay',()=>{this.game=replayRound(this.game);this.play();});bind('#reward-retry',()=>{this.game=retryRound(this.game);this.play();});bind('#reward-next',()=>{this.game=nextRound(this.game);this.conceptCorrect=false;this.play();});bind('#reward-restart',()=>this.start());
    this.container.querySelectorAll('[data-concept]').forEach(button=>button.onclick=()=>{this.conceptCorrect=button.dataset.concept==='correct';this.conceptError=this.conceptCorrect?'':'再看中间的计算节点：系统比较的是整个顺序。';this.render();});
  }
}
