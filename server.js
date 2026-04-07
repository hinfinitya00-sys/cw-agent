/**
 * server.js — CW-Agent AI Backend
 * Claude Opus 4.6 + Adaptive Thinking で案件評価・提案文生成・市場分析
 */

import Anthropic from '@anthropic-ai/sdk';
import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '2mb' }));

const PORT = process.env.PORT || 3456;

function getClient(apiKey) {
  const key = apiKey || process.env.ANTHROPIC_API_KEY;
  if (!key) {
    throw new Error('ANTHROPIC_API_KEY が設定されていません。ダッシュボードの「AI設定」からAPIキーを入力してください。');
  }
  return new Anthropic({ apiKey: key });
}

// ─────────────────────────────────────────
// GET /api/health
// ─────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', version: '2.0.0', timestamp: new Date().toISOString() });
});

// ─────────────────────────────────────────
// POST /api/evaluate — Claude による案件深層評価
// ─────────────────────────────────────────
app.post('/api/evaluate', async (req, res) => {
  const { job, apiKey } = req.body;
  if (!job) return res.status(400).json({ error: '案件データが必要です' });

  const avgBudget = Math.round(((job.budget_min || 0) + (job.budget_max || 0)) / 2);
  const hourlyEst  = job.estimated_hours > 0 ? Math.round(avgBudget / job.estimated_hours) : 0;

  try {
    const client = getClient(apiKey);
    const stream = client.messages.stream({
      model: 'claude-opus-4-6',
      max_tokens: 1024,
      thinking: { type: 'adaptive' },
      system: 'あなたはAIフリーランスの収益最大化専門エージェントです。必ずJSON形式のみで回答してください。余分なテキストは一切含めないでください。',
      messages: [{
        role: 'user',
        content: `以下のCrowdWorks案件をAIフリーランス視点で深層評価してください。

【案件情報】
タイトル: ${job.title}
カテゴリ: ${job.category || '不明'}
説明: ${job.description || '（説明なし）'}
予算: ¥${avgBudget.toLocaleString()}（¥${(job.budget_min || 0).toLocaleString()} 〜 ¥${(job.budget_max || 0).toLocaleString()}）
表示稼働時間: ${job.estimated_hours || '?'}h
表示時給: ¥${hourlyEst.toLocaleString()}/h

【月100万円達成基準】
- 時給3,000円以上が理想（最低基準2,500円）
- 週18時間以内で完了可能
- Claude/GPT/AIツール活用で作業を3倍効率化できる
- リピート受注・長期契約の可能性がある

【出力（JSON形式のみ）】
{
  "score": 0から100の整数,
  "recommendation": "apply" または "watch" または "skip",
  "ai_utilization": "ClaudeやAIツールの具体的な活用方法（1〜2文）",
  "time_estimate_actual": AI活用後の実際の必要時間（数値・時間単位）,
  "hourly_rate_actual": AI活用後の実時給予測（数値・円単位）,
  "win_probability": 獲得確率（0〜100の整数）,
  "key_reasons": ["評価理由1", "評価理由2", "評価理由3"],
  "risk_factors": ["リスク要因1"],
  "appeal_points": "このフリーランサーが強調すべきアピールポイント（1文）",
  "monthly_contribution": 月収目標100万円への月間貢献額（数値・円単位）
}`
      }]
    });

    const message = await stream.finalMessage();
    let text = '';
    for (const block of message.content) {
      if (block.type === 'text') text += block.text;
    }
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('AI応答のJSON解析に失敗しました');
    const evaluation = JSON.parse(jsonMatch[0]);

    res.json({ success: true, evaluation, usage: message.usage });
  } catch (err) {
    console.error('[/api/evaluate]', err.message);
    const status = (err instanceof Anthropic.APIError) ? err.status : 500;
    res.status(status).json({ error: err.message });
  }
});

