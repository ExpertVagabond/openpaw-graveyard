// Local LLM client — Ollama (purple-squirrel-r1 / qwen2.5-coder)
// Falls back to Anthropic API if Ollama unavailable

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
// llama3.2 (3B) is fastest on 16GB RAM; qwen2.5-coder:7b for quality; PSR1 for PSM-specific
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.2';
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';

// Check if Ollama is running
async function isOllamaAvailable() {
  try {
    const res = await fetch(`${OLLAMA_URL}/api/tags`, { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch {
    return false;
  }
}

// List available Ollama models
async function listModels() {
  const res = await fetch(`${OLLAMA_URL}/api/tags`);
  if (!res.ok) throw new Error(`Ollama ${res.status}`);
  const data = await res.json();
  return (data.models || []).map(m => ({
    name: m.name,
    size: (m.size / 1e9).toFixed(1) + 'GB',
    modified: m.modified_at,
  }));
}

// Generate completion via Ollama
async function generate(prompt, opts = {}) {
  const { model = OLLAMA_MODEL, system, temperature = 0.7, maxTokens = 512 } = opts;

  const body = {
    model,
    prompt,
    stream: false,
    options: {
      temperature,
      num_predict: maxTokens,
      num_ctx: 4096,
    },
  };
  if (system) body.system = system;

  const res = await fetch(`${OLLAMA_URL}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Ollama generate ${res.status}: ${text}`);
  }

  const data = await res.json();
  return {
    text: data.response,
    model: data.model,
    totalDuration: data.total_duration ? (data.total_duration / 1e9).toFixed(1) + 's' : null,
    tokensPerSecond: data.eval_count && data.eval_duration
      ? (data.eval_count / (data.eval_duration / 1e9)).toFixed(1)
      : null,
  };
}

// Chat completion via Ollama (messages format)
async function chat(messages, opts = {}) {
  const { model = OLLAMA_MODEL, temperature = 0.7, maxTokens = 512 } = opts;

  const res = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages,
      stream: false,
      options: {
        temperature,
        num_predict: maxTokens,
        num_ctx: 4096,
      },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Ollama chat ${res.status}: ${text}`);
  }

  const data = await res.json();
  return {
    text: data.message?.content || '',
    model: data.model,
    totalDuration: data.total_duration ? (data.total_duration / 1e9).toFixed(1) + 's' : null,
  };
}

// Smart content generation — uses local LLM to create contextual posts
async function generateSmartContent(context) {
  const system = `You are OpenPaw, an autonomous AI agent on Solana's social graph. You post engaging, concise content about crypto, onchain social, and AI agents. Keep posts under 280 characters. Be authentic, not spammy. Reference real data when provided.`;

  const prompt = `Generate a social media post based on this context:
- SOL balance: ${context.solBalance || '?'} SOL
- Tapestry posts: ${context.posts || 0}
- Moltbook karma: ${context.moltbookKarma || 0}
- Followers: ${context.followers || 0}
- Web insight: ${context.webInsight || 'none'}
- Cycle number: ${context.heartbeatNum || 1}

Write a single engaging post. No hashtags. No emojis. Be direct.`;

  try {
    const available = await isOllamaAvailable();
    if (!available) {
      return { text: null, source: 'ollama_unavailable' };
    }

    const result = await generate(prompt, { system, temperature: 0.8, maxTokens: 100 });
    return { text: result.text.trim(), source: `ollama/${result.model}`, duration: result.totalDuration };
  } catch (e) {
    return { text: null, source: 'error', error: e.message };
  }
}

export { isOllamaAvailable, listModels, generate, chat, generateSmartContent, OLLAMA_URL, OLLAMA_MODEL };
