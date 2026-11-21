// server/src/services/llmReport.js
// The LLM only WRITES the report. The suitability result comes from assessSite() rules.
const { buildReportPrompt } = require('../config/guidelines');

function fallbackReport(assessment, apiData) {
  const lines = [`Result: ${assessment.result.replace('_', ' ')}.`];
  if (assessment.fails.length) lines.push('Problems: ' + assessment.fails.join(' '));
  if (assessment.warns.length) lines.push('Warnings: ' + assessment.warns.join(' '));
  if (apiData?.riverDistanceM != null) lines.push(`Indicative: nearest river about ${apiData.riverDistanceM} m away.`);
  lines.push('(Automatic summary. AI report unavailable.)');
  return lines.join('\n');
}

async function generateReport(siteInput, assessment, apiData) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return fallbackReport(assessment, apiData);
  try {
    const p = buildReportPrompt(siteInput, assessment, apiData);
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5',
        max_tokens: 700,
        system: p.system,
        messages: [{ role: 'user', content: p.user }],
      }),
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) throw new Error(`LLM API returned ${res.status}`);
    const data = await res.json();
    const text = (data.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();
    return text || fallbackReport(assessment, apiData);
  } catch (err) {
    console.error('LLM report failed:', err.message);
    return fallbackReport(assessment, apiData);
  }
}

module.exports = { generateReport };
