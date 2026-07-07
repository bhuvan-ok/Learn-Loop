// Thin abstraction over the AI providers used in this project:
//   - OpenAI: text embeddings (Anthropic has no embeddings endpoint)
//   - Anthropic Claude, OpenAI, or Google Gemini: chat completion for the tutor's answers
//   - Google Gemini: can also do embeddings, so LLM_PROVIDER=gemini is the only
//     setting that needs just one API key for the whole pipeline
// Keeping all three behind one module means swapping providers later only
// touches this file, not the RAG pipeline that calls it.

function getProvider() {
  return (process.env.LLM_PROVIDER || 'anthropic').toLowerCase();
}

let openaiClient = null;
function getOpenAIClient() {
  if (!openaiClient) {
    const OpenAI = require('openai');
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not set; required for generating embeddings');
    }
    openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 15000, maxRetries: 1 });
  }
  return openaiClient;
}

let anthropicClient = null;
function getAnthropicClient() {
  if (!anthropicClient) {
    const Anthropic = require('@anthropic-ai/sdk');
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY is not set; required when LLM_PROVIDER=anthropic');
    }
    anthropicClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return anthropicClient;
}

let geminiClient = null;
function getGeminiClient() {
  if (!geminiClient) {
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    if (!process.env.GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY is not set; required when LLM_PROVIDER=gemini');
    }
    geminiClient = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  }
  return geminiClient;
}

async function embedText(text) {
  if (getProvider() === 'gemini') {
    const client = getGeminiClient();
    const model = client.getGenerativeModel({
      model: process.env.GEMINI_EMBEDDING_MODEL || 'gemini-embedding-001',
    });
    const result = await model.embedContent(text);
    return result.embedding.values;
  }

  const client = getOpenAIClient();
  const model = process.env.EMBEDDING_MODEL || 'text-embedding-3-small';
  const response = await client.embeddings.create({ model, input: text });
  return response.data[0].embedding;
}

async function embedBatch(texts) {
  if (!texts.length) return [];

  if (getProvider() === 'gemini') {
    const client = getGeminiClient();
    const model = client.getGenerativeModel({
      model: process.env.GEMINI_EMBEDDING_MODEL || 'gemini-embedding-001',
    });
    const result = await model.batchEmbedContents({
      requests: texts.map((text) => ({ content: { role: 'user', parts: [{ text }] } })),
    });
    return result.embeddings.map((e) => e.values);
  }

  const client = getOpenAIClient();
  const model = process.env.EMBEDDING_MODEL || 'text-embedding-3-small';
  const response = await client.embeddings.create({ model, input: texts });
  return response.data
    .sort((a, b) => a.index - b.index)
    .map((item) => item.embedding);
}

// Yields answer text as it's generated so the tutor can stream tokens to the
// student instead of making them wait for the full response.
async function* streamChatCompletion({ systemPrompt, userPrompt }) {
  const provider = getProvider();

  if (provider === 'openai') {
    const client = getOpenAIClient();
    const model = process.env.OPENAI_CHAT_MODEL || 'gpt-4o-mini';
    const stream = await client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.2,
      stream: true,
    });
    for await (const chunk of stream) {
      const token = chunk.choices[0]?.delta?.content;
      if (token) yield token;
    }
    return;
  }

  if (provider === 'gemini') {
    const client = getGeminiClient();
    const model = client.getGenerativeModel({
      model: process.env.GEMINI_CHAT_MODEL || 'gemini-2.5-flash',
      systemInstruction: systemPrompt,
    });
    const result = await model.generateContentStream(userPrompt);
    for await (const chunk of result.stream) {
      const token = chunk.text();
      if (token) yield token;
    }
    return;
  }

  const client = getAnthropicClient();
  const model = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5';
  const stream = await client.messages.create({
    model,
    max_tokens: 1024,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
    stream: true,
  });
  for await (const event of stream) {
    if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
      yield event.delta.text;
    }
  }
}

module.exports = { embedText, embedBatch, streamChatCompletion };
