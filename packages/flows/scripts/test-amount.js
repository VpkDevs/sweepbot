const text = 'Claim bonus. If more than $50, spin. If not, close.';
console.log('text', text);
console.log('dollarMatches', [...text.matchAll(/\$(\d+(?:\.\d{2})?)/g)]);
console.log('conditionRegexMatches', [...text.matchAll(/if\s+more\s+than\s+\$?(\d+)/gi)]);
