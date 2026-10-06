// Thin abstraction over the AI providers used in this project:
//   - Chat completion (the tutor's answers): Anthropic Claude, OpenAI, or
//     Google Gemini, selected via LLM_PROVIDER (see getProvider()).
//   - Embeddings (indexing + retrieval): OpenAI or Google Gemini only —
//     Anthropic has no embeddings endpoint. Selection is independent of
//     LLM_PROVIDER; whichever of GEMINI_API_KEY/OPENAI_API_KEY is actually
//     set is used (see getEmbeddingsProvider()), so e.g. LLM_PROVIDER=anthropic
//     with just GEMINI_API_KEY set still gets working embeddings instead of
//     silently requiring an unrelated OPENAI_API_KEY.
//   - Short non-streaming "utility" generations (query rewriting, reranking,
//     LLM-as-judge) via generateText/generateJSON, on an optionally cheaper
//     model (see utilityModel()).
// Keeping all three behind one module means swapping providers later only
// touches this file, not the RAG pipeline that calls it.
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { parseJsonLoose } = require('../utils/parseJson');

function getProvider() {
  return (process.env.LLM_PROVIDER || 'anthropic').toLowerCase();
}

// Embeddings are only offered by OpenAI and Google Gemini — Anthropic has no
// embeddings API. Because of that, which embeddings provider gets used is
// deliberately independent of LLM_PROVIDER (which only controls chat
// generation): whichever embeddings-capable key is actually configured wins,
// preferring Gemini since it's the key `.env.example`/README lead with. If
// neither key is set, this throws a clear, actionable error instead of letting
// embedText/embedBatch fail deep inside a provider-specific error message.
function getEmbeddingsProvider() {
  if (process.env.GEMINI_API_KEY) return 'gemini';
  if (process.env.OPENAI_API_KEY) return 'openai';
  throw new Error(
    'No embeddings provider is configured. Set GEMINI_API_KEY or OPENAI_API_KEY in your environment — ' +
      'embeddings (lesson/attachment indexing and AI tutor retrieval) require one of these regardless of ' +
      'LLM_PROVIDER, since Anthropic does not offer an embeddings API.'
  );
}

function getEmbeddingModelId() {
  if (getEmbeddingsProvider() === 'gemini') {
    return `gemini:${process.env.GEMINI_EMBEDDING_MODEL || 'gemini-embedding-001'}`;
  }
  return `openai:${process.env.EMBEDDING_MODEL || 'text-embedding-3-small'}`;
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

// ---------------------------------------------------------------------------
// Resilience: retry transient/rate-limit failures with backoff. A hard daily
// quota error is not retried — waiting seconds can't fix it.
// ---------------------------------------------------------------------------
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryable(err) {
  const message = String(err?.message || '');
  if (/PerDay|daily/i.test(message) && /quota/i.test(message)) return false;
  const status = err?.status || err?.statusCode;
  if (status === 429 || status === 500 || status === 502 || status === 503 || status === 504) return true;
  return /429|RESOURCE_EXHAUSTED|503|overloaded|fetch failed|ECONNRESET|ETIMEDOUT|rate limit/i.test(message);
}

function retryDelayMs(err, attempt) {
  const match = String(err?.message || '').match(/retry in ([\d.]+)s/i);
  if (match) return Math.ceil(parseFloat(match[1]) * 1000) + 500;
  return Math.min(60000, 1000 * 2 ** attempt);
}

async function withRetry(fn) {
  const maxRetries = Number(process.env.AI_MAX_RETRIES ?? 4);
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await fn();
    } catch (err) {
      if (attempt >= maxRetries || !isRetryable(err)) throw err;
      await sleep(retryDelayMs(err, attempt));
    }
  }
}

// Optional spacing between utility generations, for providers with a low
// requests-per-minute free tier.
let throttleChain = Promise.resolve();
function throttle() {
  const interval = Number(process.env.AI_MIN_INTERVAL_MS || 0);
  if (!interval) return Promise.resolve();
  const turn = throttleChain.then(() => sleep(interval));
  throttleChain = turn;
  return turn;
}

