import { EntityRecognizer } from '../src/interpreter/entity-recognizer.js';

const recog = new EntityRecognizer();
const examples = ['if win > 5x bonus', 'keep spinning while profitable', 'stop if i lose $50'];
for (const ex of examples) {
  console.log('input', ex, '=>', recog.extractConditions(ex));
}
