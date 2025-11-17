import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { Readable } from 'stream';

const DEFAULT_BEDROCK_MODEL = process.env.BEDROCK_MODEL || 'amazon.titan-text-express-v1';

async function streamToString(body) {
  if (typeof body === 'string') return body;
  if (body instanceof Uint8Array) return new TextDecoder().decode(body);
  if (body instanceof Readable) {
    return new Promise((resolve, reject) => {
      const chunks = [];
      body.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
      body.on('error', reject);
      body.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    });
  }
  if (body && typeof body.getReader === 'function') {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let result = '';
    // eslint-disable-next-line no-constant-condition
    while (true) {
      // @ts-ignore
      const { done, value } = await reader.read();
      if (done) break;
      result += decoder.decode(value, { stream: true });
    }
    result += decoder.decode();
    return result;
  }
  return String(body ?? '');
}

export async function callBedrockWithDocs(docs, prompt, opts = {}) {
  const model = opts.model || DEFAULT_BEDROCK_MODEL;
  const maxTokens = opts.maxTokens ?? 256;
  const temperature = opts.temperature ?? 0.0;

  const client = new BedrockRuntimeClient();
  // Build a compact text prompt that includes the documents and the instruction.
  const docsText = (docs || [])
  .map(d => {
    // copy the doc, removing all fields with undefined values, in all embeddings
    // create a method that will clean one object.  use recursion for nested objects.
    function cleanObject(obj) {
      if (obj === null || typeof obj !== 'object') return obj;
      if (Array.isArray(obj)) return obj.map(cleanObject);
      const cleaned = {};
      for (const [k, v] of Object.entries(obj)) {
        if (v !== undefined && v !== null && v !== '') cleaned[k] = cleanObject(v);
      }
      return cleaned;
    }
    return cleanObject(d);
  })
  .map(d => {
  // Keep a compact JSON representation for each doc.
  try { return JSON.stringify(d); } catch (e) { return String(d); }
  }).join('\n');
  const bodyText = `Instruction:\n${prompt}\n\nContext:\n${docsText}`;

  // Wrap the prompt in a JSON payload and send as bytes (Buffer).
  const payload = JSON.stringify({ inputText: bodyText });
    const bodyBytes = Buffer.from(payload, 'utf8');
    const command = new InvokeModelCommand({
      modelId: model,
      contentType: 'application/json',
      accept: 'application/json',
      body: bodyBytes,
    });

  let abortController;
  if (opts.timeoutMs && typeof AbortController !== 'undefined') {
    abortController = new AbortController();
    setTimeout(() => abortController && abortController.abort(), opts.timeoutMs);
  }

  try {
    // Diagnostic log: model and payload preview
    try { console.debug && console.debug('Bedrock invoke', { model, contentType: command.contentType || 'application/json', payloadPreview: String(payload || bodyText || '').slice(0, 200) }); } catch (e) {}
    const resp = await client.send(command, { abortSignal: abortController?.signal });
    const text = await streamToString(resp.body);

    let parsedOutput = text;
    try {
      const j = JSON.parse(text);
      if (typeof j === 'object' && j !== null) {
        parsedOutput = j.results?.[0]?.outputText ?? j.outputText ?? j.output ?? j.modelResponse ?? JSON.stringify(j);
      }
    } catch (e) {
      // Not JSON — keep raw text
    }

    return { output: String(parsedOutput), raw: resp };
  } catch (err) {
    // Enhanced diagnostic logging for Bedrock invocation errors
    try {
      // Log basic error and SDK metadata where available
      console.error('Bedrock invocation error', {
        message: err?.message,
        name: err?.name,
        code: err?.Code || err?.code || err?.name,
        statusCode: err?.$metadata?.httpStatusCode,
        requestId: err?.$metadata?.requestId,
      });
    } catch (e) {
      console.error('Bedrock logging failed', e);
    }
    const message = err?.message || String(err);
    throw new Error(`Bedrock invocation failed: ${message}`);
  }
}

export default callBedrockWithDocs;
