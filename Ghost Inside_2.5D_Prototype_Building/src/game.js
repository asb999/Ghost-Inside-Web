import { EVIDENCE, INFERENCES } from './game-data.js';

export const initialState = () => ({
  intro:0, started:false, phase:'investigate', view:'memory', time:'19:10',
  found:[], inspected:[], panel:null, evidenceOpen:false, helpOpen:false, helpLevel:0,
  selectedInference:null, judgement:null, cited:[], inputMode:'compose', draft:'',
  composeKnown:'', composeUnknown:'', explanation:'', chosenAction:null,
  preview:false, confirmed:false, actorPosition:'chair', result:null,
  toast:'', fallback:true, providerSource:'backup', pending:false, attempts:0, hintUsage:{investigate:0,infer:0,reconstruct:0},
  evidenceIds:[], effects:{expression_unblocked:false,seat_pull_released:false}, outcome:null, mode:'investigate', replayVisited:false
});
export const createInitialState = initialState;

const addUnique = (xs, value) => xs.includes(value) ? xs : [...xs, value];
const remove = (xs, value) => xs.filter(x => x !== value);

export function canOpenInference(s){ return ['M01','M02','M03'].every(id => s.found.includes(id)); }
export function canPreview(s){ return !!s.selectedInference && !!s.judgement && s.cited.length >= 1 && s.cited.length <= 2 && !!s.explanation.trim(); }
export function chainNodes(s){
  return [
    {label:s.found.includes('M01')?'考试失利':'尚未查看成绩',known:s.found.includes('M01')},
    {label:s.found.includes('M02')?'父亲沉默':'尚未核对反应',known:s.found.includes('M02')},
    {label:s.found.includes('M03')?'他对我失望':'尚未听到他的想法',known:s.found.includes('M03')},
    {label:s.found.includes('M03')?'我不够好':'尚未听到他的想法',known:s.found.includes('M03')},
    {label:'我不值得被爱',known:true}
  ];
}

export function validateExplanation(s, text){
  const value = text.trim();
  if(!value) return {ok:false, message:'先用自己的话，或用短句组合，说出这次想尝试的理解。'};
  if(!s.cited.length) return {ok:false, message:'先选择一至两条已经找到的线索作为依据。'};
  if(/父亲(一定|其实|只是).*(爱|忙|生病|道歉)|已经原谅|改变过去/.test(value)){
    return {ok:false, message:'这加入了现场没有记录的事实。可以保留未知，或只说明这次经历不能决定你的全部价值。'};
  }
  return {ok:true, message:'这份解释没有改写过去，也保留了尚未知道的部分。你可以预览它将松开哪一道限制。'};
}

