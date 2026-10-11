import test from 'node:test';
import assert from 'node:assert/strict';
import {validatePersonality,personalityTool} from '../server/personality.js';
import {Game} from '../src/app/fsm.js';
test('AI 性格工具仅允许三个选项，拒绝额外动作与非法值',()=>{
 for(const personality of ['happy','quiet','silly'])assert.equal(validatePersonality({personality}),personality);
 for(const value of [{personality:'angry'},{personality:'happy',action:'start_challenge'},{},null])assert.throws(()=>validatePersonality(value));
 assert.deepEqual(personalityTool.function.parameters.properties.personality.enum,['happy','quiet','silly']);
 const game=new Game();game.act('choose_personality',{turnId:'fixture'});assert.equal(game.state,'HATCH_GUIDE');
 assert.throws(()=>game.act('choose_personality',{turnId:'second'}));
});