// ─────────────────────────────────────────
// POST /api/generate-proposal — 提案文ストリーミング生成 (SSE)
// ─────────────────────────────────────────
app.post('/api/generate-proposal', async (req, res) => {
  const { job, profile, variant, apiKey } = req.body;
  if (!job) return res.status(400).json({ error: '案件データが必要です' });

  const styles = {
    technical: '技術的実装力・具体的な経験を前面に出す専門家スタイル。使用技術・ライブラリ名を具体的に記載し、実装能力への信頼感を高める。',
    business:  'クライアントのビジネス成果・ROI・コスト削減・時間短縮効果を数字で示すビジネスライクなスタイル。投資対効果を明確に。',
    creative:  '独自のアイデアや他者とは異なる創造的な解決策を強調するスタイル。差別化ポイントと新鮮な視点を際立たせる。',
    empathy:   'クライアントの課題や悩みへの深い共感と理解を示し、長期的なパートナーシップを重視するスタイル。信頼関係を最優先に。'
  };

  const avgBudget = Math.round(((job.budget_min || 0) + (job.budget_max || 0)) / 2);
  const styleDesc  = styles[variant] || styles.technical;
  const profileSummary = profile?.summary ||
    'AI開発・業務自動化専門のフリーランスエンジニア。Claude/GPT-4/Python歴3年以上。RAG・LangChain・API統合が得意。CrowdWorks月収100万円を継続達成中。';

  try {
    const client = getClient(apiKey);

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    const stream = client.messages.stream({
      model: 'claude-opus-4-6',
      max_tokens: 1500,
      thinking: { type: 'adaptive' },
      system: 'CrowdWorksでトップランカーのAIフリーランサーとして、高受注率の提案文を作成してください。必ずです/ます調で。',
      messages: [{
        role: 'user',
        content: `以下の案件に対するCrowdWorks提案文を作成してください。

【案件詳細】
タイトル: ${job.title}
説明: ${job.description || '（説明なし）'}
予算: ¥${avgBudget.toLocaleString()}
カテゴリ: ${job.category || '不明'}

【提案スタイル】
${styleDesc}

【フリーランサープロフィール】
${profileSummary}

【必須要件】
1. 文字数: 400〜600文字
2. 構成: ①クライアントの課題への共感・理解 → ②具体的な解決策とAIツール活用法 → ③実績・スキル証明 → ④次のアクションを促す締め
3. ClaudeやGPT等のAIツールをどのように活用するか、具体的に明記すること
4. です/ます調を徹底
5. CrowdWorksで実際に使える自然な文章であること`
      }]
    });

    stream.on('text', (delta) => {
      res.write(`data: ${JSON.stringify({ text: delta })}\n\n`);
    });

    const finalMsg = await stream.finalMessage();
    res.write(`data: ${JSON.stringify({ done: true, usage: finalMsg.usage })}\n\n`);
    res.end();

  } catch (err) {
    console.error('[/api/generate-proposal]', err.message);
    try {
      res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
      res.end();
    } catch (_) { /* client disconnected */ }
  }
});

// ─────────────────────────────────────────
// POST /api/ab-test — A/B 提案文同時生成
// ─────────────────────────────────────────
app.post('/api/ab-test', async (req, res) => {
  const { job, profile, apiKey } = req.body;
  if (!job) return res.status(400).json({ error: '案件データが必要です' });

  const avgBudget = Math.round(((job.budget_min || 0) + (job.budget_max || 0)) / 2);
  const profileSummary = profile?.summary ||
    'AI開発・業務自動化専門のフリーランスエンジニア。Claude/GPT-4/Python歴3年以上。CrowdWorks月収100万円継続達成。';

  async function genVariant(styleInstruction, label) {
    const client = getClient(apiKey);
    const msg = await client.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 1200,
      thinking: { type: 'adaptive' },
      system: 'CrowdWorksのトップランカーAIフリーランサーとして提案文を書いてください。です/ます調。',
      messages: [{
        role: 'user',
        content: `案件「${job.title}」（予算¥${avgBudget.toLocaleString()}、説明: ${(job.description || '').slice(0, 200)}）への提案文（${label}）を作成してください。

スタイル方針: ${styleInstruction}
プロフィール: ${profileSummary}
文字数: 350〜500文字
必須要素: AI活用法の明記、具体的解決策、クライアント課題への言及、実績アピール`
      }]
    });
    let text = '';
    for (const block of msg.content) {
      if (block.type === 'text') text += block.text;
    }
    return { label, styleInstruction, text: text.trim(), usage: msg.usage };
  }

  try {
    const [variantA, variantB] = await Promise.all([
      genVariant(
        '技術的専門性・具体的な実装経験を前面に出す。使用するAPI・ライブラリ・フレームワークの名前を明記し、技術力への信頼感を高める。',
        'A: 技術専門家型'
      ),
      genVariant(
        'クライアントのビジネス成果・ROI・時間短縮効果を数値で示す。「○○を自動化することで週X時間を削減できます」のように効果を具体的に示す。',
        'B: ビジネス成果型'
      )
    ]);
    res.json({ success: true, variantA, variantB });
  } catch (err) {
    console.error('[/api/ab-test]', err.message);
    const status = (err instanceof Anthropic.APIError) ? err.status : 500;
    res.status(status).json({ error: err.message });
  }
});

