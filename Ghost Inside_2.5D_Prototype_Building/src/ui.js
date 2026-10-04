import { EVIDENCE, HOTSPOTS, TIMELINE, INFERENCES, HELP, COMPOSER } from './game-data.js';
import { createInitialState, reduceGameState, canOpenInference, canPreview, chainNodes, validateExplanation } from './game.js';

const app = document.querySelector('#app');
let state = createInitialState();
let restartConfirm = false;
let requestController = null;
const introLines = [
  '林澈总会想起这顿晚餐。',
  '他记得的样子，与那晚留下的片段，可能不完全相同。',
  '点击房间里的物件和人物，找到值得追问的地方。'
];

const esc = value => String(value ?? '').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const dispatch = action => { state = reduceGameState(state, action); syncDerived(); render(); };
function syncDerived(){
  state.evidenceIds=[...state.found];
  state.mode=state.phase;
  if(state.toast) window.clearTimeout(syncDerived.timer), syncDerived.timer=window.setTimeout(()=>{state={...state,toast:''};render();},4200);
}

async function detectProvider(){
  try{
    const response=await fetch('/api/status',{headers:{Accept:'application/json'}});
    if(!response.ok) throw new Error();
    const data=await response.json();
    const live=data.source==='live'||data.mode==='live_available'||data.providerConfigured===true;
    state={...state,fallback:!live,providerSource:live?'live':'backup'};
  }catch{ state={...state,fallback:true,providerSource:'backup'}; }
  render();
}

async function askProvider(payload, fallbackReply){
  if(state.pending) return;
  requestController=new AbortController();
  state={...state,pending:true,toast:'正在结合你找到的线索回应……'};render();
  const timer=setTimeout(()=>requestController?.abort(),8000);
  try{
    const response=await fetch('/api/respond',{method:'POST',headers:{'Content-Type':'application/json'},signal:requestController.signal,body:JSON.stringify(payload)});
    if(!response.ok) throw new Error('bad response');
    const data=await response.json();
    let found=[...state.found];
    for(const id of data.unlockEvidence||[]) if(EVIDENCE[id]) found=[...new Set([...found,id])];
    state={...state,pending:false,found,evidenceIds:found,fallback:data.source!=='live',providerSource:data.source||'backup',panel:{type:'reply',id:payload.target||'ghost',reply:data.reply||fallbackReply},toast:''};
  }catch(error){
    state={...state,pending:false,fallback:true,providerSource:'backup',panel:{type:'reply',id:payload.target||'ghost',reply:fallbackReply},toast:error.name==='AbortError'?'AI 回应超时，已切换到备用互动；进度没有丢失。':'当前使用备用互动；回答只依据已记录的事实。'};
  }finally{clearTimeout(timer);requestController=null;render();}
}

function stageKey(){ return state.phase==='act'?'reconstruct':state.phase; }
function objective(){
  if(state.phase==='investigate') return state.found.length===0?'点击桌上的成绩单。':'找一处值得核对的说法。';
  if(state.phase==='infer') return '哪一步把经历变成了对自己的判决？';
  if(state.phase==='reconstruct') return '给这段记忆一个更有依据的解释。';
  if(state.phase==='act') return state.chosenAction==='speak'?'到桌边，把话说完。':'到门口，确认暂停。';
  return '看看这次尝试改变了什么。';
}

function topbar(){
  const order=['investigate','infer','reconstruct'];
  const current=state.phase==='act'||state.phase==='result'?'reconstruct':state.phase;
  const idx=order.indexOf(current);
  return `<header class="topbar"><div class="brand"><b>GHOST INSIDE</b><small>那顿没有结束的晚餐</small></div>
    <div class="steps">${['调查记忆','看清推断','尝试改变'].map((x,i)=>`<div class="step ${i===idx?'on':''} ${i<idx?'done':''}"><i>${i+1}</i><span>${x}</span></div>${i<2?'<div class="step-line"></div>':''}`).join('')}</div>
    <div class="objective"><span class="eyebrow">当前目标</span><br>${objective()}</div>
    <button class="ghost-btn" data-action="help">给我一点提示</button></header>`;
}

