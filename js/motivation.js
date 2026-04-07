/**
 * motivation.js — CW-Agent Motivation Module
 * Japanese motivational messages, milestones, GSAP celebrations
 */
(function () {
  'use strict';

  const Motivation = {

    // 30+ Japanese motivational messages specific to 100万円 goal
    messages: [
      '今週13時間で¥250,000！ペース完璧です🔥',
      'あと一息！今月の目標まで¥{remaining}！',
      'AIスキルは今最も稼げるスキル。あなたはその最前線にいる💪',
      '毎日1件の応募が月収100万円への確実な道！',
      '今日も良い案件を見つけよう。CW-Agentが最適案件を厳選中🤖',
      '時給¥2,500以上を維持すれば月収100万円は現実だ！',
      '昨日より今日、今日より明日。着実に積み上げよう📈',
      'Claude APIの案件はあなたの専門知識が最も活かせる場所💡',
      '今月の目標達成率{pct}%！このペースで行けば必ず達成できる！',
      'Midjourney案件で差をつけろ！AI画像生成は今が旬🎨',
      '週13時間の制限を守りながら月100万円。賢く稼ぐのがプロ！',
      '1件完了するごとに目標に近づく。今日の努力が明日の収益に！',
      'ChatGPT自動化案件の需要は爆増中📊 今こそ参入タイミング！',
      'AI開発の案件を取り続ければ、半年後の単価は倍になる！',
      'ストリークを途切れさせるな！連続応募が習慣を作る🔥',
      '今月残り{days}日。まだ十分に巻き返せる！諦めるな💪',
      '高スコア案件だけに集中。時間は有限、効率が全て！',
      '報酬よりも時給で考えろ。時給¥3,000超えた案件だけ狙え！',
      'LLM開発の専門家として、あなたの価値は市場で最高値だ💎',
      '今日の応募が来週の収益になる。種を蒔き続けよう🌱',
      '月収100万円達成者の共通点：毎日の積み重ねを欠かさない',
      'CrowdWorksのAI案件は増加中📈 早い者勝ちで応募しろ！',
      '除外条件を守って効率化。フル出勤案件は時間の無駄！',
      '週目標13時間のうち、最高効率の案件に集中投下せよ⚡',
      'AIで稼ぐ時代が来た。スキルを持つ者は勝者になれる🏆',
      'スコア80点以上の案件だけに応募。質より量より選別が重要！',
      '今月の完了案件が増えるほど来月の受注率も上がる📊',
      'Gemini・Claude・ChatGPT全対応のマルチAIスキルが最強武器💡',
      '目標まであと¥{remaining}。今日の応募が最短ルート！',
      '月100万円はゴールじゃない。通過点だ。次は月200万円！🚀',
      'データ分析×AI自動化の案件は時給¥5,000超えも珍しくない💴',
      '今日のストリークを更新すれば、習慣化まであと一歩！',
      '焦らず、しかし止まらず。着実に前進し続けることが全て🎯'
    ],

    // Milestone definitions
    milestones: [
      { amount: 100000, label: '10万円突破！', message: '最初の大台突破！この調子で続けましょう🎉', icon: '🥉' },
      { amount: 250000, label: '25万円突破！', message: '月収の1/4を達成！ペースは順調です🔥', icon: '🥈' },
      { amount: 500000, label: '50万円突破！', message: '折り返し地点！残り¥500,000。あなたならできる💪', icon: '🥇' },
      { amount: 750000, label: '75万円突破！', message: '四分の三を達成！ゴールまであと25%！ラストスパート🚀', icon: '🏆' },
      { amount: 1000000, label: '月収100万円達成！！！', message: '信じられない！月収100万円を達成しました！あなたは本当にすごい！！🎊', icon: '🎊' }
    ],

    _reachedMilestones: [],

    /**
     * checkMilestone — shows celebration if milestone reached
     * @param {number} earnings
     */
    checkMilestone: function (earnings) {
      const storageKey = 'cw_agent_milestones_' + new Date().getFullYear() + '_' + (new Date().getMonth() + 1);
      let reached;
      try {
        reached = JSON.parse(localStorage.getItem(storageKey) || '[]');
      } catch (e) {
        reached = [];
      }

      for (const ms of this.milestones) {
        if (earnings >= ms.amount && !reached.includes(ms.amount)) {
          reached.push(ms.amount);
          localStorage.setItem(storageKey, JSON.stringify(reached));
          this.showCelebration(ms);
          break; // show one at a time
        }
      }
    },

    /**
     * showCelebration — GSAP animation + confetti
     * @param {Object} milestone
     */
    showCelebration: function (milestone) {
      const overlay = document.getElementById('celebrationOverlay');
      const titleEl = document.getElementById('celebrationTitle');
      const msgEl = document.getElementById('celebrationMsg');
      const iconEl = overlay ? overlay.querySelector('.celebration-icon') : null;
      const container = document.getElementById('confettiContainer');

      if (!overlay) return;

      if (titleEl) titleEl.textContent = milestone.label;
      if (msgEl) msgEl.textContent = milestone.message;
      if (iconEl) iconEl.textContent = milestone.icon;

      overlay.style.display = 'flex';

      // Confetti
      if (container) {
        container.innerHTML = '';
        const colors = ['#00d4aa', '#ffd700', '#ff6b6b', '#58a6ff', '#3fb950', '#f0a500'];
        for (let i = 0; i < 60; i++) {
          const piece = document.createElement('div');
          piece.className = 'confetti-piece';
          piece.style.cssText = [
            'left:' + Math.random() * 100 + '%',
            'top:' + (-Math.random() * 20) + 'px',
            'background:' + colors[Math.floor(Math.random() * colors.length)],
            'width:' + (6 + Math.random() * 10) + 'px',
            'height:' + (6 + Math.random() * 10) + 'px',
            'animation-duration:' + (2 + Math.random() * 3) + 's',
            'animation-delay:' + (Math.random() * 1.5) + 's',
            'border-radius:' + (Math.random() > 0.5 ? '50%' : '2px')
          ].join(';');
          container.appendChild(piece);
        }
      }

      // GSAP animation
      if (window.gsap) {
        const content = document.getElementById('celebrationContent');
        gsap.from(content, {
          scale: 0.3,
          opacity: 0,
          duration: 0.6,
          ease: 'back.out(1.7)'
        });
        gsap.to(content, {
          boxShadow: '0 0 80px rgba(255,215,0,0.5)',
          duration: 1,
          repeat: -1,
          yoyo: true,
          ease: 'power2.inOut'
        });
      }
    },

    /**
     * getDailyMessage — returns message based on day of week + current progress
     * @returns {string}
     */
    getDailyMessage: function () {
      let state = {};
      try {
        state = JSON.parse(localStorage.getItem('cw_agent_data') || '{}');
      } catch (e) {}

      const earnings = state.monthlyEarnings || 0;
      const target = state.targetAmount || 1000000;
      const pct = Math.round((earnings / target) * 100);
      const remaining = (target - earnings).toLocaleString('ja-JP');
      const now = new Date();
      const days = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - now.getDate();

      // Pick message by day of week + progress
      const dow = now.getDay();
      let idx = (dow + Math.floor(pct / 10)) % this.messages.length;
      let msg = this.messages[idx];

      // Fill in placeholders
      msg = msg
        .replace('{remaining}', remaining)
        .replace('{pct}', pct)
        .replace('{days}', days);

      return msg;
    },

    /**
     * updateStreak — updates fire streak display in UI
     * @param {number} days
     */
    updateStreak: function (days) {
      const el = document.getElementById('streakValue');
      if (el) {
        el.textContent = days;
        if (window.gsap) {
          gsap.fromTo(el, { scale: 1.5, color: '#ffd700' }, { scale: 1, duration: 0.5, ease: 'back.out(2)' });
        }
      }
    },

    /**
     * getMotivationLevel — returns 'low'|'medium'|'high'|'peak' based on progress %
     * @returns {string}
     */
    getMotivationLevel: function () {
      let state = {};
      try {
        state = JSON.parse(localStorage.getItem('cw_agent_data') || '{}');
      } catch (e) {}
      const pct = ((state.monthlyEarnings || 0) / (state.targetAmount || 1000000)) * 100;
      if (pct >= 90) return 'peak';
      if (pct >= 60) return 'high';
      if (pct >= 30) return 'medium';
      return 'low';
    },

    /**
     * scheduleMotivationCheck — daily reminder notifications
     */
    scheduleMotivationCheck: function () {
      // Run once immediately
      this._updateBanner();

      // Update banner every 5 minutes
      setInterval(() => {
        this._updateBanner();
      }, 300000);

      // Web notification daily reminder (if permitted)
      if ('Notification' in window && Notification.permission === 'granted') {
        setInterval(() => {
          const msg = this.getDailyMessage();
          try {
            new Notification('CW-Agent 🔥', {
              body: msg,
              icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><text y="28" font-size="28">⚡</text></svg>'
            });
          } catch (e) {}
        }, 3600000); // hourly
      }
    },

    _updateBanner: function () {
      const el = document.getElementById('motivationText');
      if (el) {
        const msg = this.getDailyMessage();
        if (window.gsap) {
          gsap.to(el, {
            opacity: 0,
            duration: 0.3,
            onComplete: () => {
              el.textContent = msg;
              gsap.to(el, { opacity: 1, duration: 0.5 });
            }
          });
        } else {
          el.textContent = msg;
        }
      }
    },

    /**
     * init — initialize motivation module
     */
    init: function () {
      this._updateBanner();
      this.scheduleMotivationCheck();
    }
  };

  window.Motivation = Motivation;
})();
