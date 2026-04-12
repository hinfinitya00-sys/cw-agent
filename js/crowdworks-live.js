/**
 * crowdworks-live.js — 実CrowdWorks案件スキャン
 * server.js プロキシ経由でCrowdWorks RSSを取得・フィルタリング
 */
(function () {
  'use strict';

  const SERVER_URL = 'http://localhost:3456';

  // AI活用案件を判定するキーワード
  const AI_KEYWORDS = [
    'AI', 'Claude', 'ChatGPT', 'GPT', 'LLM', 'Gemini', 'Midjourney',
    '機械学習', '自動化', 'Python', 'スクレイピング', 'API', 'プロンプト',
    'データ分析', 'チャットボット', '生成AI', 'RAG', 'LangChain', 'OpenAI'
  ];

  // 除外キーワード（週18時間制約に合わない案件）
  const EXCLUDE_KEYWORDS = [
    'フル稼働', '常駐', '週5日', '週40時間', '出社必須', '常時対応',
    '24時間', '土日稼働', '専属', '専任'
  ];

  const CrowdWorksFetcher = {

    /**
     * fetchJobs — サーバー経由でCrowdWorks案件を取得
     * @param {string[]} keywords 検索キーワード
     * @returns {Promise<Object[]>} 案件リスト
     */
    fetchJobs: async function (keywords) {
      keywords = keywords || [
        'AI Claude', 'ChatGPT 自動化', 'Python AI', 'LLM 開発', 'プロンプト'
      ];

      const resp = await fetch(`${SERVER_URL}/api/cw/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keywords })
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${resp.status}`);
      }

      const data = await resp.json();
      if (!data.success) throw new Error(data.error || 'スキャン失敗');

      return data.jobs || [];
    },

    /**
     * fetchJobDetail — 案件詳細取得
     * @param {string} jobId
     * @param {string} [session] CWセッションCookie
     * @returns {Promise<Object>}
     */
    fetchJobDetail: async function (jobId, session) {
      const headers = { 'Content-Type': 'application/json' };
      if (session) headers['x-cw-session'] = session;

      const resp = await fetch(`${SERVER_URL}/api/cw/job/${jobId}`, { headers });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${resp.status}`);
      }
      return resp.json();
    },

    /**
     * filterJobs — AI活用可能・週18時間制約フィルター
     * @param {Object[]} jobs 全案件
     * @param {Object} [opts] オプション
     * @returns {Object[]} フィルタリング済み案件
     */
    filterJobs: function (jobs, opts) {
      opts = opts || {};
      const minHourly = opts.minHourly || 3000;
      const maxWeeklyHours = opts.maxWeeklyHours || 18;

      return jobs.filter(function (job) {
        const text = (job.title + ' ' + job.description).toLowerCase();

        // 除外キーワードチェック
        const hasExclude = EXCLUDE_KEYWORDS.some(function (kw) {
          return text.includes(kw.toLowerCase());
        });
        if (hasExclude) return false;

        // 週18時間制約: estimated_hours > maxWeeklyHours * 1.5 は除外
        if (job.estimated_hours > maxWeeklyHours * 1.5) return false;

        // 時給チェック（予算がある場合のみ）
        if (job.budget_max > 0 && job.estimated_hours > 0) {
          const hourly = job.budget_max / job.estimated_hours;
          if (hourly < minHourly * 0.5) return false; // 最低基準の半分以下は除外
        }

        return true;
      });
    },

    /**
     * scoreAiUtilization — AI活用可能性スコア（0-100）
     * @param {Object} job
     * @returns {number}
     */
    scoreAiUtilization: function (job) {
      const text = job.title + ' ' + job.description;
      let score = 0;
      AI_KEYWORDS.forEach(function (kw) {
        if (text.includes(kw)) score += 10;
      });
      // 予算・時給ボーナス
      if (job.budget_max >= 50000) score += 10;
      if (job.budget_max >= 100000) score += 10;
      return Math.min(100, score);
    }
  };

  window.CrowdWorksFetcher = CrowdWorksFetcher;
})();
