/**
 * auto-submit.js — CrowdWorks 実応募自動送信
 * server.js 経由で /api/cw/apply を呼び出し、実際に応募を送信する
 */
(function () {
  'use strict';

  const SERVER_URL = 'http://localhost:3456';

  const AutoSubmitter = {

    /**
     * submitApplication — 実際にCrowdWorksへ応募送信
     * @param {string} jobId
     * @param {string} proposalText 提案文
     * @param {number} [desiredCost] 希望報酬
     * @param {string} cwSession CrowdWorksセッションCookie
     * @returns {Promise<Object>} { success, message }
     */
    submitApplication: async function (jobId, proposalText, desiredCost, cwSession) {
      if (!cwSession) {
        throw new Error('CrowdWorksセッションCookieが設定されていません。設定画面で入力してください。');
      }

      const resp = await fetch(`${SERVER_URL}/api/cw/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId, proposalText, desiredCost, session: cwSession })
      });

      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || `応募送信失敗: HTTP ${resp.status}`);
      return data; // { success, message, redirectTo? }
    },

    /**
     * generateProposalAndApply — 提案文生成→確認ダイアログ→応募送信
     * @param {Object} job
     * @param {Object} evaluation Claude評価結果
     * @param {Object} profile フリーランサープロフィール
     * @param {string} apiKey
     * @param {string} cwSession
     * @param {Function} confirmFn (job, proposal) => Promise<boolean>  確認ダイアログ
     * @param {Function} onStatus (msg) => void  ステータスコールバック
     * @returns {Promise<{applied: boolean, proposal: string}>}
     */
    generateProposalAndApply: async function (job, evaluation, profile, apiKey, cwSession, confirmFn, onStatus) {
      // Step 1: 提案文生成
      if (typeof onStatus === 'function') onStatus('提案文をAIが生成中...');

      let proposalText;
      try {
        proposalText = await window.ClaudeEvaluator.generateProposal(
          job, profile, 'technical', apiKey
        );
      } catch (e) {
        throw new Error('提案文生成失敗: ' + e.message);
      }

      // Step 2: 確認ダイアログ
      let confirmed = true;
      if (typeof confirmFn === 'function') {
        confirmed = await confirmFn(job, proposalText, evaluation);
      }

      if (!confirmed) {
        return { applied: false, proposal: proposalText };
      }

      // Step 3: 応募送信
      if (typeof onStatus === 'function') onStatus('CrowdWorksに応募を送信中...');

      const desiredCost = job.budget_max || null;
      const result = await this.submitApplication(job.id, proposalText, desiredCost, cwSession);

      return { applied: result.success, proposal: proposalText, result };
    }
  };

  window.AutoSubmitter = AutoSubmitter;
})();