function hotspot(id, cls){
  const h=HOTSPOTS[id]; const seen=state.inspected.includes(id); const active=state.view==='replay'&&TIMELINE.find(x=>x.time===state.time)?.active===id;
  const disabled=(id==='phone'&&!(state.view==='replay'&&state.time==='19:12'))||(id==='plate'&&!(state.view==='replay'&&state.time==='19:13'));
  return `<button ${disabled?'aria-disabled="true"':''} class="hotspot ${cls} ${seen?'seen':''} ${active?'active':''}" data-action="inspect" data-id="${id}" ${id==='grade'?'data-testid="object-report"':id==='plate'?'data-testid="object-plate"':id==='lin'?'data-testid="object-lin"':''}><span class="orb">${h.icon}</span><span>${h.label}${seen?' · 已查看':''}</span></button>`;
}

function room(){
  const moment=TIMELINE.find(x=>x.time===state.time);
  const showPanel=!!state.panel||state.evidenceOpen||state.helpOpen;
  const act=state.phase==='act';
  return `<main class="workspace"><div class="room-wrap ${showPanel?'':'full'}"><div class="room ${state.view}">
    <div class="wall-back"></div><div class="window"></div><div class="floor"></div><div class="door"></div><div class="door-glow"></div><div class="table"></div><div class="chair"></div>
    ${state.view==='memory'?'<div class="memory-text">“他整晚都没有再理我。”<br>“我不够好。”</div>':`<div class="replay-card"><b>${moment.time}</b>${moment.text}</div>`}
    ${hotspot('grade','grade')}${hotspot('phone','phone')}${hotspot('plate','plate')}${hotspot('father','father')}${hotspot('lin','lin')}
    ${act?actionPrompt():''}
  </div></div>
  ${showPanel?sidePanel():''}
  ${state.phase==='investigate'||state.phase==='act'?`<div class="perspective-bar"><button class="${state.view==='memory'?'on':''}" data-action="view" data-view="memory">记得的样子</button><button class="${state.view==='replay'?'on':''}" data-action="view" data-view="replay" data-testid="view-replay">现场回放</button></div>`:''}
  ${state.view==='replay'&&(state.phase==='investigate'||state.phase==='act')?`<div class="timeline">${TIMELINE.map(x=>`<button class="time-btn ${state.time===x.time?'on':''}" data-action="time" data-time="${x.time}" ${x.time==='19:13'?'data-testid="replay-1913"':''}>${x.time}</button>`).join('')}</div>`:''}
  </main>`;
}

function inspectPanel(id){
  const h=HOTSPOTS[id]||HOTSPOTS.grade; const ev=id==='grade'?EVIDENCE.M01:id==='father'?EVIDENCE.M02:id==='lin'?EVIDENCE.M03:id==='phone'?EVIDENCE.M04:EVIDENCE.M05;
  const unlocked=state.found.includes(ev.id);
  let questions='';
  if(id==='lin') questions=`<button class="choice" data-action="fixed-ask" data-id="lin-feeling">你当时怎么理解他的沉默？</button><button class="choice" data-action="target-m05">“整晚没理我”是完全准确的吗？</button>`;
  if(id==='father') questions=`<button class="choice" data-action="fixed-ask" data-id="father-record">你当时为什么不说话？</button>`;
  return `<div class="panel-head"><div><span class="eyebrow">调查对象</span><h2>${h.label}</h2></div><button class="close" data-action="close" aria-label="关闭">×</button></div><p>${h.description}</p>
    ${unlocked?`<div class="found-card"><b>获得 ${ev.id} · ${ev.kind}</b>${ev.short}</div>`:'<div class="notice">这个时刻没有留下可确认的新记录。换一个回放时刻再看。</div>'}
    ${questions?`<div class="question-list"><span class="eyebrow">可以追问</span>${questions}</div>`:''}
    ${(id==='lin'||id==='father')?`<form data-form="ask" data-target="${id}"><label class="eyebrow" for="ask">或用自己的话问</label><textarea id="ask" data-testid="ask-input" maxlength="200" placeholder="输入你的问题（不会自动改变事实）"></textarea><button class="primary" data-testid="ask-submit" type="submit">询问${id==='lin'?'林澈':'父亲投影'}</button></form>`:''}
    <p class="notice">${id==='lin'?'感受值得被看见，事件细节仍可以核对。':id==='father'?'投影只会依据现场记录回答，不会补写他的内心。':'现场记录只说明发生过什么。'}</p>`;
}

