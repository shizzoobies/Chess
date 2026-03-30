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
  if (!apiKey) return Response.json({ analysis: 'API key not configured. Add ANTHROPIC_API_KEY to enable post-game analysis.' });

  try {
    const { pgn, result, playerColor, moveCount } = await context.request.json();
    if (!pgn) return Response.json({ error: 'Missing pgn' }, { status: 400 });

    const data = await callClaude(
      apiKey,
      'claude-sonnet-4-5-20250929',
      400,
      `You are a grandmaster-level chess coach providing post-game analysis. Be concise, specific, and actionable. Structure your response with these exact sections:
**Key Moments** — 2-3 critical turning points in the game
**What Went Well** — genuine strengths shown
**Areas to Improve** — specific weaknesses to work on
**Lesson** — one concrete takeaway to practice

Keep total response under 150 words. Be direct and honest.`,
      `Game PGN:\n${pgn}\n\nResult: ${result}\nPlayer was: ${playerColor}\nTotal moves: ${moveCount}\n\nProvide post-game analysis.`
    );

    return Response.json({ analysis: data.content[0].text.trim() });
  } catch (err) {
    console.error('Analysis error:', err.message);
    return Response.json({ error: 'Analysis failed' }, { status: 500 });
  }
}