export function reduceGame(state, action){
  let s = {...state};
  switch(action.type){
    case 'INTRO_NEXT': return {...s, intro:Math.min(2,s.intro+1)};
    case 'START': return {...initialState(), started:true, toast:'点击桌上的成绩单，开始核对这段记忆。'};
    case 'SET_VIEW': return {...s, view:action.view, panel:null, replayVisited:s.replayVisited||action.view==='replay', toast:action.view==='replay'?(s.replayVisited?'现场回放只记录动作和声音，不能读到任何人的全部想法。':'现场回放只记录动作和声音，不能读到任何人的全部想法。可用下方 19:10–19:13 按钮切换时刻。'):'回到林澈记得的样子。'};
    case 'SET_TIME':
    case 'SET_REPLAY_TIME': return {...s, time:action.time, panel:null};
    case 'INSPECT': {
      let found=s.found;
      const id=action.id||action.target;
      if(id==='grade'||id==='report') found=addUnique(found,'M01');
      if(id==='father') found=addUnique(found,'M02');
      if(id==='lin') found=addUnique(addUnique(found,'M03'),'M06');
      if(id==='phone' && s.view==='replay' && s.time==='19:12') found=addUnique(found,'M04');
      if(id==='plate' && s.view==='replay' && s.time==='19:13') found=addUnique(found,'M05');
      const firstClue = s.found.length===0 && found.length>0;
      return {...s, found, evidenceIds:found, inspected:addUnique(s.inspected,id), panel:{type:'inspect',id}, evidenceOpen:false, helpOpen:false, toast:firstClue?'第一条线索已收进证据册。可随时点下方“证据册”回看，或继续核对其余对象。':''};
    }
    case 'TARGETED_M05': { const found=addUnique(s.found,'M05'); return {...s, found,evidenceIds:found, panel:{type:'reply',id:'lin',reply:'你说得对……我记得的是“整晚没理我”。可在 19:13，他把餐盘推过来，说了那句话。我当时只听见成绩。'}, toast:'发现 M05：记忆的概括与现场细节并不完全相同。'}; }
    case 'ASK': {
      if(action.intent==='targeted_1913') { const found=addUnique(s.found,'M05'); return {...s,found,evidenceIds:found,panel:{type:'reply',id:action.target||'lin',reply:action.reply||'19:13 的记录显示，父亲推近餐盘并开口。'}}; }
      return {...s, panel:{type:'reply',id:action.id||action.target,reply:action.reply||'这段记忆里没有更多可以确定的记录。'}};
    }
    case 'CLOSE_PANEL': return {...s,panel:null};
    case 'OPEN_EVIDENCE': return {...s,evidenceOpen:true,panel:null,helpOpen:false};
    case 'CLOSE_EVIDENCE': return {...s,evidenceOpen:false};
    case 'OPEN_INFERENCE': return canOpenInference(s)?{...s,phase:'infer',mode:'infer',panel:null,evidenceOpen:false,helpOpen:false,preview:false}:{...s,toast:'先核对成绩单、父亲投影和林澈投影。'};
    case 'BACK_ROOM': return {...s,phase:'investigate',mode:'investigate',panel:null,evidenceOpen:false,preview:false,helpOpen:false};
    case 'SELECT_INFERENCE': return {...s,phase:'infer',selectedInference:action.id,judgement:null,cited:[],explanation:'',draft:'',composeKnown:'',composeUnknown:'',preview:false};
    case 'JUDGE': return {...s,judgement:action.value};
    case 'TOGGLE_CITE':
    case 'SELECT_EVIDENCE': {
      action={...action,id:action.id||action.evidenceId};
      if(!s.found.includes(action.id)) return s;
      const cited=s.cited.includes(action.id)?remove(s.cited,action.id):(s.cited.length<2?[...s.cited,action.id]:[s.cited[1],action.id]);
      return {...s,cited};
    }
    case 'SET_INPUT_MODE': return {...s,inputMode:action.mode};
    case 'SET_DRAFT': return {...s,draft:action.value.slice(0,200)};
    case 'SET_COMPOSE': {
      const next={...s,[action.field]:action.value};
      const inf=INFERENCES[s.selectedInference];
      next.explanation=[inf?.starts?.[0],next.composeKnown,next.composeUnknown].filter(Boolean).join('，').replace(/。，/g,'，');
      return next;
    }
    case 'CONFIRM_EXPLANATION': {
      const text=s.inputMode==='free'?s.draft:s.explanation;
      const verdict=validateExplanation(s,text);
      return verdict.ok?{...s,phase:'reconstruct',mode:'reconstruct',explanation:text,toast:verdict.message}:{...s,toast:verdict.message};
    }
    case 'CHOOSE_ACTION': return {...s,chosenAction:action.id};
    case 'OPEN_PREVIEW': return canPreview(s)&&s.chosenAction?{...s,preview:true}:{...s,toast:'请完成解释，并选择这次想尝试的行动。'};
    case 'CLOSE_PREVIEW': return {...s,preview:false};
    case 'CONFIRM_PREVIEW': return {...s,preview:false,confirmed:true,phase:'act',mode:'act',panel:null,actorPosition:'chair',result:null,effects:{expression_unblocked:action.id==='speak',seat_pull_released:action.id==='pause'},toast:action.id==='speak'?'评价声已经减弱。现在亲手走到桌边。':'椅子的牵引已经松开。现在亲手走到门口。'};
    case 'CONFIRM_OUTCOME': { if(s.outcome||s.confirmed)return s; const id=action.outcome==='express'?'speak':action.outcome; return {...s,chosenAction:id,confirmed:true,phase:'act',mode:'act',outcome:action.outcome,effects:{expression_unblocked:id==='speak',seat_pull_released:id==='pause'}}; }
    case 'MOVE_ACTOR': return {...s,actorPosition:action.position,toast:action.position==='table'?'已经到桌边。现在把话说完。':'已经到暂停区。现在确认暂停。'};
    case 'FINISH': return {...s,result:action.id,phase:'result',mode:'result',outcome:action.id==='speak'?'express':'pause',toast:''};
    case 'HELP_OPEN': return {...s,helpOpen:true,panel:null,evidenceOpen:false};
    case 'HELP_NEXT': {
      const level=Math.min(3,s.helpLevel+1), key=s.phase==='act'?'reconstruct':s.phase;
      return {...s,helpLevel:level,hintUsage:{...s.hintUsage,[key]:Math.max(s.hintUsage[key]||0,level)}};
    }
    case 'HELP_CLOSE': return {...s,helpOpen:false};
    case 'RETRY_KEEP':
    case 'RETRY_RECONSTRUCTION': return {...s,phase:'infer',mode:'infer',selectedInference:null,judgement:null,cited:[],inputMode:'compose',draft:'',composeKnown:'',composeUnknown:'',explanation:'',chosenAction:null,preview:false,confirmed:false,actorPosition:'chair',result:null,outcome:null,effects:{expression_unblocked:false,seat_pull_released:false},toast:'线索已保留。两道限制都恢复了，可以尝试另一种解释。'};
    case 'RESET':
    case 'RESTART': return initialState();
    case 'TOAST_CLEAR': return {...s,toast:''};
    default:return s;
  }
}
export const reduceGameState = reduceGame;

export function evidenceList(s){ return s.found.map(id=>EVIDENCE[id]).filter(Boolean); }
