/**
 * main.js — CW-Agent Main Dashboard Controller
 * AppState, localStorage persistence, Chart.js initialization,
 * KPI updates, project management, theme toggle
 */
(function () {
  'use strict';

  const STORAGE_KEY = 'cw_agent_data';
  const THEME_KEY = 'cw_agent_theme';

  // =========================================================
  // APP STATE
  // =========================================================
  const AppState = {
    monthlyEarnings: 0,
    targetAmount: 1000000,
    weeklyHours: 0,
    streak: 0,
    theme: 'dark',
    earningsHistory: [320000, 450000, 510000, 680000, 750000],
    activeFilter: 'all',
    projects: []
  };

  // =========================================================
  // DEMO DATA
  // =========================================================
  const DEMO_PROJECTS = [
    {
      id: 'p001',
      title: 'Claude APIを使った社内文書自動化',
      category: 'AI開発',
      budget: 180000,
      hours: 28,
      status: 'completed',
      ai_score: 92
    },
    {
      id: 'p002',
      title: 'ChatGPT業務自動化ボット開発',
      category: '自動化',
      budget: 65000,
      hours: 14,
      status: 'completed',
      ai_score: 85
    },
    {
      id: 'p003',
      title: 'Midjourney商品画像バッチ生成',
      category: '画像生成',
      budget: 95000,
      hours: 18,
      status: 'inprogress',
      ai_score: 78
    },
    {
      id: 'p004',
      title: 'LangChain + RAGナレッジベース構築',
      category: 'AI開発',
      budget: 220000,
      hours: 35,
      status: 'applying',
      ai_score: 96
    },
    {
      id: 'p005',
      title: 'Gemini ProでのSEO記事自動生成',
      category: '自動化',
      budget: 45000,
      hours: 10,
      status: 'completed',
      ai_score: 72
    },
    {
      id: 'p006',
      title: 'Stable Diffusion LoRA学習スクリプト',
      category: '画像生成',
      budget: 75000,
      hours: 16,
      status: 'watching',
      ai_score: 68
    },
    {
      id: 'p007',
      title: 'Whisper APIで会議議事録自動生成',
      category: '自動化',
      budget: 140000,
      hours: 22,
      status: 'inprogress',
      ai_score: 88
    },
    {
      id: 'p008',
      title: 'GPT-4o活用の需要予測AIツール',
      category: 'データ分析',
      budget: 130000,
      hours: 20,
      status: 'applying',
      ai_score: 82
    }
  ];

  // =========================================================
  // STORAGE
  // =========================================================
  function loadFromStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return false;
      const saved = JSON.parse(raw);
      Object.assign(AppState, saved);
      return true;
    } catch (e) {
      console.warn('loadFromStorage error:', e);
      return false;
    }
  }

  function saveToStorage() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(AppState));
    } catch (e) {
      console.warn('saveToStorage error:', e);
    }
  }

  // =========================================================
  // PROJECT MANAGEMENT
  // =========================================================
  function addProject(project) {
    const newProject = {
      id: 'p' + Date.now(),
      title: project.title || '無題の案件',
      category: project.category || 'その他',
      budget: parseFloat(project.budget) || 0,
      hours: parseFloat(project.hours) || 1,
      status: project.status || 'watching',
      ai_score: project.ai_score || _autoScore(project)
    };
    AppState.projects.push(newProject);
    _recalcEarnings();
    saveToStorage();
    renderProjectsTable();
    updateKPIs();
    updateProgressBar();
    return newProject;
  }

  function updateProject(id, updates) {
    const idx = AppState.projects.findIndex(p => p.id === id);
    if (idx === -1) return;
    AppState.projects[idx] = Object.assign({}, AppState.projects[idx], updates);
    _recalcEarnings();
    saveToStorage();
    renderProjectsTable();
    updateKPIs();
    updateProgressBar();
  }

  function deleteProject(id) {
    if (!confirm('この案件を削除しますか？')) return;
    AppState.projects = AppState.projects.filter(p => p.id !== id);
    _recalcEarnings();
    saveToStorage();
    renderProjectsTable();
    updateKPIs();
    updateProgressBar();
  }

  function _recalcEarnings() {
    const completed = AppState.projects.filter(p => p.status === 'completed');
    AppState.monthlyEarnings = completed.reduce((s, p) => s + (parseFloat(p.budget) || 0), 0);
    AppState.weeklyHours = AppState.projects
      .filter(p => p.status === 'inprogress' || p.status === 'completed')
      .reduce((s, p) => s + (parseFloat(p.hours) || 0), 0);
  }

  function _autoScore(project) {
    if (!window.CWAgent) return 50;
    const eval_ = CWAgent.evaluateJob({
      title: project.title,
      description: '',
      budget_min: project.budget,
      budget_max: project.budget,
      estimated_hours: project.hours
    });
    return eval_.score;
  }

  // =========================================================
  // KPI UPDATE
  // =========================================================
  function updateKPIs() {
    const earnings = AppState.monthlyEarnings;
    const target = AppState.targetAmount;
    const rate = Math.round((earnings / target) * 100);

    // Total hours worked (completed + in-progress)
    const totalHours = AppState.projects
      .filter(p => p.status === 'completed' || p.status === 'inprogress')
      .reduce((s, p) => s + (parseFloat(p.hours) || 0), 0);

    const hourlyRate = totalHours > 0 ? Math.round(earnings / totalHours) : 0;

    // Earnings KPI
    _setText('kpiEarningsVal', '¥' + earnings.toLocaleString('ja-JP'));
    _setText('kpiEarningsSub', '完了案件 ' + AppState.projects.filter(p => p.status === 'completed').length + '件');

    // Rate KPI
    _setText('kpiRateVal', rate + '%');
    _setText('kpiRateSub', '残り ¥' + (target - earnings).toLocaleString('ja-JP'));
    const rateTrend = document.getElementById('kpiRateTrend');
    if (rateTrend) {
      rateTrend.textContent = rate >= 75 ? '↑' : rate >= 40 ? '→' : '↓';
      rateTrend.className = 'kpi-trend ' + (rate >= 75 ? 'up' : rate >= 40 ? 'neutral' : 'down');
    }

    // Hourly KPI
    _setText('kpiHourlyVal', '¥' + hourlyRate.toLocaleString('ja-JP') + '/h');
    const hTrend = document.getElementById('kpiHourlyTrend');
    if (hTrend) {
      hTrend.textContent = hourlyRate >= 3000 ? '↑' : '↓';
      hTrend.className = 'kpi-trend ' + (hourlyRate >= 3000 ? 'up' : 'down');
    }
    _setText('kpiHourlySub', hourlyRate >= 3000 ? '目標達成中 ✓' : '目標 ¥3,000/h');

    // Hours KPI
    _setText('kpiHoursVal', Math.round(totalHours * 10) / 10 + 'h');
    const weekH = AppState.weeklyHours || 0;
    _setText('kpiHoursSub', '今週 ' + Math.round(weekH * 10) / 10 + 'h / 18h');
    const hTrend2 = document.getElementById('kpiHoursTrend');
    if (hTrend2) {
      hTrend2.textContent = weekH > 13 ? '⚠' : weekH >= 10 ? '↑' : '→';
      hTrend2.className = 'kpi-trend ' + (weekH > 13 ? 'down' : weekH >= 10 ? 'up' : 'neutral');
    }

    // Weekly bar
    updateWeeklyBar();

    // Streak
    const streakData = Analytics.getStreakData();
    AppState.streak = streakData.days || 0;
    _setText('streakValue', AppState.streak);

    // Check milestone
    if (window.Motivation) {
      Motivation.checkMilestone(earnings);
    }
  }

  // =========================================================
  // PROGRESS BAR
  // =========================================================
  function updateProgressBar() {
    const earnings = AppState.monthlyEarnings;
    const target = AppState.targetAmount;
    const pct = Math.min(100, Math.round((earnings / target) * 100));

    const bar = document.getElementById('mainProgressBar');
    if (bar) {
      bar.style.width = pct + '%';
    }

    _setText('targetCurrentDisplay', '¥' + earnings.toLocaleString('ja-JP'));
    _setText('targetPctDisplay', pct + '%');
    _setText('targetRemaining', '残り ¥' + (target - earnings).toLocaleString('ja-JP'));

    const now = new Date();
    const daysLeft = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - now.getDate();
    _setText('daysLeftNum', daysLeft);
  }

  // =========================================================
  // WEEKLY BAR
  // =========================================================
  function updateWeeklyBar() {
    const weekH = AppState.weeklyHours || 0;
    const limit = 18;
    const pct = Math.min(100, (weekH / limit) * 100);

    const fill = document.getElementById('weeklyBarFill');
    if (fill) {
      fill.style.width = pct + '%';
      fill.className = 'weekly-bar-fill' + (weekH > limit ? ' warning' : '');
    }

    _setText('weeklyStatus', Math.round(weekH * 10) / 10 + 'h / ' + limit + 'h');
    _setText('weeklyRemaining', '残り ' + Math.max(0, Math.round((limit - weekH) * 10) / 10) + '時間');

    const hourlyRate = weekH > 0 ? Math.round(AppState.monthlyEarnings / weekH) : 0;
    const projectedWeekly = Math.round(hourlyRate * limit);
    _setText('weeklyProjected', '週収益予測: ¥' + projectedWeekly.toLocaleString('ja-JP'));
  }

  // =========================================================
  // FILTER
  // =========================================================
  const _filters = { ai: false, hourly: false, exclude: false, all: true };

  window.toggleFilter = function (type) {
    if (type === 'all') {
      _filters.ai = false;
      _filters.hourly = false;
      _filters.exclude = false;
      _filters.all = true;
    } else {
      _filters.all = false;
      _filters[type] = !_filters[type];
      if (!_filters.ai && !_filters.hourly && !_filters.exclude) {
        _filters.all = true;
      }
    }
    AppState.activeFilter = type;

    // Update chip active states
    ['ai', 'hourly', 'exclude', 'all'].forEach(k => {
      const chip = document.getElementById('filter' + k.charAt(0).toUpperCase() + k.slice(1));
      if (chip) chip.className = 'chip' + (_filters[k] ? ' active' : '');
    });
    const allChip = document.getElementById('filterAll');
    if (allChip) allChip.className = 'chip' + (_filters.all ? ' active' : '');

    renderProjectsTable();
  };

  function applyFilters(projects) {
    let filtered = [...projects];

    if (_filters.exclude) {
      const EXCL = ['フル出勤', '雇用契約', '常駐', '週5'];
      filtered = filtered.filter(p => !EXCL.some(kw => (p.title || '').includes(kw)));
      filtered = filtered.filter(p => p.status !== 'excluded');
    }

    if (_filters.ai) {
      const AI_KW = ['Claude', 'GPT', 'ChatGPT', 'Midjourney', 'Gemini', 'AI', '自動化', 'LLM', '機械学習'];
      filtered = filtered.filter(p => AI_KW.some(kw => (p.title || '').toLowerCase().includes(kw.toLowerCase())));
    }

    if (_filters.hourly) {
      filtered = filtered.filter(p => {
        const hr = (parseFloat(p.hours) || 1);
        return Math.round((parseFloat(p.budget) || 0) / hr) >= 3000;
      });
    }

    return filtered;
  }

  // =========================================================
  // PROJECTS TABLE
  // =========================================================
  function renderProjectsTable() {
    const tbody = document.getElementById('projectsTbody');
    if (!tbody) return;

    const filtered = applyFilters(AppState.projects);

    if (filtered.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" class="empty-row">案件が見つかりません</td></tr>';
      return;
    }

    const STATUS_LABELS = {
      applying: '応募中',
      inprogress: '進行中',
      completed: '完了',
      watching: 'ウォッチ中',
      excluded: '除外'
    };

    tbody.innerHTML = filtered.map(p => {
      const hours = parseFloat(p.hours) || 1;
      const budget = parseFloat(p.budget) || 0;
      const hourly = Math.round(budget / hours);
      const score = p.ai_score || 0;
      const scoreClass = score >= 70 ? 'score-high' : score >= 45 ? 'score-med' : 'score-low';

      return '<tr>' +
        '<td class="font-bold">' + _escHtml(p.title) + '</td>' +
        '<td>' + _escHtml(p.category) + '</td>' +
        '<td>¥' + budget.toLocaleString('ja-JP') + '</td>' +
        '<td>' + (hourly >= 3000 ? '<span class="text-accent">¥' + hourly.toLocaleString() + '</span>' : '<span class="text-danger">¥' + hourly.toLocaleString() + '</span>') + '/h</td>' +
        '<td>' + hours + 'h</td>' +
        '<td><span class="status-badge status-' + (p.status || 'watching') + '">' + (STATUS_LABELS[p.status] || p.status) + '</span></td>' +
        '<td><div class="ai-score-wrap ' + scoreClass + '"><div class="ai-score-bar"><div class="ai-score-fill" style="width:' + score + '%"></div></div><span class="ai-score-text">' + score + '</span></div></td>' +
        '<td><div class="table-actions">' +
          '<button class="btn-icon" onclick="openEditStatus(\'' + p.id + '\')" title="ステータス変更">✏️</button>' +
          '<button class="btn-icon del" onclick="deleteProject(\'' + p.id + '\')" title="削除">🗑️</button>' +
        '</div></td>' +
      '</tr>';
    }).join('');
  }

  // =========================================================
  // CHARTS
  // =========================================================
  let _earningsChart = null;
  let _statusChart = null;

  function initCharts() {
    const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
    const gridColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
    const textColor = isDark ? '#8b949e' : '#57606a';

    Chart.defaults.color = textColor;
    Chart.defaults.borderColor = gridColor;

    // --- Line chart: monthly earnings ---
    const earningsCtx = document.getElementById('earningsChart');
    if (earningsCtx) {
      if (_earningsChart) _earningsChart.destroy();
      const labels = Analytics.chartData.getMonthLabels();
      const data = Analytics.chartData.getEarningsHistory();

      _earningsChart = new Chart(earningsCtx, {
        type: 'line',
        data: {
          labels,
          datasets: [{
            label: '月次収益',
            data,
            borderColor: '#00d4aa',
            backgroundColor: 'rgba(0,212,170,0.1)',
            borderWidth: 2.5,
            pointBackgroundColor: '#00d4aa',
            pointRadius: 5,
            pointHoverRadius: 7,
            fill: true,
            tension: 0.4
          }, {
            label: '目標ライン',
            data: labels.map(() => 1000000),
            borderColor: '#ffd700',
            borderWidth: 1.5,
            borderDash: [6, 4],
            pointRadius: 0,
            fill: false,
            tension: 0
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'top',
              labels: { font: { size: 11 }, padding: 12 }
            },
            tooltip: {
              callbacks: {
                label: ctx => ' ¥' + (ctx.parsed.y || 0).toLocaleString('ja-JP')
              }
            }
          },
          scales: {
            y: {
              beginAtZero: true,
              ticks: {
                callback: v => '¥' + (v / 10000).toFixed(0) + '万',
                font: { size: 10 }
              },
              grid: { color: gridColor }
            },
            x: {
              ticks: { font: { size: 10 } },
              grid: { color: gridColor }
            }
          }
        }
      });
    }

    // --- Pie chart: status distribution ---
    const statusCtx = document.getElementById('statusChart');
    if (statusCtx) {
      if (_statusChart) _statusChart.destroy();
      const counts = Analytics.chartData.getStatusCounts();
      const labels = ['応募中', '進行中', '完了', 'ウォッチ', '除外'];
      const values = [counts.applying, counts.inprogress, counts.completed, counts.watching, counts.excluded];
      const colors = ['#58a6ff', '#00d4aa', '#3fb950', '#f0a500', '#ff6b6b'];

      _statusChart = new Chart(statusCtx, {
        type: 'doughnut',
        data: {
          labels,
          datasets: [{
            data: values,
            backgroundColor: colors.map(c => c + '99'),
            borderColor: colors,
            borderWidth: 2,
            hoverOffset: 6
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'bottom',
              labels: { font: { size: 11 }, padding: 10 }
            },
            tooltip: {
              callbacks: {
                label: ctx => ' ' + ctx.label + ': ' + ctx.parsed + '件'
              }
            }
          }
        }
      });
    }
  }

  // =========================================================
  // THEME
  // =========================================================
  window.toggleTheme = function () {
    const isLight = document.documentElement.getAttribute('data-theme') === 'light';
    const newTheme = isLight ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', newTheme);
    AppState.theme = newTheme;
    localStorage.setItem(THEME_KEY, newTheme);
    _setText('themeIcon', newTheme === 'dark' ? '🌙' : '☀️');
    _setText('themeLabel', newTheme === 'dark' ? 'ライト' : 'ダーク');
    // Recreate charts with new colors
    setTimeout(initCharts, 100);
  };

  // =========================================================
  // EXPORT
  // =========================================================
  window.exportReport = function () {
    const report = Analytics.generateMonthlyReport();
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'cw-agent-report-' + new Date().toISOString().slice(0, 7) + '.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  // =========================================================
  // ADD PROJECT MODAL
  // =========================================================
  window.openAddProjectModal = function () {
    document.getElementById('addProjectModal').style.display = 'flex';
    document.getElementById('newTitle').focus();
  };

  window.closeAddProjectModal = function () {
    document.getElementById('addProjectModal').style.display = 'none';
    ['newTitle', 'newBudget', 'newHours'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
  };

  window.submitAddProject = function () {
    const title = (document.getElementById('newTitle') || {}).value || '';
    const category = (document.getElementById('newCategory') || {}).value || 'その他';
    const budget = parseFloat((document.getElementById('newBudget') || {}).value) || 0;
    const hours = parseFloat((document.getElementById('newHours') || {}).value) || 1;
    const status = (document.getElementById('newStatus') || {}).value || 'watching';

    if (!title.trim()) {
      alert('案件名を入力してください');
      return;
    }

    addProject({ title: title.trim(), category, budget, hours, status });
    closeAddProjectModal();
  };

  // Edit status (simple prompt)
  window.openEditStatus = function (id) {
    const project = AppState.projects.find(p => p.id === id);
    if (!project) return;
    const statuses = ['applying', 'inprogress', 'completed', 'watching', 'excluded'];
    const labels = ['応募中', '進行中', '完了', 'ウォッチ中', '除外'];
    const current = statuses.indexOf(project.status);
    const choice = prompt(
      '「' + project.title + '」のステータスを選択:\n' +
      statuses.map((s, i) => (i + 1) + '. ' + labels[i] + (i === current ? ' ← 現在' : '')).join('\n') +
      '\n\n番号を入力してください (1-' + statuses.length + ')'
    );
    if (choice === null) return;
    const idx = parseInt(choice) - 1;
    if (idx >= 0 && idx < statuses.length) {
      updateProject(id, { status: statuses[idx] });
    }
  };

  // Expose deleteProject globally
  window.deleteProject = deleteProject;

  // =========================================================
  // CELEBRATION CLOSE
  // =========================================================
  window.closeCelebration = function () {
    const overlay = document.getElementById('celebrationOverlay');
    if (overlay) {
      if (window.gsap) {
        gsap.to(overlay, { opacity: 0, duration: 0.3, onComplete: () => { overlay.style.display = 'none'; overlay.style.opacity = ''; } });
      } else {
        overlay.style.display = 'none';
      }
    }
  };

  // =========================================================
  // HEADER DATE
  // =========================================================
  function updateHeaderDate() {
    const el = document.getElementById('headerDate');
    if (!el) return;
    const now = new Date();
    el.textContent = now.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' });
  }

  // =========================================================
  // INIT DASHBOARD
  // =========================================================
  function initDashboard() {
    // Load theme from storage
    const savedTheme = localStorage.getItem(THEME_KEY) || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    AppState.theme = savedTheme;
    _setText('themeIcon', savedTheme === 'dark' ? '🌙' : '☀️');
    _setText('themeLabel', savedTheme === 'dark' ? 'ライト' : 'ダーク');

    // Load data
    const hasData = loadFromStorage();
    if (!hasData || AppState.projects.length === 0) {
      // Initialize with demo data
      AppState.projects = DEMO_PROJECTS;
      _recalcEarnings();
      saveToStorage();
    } else {
      _recalcEarnings();
    }

    updateHeaderDate();
    updateProgressBar();
    updateKPIs();
    renderProjectsTable();
    initCharts();

    // Init modules
    if (window.Motivation) Motivation.init();
    if (window.CWAgent) CWAgent.scheduleAutoFetch();

    // Refresh every 30 seconds
    setInterval(() => {
      updateKPIs();
      updateProgressBar();
      updateHeaderDate();
    }, 30000);
  }

  // =========================================================
  // HELPERS
  // =========================================================
  function _setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  }

  function _escHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // =========================================================
  // START
  // =========================================================
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDashboard);
  } else {
    initDashboard();
  }

  // Expose for external use
  window.AppState = AppState;
  window.addProject = addProject;
  window.updateProject = updateProject;
  window.toggleFilter = window.toggleFilter;

})();
