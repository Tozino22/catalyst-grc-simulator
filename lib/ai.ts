// AI helper: suggest which framework criteria a security finding impacts.

type Req = { id: string; ref: string; title: string };
export type Suggestion = { ref: string; rationale: string };

export async function suggestMappings(
  finding: { title: string; description: string | null; severity: string; cwe: string | null },
  requirements: Req[]
): Promise<Suggestion[]> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('Server is missing GEMINI_API_KEY (add it to .env.local).');

  const list = requirements.map((r) => `${r.ref}: ${r.title}`).join('\n');
  const prompt = `You are a compliance auditor. A security finding was reported by a technical audit:
Title: ${finding.title}
Description: ${finding.description || '(none)'}
Severity: ${finding.severity}${finding.cwe ? `\nCWE: ${finding.cwe}` : ''}

Here are the applicable compliance criteria (may span SOC 2, PCI DSS, NIST CSF, NIST AI RMF, ISO 42001):
${list}

Which criteria does this finding most directly impact or violate? Return ONLY a JSON array (no markdown fences) of objects with keys "ref" (the exact criterion ref, e.g. CC6.6) and "rationale" (one short sentence). Include only the 1-4 most relevant criteria.`;

  const model = process.env.GEMINI_MODEL || 'gemini-flash-lite-latest';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;

  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data?.error?.message || 'AI request failed.');

  const text: string =
    data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text || '').join('') || '';
  const m = text.match(/\[[\s\S]*\]/);
  if (!m) return [];
  try {
    const arr = JSON.parse(m[0]) as Suggestion[];
    return Array.isArray(arr) ? arr.filter((s) => s && s.ref) : [];
  } catch {
    return [];
  }
}
