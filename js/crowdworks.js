/**
 * crowdworks.js — CW-Agent CrowdWorks Integration Module
 * Simulates CrowdWorks API, evaluates jobs, filters exclusions
 */
(function () {
  'use strict';

  const EXCLUDED_KEYWORDS = ['フル出勤', '雇用契約', '常駐', '週5', '正社員', '派遣'];
  const AI_KEYWORDS = ['Claude', 'GPT', 'ChatGPT', 'Midjourney', 'Gemini', 'Stable Diffusion',
    'AI', '自動化', 'LLM', '機械学習', 'deep learning', 'ディープラーニング', 'StableDiffusion',
    'DALL-E', 'Whisper', 'RAG', 'ベクトル', '自然言語', 'NLP'];
  const MIN_HOURLY = 3000;
  const MAX_WEEKLY_HOURS = 18;

  let _fetchInterval = null;

  // Sample job pool — simulates real CrowdWorks listings
  const _jobPool = [
    {
      id: 'cw_001',
      title: 'Claude API を使った社内文書自動化システム構築',
      category: 'AI開発',
      description: 'AnthropicのClaude APIを利用して、社内Slackへの自動返信と文書分類システムを開発。RAG実装経験者優遇。',
      budget_min: 150000,
      budget_max: 200000,
      estimated_hours: 25,
      url: 'https://crowdworks.jp/public/jobs/sample_001',
      posted_at: _daysAgo(0)
    },
    {
      id: 'cw_002',
      title: 'Midjourney + ComfyUI 商品画像自動生成ワークフロー',
      category: '画像生成',
      description: 'ECサイト向けの商品画像をMidjourney/ComfyUIで自動生成するバッチ処理システム。Python必須。',
      budget_min: 80000,
      budget_max: 120000,
      estimated_hours: 20,
      url: 'https://crowdworks.jp/public/jobs/sample_002',
      posted_at: _daysAgo(1)
    },
    {
      id: 'cw_003',
      title: 'ChatGPT APIを使った業務フロー自動化（メール返信・日程調整）',
      category: '自動化',
      description: 'GPT-4oを使ってメールの自動分類・返信案生成・カレンダー連携を実現するシステム。GAS可。',
      budget_min: 50000,
      budget_max: 80000,
      estimated_hours: 15,
      url: 'https://crowdworks.jp/public/jobs/sample_003',
      posted_at: _daysAgo(0)
    },
    {
      id: 'cw_004',
      title: 'LLMを活用した不動産物件説明文自動生成ツール',
      category: 'AI開発',
      description: 'Gemini Pro APIで物件データから魅力的な説明文を生成するWebアプリ開発。Next.js使用。',
      budget_min: 120000,
      budget_max: 180000,
      estimated_hours: 30,
      url: 'https://crowdworks.jp/public/jobs/sample_004',
      posted_at: _daysAgo(2)
    },
    {
      id: 'cw_005',
      title: 'Stable Diffusion LoRA学習スクリプト作成',
      category: '画像生成',
      description: '商品キャラクターのLoRA学習用スクリプト作成。AWS EC2でのバッチ実行対応。',
      budget_min: 60000,
      budget_max: 90000,
      estimated_hours: 18,
      url: 'https://crowdworks.jp/public/jobs/sample_005',
      posted_at: _daysAgo(1)
    },
    {
      id: 'cw_006',
      title: 'GPT-4oとPythonを使ったWebスクレイピング＋AI要約システム',
      category: '自動化',
      description: 'ニュースサイトの記事を自動収集しGPT-4oで要約・分類してSlack通知するボット開発。',
      budget_min: 40000,
      budget_max: 60000,
      estimated_hours: 12,
      url: 'https://crowdworks.jp/public/jobs/sample_006',
      posted_at: _daysAgo(0)
    },
    {
      id: 'cw_007',
      title: 'AIチャットボット（RAG構成）カスタマーサポート向け',
      category: 'AI開発',
      description: 'Pinecone + OpenAI Embeddingsで社内FAQ検索システムを構築。FastAPIバックエンド。',
      budget_min: 200000,
      budget_max: 300000,
      estimated_hours: 40,
      url: 'https://crowdworks.jp/public/jobs/sample_007',
      posted_at: _daysAgo(3)
    },
    {
      id: 'cw_008',
      title: 'データ入力作業（単純作業・時給1200円）',
      category: 'データ入力',
      description: 'Excelデータの入力作業。特別なスキル不要。週5日、フル出勤可能な方。',
      budget_min: 5000,
      budget_max: 10000,
      estimated_hours: 8,
      url: 'https://crowdworks.jp/public/jobs/sample_008',
      posted_at: _daysAgo(0)
    },
    {
      id: 'cw_009',
      title: 'Claude + LangChainでの社内ナレッジ管理システム',
      category: 'AI開発',
      description: 'LangChainとClaude Opusを使ったドキュメント検索・Q&Aシステム。TypeScript/Next.js。',
      budget_min: 180000,
      budget_max: 250000,
      estimated_hours: 35,
      url: 'https://crowdworks.jp/public/jobs/sample_009',
      posted_at: _daysAgo(1)
    },
    {
      id: 'cw_010',
      title: 'Python×AI機械学習モデルを使った需要予測ツール',
      category: 'データ分析',
      description: '小売業向けの在庫・需要予測AIシステム。scikit-learn/XGBoost + ChatGPT解説機能付き。',
      budget_min: 100000,
      budget_max: 150000,
      estimated_hours: 22,
      url: 'https://crowdworks.jp/public/jobs/sample_010',
      posted_at: _daysAgo(2)
    },
    {
      id: 'cw_011',
      title: 'Whisper APIを使った会議議事録自動生成サービス',
      category: '自動化',
      description: 'OpenAI Whisperで音声文字起こし→GPT-4で要約・アクションアイテム抽出するSaaS開発。',
      budget_min: 130000,
      budget_max: 200000,
      estimated_hours: 28,
      url: 'https://crowdworks.jp/public/jobs/sample_011',
      posted_at: _daysAgo(0)
    },
    {
      id: 'cw_012',
      title: '常駐SE募集（雇用契約・週5フル出勤）',
      category: 'Web開発',
      description: '都内常駐の正社員SE。週5日フル出勤必須。雇用契約。',
      budget_min: 300000,
      budget_max: 400000,
      estimated_hours: 160,
      url: 'https://crowdworks.jp/public/jobs/sample_012',
      posted_at: _daysAgo(4)
    }
  ];

  function _daysAgo(n) {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d.toISOString();
  }

  function _formatDate(iso) {
    const d = new Date(iso);
    return d.toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' });
  }

  const CWAgent = {

    /**
     * fetchJobs — simulates API fetch, returns AI-related jobs
     * @returns {Array} evaluated job objects
     */
    fetchJobs: function () {
      // Simulate network delay feel — return synchronously in simulation
      const jobs = _jobPool.map(job => {
        const evaluation = this.evaluateJob(job);
        return {
          ...job,
          ai_score: evaluation.score,
          recommendation: evaluation.recommendation,
          eval_reason: evaluation.reason,
          hourly_rate: Math.round(((job.budget_min + job.budget_max) / 2) / job.estimated_hours),
          status: 'new'
        };
      });

      return jobs;
    },

    /**
     * evaluateJob — AI evaluation scoring logic
     * @param {Object} job
     * @returns {Object} { score, recommendation, reason }
     */
    evaluateJob: function (job) {
      const titleDesc = ((job.title || '') + ' ' + (job.description || '')).toLowerCase();
      const avgBudget = ((job.budget_min || 0) + (job.budget_max || 0)) / 2;
      const hours = job.estimated_hours || 1;
      const hourlyRate = avgBudget / hours;

      // Check exclusions first
      const exclusionMatch = EXCLUDED_KEYWORDS.find(kw => titleDesc.includes(kw.toLowerCase()));
      if (exclusionMatch) {
        return {
          score: 0,
          recommendation: 'skip',
          reason: '除外キーワード「' + exclusionMatch + '」が含まれています'
        };
      }

      // Check if hours exceed max
      if (hours > MAX_WEEKLY_HOURS) {
        return {
          score: Math.max(0, 30 - Math.round((hours - MAX_WEEKLY_HOURS) * 2)),
          recommendation: 'skip',
          reason: '稼働時間が上限(' + MAX_WEEKLY_HOURS + 'h)を超えています (' + hours + 'h)'
        };
      }

      // Count AI keyword matches
      let aiScore = 0;
      let matchedKeywords = [];
      AI_KEYWORDS.forEach(kw => {
        if (titleDesc.includes(kw.toLowerCase())) {
          aiScore += 15;
          matchedKeywords.push(kw);
        }
      });
      aiScore = Math.min(aiScore, 60); // max 60 from keywords

      // Hourly rate score (0-30)
      let hourlyScore = 0;
      if (hourlyRate >= 5000) hourlyScore = 30;
      else if (hourlyRate >= 3500) hourlyScore = 22;
      else if (hourlyRate >= 3000) hourlyScore = 15;
      else if (hourlyRate >= 1500) hourlyScore = 5;
      else hourlyScore = 0;

      // Budget tier bonus (0-10)
      let budgetBonus = 0;
      if (avgBudget >= 200000) budgetBonus = 10;
      else if (avgBudget >= 100000) budgetBonus = 6;
      else if (avgBudget >= 50000) budgetBonus = 3;

      const totalScore = Math.min(100, aiScore + hourlyScore + budgetBonus);

      let recommendation, reason;
      if (hourlyRate < MIN_HOURLY) {
        recommendation = 'skip';
        reason = '時給¥' + Math.round(hourlyRate).toLocaleString() + ' — 最低基準(¥' + MIN_HOURLY.toLocaleString() + '/h)未満';
      } else if (totalScore >= 70) {
        recommendation = 'apply';
        reason = 'AIキーワード多数・時給良好。マッチ: ' + (matchedKeywords.slice(0, 3).join(', ') || '—');
      } else if (totalScore >= 45) {
        recommendation = 'watch';
        reason = '要件確認推奨。時給¥' + Math.round(hourlyRate).toLocaleString() + '/h';
      } else {
        recommendation = 'skip';
        reason = 'AIスコア低・時給¥' + Math.round(hourlyRate).toLocaleString() + '/h';
      }

      return { score: totalScore, recommendation, reason };
    },

    /**
     * filterExclusions — removes excluded jobs
     * @param {Array} jobs
     * @returns {Array} filtered jobs
     */
    filterExclusions: function (jobs) {
      return jobs.filter(job => {
        const titleDesc = ((job.title || '') + ' ' + (job.description || '')).toLowerCase();
        return !EXCLUDED_KEYWORDS.some(kw => titleDesc.includes(kw.toLowerCase()));
      });
    },

    /**
     * scheduleAutoFetch — sets interval, calls fetchJobs every 5 min (simulation)
     */
    scheduleAutoFetch: function () {
      // Immediate fetch
      this._doFetch();

      // Schedule every 5 minutes
      if (_fetchInterval) clearInterval(_fetchInterval);
      _fetchInterval = setInterval(() => {
        this._doFetch();
      }, 300000);
    },

    _doFetch: function () {
      const jobs = this.fetchJobs();
      const filtered = this.filterExclusions(jobs);
      const newJobs = filtered.filter(j => j.recommendation !== 'skip' || j.ai_score > 0);

      // Update the UI
      this._renderJobCards(filtered);

      // Notify about new high-score jobs
      const highScore = filtered.filter(j => j.ai_score >= 70);
      if (highScore.length > 0) {
        this.notifyNewJobs(highScore);
      }

      // Update count badge
      const badge = document.getElementById('newJobsCount');
      if (badge) badge.textContent = filtered.length + '件';
    },

    _renderJobCards: function (jobs) {
      const container = document.getElementById('newJobsList');
      if (!container) return;

      if (jobs.length === 0) {
        container.innerHTML = '<div class="loading-placeholder">新着案件はありません</div>';
        return;
      }

      // Sort: apply > watch > skip, then by score desc
      const sorted = [...jobs].sort((a, b) => {
        const order = { apply: 0, watch: 1, skip: 2 };
        const orderDiff = (order[a.recommendation] || 2) - (order[b.recommendation] || 2);
        if (orderDiff !== 0) return orderDiff;
        return (b.ai_score || 0) - (a.ai_score || 0);
      });

      container.innerHTML = sorted.map(job => {
        const scoreClass = job.ai_score >= 70 ? 'high' : job.ai_score >= 45 ? 'med' : 'low';
        const recClass = job.recommendation === 'apply' ? 'rec-apply' : job.recommendation === 'watch' ? 'rec-watch' : 'rec-skip';
        const recLabel = job.recommendation === 'apply' ? '✅ 応募推奨' : job.recommendation === 'watch' ? '👀 ウォッチ' : '❌ スキップ';
        const avgBudget = Math.round(((job.budget_min || 0) + (job.budget_max || 0)) / 2);

        return '<div class="job-card">' +
          '<div class="job-card-header">' +
            '<span class="job-title">' + _escHtml(job.title) + '</span>' +
            '<span class="job-score ' + scoreClass + '">スコア ' + (job.ai_score || 0) + '</span>' +
          '</div>' +
          '<div class="job-meta">' +
            '<span>📂 ' + _escHtml(job.category) + '</span>' +
            '<span>💴 ¥' + avgBudget.toLocaleString() + '</span>' +
            '<span>⏱️ ' + job.estimated_hours + 'h</span>' +
            '<span>💰 ¥' + (job.hourly_rate || 0).toLocaleString() + '/h</span>' +
            '<span>📅 ' + _formatDate(job.posted_at) + '</span>' +
          '</div>' +
          '<div class="job-recommendation ' + recClass + '">' + recLabel + ' — ' + _escHtml(job.eval_reason || '') + '</div>' +
          '<div class="job-actions">' +
            '<button class="btn btn-sm btn-outline-ai" onclick="ClaudeUI && ClaudeUI.openEvaluateModal(\'' + job.id + '\')">🤖 Claude評価</button>' +
            '<button class="btn btn-sm btn-outline-ai" onclick="ClaudeUI && ClaudeUI.openProposalModal(\'' + job.id + '\')">✍️ 提案文</button>' +
            '<button class="btn btn-sm btn-outline-ai" onclick="ClaudeUI && ClaudeUI.openABTestModal(\'' + job.id + '\')">🔀 A/Bテスト</button>' +
          '</div>' +
        '</div>';
      }).join('');
    },

    /**
     * notifyNewJobs — Web Notifications API
     * @param {Array} jobs
     */
    notifyNewJobs: function (jobs) {
      if (!('Notification' in window)) return;
      if (Notification.permission === 'denied') return;

      const send = () => {
        if (jobs.length === 0) return;
        const top = jobs[0];
        try {
          new Notification('CW-Agent: 新着AI案件 🔥', {
            body: top.title + '\nスコア: ' + top.ai_score + ' | ¥' + (top.hourly_rate || 0).toLocaleString() + '/h',
            icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><text y="28" font-size="28">⚡</text></svg>',
            tag: 'cw-agent-jobs'
          });
        } catch (e) {}
      };

      if (Notification.permission === 'granted') {
        send();
      } else if (Notification.permission === 'default') {
        Notification.requestPermission().then(perm => {
          if (perm === 'granted') send();
        });
      }
    }
  };

  function _escHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  window.CWAgent = CWAgent;
})();