function replyPanel(){ return `<div class="panel-head"><div><span class="eyebrow">回应</span><h2>${state.panel.id==='father'?'父亲投影':'林澈投影'}</h2></div><button class="close" data-action="close">×</button></div><p>${esc(state.panel.reply)}</p><button class="secondary" data-action="close">回到现场</button>`; }
function evidencePanel(){ return `<div class="panel-head"><div><span class="eyebrow">只显示已发现内容</span><h2>证据册 · ${state.found.length}/6</h2></div><button class="close" data-action="evidence-close">×</button></div>${state.found.length?state.found.map(id=>{const e=EVIDENCE[id];return `<article class="evidence-full"><span class="tag">${e.kind}</span><h3>${e.id} · ${e.title}</h3><small>${e.source}</small><p>${e.body}</p></article>`}).join(''):'<p>调查房间后，线索会出现在这里。</p>'}<button class="secondary" data-action="evidence-close">回到现场</button>`; }
function helpPanel(){
  const key=stageKey(), level=state.helpLevel;
  return `<div class="panel-head"><div><span class="eyebrow">渐进提示</span><h2>我该做什么？</h2></div><button class="close" data-action="help-close">×</button></div>
    <p>提示只帮助你找到核对方向，不会替你完成判断。</p>${level?Array.from({length:level},(_,i)=>`<div class="help-level"><b>${i+1===3?'明确定位':i+1===2?'思考方向':'操作提示'}</b><p>${HELP[key][i]}</p></div>`).join(''):'<div class="notice">先获取一条操作提示。需要时可以继续加深。</div>'}
    ${level<3?`<button class="primary" data-action="help-next">${level===2?'直接告诉我核对哪里':'再给一点提示'}</button>`:'<button class="secondary" data-action="help-close">继续探索</button>'}`;
}
function sidePanel(){ return `<aside class="side-panel">${state.helpOpen?helpPanel():state.evidenceOpen?evidencePanel():state.panel?.type==='reply'?replyPanel():inspectPanel(state.panel?.id||'grade')}</aside>`; }

function actionPrompt(){
  const speak=state.chosenAction==='speak', atPlace=speak?state.actorPosition==='table':state.actorPosition==='door';
  return `<div class="act-prompt"><span class="eyebrow">亲手完成这次尝试</span><h2>${speak?'留下，把话说完':'离开审视，暂停谈话'}</h2><p>${speak?'评价声不再盖住林澈的声音；门口的牵引仍在。':'椅子的牵引已经松开；桌边的话仍未说完。'}</p><div class="act-controls">${!atPlace?`<button class="primary" data-action="move" data-position="${speak?'table':'door'}" ${speak?'data-testid="move-table"':'data-testid="move-door"'}>${speak?'到桌边':'到门口'}</button>`:`<button class="primary" data-action="finish" data-id="${state.chosenAction}" ${speak?'data-testid="act-express"':'data-testid="act-pause"'}>${speak?'把这句话说完':'在这里暂停'}</button>`}</div></div>`;
}

function bottomNav(){
  return `<nav class="bottom-nav"><button class="secondary" data-action="evidence" ${state.found.length?'':'disabled'}>证据册 <span class="count">${state.found.length}</span></button><button class="primary" data-action="inference" data-testid="open-belief" ${canOpenInference(state)?'':'disabled'}>查看信念链</button>${!state.confirmed?'<button class="secondary" data-action="try-limit">试着起身 / 开口</button>':''}</nav>`;
}

