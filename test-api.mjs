import fetch from 'node-fetch';
async function test() {
  const response = await fetch('http://localhost:3000/api/ai/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: 'Hello',
      language: 'English',
      history: []
    })
  });
  const data = await response.json();
  console.log("Chat response:", data);

  const response2 = await fetch('http://localhost:3000/api/ai/pitch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ target: 'intern_web3', settings: {} })
  });
  const data2 = await response2.json();
  console.log("Pitch response:", data2);
}
test();
