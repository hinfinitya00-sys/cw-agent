/**
 * claude-api-live.js — Claude API リアルタイム統合
 * server.js 経由で案件評価・提案文生成を実行
 */
(function () {
  'use strict';

  const SERVER_URL = 'http://localhost:3456';

  const ClaudeEvaluator = {

    /**
     * evaluateJob — Claude で案件を深層評価
     * @param {Object} job 案件データ
     * @param {string} apiKey Anthropic APIキー
     * @returns {Promise<Object>} evaluation オブジェクト
     */
    evaluateJob: async function (job, apiKey) {
      const resp = await fetch(`${SERVER_URL}/api/evaluate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ job, apiKey })
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || `評価API失敗: HTTP ${resp.status}`);
      }

      const data = await resp.json();
      if (!data.success) throw new Error(data.error || '評価失敗');

      return data.evaluation; // { score, recommendation, ai_utilization, ... }
    },

    /**
     * generateProposalStreaming — SSEストリーミングで提案文を生成
     * @param {Object} job 案件データ
     * @param {Object} profile フリーランサープロフィール
     * @param {string} variant スタイル (technical|business|creative|empathy)
     * @param {string} apiKey Anthropic APIキー
     * @param {Function} onChunk テキストチャンクコールバック
     * @param {Function} onDone 完了コールバック
     * @returns {Promise<string>} 生成された提案文全体
     */
    generateProposalStreaming: async function (job, profile, variant, apiKey, onChunk, onDone) {
      const resp = await fetch(`${SERVER_URL}/api/generate-proposal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ job, profile, variant: variant || 'technical', apiKey })
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || `提案文生成失敗: HTTP ${resp.status}`);
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let fullText = '';
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop(); // 不完全な行をバッファに残す

        for (const line of lines) {
          if (!line.startsWith('data:')) continue;
          const jsonStr = line.slice(5).trim();
          if (!jsonStr) continue;
          try {
            const evt = JSON.parse(jsonStr);
            if (evt.text) {
              fullText += evt.text;
              if (typeof onChunk === 'function') onChunk(evt.text, fullText);
            }
            if (evt.done) {
              if (typeof onDone === 'function') onDone(fullText, evt.usage);
            }
            if (evt.error) throw new Error(evt.error);
          } catch (e) {
            if (e.message && !e.message.includes('JSON')) throw e;
          }
        }
      }

      return fullText;
    },

    /**
     * generateProposal — 提案文を一括生成（SSEバッファリング版）
     * @param {Object} job
     * @param {Object} profile
     * @param {string} variant
     * @param {string} apiKey
     * @returns {Promise<string>}
     */
    generateProposal: async function (job, profile, variant, apiKey) {
      return this.generateProposalStreaming(job, profile, variant, apiKey, null, null);
    }
  };

  window.ClaudeEvaluator = ClaudeEvaluator;
})();
