// server/src/services/llmReport.js
// The LLM only WRITES the report. The suitability result comes from assessSite() rules.
const { buildReportPrompt } = require('../config/guidelines');

function humanizeKey(key) {
  return key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/^./, (character) => character.toUpperCase());
}

function formatValue(value, depth = 0) {
  const indent = '  '.repeat(depth);
  if (value == null) return `${indent}Not provided`;
  if (Array.isArray(value)) {
    return value.map((item) => {
      if (item && typeof item === 'object') return `${indent}-\n${formatValue(item, depth + 1)}`;
      return `${indent}- ${String(item)}`;
    }).join('\n');
  }
  if (typeof value === 'object') {
    return Object.entries(value).map(([key, entry]) => {
      const label = humanizeKey(key);
      if (entry && typeof entry === 'object') return `${indent}- ${label}:\n${formatValue(entry, depth + 1)}`;
      return `${indent}- ${label}: ${String(entry ?? 'Not provided')}`;
    }).join('\n');
  }
  return `${indent}${String(value)}`;
}

function formatReport(content) {
  const text = content.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  if (!text.startsWith('{') || !text.endsWith('}')) return text;

  try {
    const report = JSON.parse(text);
    if (!report || typeof report !== 'object' || Array.isArray(report)) return text;

    const normalizeKey = (key) => key.toLowerCase().replace(/[^a-z]/g, '');
    const preferred = ['Summary', 'Risks', 'Data limitations', 'Resource needs', 'Recommended actions'];
    const entries = Object.entries(report);
    const ordered = preferred.flatMap((title) => {
      const entry = entries.find(([key]) => normalizeKey(key) === normalizeKey(title));
      return entry ? [[title, entry[1]]] : [];
    });
    const recognized = new Set(ordered.map(([title]) => normalizeKey(title)));
    const remaining = entries
      .filter(([key]) => !recognized.has(normalizeKey(key)))
      .map(([key, value]) => [humanizeKey(key), value]);
    const sections = [...ordered, ...remaining];
    if (!sections.length) return text;

    return sections.map(([title, value]) => `${title}\n${formatValue(value)}`).join('\n\n');
  } catch {
    return text;
  }
}

function fallbackReport(assessment, apiData) {
  const lines = ['Summary', `Result: ${assessment.result.replace('_', ' ')}.`];
  if (assessment.fails.length) lines.push('Problems: ' + assessment.fails.join(' '));
  if (assessment.warns.length) lines.push('Warnings: ' + assessment.warns.join(' '));
  if (apiData?.riverDistanceM != null) lines.push(`Indicative: nearest river about ${apiData.riverDistanceM} m away.`);
  if (apiData?.notes?.length) lines.push(`Data limitations: ${apiData.notes.join(' ')}`);
  lines.push('(Automatic summary. AI report unavailable.)');
  return lines.join('\n');
}

async function generateReport(siteInput, assessment, apiData) {
  const key = process.env.OPENROUTER_API_KEY || process.env.ANTHROPIC_API_KEY;
  if (!key) return fallbackReport(assessment, apiData);
  try {
    const p = buildReportPrompt(siteInput, assessment, apiData);
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${key}`,
        'HTTP-Referer': process.env.OPENROUTER_SITE_URL || process.env.CLIENT_ORIGIN || 'http://localhost:5173',
        'X-Title': 'CCCM Manager',
      },
      body: JSON.stringify({
        model: process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini',
        max_tokens: 700,
        messages: [
          { role: 'system', content: p.system },
          { role: 'user', content: p.user },
        ],
      }),
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) throw new Error(`LLM API returned ${res.status}`);
    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    const text = (typeof content === 'string'
      ? content
      : Array.isArray(content)
        ? content.map((part) => (
          typeof part === 'string' ? part : typeof part?.text === 'string' ? part.text : ''
        )).join('\n')
        : ''
    ).trim();
    return text ? formatReport(text) : fallbackReport(assessment, apiData);
  } catch (err) {
    console.error('LLM report failed:', err.message);
    return fallbackReport(assessment, apiData);
  }
}

module.exports = { generateReport, formatReport };
