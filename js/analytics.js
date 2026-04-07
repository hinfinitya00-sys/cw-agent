/**
 * analytics.js — CW-Agent Analytics Module
 * Handles ROI calculations, reports, predictions, streak tracking
 */
(function () {
  'use strict';

  const STORAGE_KEY = 'cw_agent_data';
  const STREAK_KEY = 'cw_agent_streak';
  const MIN_HOURLY = 2500;

  // ---------- Chart data (last 6 months) ----------
  const chartData = {
    getMonthLabels: function () {
      const labels = [];
      const now = new Date();
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        labels.push(d.getFullYear() + '/' + String(d.getMonth() + 1).padStart(2, '0'));
      }
      return labels;
    },

    getEarningsHistory: function () {
      const state = Analytics._getState();
      // Pad/fill 6-month array
      const history = (state.earningsHistory || []).slice(-6);
      while (history.length < 5) history.unshift(0);
      history.push(state.monthlyEarnings || 0);
      return history.slice(-6);
    },

    getStatusCounts: function () {
      const state = Analytics._getState();
      const projects = state.projects || [];
      const counts = { applying: 0, inprogress: 0, completed: 0, watching: 0, excluded: 0 };
      projects.forEach(p => {
        const key = p.status || 'watching';
        if (counts[key] !== undefined) counts[key]++;
      });
      return counts;
    }
  };

  // ---------- Core Analytics ----------
  const Analytics = {

    _getState: function () {
      try {
        return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      } catch (e) {
        return {};
      }
    },

    /**
     * calculateROI: revenue / hours vs baseline
     * @param {Object} project
     * @returns {Object} { hourlyRate, roiVsBaseline, grade }
     */
    calculateROI: function (project) {
      const hours = parseFloat(project.hours) || 1;
      const budget = parseFloat(project.budget) || 0;
      const hourlyRate = Math.round(budget / hours);
      const roiVsBaseline = ((hourlyRate - MIN_HOURLY) / MIN_HOURLY * 100).toFixed(1);
      let grade;
      if (hourlyRate >= 5000) grade = 'S';
      else if (hourlyRate >= 3500) grade = 'A';
      else if (hourlyRate >= 2500) grade = 'B';
      else if (hourlyRate >= 1500) grade = 'C';
      else grade = 'D';
      return { hourlyRate, roiVsBaseline: parseFloat(roiVsBaseline), grade };
    },

    /**
     * generateWeeklyReport
     * @returns {Object} weekly summary
     */
    generateWeeklyReport: function () {
      const state = this._getState();
      const projects = (state.projects || []).filter(p => p.status === 'completed');
      const totalEarnings = projects.reduce((s, p) => s + (parseFloat(p.budget) || 0), 0);
      const hoursWorked = projects.reduce((s, p) => s + (parseFloat(p.hours) || 0), 0);
      const projectsCompleted = projects.length;
      const avgHourlyRate = hoursWorked > 0 ? Math.round(totalEarnings / hoursWorked) : 0;
      const topProject = projects.sort((a, b) => (parseFloat(b.budget) || 0) - (parseFloat(a.budget) || 0))[0] || null;

      return {
        totalEarnings,
        hoursWorked: Math.round(hoursWorked * 10) / 10,
        projectsCompleted,
        avgHourlyRate,
        topProject: topProject ? topProject.title : '—',
        generatedAt: new Date().toISOString()
      };
    },

    /**
     * generateMonthlyReport — extended version with trend data
     * @returns {Object}
     */
    generateMonthlyReport: function () {
      const state = this._getState();
      const weekly = this.generateWeeklyReport();
      const earningsHistory = chartData.getEarningsHistory();
      const monthlyEarnings = state.monthlyEarnings || 0;
      const targetAmount = state.targetAmount || 1000000;
      const achievementRate = Math.round((monthlyEarnings / targetAmount) * 100);
      const prediction = this.predictMonthlyEarnings({ monthlyEarnings });
      const topCategories = this.getTopPerformingCategories();
      const streak = this.getStreakData();

      return {
        month: new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: 'long' }),
        monthlyEarnings,
        targetAmount,
        achievementRate,
        prediction,
        topCategories,
        streak,
        earningsTrend: earningsHistory,
        ...weekly,
        generatedAt: new Date().toISOString()
      };
    },

    /**
     * predictMonthlyEarnings — linear projection based on current week
     * @param {Object} currentData
     * @returns {number} projected monthly earnings
     */
    predictMonthlyEarnings: function (currentData) {
      const now = new Date();
      const dayOfMonth = now.getDate();
      const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      if (dayOfMonth === 0) return currentData.monthlyEarnings || 0;
      const dailyRate = (currentData.monthlyEarnings || 0) / dayOfMonth;
      return Math.round(dailyRate * daysInMonth);
    },

    /**
     * getStreakData — returns streak object from localStorage
     * @returns {Object} { days, lastDate, isToday }
     */
    getStreakData: function () {
      try {
        const raw = localStorage.getItem(STREAK_KEY);
        if (!raw) return { days: 0, lastDate: null, isToday: false };
        const data = JSON.parse(raw);
        const today = new Date().toDateString();
        const lastDate = data.lastDate ? new Date(data.lastDate).toDateString() : null;
        const yesterday = new Date(Date.now() - 86400000).toDateString();
        const isToday = lastDate === today;
        const isConsecutive = lastDate === yesterday || isToday;
        if (!isConsecutive) {
          return { days: 0, lastDate: data.lastDate, isToday: false, broken: true };
        }
        return { days: data.days || 0, lastDate: data.lastDate, isToday };
      } catch (e) {
        return { days: 0, lastDate: null, isToday: false };
      }
    },

    /**
     * updateStreak — increments streak if applied today
     * @returns {number} new streak count
     */
    updateStreak: function () {
      const today = new Date().toISOString();
      const todayStr = new Date().toDateString();
      let data;
      try {
        data = JSON.parse(localStorage.getItem(STREAK_KEY) || '{"days":0,"lastDate":null}');
      } catch (e) {
        data = { days: 0, lastDate: null };
      }

      const lastStr = data.lastDate ? new Date(data.lastDate).toDateString() : null;
      const yesterdayStr = new Date(Date.now() - 86400000).toDateString();

      if (lastStr === todayStr) {
        // Already counted today
        alert('本日の応募は既に記録済みです！ストリーク: ' + data.days + '日 🔥');
        return data.days;
      }

      if (lastStr === yesterdayStr || lastStr === null) {
        data.days = (data.days || 0) + 1;
      } else {
        // Streak broken
        data.days = 1;
      }
      data.lastDate = today;
      localStorage.setItem(STREAK_KEY, JSON.stringify(data));

      // Update display
      const el = document.getElementById('streakValue');
      if (el) el.textContent = data.days;

      if (window.Motivation) {
        Motivation.updateStreak(data.days);
      }

      alert('ストリーク更新！ ' + data.days + '日連続応募中 🔥');
      return data.days;
    },

    /**
     * getTopPerformingCategories — sorted by total earnings
     * @returns {Array} [{ category, earnings, count, avgHourly }]
     */
    getTopPerformingCategories: function () {
      const state = this._getState();
      const projects = (state.projects || []).filter(p => p.status === 'completed');
      const map = {};
      projects.forEach(p => {
        const cat = p.category || 'その他';
        if (!map[cat]) map[cat] = { category: cat, earnings: 0, count: 0, totalHours: 0 };
        map[cat].earnings += parseFloat(p.budget) || 0;
        map[cat].count++;
        map[cat].totalHours += parseFloat(p.hours) || 0;
      });
      return Object.values(map).map(c => ({
        ...c,
        avgHourly: c.totalHours > 0 ? Math.round(c.earnings / c.totalHours) : 0
      })).sort((a, b) => b.earnings - a.earnings);
    },

    chartData
  };

  window.Analytics = Analytics;
})();
