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
  if (!apiKey) return Response.json({ commentary: '' });

  try {
    const { fen, move, moveSAN, moveNumber } = await context.request.json();
    if (!fen || !move) return Response.json({ error: 'Missing fen or move' }, { status: 400 });

    const data = await callClaude(
      apiKey,
      'claude-haiku-4-5-20251001',
      120,
      `You are a chess grandmaster commentator. When given a chess position and the move just played, write 1-2 sentences of insightful commentary explaining WHY the move was played — the strategic or tactical idea behind it. Be specific and educational. Never just describe what happened — explain the idea. Keep it under 30 words. No filler phrases like "This move..." or "Stockfish plays...". Start directly with the insight.`,
      `Position (FEN): ${fen}\nMove played: ${moveSAN} (${move})\nMove number: ${moveNumber}\n\nExplain this move in 1-2 sentences.`
    );

    return Response.json({ commentary: data.content[0].text.trim() });
  } catch (err) {
    console.error('Commentary error:', err.message);
    return Response.json({ error: 'Commentary failed' }, { status: 500 });
  }
}
