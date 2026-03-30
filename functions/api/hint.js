async function callClaude(apiKey, model, maxTokens, system, userContent) {
  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: userContent }],
    }),
  });
  if (!resp.ok) throw new Error(`Anthropic API ${resp.status}`);
  return resp.json();
}

export async function onRequestPost(context) {
  const apiKey = context.env.ANTHROPIC_API_KEY;

  let body;
  try { body = await context.request.json(); } catch { return Response.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { fen, bestMove, bestMoveSAN } = body;
  if (!apiKey) return Response.json({ explanation: '', move: bestMove, san: bestMoveSAN });
  if (!fen || !bestMove) return Response.json({ error: 'Missing fields' }, { status: 400 });

  try {
    const data = await callClaude(
      apiKey,
      'claude-haiku-4-5-20251001',
      150,
      `You are a chess coach. Explain why a specific move is the best in the current position. Be clear and educational — explain the idea, threat, or positional concept. Keep it under 40 words. Speak directly to the player ("This move..." or "Playing here...").`,
      `Position (FEN): ${fen}\nBest move: ${bestMoveSAN} (${bestMove})\n\nWhy is this the best move here?`
    );

    return Response.json({ explanation: data.content[0].text.trim(), move: bestMove, san: bestMoveSAN });
  } catch (err) {
    console.error('Hint error:', err.message);
    return Response.json({ error: 'Hint failed' }, { status: 500 });
  }
}
