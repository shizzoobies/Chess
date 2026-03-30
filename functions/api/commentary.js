import Anthropic from '@anthropic-ai/sdk';

export async function onRequestPost(context) {
  const apiKey = context.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return Response.json({ commentary: '' });
  }

  try {
    const { fen, move, moveSAN, moveNumber } = await context.request.json();
    if (!fen || !move) {
      return Response.json({ error: 'Missing fen or move' }, { status: 400 });
    }

    const anthropic = new Anthropic({ apiKey });
    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 120,
      system: `You are a chess grandmaster commentator. When given a chess position and the move just played, write 1-2 sentences of insightful commentary explaining WHY the move was played — the strategic or tactical idea behind it. Be specific and educational. Never just describe what happened — explain the idea. Keep it under 30 words. No filler phrases like "This move..." or "Stockfish plays...". Start directly with the insight.`,
      messages: [{
        role: 'user',
        content: `Position (FEN): ${fen}\nMove played: ${moveSAN} (${move})\nMove number: ${moveNumber}\n\nExplain this move in 1-2 sentences.`
      }]
    });

    return Response.json({ commentary: message.content[0].text.trim() });
  } catch (err) {
    console.error('Commentary error:', err.message);
    return Response.json({ error: 'Commentary failed' }, { status: 500 });
  }
}