// ---------------------------------------------------------------------------
// Optional on-disk response cache (AI_CACHE_DIR). Off in normal operation. The
// evaluation harness turns it on so repeated runs reuse identical embeddings
// and LLM outputs: runs become fast, free after the first pass, and exactly
// reproducible. AI_CACHE_SALT lets a run opt out of existing entries (used to
// measure run-to-run variance of the LLM-driven stages).
// ---------------------------------------------------------------------------
function cachePath(kind, payload) {
  const dir = process.env.AI_CACHE_DIR;
  if (!dir) return null;
  const hash = crypto
    .createHash('sha256')
    .update(JSON.stringify([kind, process.env.AI_CACHE_SALT || '', payload]))
    .digest('hex');
  return path.join(dir, `${kind}-${hash}.json`);
}

function readCache(file) {
  if (!file) return undefined;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return undefined;
  }
}

function writeCache(file, value) {
  if (!file) return;
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(value));
  } catch {
    // caching is best-effort
  }
}

const f32ToBase64 = (arr) => Buffer.from(new Float32Array(arr).buffer).toString('base64');
const base64ToF32 = (b64) => {
  const buf = Buffer.from(b64, 'base64');
  return Array.from(new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4));
};

// ---------------------------------------------------------------------------
// Embeddings
// ---------------------------------------------------------------------------
const GEMINI_BATCH_LIMIT = 100;
const OPENAI_BATCH_LIMIT = 256;

function geminiTaskType(taskType) {
  if (!taskType) return undefined;
  const { TaskType } = require('@google/generative-ai');
  return taskType === 'query' ? TaskType.RETRIEVAL_QUERY : TaskType.RETRIEVAL_DOCUMENT;
}

async function embedUncached(texts, taskType) {
  if (getEmbeddingsProvider() === 'gemini') {
    const model = getGeminiClient().getGenerativeModel({
      model: process.env.GEMINI_EMBEDDING_MODEL || 'gemini-embedding-001',
    });
    const out = [];
    for (let i = 0; i < texts.length; i += GEMINI_BATCH_LIMIT) {
      const slice = texts.slice(i, i + GEMINI_BATCH_LIMIT);
      const type = geminiTaskType(taskType);
      const result = await withRetry(() =>
        model.batchEmbedContents({
          requests: slice.map((text) => ({
            content: { role: 'user', parts: [{ text }] },
            ...(type ? { taskType: type } : {}),
          })),
        })
      );
      out.push(...result.embeddings.map((e) => e.values));
    }
    return out;
  }

  const client = getOpenAIClient();
  const model = process.env.EMBEDDING_MODEL || 'text-embedding-3-small';
  const out = [];
  for (let i = 0; i < texts.length; i += OPENAI_BATCH_LIMIT) {
    const slice = texts.slice(i, i + OPENAI_BATCH_LIMIT);
    const response = await withRetry(() => client.embeddings.create({ model, input: slice }));
    out.push(...response.data.sort((a, b) => a.index - b.index).map((item) => item.embedding));
  }
  return out;
}

// `taskType` is 'query' | 'document' | undefined. Gemini embeddings are
// trained with distinct query/document modes (asymmetric retrieval); OpenAI's
// have no such parameter so it is ignored there. Leaving it undefined
// reproduces the original undifferentiated behaviour.
async function embedBatch(texts, { taskType } = {}) {
  if (!texts.length) return [];

  const modelId = getEmbeddingModelId();
  const files = texts.map((text) => cachePath('emb', [modelId, taskType || null, text]));
  const results = files.map((file) => {
    const hit = readCache(file);
    return hit ? base64ToF32(hit.v) : null;
  });

  const missing = results.map((r, i) => (r ? -1 : i)).filter((i) => i >= 0);
  if (missing.length) {
    const fresh = await embedUncached(
      missing.map((i) => texts[i]),
      taskType
    );
    missing.forEach((textIndex, j) => {
      results[textIndex] = fresh[j];
      writeCache(files[textIndex], { v: f32ToBase64(fresh[j]) });
    });
  }
  return results;
}

async function embedText(text, options = {}) {
  const [embedding] = await embedBatch([text], options);
  return embedding;
}

