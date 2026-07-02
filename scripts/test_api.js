fetch('https://api.1min.ai/api/features', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'API-KEY': '8f674be2ac501623ea84e99b21ad7fb562525a0879142995d96591d7607b747f'
  },
  body: JSON.stringify({
    type: 'CODE_GENERATOR',
    model: 'gpt-4o',
    conversationId: 'test12',
    promptObject: {prompt: 'reply ok', webSearch:false}
  })
}).then(r=>r.text()).then(t=>console.log(t.substring(0, 500) + "\n\n" + t.substring(t.length > 500 ? t.length - 1500 : 0)))
