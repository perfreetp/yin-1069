(function () {
  const state = {
    reminders: [],
    forecast: [],
    stageSummary: null,
    settings: null
  };

  const elements = {};

  function init() {
    cacheElements();
    bindEvents();
    loadData();
    updateDateDisplay();
  }

  function cacheElements() {
    elements.stageDot = document.getElementById('stageDot');
    elements.stageLabel = document.getElementById('stageLabel');
    elements.stageText = document.getElementById('stageText');
    elements.remindersList = document.getElementById('remindersList');
    elements.forecastList = document.getElementById('forecastList');
    elements.confirmBtn = document.getElementById('confirmBtn');
    elements.laterBtn = document.getElementById('laterBtn');
    elements.skipBtn = document.getElementById('skipBtn');
    elements.suggestionText = document.getElementById('suggestionText');
    elements.settingsBtn = document.getElementById('settingsBtn');
    elements.summaryBtn = document.getElementById('summaryBtn');
    elements.openWindowBtn = document.getElementById('openWindowBtn');
    elements.summaryModal = document.getElementById('summaryModal');
    elements.closeSummaryBtn = document.getElementById('closeSummaryBtn');
    elements.summaryContent = document.getElementById('summaryContent');
    elements.dateDisplay = document.getElementById('dateDisplay');
  }

  function bindEvents() {
    elements.confirmBtn.addEventListener('click', () => handleAction('confirmed'));
    elements.laterBtn.addEventListener('click', () => handleAction('later'));
    elements.skipBtn.addEventListener('click', () => handleAction('skipped'));
    elements.settingsBtn.addEventListener('click', openSettings);
    elements.summaryBtn.addEventListener('click', showSummary);
    elements.openWindowBtn.addEventListener('click', openStandaloneWindow);
    elements.closeSummaryBtn.addEventListener('click', hideSummary);
    
    elements.summaryModal.addEventListener('click', (e) => {
      if (e.target === elements.summaryModal) {
        hideSummary();
      }
    });
  }

  async function loadData() {
    try {
      const [reminders, forecast, settings] = await Promise.all([
        ReminderEngine.getTodayReminders(),
        ReminderEngine.getThreeDayForecast(),
        AppStorage.getSettings()
      ]);

      state.reminders = reminders;
      state.forecast = forecast;
      state.settings = settings;
      state.stageSummary = ReminderEngine.getStageSummary(reminders);

      renderStage();
      renderReminders();
      renderForecast();
    } catch (error) {
      console.error('加载数据失败:', error);
    }
  }

  function renderStage() {
    const summary = state.stageSummary;
    if (!summary) return;

    elements.stageDot.style.backgroundColor = summary.color;
    elements.stageLabel.textContent = getStageLabel(summary.mainStage);
    elements.stageLabel.style.color = summary.color;
    elements.stageText.textContent = summary.text;
  }

  function getStageLabel(stage) {
    const labels = {
      today: '今天有重要日子',
      soon: '即将到来',
      planning: '计划中',
      calm: '状态平稳',
      all_clear: '一切安好'
    };
    return labels[stage] || '正常';
  }

  function renderReminders() {
    const reminders = state.reminders.slice(0, 5);
    
    if (reminders.length === 0) {
      elements.remindersList.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">🎉</div>
          <div class="empty-state-text">近期没有特别的日子</div>
        </div>
      `;
      return;
    }

    elements.remindersList.innerHTML = reminders.map(r => {
      const priorityClass = r.priority >= 7 ? 'high-priority' : r.priority >= 4 ? 'medium-priority' : 'low-priority';
      const daysClass = r.daysUntil <= 2 ? 'urgent' : r.daysUntil <= 7 ? 'soon' : '';
      const conflictHtml = r.hasConflict ? `<span class="conflict-tag">${ReminderEngine.getConflictLabel(r.conflictResolution)}</span>` : '';
      
      return `
        <div class="reminder-item ${priorityClass} ${r.hasConflict ? 'has-conflict' : ''}">
          <div class="reminder-info">
            <h3>${r.name} ${conflictHtml}</h3>
            <p>${r.stage.label}</p>
          </div>
          <div class="reminder-days ${daysClass}">
            ${r.daysUntil === 0 ? '今天' : r.daysUntil + '天'}
          </div>
        </div>
      `;
    }).join('');
  }

  function renderForecast() {
    elements.forecastList.innerHTML = state.forecast.map(day => {
      let remindersHtml = '';
      
      if (day.hasConflict && day.reminders.length > 1) {
        const names = day.reminders.map(r => r.name).join(' + ');
        const resolution = day.reminders[0].conflictResolution || 'merge';
        remindersHtml = `
          <div class="forecast-reminder conflict">⚡ ${names}</div>
          <div class="forecast-conflict-hint">${ReminderEngine.getConflictLabel(resolution)}</div>
        `;
      } else if (day.reminders.length > 0) {
        remindersHtml = day.reminders.map(r => {
          const label = r.daysUntil === 0 ? '今天' : r.daysUntil + '天';
          return `<div class="forecast-reminder">• ${r.name} · ${label}</div>`;
        }).join('');
      } else {
        remindersHtml = '<div class="forecast-empty">没有安排</div>';
      }

      return `
        <div class="forecast-item ${day.hasConflict ? 'has-conflict' : ''}">
          <div class="forecast-header">
            <span class="forecast-day-label">${day.dayLabel}</span>
            <span class="forecast-date">${day.weekday} ${day.date.slice(5)}</span>
          </div>
          <div class="forecast-content">
            ${remindersHtml}
          </div>
        </div>
      `;
    }).join('');
  }

  async function handleAction(action) {
    const nearestReminder = state.reminders[0];
    const reminderId = nearestReminder ? nearestReminder.id : 'general';
    const reminderName = nearestReminder ? nearestReminder.name : '日常提醒';

    const record = {
      action,
      reminderId,
      reminderName,
      timestamp: Date.now()
    };

    await AppStorage.addRecord(record);

    const suggestion = ReminderEngine.getRandomSuggestion(action);
    elements.suggestionText.textContent = suggestion;

    flashButton(action);

    setTimeout(() => {
      elements.suggestionText.textContent = '';
    }, 5000);
  }

  function flashButton(action) {
    const btnMap = {
      confirmed: elements.confirmBtn,
      later: elements.laterBtn,
      skipped: elements.skipBtn
    };
    const btn = btnMap[action];
    if (btn) {
      btn.style.transform = 'scale(0.95)';
      setTimeout(() => {
        btn.style.transform = '';
      }, 150);
    }
  }

  function openSettings() {
    chrome.runtime.openOptionsPage();
  }

  async function showSummary() {
    const now = new Date();
    const summary = await AppStorage.getMonthlySummary(now.getFullYear(), now.getMonth() + 1);

    const message = getSummaryMessage(summary);

    elements.summaryContent.innerHTML = `
      <div class="summary-rate">
        <div class="rate-number">${summary.rate}%</div>
        <div class="rate-label">本月执行率</div>
      </div>
      <div class="summary-stats">
        <div class="stat-card confirm">
          <div class="stat-number">${summary.confirmed}</div>
          <div class="stat-label">已确认</div>
        </div>
        <div class="stat-card later">
          <div class="stat-number">${summary.later}</div>
          <div class="stat-label">稍后</div>
        </div>
        <div class="stat-card skipped">
          <div class="stat-number">${summary.skipped}</div>
          <div class="stat-label">跳过</div>
        </div>
      </div>
      <p class="summary-message">${message}</p>
    `;

    elements.summaryModal.classList.remove('hidden');
  }

  function getSummaryMessage(summary) {
    if (summary.total === 0) {
      return '这个月还没有记录，从今天开始行动吧~';
    }
    if (summary.rate >= 80) {
      return '表现很棒！继续保持，她一定能感受到你的用心 ❤️';
    }
    if (summary.rate >= 50) {
      return '还不错，再加把劲。小细节积累起来就是大感动~';
    }
    return '这个月可能有点忙，记得多花点心思在她身上哦。';
  }

  function hideSummary() {
    elements.summaryModal.classList.add('hidden');
  }

  function openStandaloneWindow() {
    chrome.windows.create({
      url: 'window.html',
      type: 'popup',
      width: 420,
      height: 560,
      focused: true
    });
    window.close();
  }

  function updateDateDisplay() {
    const now = new Date();
    const month = now.getMonth() + 1;
    const date = now.getDate();
    const weekday = ['日', '一', '二', '三', '四', '五', '六'][now.getDay()];
    elements.dateDisplay.textContent = `${month}月${date}日 周${weekday}`;
  }

  document.addEventListener('DOMContentLoaded', init);
})();