// ---------------------------------------------------------------------------
// Non-streaming generation for short utility tasks
// ---------------------------------------------------------------------------
function utilityModel() {
  const provider = getProvider();
  if (provider === 'openai') return process.env.OPENAI_UTILITY_MODEL || process.env.OPENAI_CHAT_MODEL || 'gpt-4o-mini';
  if (provider === 'gemini') return process.env.GEMINI_UTILITY_MODEL || process.env.GEMINI_CHAT_MODEL || 'gemini-2.5-flash';
  return process.env.ANTHROPIC_UTILITY_MODEL || process.env.ANTHROPIC_MODEL || 'claude-sonnet-5';
}

async function generateTextUncached({ system, prompt, temperature, maxTokens, json }) {
  const provider = getProvider();
  const model = utilityModel();

  if (provider === 'openai') {
    const response = await getOpenAIClient().chat.completions.create({
      model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: prompt },
      ],
      temperature,
      max_tokens: maxTokens,
      ...(json ? { response_format: { type: 'json_object' } } : {}),
    });
    return response.choices[0]?.message?.content || '';
  }

  if (provider === 'gemini') {
    const generationConfig = { temperature, maxOutputTokens: maxTokens };
    if (json) generationConfig.responseMimeType = 'application/json';
    // Gemini 2.5 spends hidden "thinking" tokens out of the output budget;
    // short classification/rewrite tasks don't benefit and it adds latency.
    if (/gemini-2\.5/.test(model)) generationConfig.thinkingConfig = { thinkingBudget: 0 };

    const generative = getGeminiClient().getGenerativeModel({
      model,
      systemInstruction: system,
      generationConfig,
    });
    const result = await generative.generateContent(prompt);
    return result.response.text();
  }

  const response = await getAnthropicClient().messages.create({
    model,
    max_tokens: maxTokens,
    temperature,
    system,
    messages: [{ role: 'user', content: prompt }],
  });
  return response.content.map((block) => (block.type === 'text' ? block.text : '')).join('');
}

async function generateText({ system, prompt, temperature = 0, maxTokens = 800, json = false }) {
  const file = cachePath('gen', [getProvider(), utilityModel(), system, prompt, temperature, maxTokens, json]);
  const cached = readCache(file);
  if (cached) return cached.text;

  await throttle();
  const text = await withRetry(() => generateTextUncached({ system, prompt, temperature, maxTokens, json }));
  writeCache(file, { text });
  return text;
}

// Returns the parsed JSON value, or null if the model's output wasn't
// parseable — callers treat null as "stage failed, fall back".
async function generateJSON(args) {
  const text = await generateText({ ...args, json: true });
  return parseJsonLoose(text);
}

// ---------------------------------------------------------------------------
// Streaming chat completion (the tutor's answer)
// ---------------------------------------------------------------------------
// Yields answer text as it's generated so the tutor can stream tokens to the
// student instead of making them wait for the full response. `signal` aborts
// the upstream request (e.g. when the student closes the tab) so tokens aren't
// generated — and billed — for nobody.
async function* streamChatCompletion({ systemPrompt, userPrompt, signal }) {
  const provider = getProvider();

  if (provider === 'openai') {
    const client = getOpenAIClient();
    const model = process.env.OPENAI_CHAT_MODEL || 'gpt-4o-mini';
    const stream = await client.chat.completions.create(
      {
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.2,
        stream: true,
      },
      { signal }
    );
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
    // Only creating the stream is retried (e.g. a rate-limit before the first
    // token); once tokens flow, a failure surfaces to the caller.
    const result = await withRetry(() => model.generateContentStream(userPrompt, { signal }));
    // The SDK also exposes an aggregated `response` promise that rejects when
    // the request is aborted mid-stream. We never await it, so without this
    // the rejection is unhandled and takes the whole Node process down.
    result.response.catch(() => {});
    for await (const chunk of result.stream) {
      const token = chunk.text();
      if (token) yield token;
    }
    return;
  }

  const client = getAnthropicClient();
  const model = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5';
  const stream = await client.messages.create(
    {
      model,
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
      stream: true,
    },
    { signal }
  );
  for await (const event of stream) {
    if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
      yield event.delta.text;
    }
  }
}

module.exports = {
  embedText,
  embedBatch,
  generateText,
  generateJSON,
  streamChatCompletion,
  getEmbeddingModelId,
};
