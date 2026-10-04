import test from 'node:test';
import assert from 'node:assert/strict';

import { createInitialState, reduceGameState } from '../src/game.js';

const step = (state, type, payload = {}) => reduceGameState(state, { type, ...payload });
const evidence = (state) => state.evidenceIds ?? state.unlockedEvidenceIds ?? [];

test('M05 不按调查或对话次数自动解锁', () => {
  let state = createInitialState();
  for (let index = 0; index < 8; index += 1) {
    state = step(state, 'ASK', { target: index % 2 ? 'father' : 'lin', intent: 'general' });
    state = step(state, 'INSPECT', { target: index % 2 ? 'report' : 'phone' });
  }
  assert.equal(evidence(state).includes('M05'), false);
});

test('M05 只由 19:13 餐盘核对或针对性追查解锁', () => {
  let wrongTime = createInitialState();
  wrongTime = step(wrongTime, 'SET_VIEW', { view: 'replay' });
  wrongTime = step(wrongTime, 'SET_REPLAY_TIME', { time: '19:12' });
  wrongTime = step(wrongTime, 'INSPECT', { target: 'plate' });
  assert.equal(evidence(wrongTime).includes('M05'), false);

  let replay = step(wrongTime, 'SET_REPLAY_TIME', { time: '19:13' });
  replay = step(replay, 'INSPECT', { target: 'plate' });
  assert.equal(evidence(replay).includes('M05'), true);

  let followUp = createInitialState();
  followUp = step(followUp, 'ASK', { target: 'lin', intent: 'targeted_1913' });
  assert.equal(evidence(followUp).includes('M05'), true);
});

test('未解锁证据不能被选作依据', () => {
  const initial = createInitialState();
  const changed = step(initial, 'SELECT_EVIDENCE', { evidenceId: 'M05' });
  assert.deepEqual(changed.selectedEvidenceIds ?? [], []);
});

test('每轮只能产生一个结果，第二个结果不能叠加', () => {
  let state = createInitialState();
  state = step(state, 'CONFIRM_OUTCOME', { outcome: 'express' });
  assert.equal(state.outcome, 'express');
  assert.equal(Boolean(state.effects?.expression_unblocked), true);
  assert.equal(Boolean(state.effects?.seat_pull_released), false);

  state = step(state, 'CONFIRM_OUTCOME', { outcome: 'pause' });
  assert.equal(state.outcome, 'express');
  assert.equal(Boolean(state.effects?.expression_unblocked), true);
  assert.equal(Boolean(state.effects?.seat_pull_released), false);
});

test('保留证据重试会清除解释、位置和两种结果效果', () => {
  let state = createInitialState();
  state = step(state, 'INSPECT', { target: 'report' });
  state = step(state, 'INSPECT', { target: 'lin' });
  state = step(state, 'SET_DRAFT', { value: '一次成绩不能决定我的全部价值。' });
  state = step(state, 'CONFIRM_OUTCOME', { outcome: 'express' });
  state = step(state, 'MOVE_ACTOR', { position: 'table' });

  const retried = step(state, 'RETRY_RECONSTRUCTION');
  assert.deepEqual(evidence(retried).sort(), ['M01', 'M03', 'M06']);
  assert.equal(retried.outcome, null);
  assert.deepEqual(retried.effects, { expression_unblocked: false, seat_pull_released: false });
  assert.equal(retried.draft ?? '', '');
  assert.equal(retried.actorPosition, 'chair');
});

test('从头开始清空全部本轮状态', () => {
  let state = createInitialState();
  state = step(state, 'INSPECT', { target: 'report' });
  state = step(state, 'SET_REPLAY_TIME', { time: '19:13' });
  state = step(state, 'SET_DRAFT', { value: '保留中的草稿' });
  const restarted = step(state, 'RESTART');
  assert.deepEqual(restarted, createInitialState());
});

