import { createBattle, step } from './battle.js';
import { hashState } from './hash.js';

// record = { seed, team: [ids], enemies: [ids], actions: [ {type:'move',path}|{type:'skill',index} ] }
export function newRecord(seed, team, enemies) {
  return { seed, team, enemies, actions: [] };
}

export function play(ctx, record) {
  let state = createBattle(ctx, record);
  for (const a of record.actions) state = step(ctx, state, a).state;
  return state;
}

export function replayHash(ctx, record) {
  return hashState(play(ctx, record));
}
