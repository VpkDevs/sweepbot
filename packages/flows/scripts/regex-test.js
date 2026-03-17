const re = /at\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*([A-Z]{2,4})?/i
console.log('match1', 'Every day at 5 PM, open Chumba and claim bonus'.match(re))
console.log('match2', 'Every day at 3:30 PM'.match(re))
