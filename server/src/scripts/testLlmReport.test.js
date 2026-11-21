const { test } = require('node:test');
const assert = require('node:assert/strict');
const { generateReport } = require('../services/llmReport');

const assessment = { result: 'suitable', fails: [], warns: [] };
const siteInput = { population: 1000 };
const apiData = {};

test('generates reports through OpenRouter chat completions', async (t) => {
  const originalFetch = global.fetch;
  const originalKey = process.env.OPENROUTER_API_KEY;
  const originalModel = process.env.OPENROUTER_MODEL;
  const originalLegacyKey = process.env.ANTHROPIC_API_KEY;
  let request;

  process.env.OPENROUTER_API_KEY = 'test-key';
  process.env.OPENROUTER_MODEL = 'test/model';
  delete process.env.ANTHROPIC_API_KEY;
  global.fetch = async (url, options) => {
    request = { url, options };
    return {
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'Generated report.' } }] }),
    };
  };

  t.after(() => {
    global.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.OPENROUTER_API_KEY;
    else process.env.OPENROUTER_API_KEY = originalKey;
    if (originalModel === undefined) delete process.env.OPENROUTER_MODEL;
    else process.env.OPENROUTER_MODEL = originalModel;
    if (originalLegacyKey === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = originalLegacyKey;
  });

  const report = await generateReport(siteInput, assessment, apiData);

  assert.equal(report, 'Generated report.');
  assert.equal(request.url, 'https://openrouter.ai/api/v1/chat/completions');
  assert.equal(request.options.headers.authorization, 'Bearer test-key');
  assert.equal(JSON.parse(request.options.body).model, 'test/model');
  assert.equal(JSON.parse(request.options.body).messages[0].role, 'system');
});

test('uses the existing legacy key setting with OpenRouter', async (t) => {
  const originalFetch = global.fetch;
  const originalKey = process.env.OPENROUTER_API_KEY;
  const originalLegacyKey = process.env.ANTHROPIC_API_KEY;
  let authorization;

  delete process.env.OPENROUTER_API_KEY;
  process.env.ANTHROPIC_API_KEY = 'legacy-openrouter-key';
  global.fetch = async (_url, options) => {
    authorization = options.headers.authorization;
    return {
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'Legacy-key report.' } }] }),
    };
  };

  t.after(() => {
    global.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.OPENROUTER_API_KEY;
    else process.env.OPENROUTER_API_KEY = originalKey;
    if (originalLegacyKey === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = originalLegacyKey;
  });

  assert.equal(await generateReport(siteInput, assessment, apiData), 'Legacy-key report.');
  assert.equal(authorization, 'Bearer legacy-openrouter-key');
});

test('formats a JSON-shaped model response as a readable report', async (t) => {
  const originalFetch = global.fetch;
  const originalKey = process.env.OPENROUTER_API_KEY;
  const originalModel = process.env.OPENROUTER_MODEL;

  process.env.OPENROUTER_API_KEY = 'test-key';
  delete process.env.OPENROUTER_MODEL;
  global.fetch = async () => ({
    ok: true,
    json: async () => ({
      choices: [{
        message: {
          content: JSON.stringify({
            Summary: 'Suitable for 1,000 people.',
            Risks: ['Water-borne disease risk [p.4].'],
            'Resource needs': { population: 1000, landM2: { min: 30000, max: 45000 } },
            'Recommended actions': { confirmWater: 'Verify the water source on site.' },
          }),
        },
      }],
    }),
  });

  t.after(() => {
    global.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.OPENROUTER_API_KEY;
    else process.env.OPENROUTER_API_KEY = originalKey;
    if (originalModel === undefined) delete process.env.OPENROUTER_MODEL;
    else process.env.OPENROUTER_MODEL = originalModel;
  });

  const report = await generateReport(siteInput, assessment, apiData);

  assert.match(report, /^Summary\nSuitable for 1,000 people\./);
  assert.match(report, /Risks\n- Water-borne disease risk \[p\.4\]\./);
  assert.match(report, /Resource needs\n- Population: 1000\n- Land M2:\n  - Min: 30000\n  - Max: 45000/);
  assert.match(report, /Recommended actions\n- Confirm Water: Verify the water source on site\./);
  assert.doesNotMatch(report, /^\s*\{/);
});