function inferenceScreen(){
  const nodes=chainNodes(state); const arrowIds=[null,'silence',null,'worth'];
  return `<main class="inference-screen"><span class="eyebrow">第二阶段</span><h1>看清这条信念是怎样连起来的</h1><p class="sub">这是林澈当时的理解，不代表这些推断都成立。点击发光的箭头，选择一处核对。</p>
    <div class="chain">${nodes.map((n,i)=>`${i?`<button class="arrow ${arrowIds[i-1]?'selectable':''} ${state.selectedInference===arrowIds[i-1]?'selected':''}" ${arrowIds[i-1]?`data-action="select-inference" data-id="${arrowIds[i-1]}" ${arrowIds[i-1]==='worth'?'data-testid="inference-worth"':''}`:'disabled'} aria-label="${arrowIds[i-1]?'检查这一步':'固定联系'}">→</button>`:''}<div class="node ${n.known?'':'unknown'}">${n.label}</div>`).join('')}</div>
    ${state.selectedInference?reasoningPanel():`<div class="reasoning"><h2>选择一条发光箭头</h2><p class="sub">你可以检查“沉默是否等于失望”，也可以检查“一次不够好是否等于不值得被爱”。</p></div>`}
    <div class="actions"><button class="secondary" data-action="back-room">回去调查</button><button class="secondary" data-action="evidence">查看证据册</button></div></main>`;
}

function reasoningPanel(){
  const inf=INFERENCES[state.selectedInference];
  const cited=state.cited;
  return `<section class="reasoning"><span class="eyebrow">你选择核对</span><h2>${inf.title}</h2><p>${inf.question}</p><p class="notice">${inf.guidance}</p>
    <div class="judgements">${[['supported','有依据'],['uncertain','还不能确定'],['invalid','不能这样推出']].map(([v,l])=>`<button class="choice ${state.judgement===v?'on':''}" data-action="judge" data-value="${v}">${l}</button>`).join('')}</div>
    <h3>选择一至两条依据</h3><div class="evidence-picker">${state.found.map(id=>{const e=EVIDENCE[id];return `<button class="evidence-mini ${cited.includes(id)?'on':''}" data-action="cite" data-id="${id}" data-testid="evidence-${id}"><small>${e.id} · ${e.kind}</small><b>${e.title}</b><br>${cited.includes(id)?'✓ 已用作依据':'用作依据'}</button>`}).join('')}</div>
    <h3>你想怎样看待这一步？</h3><div class="mode-tabs"><button class="pill ${state.inputMode==='compose'?'on':''}" data-action="input-mode" data-mode="compose">组合短句</button><button class="pill ${state.inputMode==='free'?'on':''}" data-action="input-mode" data-mode="free">用自己的话说</button></div>
    ${state.inputMode==='compose'?composer(inf):freeInput()}
    <div class="actions"><button class="primary" data-action="confirm-explanation">确认这表达了我的意思</button></div></section>`;
}
function composer(inf){
  const opts=COMPOSER[state.selectedInference];
  return `<div class="explanation-preview">${esc(state.explanation||'选择各一条内容，组成你自己的解释。')}</div><div class="composer-grid"><fieldset><legend>我能从记录中知道</legend>${opts.known.map(x=>`<label class="select-card"><input type="radio" name="known" value="${esc(x)}" ${state.composeKnown===x?'checked':''}> ${x}</label>`).join('')}</fieldset><fieldset><legend>我愿意保留的未知或边界</legend>${opts.unknown.map(x=>`<label class="select-card"><input type="radio" name="unknown" value="${esc(x)}" ${state.composeUnknown===x?'checked':''}> ${x}</label>`).join('')}</fieldset></div>`;
}
function freeInput(){ return `<label for="reconstruction" class="eyebrow">你的解释 · 最多 200 字</label><textarea id="reconstruction" data-testid="reconstruction-input" maxlength="200" placeholder="例如：我还不能确定沉默的全部原因……">${esc(state.draft)}</textarea><div class="charcount">${state.draft.length}/200 · 备用互动不会按字数评分</div>`; }

