const arrows=['↑','→','↓','←'];
const names=['上','右','下','左'];

export function describeMove({direction,moved,merges,scoreDelta}){
  const input=`按下${arrows[direction]}，让数字向${names[direction]}移动`;
  if(!moved)return {input,compute:'这个方向上没有产生位置变化或合并',output:'棋盘和分数不变'};
  return {
    input,
    compute:`向${names[direction]}滑动；${merges?`${merges}组相同数字合并`:'这次没有相同数字合并'}`,
    output:`棋盘更新，补进新方块；${scoreDelta?`本次得分 +${scoreDelta}`:'本次未得分'}`
  };
}

export class Reward2048{
  constructor(container,playerKey){
    this.container=container;
    this.container.innerHTML=`<div class="reward-2048"><p class="eyebrow">考核后奖励 · 开源游戏体验</p><h2>2048：给出方向，看规则怎样改变棋盘</h2><p>用方向键或方向按钮移动数字。相同数字碰到一起会合并；观察你的操作怎样改变棋盘与分数。</p><div class="reward-2048-layout"><iframe title="2048 数字合并游戏" src="/vendor/2048/index.html?player=${encodeURIComponent(playerKey)}"></iframe><aside><h3>移动方向</h3><div class="reward-2048-buttons"><button data-reward-move="0" aria-label="向上移动">↑</button><div><button data-reward-move="3" aria-label="向左移动">←</button><button data-reward-move="2" aria-label="向下移动">↓</button><button data-reward-move="1" aria-label="向右移动">→</button></div></div><h3>最近一次操作</h3><div class="reward-2048-flow" aria-live="polite"><div><b>输入</b><span data-part="input">等待你给出移动方向</span></div><div><b>规则处理</b><span data-part="compute">方块按方向滑动，相同数字相遇时合并</span></div><div><b>可见结果</b><span data-part="output">等待棋盘与分数变化</span></div></div><p class="reward-2048-challenge">观察挑战：试一次没有合并的移动，再试一次发生合并的移动。两次结果哪里不同？</p><p class="note">这是选做体验，不改变考核成绩或主线积分。</p></aside></div><p class="reward-credit">改编自 Gabriele Cirulli 的 2048，按 MIT 许可保留来源与许可证；游戏文件在本机运行。</p></div>`;
    this.frame=this.container.querySelector('iframe');
    this.container.querySelectorAll('[data-reward-move]').forEach(button=>button.onclick=()=>this.frame.contentWindow.postMessage({type:'lesson4-2048-command',direction:Number(button.dataset.rewardMove)},location.origin));
    this.onMessage=event=>{
      if(event.origin!==location.origin||event.source!==this.frame.contentWindow)return;
      if(event.data?.type==='lesson4-2048-move'){
        const move=describeMove(event.data);
        for(const [part,value] of Object.entries(move))this.container.querySelector(`[data-part="${part}"]`).textContent=value;
      }else if(event.data?.type==='lesson4-2048-restart'){
        this.container.querySelector('[data-part="input"]').textContent='开始新一局';
        this.container.querySelector('[data-part="compute"]').textContent='重新生成起始棋盘';
        this.container.querySelector('[data-part="output"]').textContent='棋盘和本局分数已重置';
      }
    };
    this.resize=()=>{const body=this.frame.contentDocument?.body;if(body){const style=getComputedStyle(body);this.frame.style.height=`${body.scrollHeight+parseFloat(style.marginTop)+parseFloat(style.marginBottom)+2}px`;}};
    this.frame.onload=this.resize;
    window.addEventListener('message',this.onMessage);
    window.addEventListener('resize',this.resize);
  }
  destroy(){window.removeEventListener('message',this.onMessage);window.removeEventListener('resize',this.resize);this.container.innerHTML='';}
}
