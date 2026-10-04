export const EVIDENCE = {
  M01: { id:'M01', kind:'现场记录', title:'低于预期的成绩', source:'成绩单 · 19:10', short:'这次成绩低于林澈自己的预期。', body:'成绩单只记录了这一次失利，没有记录一个人的全部价值。' },
  M02: { id:'M02', kind:'现场记录', title:'父亲的沉默', source:'父亲投影 · 19:11', short:'父亲看过成绩单后沉默。', body:'现场没有留下足以说明沉默全部动机的记录。' },
  M03: { id:'M03', kind:'感受／推断', title:'林澈当时的理解', source:'林澈 · 自述', short:'“他对我失望，因为我不够好。”', body:'“他整晚都没有再理我。我当时想：他对我失望，是因为我不够好。我觉得不配坐这里。”' },
  M04: { id:'M04', kind:'现场记录', title:'工作消息', source:'手机 · 19:12', short:'手机收到“今晚再确认一下返工方案”。', body:'这是额外背景，但不能证明父亲的沉默只是因为工作。' },
  M05: { id:'M05', kind:'现场记录', title:'被推近的餐盘', source:'餐盘 · 19:13', short:'父亲推近餐盘，说“先吃，明天再说成绩”。', body:'林澈回答“我不饿”。这与“整晚一句话也没有”的概括存在局部矛盾，但不抹去他的受伤。' },
  M06: { id:'M06', kind:'自我报告', title:'一直达标才值得被爱', source:'林澈 · 此刻', short:'“我以为必须一直达标，才值得被爱。”', body:'这是林澈后来辨认出的核心信念，不是现场记录的客观结论。' }
};

export const HOTSPOTS = {
  grade: { label:'成绩单', icon:'87', evidence:'M01', description:'右上角被反复折过。' },
  father: { label:'父亲投影', icon:'父', evidence:'M02', description:'脸藏在逆光里，沉默被拉得很长。' },
  lin: { label:'林澈投影', icon:'澈', evidence:'M03', description:'他仍坐在原位，肩膀绷紧。' },
  phone: { label:'手机', icon:'▣', evidence:'M04', description:'屏幕在桌边亮起。' },
  plate: { label:'餐盘', icon:'○', evidence:'M05', description:'餐盘停在桌沿，像被谁移动过。' }
};

export const TIMELINE = [
  { time:'19:10', title:'成绩出现', text:'林澈看到成绩低于自己的预期。', active:'grade' },
  { time:'19:11', title:'沉默', text:'父亲拿起成绩单，看了一会儿，没有说话。', active:'father' },
  { time:'19:12', title:'屏幕亮起', text:'手机收到工作消息：“今晚再确认一下返工方案”。', active:'phone' },
  { time:'19:13', title:'餐盘移动', text:'父亲把餐盘推近：“先吃，明天再说成绩。”林澈：“我不饿。”', active:'plate' }
];

export const INFERENCES = {
  silence: {
    id:'silence', from:'父亲沉默', to:'他对我失望', title:'沉默 → 失望',
    question:'沉默，足以证明父亲对林澈失望吗？',
    guidance:'区分现场留下的事实，与我们还不知道的动机。',
    starts:['我还不能确定，父亲的沉默是否意味着失望。','我知道父亲沉默了，但我仍不知道他的全部想法。']
  },
  worth: {
    id:'worth', from:'我不够好', to:'我不值得被爱', title:'不够好 → 不值得被爱',
    question:'一次没有达到期待，能决定一个人是否值得被爱吗？',
    guidance:'即使失望存在，也检查它能否说明一个人的全部价值。',
    starts:['即使这次没有达到期待，也不能说明我不值得被爱。','一次成绩只能说明这一次，不等于我的全部价值。']
  }
};

export const HELP = {
  investigate:['可以切换“现场回放”，在不同时刻重新查看物件。','留意一个概括整晚的说法，和现场记录是否完全一致。','查看 19:13 的餐盘。'],
  infer:['点击信念链中发光的箭头，选择你想核对的那一步。','分清哪些是发生过的事，哪些是林澈得出的结论。','比较沉默的记录与林澈对沉默的理解。'],
  reconstruct:['先选一至两条依据，再说你想怎样理解它。','想想线索能说明什么，以及还有什么不知道。','检查你的解释是否加入了现场没有记录的事。']
};

export const COMPOSER = {
  silence: {
    known:['父亲确实沉默了','这次成绩低于我的预期','19:13 他曾推近餐盘并开口'],
    unknown:['但沉默的全部原因仍然未知','但我不能替他补完心里的话']
  },
  worth: {
    known:['这只是一次没有达到期待','受伤的感受是真实的','别人的失望不等于我的全部价值'],
    unknown:['我的价值不需要由一次成绩证明','我可以在不原谅的情况下先保护自己']
  }
};

export const FIXED_FACTS = Object.freeze({
  times:['19:10','19:11','19:12','19:13'],
  fatherMotive:'unknown',
  pastCanChange:false,
  coreBelief:'我必须一直达标，才值得被爱',
  allowedEffects:['expression_unblocked','seat_pull_released']
});