function reconstructScreen(){
  return `<main class="inference-screen"><span class="eyebrow">第三阶段</span><h1>尝试一种新的行动</h1><p class="sub">过去不会被改写。你正在改变这段记忆对现在行动的限制。</p>
    <section class="reasoning"><h2>你的解释</h2><div class="explanation-preview">${esc(state.explanation)}</div><p class="notice">依据：${state.cited.map(id=>EVIDENCE[id].title).join('、')}。父亲的全部动机仍然未知。</p>
    <h3>这一次，你想先练习什么？</h3><div class="actions"><button class="action-card ${state.chosenAction==='speak'?'on':''}" data-action="choose-action" data-id="speak" data-testid="outcome-express"><b>把话说完</b><small>留下表达自己的感受与边界。不会保证父亲理解。</small></button><button class="action-card ${state.chosenAction==='pause'?'on':''}" data-action="choose-action" data-id="pause" data-testid="outcome-pause"><b>先暂停谈话</b><small>离开审视，暂时保护自己。桌边对话仍未完成。</small></button></div>
    <div class="actions"><button class="primary" data-action="preview" data-testid="preview" ${state.chosenAction?'':'disabled'}>预览这次尝试</button><button class="secondary" data-action="back-infer">修改解释</button><button class="secondary" data-action="back-room">回去调查</button></div></section></main>`;
}

function previewModal(){
  const speak=state.chosenAction==='speak';
  return `<div class="modal-backdrop"><section class="modal"><span class="eyebrow">确认前预览 · 此时场景尚未改变</span><h2>${speak?'留下，把话说完':'离开审视，先暂停'}</h2><p>“${esc(state.explanation)}”</p><div class="preview-list"><div class="preview-box"><b>即将改变</b>${speak?'评价声不再遮盖林澈的表达。':'座位不再把林澈拉回原处。'}</div><div class="preview-box"><b>仍未解决</b>${speak?'父亲是否理解仍然未知；离席限制仍在。':'桌边对话仍未完成；表达限制仍在。'}</div></div><div class="actions"><button class="primary" data-action="confirm-preview" data-id="${state.chosenAction}" data-testid="confirm-reconstruction">确认这次尝试</button><button class="secondary" data-action="close-preview">修改解释</button><button class="secondary" data-action="back-room">回去调查</button></div></section></div>`;
}

function resultModal(){
  const speak=state.result==='speak';
  return `<div class="modal-backdrop"><section class="modal result"><span class="eyebrow">这次练习已经完成</span><h1>${speak?'林澈把那句话说完了':'林澈走到了门口'}</h1><p>${speak?'“这次我没有达到期待，但我想把自己的感受说完。”房间里那道评价声退到了远处。':'“我现在不能继续这场谈话。我需要先离开一下。”椅子没有再把他拉回去。'}</p><div class="result-grid"><div class="result-box"><b>你改变了什么</b>${speak?'表达不再被评价声覆盖。':'林澈可以离开审视，暂停谈话。'}</div><div class="result-box"><b>仍然不知道什么</b>${speak?'父亲是否理解未知；门口牵引仍在。':'父亲的动机未知；桌边对话仍未完成。'}</div></div><p class="notice">这不是治愈结论。它只证明：同一段经历可以支持一种更有边界的行动。</p><div class="actions"><button class="primary" data-action="retry" data-testid="retry-reconstruction">保留证据，试另一种解释</button><button class="secondary" data-action="restart-request" data-testid="restart-game">从头开始</button></div></section></div>`;
}
function restartModal(){return `<div class="modal-backdrop"><section class="modal"><h2>确认从头开始？</h2><p>这会清除本轮调查、解释和行动结果。</p><div class="actions"><button class="primary" data-action="restart-confirm" data-testid="confirm-restart">清空并重新开始</button><button class="secondary" data-action="restart-cancel">取消，保留进度</button></div></section></div>`}
function introModal(){return `<div class="modal-backdrop"><section class="modal intro"><div class="mark">G</div><h1>Ghost Inside<span>那顿没有结束的晚餐</span></h1><p class="intro-copy">${introLines[state.intro]}</p><div class="dots">${introLines.map((_,i)=>`<i class="${i===state.intro?'on':''}"></i>`).join('')}</div><div class="intro-actions">${state.intro<2?'<button class="primary" data-action="intro-next">继续</button>':'<button class="primary" data-action="start" data-testid="start-game">开始调查</button>'}<button class="secondary" data-action="start">跳过引导</button></div></section></div>`}

