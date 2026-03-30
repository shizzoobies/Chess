import Anthropic from '@anthropic-ai/sdk';

export async function onRequestPost(context) {
  const apiKey = context.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return Response.json({ analysis: 'API key not configured. Add ANTHROPIC_API_KEY to enable post-game analysis.' });
  }

  try {
    const { pgn, result, playerColor, moveCount } = await context.request.json();
    if (!pgn) {
      return Response.json({ error: 'Missing pgn' }, { status: 400 });
    }

    const anthropic = new Anthropic({ apiKey });
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 400,
      system: `You are a grandmaster-level chess coach providing post-game analysis. Be concise, specific, and actionable. Structure your response with these exact sections:
**Key Moments** — 2-3 critical turning points in the game
**What Went Well** — genuine strengths shown
**Areas to Improve** — specific weaknesses to work on
**Lesson** — one concrete takeaway to practice

Keep total response under 150 words. Be direct and honest.`,
      messages: [{
        role: 'user',
        content: `Game PGN:\n${pgn}\n\nResult: ${result}\nPlayer was: ${playerColor}\nTotal moves: ${moveCount}\n\nProvide post-game analysis.`
      }]
    });

    return Response.json({ analysis: message.content[0].text.trim() });
  } catch (err) {
    console.error('Analysis error:', err.message);
    return Response.json({ error: 'Analysis failed' }, { status: 500 });
  }
}
