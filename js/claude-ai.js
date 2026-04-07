/**
 * claude-ai.js — CW-Agent Claude AI フロントエンドモジュール
 * ローカルサーバー (server.js) と通信してAI機能を提供する
 */
(function () {
  'use strict';

  const SERVER_URL    = 'http://localhost:3456';
  const API_KEY_KEY   = 'cw_anthropic_key';
  const PROFILE_KEY   = 'cw_user_profile';
  const AB_RESULTS_KEY = 'cw_ab_results';

  // ─── 公開 API ────────────────────────────────────────────
  const ClaudeAI = {

    // ── キー管理 ────────────────────────────────────────────
    getApiKey: function () {
      return localStorage.getItem(API_KEY_KEY) || '';
    },
    setApiKey: function (key) {
      localStorage.setItem(API_KEY_KEY, key.trim());
    },
    isConfigured: function () {
      return !!this.getApiKey();
    },

    // ── プロフィール管理 ─────────────────────────────────────
    getProfile: function () {
      try {
        return JSON.parse(localStorage.getItem(PROFILE_KEY) || '{}');
      } catch { return {}; }
    },
    saveProfile: function (profile) {
      localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    },

    // ── サーバー接続確認 ─────────────────────────────────────
    checkServer: async function () {
      try {
        const res = await fetch(`${SERVER_URL}/api/health`, {
          signal: AbortSignal.timeout(3000)
        });
        return res.ok;
      } catch {
        return false;
      }
    },

    // ── 案件深層評価 ─────────────────────────────────────────
    evaluateJob: async function (job) {
      const res = await fetch(`${SERVER_URL}/api/evaluate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ job, apiKey: this.getApiKey() })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      return res.json();
    },

    // ── 提案文ストリーミング生成 ──────────────────────────────
    generateProposal: async function (job, variant, onChunk, onDone, onError) {
      const res = await fetch(`${SERVER_URL}/api/generate-proposal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          job,
          variant: variant || 'technical',
          profile: this.getProfile(),
          apiKey: this.getApiKey()
        })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(err.error || `HTTP ${res.status}`);
      }

      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let fullText  = '';
      let buffer    = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop(); // 不完全な行はバッファに残す

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.text) {
              fullText += data.text;
              onChunk && onChunk(data.text, fullText);
            }
            if (data.done) {
              onDone && onDone(fullText, data.usage);
            }
            if (data.error) {
              onError && onError(data.error);
              return fullText;
            }
          } catch (_) { /* 不完全なJSON は無視 */ }
        }
      }
      return fullText;
    },

    // ── A/B テスト生成 ────────────────────────────────────────
    runABTest: async function (job) {
      const res = await fetch(`${SERVER_URL}/api/ab-test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          job,
          profile: this.getProfile(),
          apiKey: this.getApiKey()
        })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const result = await res.json();
      // 結果を保存
      localStorage.setItem(AB_RESULTS_KEY, JSON.stringify({
        job: { id: job.id, title: job.title },
        result,
        savedAt: new Date().toISOString()
      }));
      return result;
    },

    // ── 市場分析 ──────────────────────────────────────────────
    analyzeMarket: async function (jobs) {
      const res = await fetch(`${SERVER_URL}/api/market-analysis`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobs, apiKey: this.getApiKey() })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      return res.json();
    }
  };

  // ─── UI ヘルパー ──────────────────────────────────────────
  const ClaudeUI = {

    // サーバー接続バナーを更新
    updateStatusBanner: async function () {
      const banner = document.getElementById('aiStatusBanner');
      if (!banner) return;
      const connected = await ClaudeAI.checkServer();
      if (connected) {
        const hasKey = ClaudeAI.isConfigured();
        if (hasKey) {
          banner.className = 'ai-banner ai-banner--ok';
          banner.innerHTML = '<span>✅</span><span>Claude AI 接続済み — Opus 4.6 Adaptive Thinking 有効</span><button onclick="ClaudeUI.runMarketAnalysis()" class="btn btn-sm btn-accent">📊 市場分析</button>';
        } else {
          banner.className = 'ai-banner ai-banner--warn';
          banner.innerHTML = '<span>⚠️</span><span>APIキー未設定</span><button onclick="ClaudeUI.openSettings()" class="btn btn-sm btn-outline">🔑 APIキーを設定</button>';
        }
      } else {
        banner.className = 'ai-banner ai-banner--error';
        banner.innerHTML = '<span>🔴</span><span>AIサーバー未起動 — ターミナルで <code>npm start</code> を実行してください</span>';
      }
    },

    // 設定モーダルを開く
    openSettings: function () {
      const modal = document.getElementById('aiSettingsModal');
      if (!modal) return;
      const keyInput = document.getElementById('anthropicKeyInput');
      if (keyInput) keyInput.value = ClaudeAI.getApiKey();
      const profileInput = document.getElementById('profileSummaryInput');
      if (profileInput) profileInput.value = ClaudeAI.getProfile().summary || '';
      modal.style.display = 'flex';
    },

    closeSettings: function () {
      const modal = document.getElementById('aiSettingsModal');
      if (modal) modal.style.display = 'none';
    },

    saveSettings: function () {
      const key = (document.getElementById('anthropicKeyInput') || {}).value || '';
      const summary = (document.getElementById('profileSummaryInput') || {}).value || '';
      if (!key.trim()) { alert('APIキーを入力してください'); return; }
      ClaudeAI.setApiKey(key);
      if (summary.trim()) ClaudeAI.saveProfile({ summary: summary.trim() });
      this.closeSettings();
      this.updateStatusBanner();
      this.showToast('設定を保存しました ✅');
    },

    // 案件評価モーダル
    openEvaluateModal: async function (jobId) {
      const modal = document.getElementById('aiEvalModal');
      if (!modal) return;

      if (!ClaudeAI.isConfigured()) {
        this.showToast('先にAPIキーを設定してください', 'error');
        this.openSettings();
        return;
      }

      const job = _findJob(jobId);
      if (!job) { this.showToast('案件が見つかりません', 'error'); return; }

      // Reset
      document.getElementById('evalJobTitle').textContent  = job.title;
      document.getElementById('evalResultBody').innerHTML  = '<div class="ai-loading"><div class="ai-spinner"></div><span>Claude Opus 4.6 が分析中...</span></div>';
      document.getElementById('evalProposalBtn').dataset.jobId = jobId;
      document.getElementById('evalABTestBtn').dataset.jobId   = jobId;
      modal.style.display = 'flex';

      try {
        const { evaluation } = await ClaudeAI.evaluateJob(job);
        _renderEvalResult(evaluation);
      } catch (err) {
        document.getElementById('evalResultBody').innerHTML =
          `<div class="ai-error">❌ ${_esc(err.message)}</div>`;
      }
    },

    closeEvaluateModal: function () {
      const modal = document.getElementById('aiEvalModal');
      if (modal) modal.style.display = 'none';
    },

    // 提案文生成モーダル
    openProposalModal: function (jobId) {
      const modal = document.getElementById('proposalModal');
      if (!modal) return;

      if (!ClaudeAI.isConfigured()) {
        this.showToast('先にAPIキーを設定してください', 'error');
        this.openSettings();
        return;
      }

      const job = _findJob(jobId);
      if (!job) { this.showToast('案件が見つかりません', 'error'); return; }

      document.getElementById('proposalJobTitle').textContent = job.title;
      document.getElementById('proposalOutput').textContent   = '';
      document.getElementById('proposalMeta').textContent     = '';
      document.getElementById('proposalGenerateBtn').dataset.jobId = jobId;
      modal.style.display = 'flex';
    },

    closeProposalModal: function () {
      const modal = document.getElementById('proposalModal');
      if (modal) modal.style.display = 'none';
    },

    generateProposal: async function () {
      const btn     = document.getElementById('proposalGenerateBtn');
      const jobId   = btn?.dataset.jobId;
      const variant = document.getElementById('proposalVariant')?.value || 'technical';
      const output  = document.getElementById('proposalOutput');
      const meta    = document.getElementById('proposalMeta');
      if (!jobId || !output) return;

      const job = _findJob(jobId);
      if (!job) return;

      output.textContent = '';
      meta.textContent   = '生成中...';
      btn.disabled       = true;

      try {
        await ClaudeAI.generateProposal(
          job,
          variant,
          (_chunk, full) => { output.textContent = full; },
          (_full, usage) => {
            meta.textContent = `✅ 生成完了 (入力: ${usage?.input_tokens || '?'}tokens / 出力: ${usage?.output_tokens || '?'}tokens)`;
          },
          (errMsg) => {
            meta.textContent = `❌ ${errMsg}`;
          }
        );
      } catch (err) {
        meta.textContent = `❌ ${err.message}`;
      } finally {
        btn.disabled = false;
      }
    },

    copyProposal: function () {
      const text = document.getElementById('proposalOutput')?.textContent || '';
      if (!text) { this.showToast('提案文がありません', 'error'); return; }
      navigator.clipboard.writeText(text)
        .then(() => this.showToast('クリップボードにコピーしました ✅'))
        .catch(() => this.showToast('コピー失敗', 'error'));
    },

    // A/B テストモーダル
    openABTestModal: async function (jobId) {
      const modal = document.getElementById('abTestModal');
      if (!modal) return;

      if (!ClaudeAI.isConfigured()) {
        this.showToast('先にAPIキーを設定してください', 'error');
        this.openSettings();
        return;
      }

      const job = _findJob(jobId);
      if (!job) return;

      document.getElementById('abTestJobTitle').textContent = job.title;
      document.getElementById('abVariantA').textContent     = '生成中...';
      document.getElementById('abVariantB').textContent     = '生成中...';
      document.getElementById('abMeta').textContent         = 'Claude が2パターンを並列生成中...';
      modal.style.display = 'flex';

      try {
        const { variantA, variantB } = await ClaudeAI.runABTest(job);
        document.getElementById('abLabelA').textContent = variantA.label;
        document.getElementById('abLabelB').textContent = variantB.label;
        document.getElementById('abVariantA').textContent = variantA.text;
        document.getElementById('abVariantB').textContent = variantB.text;
        const totalOut = (variantA.usage?.output_tokens || 0) + (variantB.usage?.output_tokens || 0);
        document.getElementById('abMeta').textContent =
          `✅ 生成完了 — 合計出力 ${totalOut} tokens`;
      } catch (err) {
        document.getElementById('abMeta').textContent = `❌ ${err.message}`;
      }
    },

    closeABTestModal: function () {
      const modal = document.getElementById('abTestModal');
      if (modal) modal.style.display = 'none';
    },

    copyABVariant: function (variant) {
      const el = document.getElementById(variant === 'A' ? 'abVariantA' : 'abVariantB');
      const text = el?.textContent || '';
      if (!text || text === '生成中...') { this.showToast('テキストがありません', 'error'); return; }
      navigator.clipboard.writeText(text)
        .then(() => this.showToast(`${variant}パターンをコピーしました ✅`))
        .catch(() => this.showToast('コピー失敗', 'error'));
    },

    // 市場分析
    runMarketAnalysis: async function () {
      const modal = document.getElementById('marketAnalysisModal');
      if (!modal) return;

      if (!ClaudeAI.isConfigured()) {
        this.showToast('先にAPIキーを設定してください', 'error');
        this.openSettings();
        return;
      }

      document.getElementById('marketAnalysisBody').innerHTML =
        '<div class="ai-loading"><div class="ai-spinner"></div><span>Claude Opus 4.6 が市場を分析中...</span></div>';
      modal.style.display = 'flex';

      try {
        const jobs = (window.CWAgent ? CWAgent.fetchJobs() : []);
        if (!jobs.length) {
          document.getElementById('marketAnalysisBody').innerHTML =
            '<div class="ai-error">案件データが取得できませんでした</div>';
          return;
        }
        const { analysis, jobCount } = await ClaudeAI.analyzeMarket(jobs);
        _renderMarketAnalysis(analysis, jobCount);
      } catch (err) {
        document.getElementById('marketAnalysisBody').innerHTML =
          `<div class="ai-error">❌ ${_esc(err.message)}</div>`;
      }
    },

    closeMarketAnalysisModal: function () {
      const modal = document.getElementById('marketAnalysisModal');
      if (modal) modal.style.display = 'none';
    },

    // トースト通知
    showToast: function (msg, type = 'success') {
      let container = document.getElementById('toastContainer');
      if (!container) {
        container = document.createElement('div');
        container.id = 'toastContainer';
        document.body.appendChild(container);
      }
      const toast = document.createElement('div');
      toast.className = `toast toast--${type}`;
      toast.textContent = msg;
      container.appendChild(toast);
      setTimeout(() => toast.classList.add('toast--show'), 10);
      setTimeout(() => {
        toast.classList.remove('toast--show');
        setTimeout(() => toast.remove(), 300);
      }, 3000);
    }
  };

  // ─── 内部ヘルパー ──────────────────────────────────────────
  function _findJob(jobId) {
    // CWAgent の jobPool から探す
    if (window.CWAgent) {
      const jobs = CWAgent.fetchJobs();
      const found = jobs.find(j => j.id === jobId);
      if (found) return found;
    }
    // AppState の projects から探す
    if (window.AppState?.projects) {
      const p = AppState.projects.find(p => p.id === jobId);
      if (p) {
        return {
          id: p.id,
          title: p.title,
          category: p.category,
          description: '',
          budget_min: p.budget,
          budget_max: p.budget,
          estimated_hours: p.hours
        };
      }
    }
    return null;
  }

  function _esc(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function _renderEvalResult(ev) {
    const recMap = {
      apply: { cls: 'rec-apply', label: '✅ 応募推奨' },
      watch: { cls: 'rec-watch', label: '👀 ウォッチ推奨' },
      skip:  { cls: 'rec-skip',  label: '❌ スキップ推奨' }
    };
    const rec = recMap[ev.recommendation] || recMap.watch;
    const scoreClass = ev.score >= 70 ? 'high' : ev.score >= 45 ? 'med' : 'low';

    const reasons  = (ev.key_reasons  || []).map(r => `<li>${_esc(r)}</li>`).join('');
    const risks    = (ev.risk_factors || []).map(r => `<li>${_esc(r)}</li>`).join('');
    const targets  = (ev.application_targets || []).map(t =>
      `<li><strong>${_esc(t.title)}</strong> — ${_esc(t.reason)}</li>`).join('');

    document.getElementById('evalResultBody').innerHTML = `
      <div class="eval-header">
        <div class="eval-score-circle ${scoreClass}">${ev.score}</div>
        <div class="eval-header-right">
          <div class="eval-rec ${rec.cls}">${rec.label}</div>
          <div class="eval-win">獲得確率 <strong>${ev.win_probability || '?'}%</strong></div>
        </div>
      </div>

      <div class="eval-grid">
        <div class="eval-item">
          <div class="eval-item-label">AI活用後の実時給</div>
          <div class="eval-item-value accent">¥${(ev.hourly_rate_actual || 0).toLocaleString()}/h</div>
        </div>
        <div class="eval-item">
          <div class="eval-item-label">実稼働時間予測</div>
          <div class="eval-item-value">${ev.time_estimate_actual || '?'}h</div>
        </div>
        <div class="eval-item">
          <div class="eval-item-label">月収への貢献</div>
          <div class="eval-item-value">¥${(ev.monthly_contribution || 0).toLocaleString()}</div>
        </div>
      </div>

      <div class="eval-section">
        <div class="eval-section-title">🤖 AI活用法</div>
        <p>${_esc(ev.ai_utilization || '—')}</p>
      </div>

      <div class="eval-section">
        <div class="eval-section-title">✅ 評価理由</div>
        <ul>${reasons || '<li>—</li>'}</ul>
      </div>

      ${risks ? `<div class="eval-section">
        <div class="eval-section-title">⚠️ リスク要因</div>
        <ul>${risks}</ul>
      </div>` : ''}

      <div class="eval-section">
        <div class="eval-section-title">💡 アピールポイント</div>
        <p class="highlight-text">${_esc(ev.appeal_points || '—')}</p>
      </div>
    `;
  }

  function _renderMarketAnalysis(a, jobCount) {
    const opps = (a.top_opportunities || []).map(o => `
      <tr>
        <td><strong>${_esc(o.category)}</strong></td>
        <td><span class="demand-badge demand-${(o.demand_level || '').replace(/[^a-z]/gi, '')}">${_esc(o.demand_level)}</span></td>
        <td class="accent">¥${(o.avg_hourly || 0).toLocaleString()}/h</td>
        <td>${_esc(o.competition)}</td>
        <td>${_esc(o.action)}</td>
      </tr>`).join('');

    const keywords = (a.high_value_keywords || []).map(k =>
      `<span class="kw-chip">${_esc(k)}</span>`).join('');

    const targets = (a.application_targets || []).map(t => `
      <div class="target-item">
        <div class="target-title">${_esc(t.title)}</div>
        <div class="target-meta">期待収入: ¥${(t.expected_income || 0).toLocaleString()} — ${_esc(t.reason)}</div>
      </div>`).join('');

    const strategy = a.monthly_strategy || {};

    document.getElementById('marketAnalysisBody').innerHTML = `
      <div class="market-forecast">
        <div class="forecast-label">月収予測</div>
        <div class="forecast-value">¥${(a.monthly_income_forecast || 0).toLocaleString()}</div>
        <div class="forecast-jobs">${jobCount}件の市場データから算出</div>
      </div>

      <div class="market-section">
        <div class="market-section-title">📈 市場概況</div>
        <p>${_esc(a.market_overview || '—')}</p>
      </div>

      <div class="market-section">
        <div class="market-section-title">🎯 カテゴリ別機会</div>
        <div class="table-responsive">
          <table class="market-table">
            <thead><tr><th>カテゴリ</th><th>需要</th><th>平均時給</th><th>競合</th><th>アクション</th></tr></thead>
            <tbody>${opps}</tbody>
          </table>
        </div>
      </div>

      <div class="market-section">
        <div class="market-section-title">🔑 高単価キーワード</div>
        <div class="kw-chips">${keywords}</div>
      </div>

      <div class="market-section">
        <div class="market-section-title">📅 今月の週次戦略</div>
        <div class="strategy-steps">
          <div class="strategy-step"><span class="step-label">Week 1</span><span>${_esc(strategy.week1 || '—')}</span></div>
          <div class="strategy-step"><span class="step-label">Week 2</span><span>${_esc(strategy.week2 || '—')}</span></div>
          <div class="strategy-step"><span class="step-label">Week 3-4</span><span>${_esc(strategy.week3_4 || '—')}</span></div>
        </div>
      </div>

      ${targets ? `<div class="market-section">
        <div class="market-section-title">🚀 今すぐ応募すべき案件</div>
        <div class="application-targets">${targets}</div>
      </div>` : ''}

      ${a.risk_warning ? `<div class="market-section risk-section">
        <div class="market-section-title">⚠️ 注意事項</div>
        <p>${_esc(a.risk_warning)}</p>
      </div>` : ''}

      <div class="market-section">
        <div class="market-section-title">🛠 今すぐ強化すべき技術スタック</div>
        <div class="stack-chips">
          ${(a.recommended_stack || []).map(s => `<span class="stack-chip">${_esc(s)}</span>`).join('')}
        </div>
      </div>
    `;
  }

  // ─── 初期化 ───────────────────────────────────────────────
  function init() {
    // 起動時にサーバー状態を確認
    ClaudeUI.updateStatusBanner();

    // モーダル外クリックで閉じる
    ['aiSettingsModal', 'aiEvalModal', 'proposalModal', 'abTestModal', 'marketAnalysisModal'].forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('click', (e) => {
        if (e.target === el) {
          el.style.display = 'none';
        }
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.ClaudeAI = ClaudeAI;
  window.ClaudeUI = ClaudeUI;

})();
