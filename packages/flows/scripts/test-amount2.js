const { EntityRecognizer } = require('./dist/interpreter/entity-recognizer.js');
const r = new EntityRecognizer();
const text = 'Claim bonus. If more than $50, spin. If not, close.';
console.log('calling recognize');
const result = r.recognize(text);
console.log(JSON.stringify(result, null, 2));
console.log('amounts details:');
console.log(result.amounts.map(a=>a.text+' '+a.value));