function render(){
  const ids=state.found.join(',');
  app.dataset.evidenceIds=ids; app.dataset.outcome=state.outcome||''; app.dataset.effectExpression=String(state.effects.expression_unblocked); app.dataset.effectSeat=String(state.effects.seat_pull_released);
  let content='';
  if(!state.started) content=`<div class="game" data-testid="game-root">${introModal()}</div>`;
  else if(state.phase==='infer') content=`<div class="game" data-testid="game-root">${topbar()}${inferenceScreen()}${state.evidenceOpen||state.helpOpen?`<div class="modal-backdrop"><section class="modal">${state.helpOpen?helpPanel():evidencePanel()}</section></div>`:''}${bottomNav()}</div>`;
  else if(state.phase==='reconstruct') content=`<div class="game" data-testid="game-root">${topbar()}${reconstructScreen()}${state.preview?previewModal():''}</div>`;
  else content=`<div class="game" data-testid="game-root">${topbar()}${room()}${bottomNav()}${state.phase==='result'?resultModal():''}</div>`;
  app.innerHTML=content+`${state.toast?`<div class="toast" role="status">${esc(state.toast)}${state.pending?' <button class="secondary" data-action="cancel-request">取消请求</button>':''}</div>`:''}<div class="fallback-badge" data-testid="fallback-badge">${state.providerSource==='live'?'实时 AI 已连接':'备用互动 · 固定事实校验'}</div>${restartConfirm?restartModal():''}`;
}

