// kk-relay：ケミカル・キッチン「過去問 早押し」の自分専用の中継（Supabase Edge Function）。
// ブラウザは配布元のPDFを直接読めない（CORS）ので、合言葉を知っている本人のブラウザに限り、ここで受け取って渡す。
//   - 合言葉は Edge Function の秘密の値 KK_RELAY_PASS（本人がダッシュボードで設定。コードやリポジトリには入れない）
//   - 取りに行くのは過去問の配布元2か所の PDF だけ。保存はしない
//   - 配布元にことわられたら（403・429）、429 を返す（アプリはそこで止まる）
//   - ?health=1：配布元の PDF の先頭1バイトだけを取りに行き、応答の番号だけを返す（中身は返さない。1分に1回まで）
// 合言葉は本人だけが使うこと（ほかの人に使わせると、配布元の PDF を第三者に送ることになる）。
const HOSTS = new Set(['school.js88.com', 'img.cf.47news.jp']);
const ORIGINS = ['https://s70rm3892.github.io', 'http://127.0.0.1:8765', 'http://localhost:8765'];
const HEALTH_URL = 'https://img.cf.47news.jp/static/kyotsu-exam/2025/files/3hp3a3ybgi-answer.pdf';
const UA = 'Mozilla/5.0 (compatible; kk-relay/1; personal use)';
let lastHealth = 0;

function cors(req) {
  const o = req.headers.get('origin') || '';
  return {
    'Access-Control-Allow-Origin': ORIGINS.includes(o) ? o : ORIGINS[0],
    'Vary': 'Origin',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'x-kk-pass, content-type',
    'Access-Control-Max-Age': '600',
    'Cache-Control': 'no-store',
  };
}
const json = (status, body, h) => new Response(JSON.stringify(body), { status, headers: { ...h, 'Content-Type': 'application/json; charset=utf-8' } });

// 合言葉の比較：両方を SHA-256 にしてから、長さによらず同じ時間で比べる
async function samePass(a, b) {
  const enc = new TextEncoder();
  const [x, y] = await Promise.all([crypto.subtle.digest('SHA-256', enc.encode(a)), crypto.subtle.digest('SHA-256', enc.encode(b))]);
  const p = new Uint8Array(x), q = new Uint8Array(y);
  let d = 0;
  for (let i = 0; i < p.length; i++) d |= p[i] ^ q[i];
  return d === 0;
}

export async function handle(req, env, fetchImpl = fetch) {
  const h = cors(req);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: h });
  if (req.method !== 'GET') return json(405, { ok: false, error: 'GET だけ' }, h);
  const url = new URL(req.url);

  if (url.searchParams.has('health')) {
    const now = Date.now();
    if (now - lastHealth < 60000) return json(429, { ok: false, error: '1分に1回まで' }, h);
    lastHealth = now;
    try {
      const r = await fetchImpl(HEALTH_URL, { headers: { 'User-Agent': UA, 'Range': 'bytes=0-0' } });
      try { await r.body?.cancel(); } catch (_) { /* 読まない */ }
      return json(200, { ok: true, upstream: r.status }, h);
    } catch (e) {
      return json(200, { ok: false, upstream: 0, error: String(e).slice(0, 120) }, h);
    }
  }

  const pass = env('KK_RELAY_PASS') || '';
  if (pass.length < 8) return json(503, { ok: false, error: '合言葉がまだ設定されていない' }, h);
  if (!(await samePass(req.headers.get('x-kk-pass') || '', pass))) {
    await new Promise((r) => setTimeout(r, 700)); // 総当たりを遅くする
    return json(401, { ok: false, error: '合言葉がちがう' }, h);
  }
  if (url.searchParams.has('ping')) return json(200, { ok: true, v: 1 }, h);

  let t;
  try { t = new URL(url.searchParams.get('u') || ''); } catch (_) { return json(400, { ok: false, error: 'URLがおかしい' }, h); }
  if (t.protocol !== 'https:' || !HOSTS.has(t.hostname) || !t.pathname.toLowerCase().endsWith('.pdf')) {
    return json(403, { ok: false, error: '過去問の配布元のPDFだけ' }, h);
  }
  let r;
  try { r = await fetchImpl(t.href, { headers: { 'User-Agent': UA } }); }
  catch (e) { return json(502, { ok: false, error: '配布元につながらない' }, h); }
  if (r.status === 403 || r.status === 429) return json(429, { ok: false, error: `配布元の応答 ${r.status}` }, h);
  if (!r.ok || !r.body) return json(502, { ok: false, error: `配布元の応答 ${r.status}` }, h);
  const len = r.headers.get('content-length');
  if (len && +len > 40e6) return json(413, { ok: false, error: '大きすぎる' }, h);
  return new Response(r.body, { status: 200, headers: { ...h, 'Content-Type': 'application/pdf', ...(len ? { 'Content-Length': len } : {}) } });
}

// Supabase（Deno）で動くときだけ起動する（テストでは handle を直接呼ぶ）
if (typeof Deno !== 'undefined') Deno.serve((req) => handle(req, (k) => Deno.env.get(k)));