// ─────────────────────────────────────────
// POST /api/market-analysis — 市場分析・月収戦略
// ─────────────────────────────────────────
app.post('/api/market-analysis', async (req, res) => {
  const { jobs, apiKey } = req.body;
  if (!jobs?.length) return res.status(400).json({ error: '案件データが必要です' });

  const summary = jobs.slice(0, 20).map(j => {
    const avg = Math.round(((j.budget_min || 0) + (j.budget_max || 0)) / 2);
    const hr  = j.estimated_hours > 0 ? Math.round(avg / j.estimated_hours) : 0;
    return `・${j.title}（¥${(avg / 10000).toFixed(0)}万円 / ${j.estimated_hours}h / 時給¥${hr.toLocaleString()}）`;
  }).join('\n');

  try {
    const client = getClient(apiKey);
    const message = await client.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 2000,
      thinking: { type: 'adaptive' },
      system: 'AIフリーランス市場の専門アナリストとして、必ずJSON形式のみで回答してください。',
      messages: [{
        role: 'user',
        content: `以下のCrowdWorks AI案件リストを分析し、月収100万円を達成・維持するための具体的な戦略をJSON形式で提供してください。

【最新案件リスト（${jobs.slice(0, 20).length}件）】
${summary}

【分析の観点】
- 現在の市場での時給相場と需要トレンド
- 競合が少なく高単価なニッチ領域
- 今すぐ応募すべき優先案件
- 月収100万円に向けた今月の戦略

【出力（JSON形式のみ）】
{
  "market_overview": "現在の市場状況と注目トレンド（2〜3文）",
  "top_opportunities": [
    {
      "category": "カテゴリ名",
      "demand_level": "高 / 中 / 低",
      "avg_hourly": 平均時給の数値,
      "competition": "高 / 中 / 低",
      "action": "具体的な行動指針（1文）"
    }
  ],
  "recommended_stack": ["今月すぐ習得・強化すべき技術1", "技術2", "技術3"],
  "monthly_strategy": {
    "week1": "第1週の最優先タスク",
    "week2": "第2週の最優先タスク",
    "week3_4": "第3〜4週の最優先タスク"
  },
  "high_value_keywords": ["高単価化につながるキーワード1", "キーワード2", "キーワード3", "キーワード4", "キーワード5"],
  "application_targets": [
    {
      "title": "今すぐ応募すべき案件タイトル",
      "reason": "応募理由（1文）",
      "expected_income": 期待収入の数値
    }
  ],
  "risk_warning": "今月注意すべき最大のリスク（1文）",
  "monthly_income_forecast": 現在の案件市場から見た月収予測の数値
}`
      }]
    });

    let text = '';
    for (const block of message.content) {
      if (block.type === 'text') text += block.text;
    }
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('JSON解析失敗');
    const analysis = JSON.parse(jsonMatch[0]);

    res.json({ success: true, analysis, jobCount: jobs.length, usage: message.usage });
  } catch (err) {
    console.error('[/api/market-analysis]', err.message);
    const status = (err instanceof Anthropic.APIError) ? err.status : 500;
    res.status(status).json({ error: err.message });
  }
});

// ─────────────────────────────────────────
// Start
// ─────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀 CW-Agent AI Server  →  http://localhost:${PORT}`);
  console.log(`🤖 Claude API: ${process.env.ANTHROPIC_API_KEY ? '✅ 環境変数からキー読み込み済み' : '⚠️  未設定（ダッシュボードから入力）'}`);
  console.log('\nエンドポイント:');
  console.log('  GET  /api/health');
  console.log('  POST /api/evaluate           — 案件深層評価');
  console.log('  POST /api/generate-proposal  — 提案文生成（SSEストリーミング）');
  console.log('  POST /api/ab-test            — A/B提案文同時生成');
  console.log('  POST /api/market-analysis    — 市場分析・月収戦略\n');
});