app.addEventListener('click',e=>{
  const button=e.target.closest('[data-action]'); if(!button)return;
  const a=button.dataset.action;
  if(a==='intro-next')dispatch({type:'INTRO_NEXT'});
  if(a==='start')dispatch({type:'START'});
  if(a==='view')dispatch({type:'SET_VIEW',view:button.dataset.view});
  if(a==='time')dispatch({type:'SET_REPLAY_TIME',time:button.dataset.time});
  if(a==='inspect')dispatch({type:'INSPECT',target:button.dataset.id});
  if(a==='close')dispatch({type:'CLOSE_PANEL'});
  if(a==='evidence')dispatch({type:'OPEN_EVIDENCE'});
  if(a==='evidence-close')dispatch({type:'CLOSE_EVIDENCE'});
  if(a==='inference')dispatch({type:'OPEN_INFERENCE'});
  if(a==='back-room')dispatch({type:'BACK_ROOM'});
  if(a==='select-inference')dispatch({type:'SELECT_INFERENCE',id:button.dataset.id});
  if(a==='judge')dispatch({type:'JUDGE',value:button.dataset.value});
  if(a==='cite')dispatch({type:'SELECT_EVIDENCE',evidenceId:button.dataset.id});
  if(a==='input-mode')dispatch({type:'SET_INPUT_MODE',mode:button.dataset.mode});
  if(a==='confirm-explanation'){
    const text=state.inputMode==='free'?state.draft:state.explanation, verdict=validateExplanation(state,text);
    if(state.inputMode==='free'&&verdict.ok&&state.providerSource==='live'){
      const inference=state.selectedInference==='silence'?'silence_means_disappointment':'worth_depends_on_performance';
      askProvider({mode:'reconstruct',text,unlockedEvidence:state.found,selectedEvidence:state.cited,inference},verdict.message).then(()=>{ if(validateExplanation(state,text).ok) dispatch({type:'CONFIRM_EXPLANATION'}); });
    }else dispatch({type:'CONFIRM_EXPLANATION'});
  }
  if(a==='choose-action')dispatch({type:'CHOOSE_ACTION',id:button.dataset.id});
  if(a==='preview')dispatch({type:'OPEN_PREVIEW'});
  if(a==='close-preview')dispatch({type:'CLOSE_PREVIEW'});
  if(a==='confirm-preview')dispatch({type:'CONFIRM_PREVIEW',id:button.dataset.id});
  if(a==='back-infer'){state={...state,phase:'infer',preview:false};render()}
  if(a==='move')dispatch({type:'MOVE_ACTOR',position:button.dataset.position});
  if(a==='finish')dispatch({type:'FINISH',id:button.dataset.id});
  if(a==='help')dispatch({type:'HELP_OPEN'});
  if(a==='help-next')dispatch({type:'HELP_NEXT'});
  if(a==='help-close')dispatch({type:'HELP_CLOSE'});
  if(a==='target-m05')dispatch({type:'TARGETED_M05'});
  if(a==='fixed-ask'){
    const isFather=button.dataset.id==='father-record';
    dispatch({type:'ASK',target:isFather?'father':'lin',reply:isFather?'记录里只留下沉默、手机上的工作消息，以及后来推近餐盘的动作。这里不能确定我沉默的全部原因。':'那时我觉得：他对我失望，是因为我不够好。我甚至觉得自己不配坐在这里。'});
  }
  if(a==='try-limit')dispatch({type:'ASK',target:'ghost',reply:'林澈试着开口，评价声立刻盖过了他；他试着起身，椅子又把他牵回原位。调查不会受到这两道限制。'});
  if(a==='retry')dispatch({type:'RETRY_RECONSTRUCTION'});
  if(a==='restart-request'){restartConfirm=true;render()}
  if(a==='restart-cancel'){restartConfirm=false;render()}
  if(a==='restart-confirm'){restartConfirm=false;dispatch({type:'RESTART'})}
  if(a==='cancel-request'){requestController?.abort();state={...state,pending:false,toast:'请求已取消，输入与证据都已保留。'};render()}
});

app.addEventListener('input',e=>{if(e.target.matches('[data-testid="reconstruction-input"]')){state={...state,draft:e.target.value.slice(0,200)};const count=e.target.parentElement.querySelector('.charcount');if(count)count.textContent=`${state.draft.length}/200 · 备用互动不会按字数评分`;}});
app.addEventListener('change',e=>{
  if(e.target.name==='known')dispatch({type:'SET_COMPOSE',field:'composeKnown',value:e.target.value});
  if(e.target.name==='unknown')dispatch({type:'SET_COMPOSE',field:'composeUnknown',value:e.target.value});
});
app.addEventListener('submit',e=>{
  if(!e.target.matches('[data-form="ask"]'))return;e.preventDefault();
  const question=e.target.querySelector('textarea').value.trim(); if(!question){state={...state,toast:'可以输入一个简短问题，或点击上方的问题按钮。'};render();return;}
  const target=e.target.dataset.target==='lin'?'linche':e.target.dataset.target;
  const targeted=/整晚|19.?13|餐盘|说过话|一句话/.test(question);
  if(targeted){dispatch({type:'TARGETED_M05'});return;}
  const fallback=target==='father'?'记录只能确认我当时沉默。这里没有足够信息说明我心里的全部原因。':'我记得那段沉默像一个判决。我当时认定，是因为我不够好。';
  askProvider({mode:'inquire',target,question,moment:state.time,unlockedEvidence:state.found},fallback);
});

render();
detectProvider();
