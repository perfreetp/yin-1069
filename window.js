(function () {
  const state = {
    reminders: [],
    forecast: [],
    stageSummary: null,
    settings: null,
    partnerPrefs: null
  };

  const elements = {};

  function init() {
    cacheElements();
    bindEvents();
    loadData();
    updateDateDisplay();
  }

  function cacheElements() {
    elements.heroDot = document.getElementById('heroDot');
    elements.heroStageLabel = document.getElementById('heroStageLabel');
    elements.heroText = document.getElementById('heroText');
    elements.heroDetail = document.getElementById('heroDetail');
    elements.forecastCards = document.getElementById('forecastCards');
    elements.allRemindersList = document.getElementById('allRemindersList');
    elements.reminderCount = document.getElementById('reminderCount');
    elements.confirmBtn = document.getElementById('confirmBtn');
    elements.laterBtn = document.getElementById('laterBtn');
    elements.skipBtn = document.getElementById('skipBtn');
    elements.suggestionText = document.getElementById('suggestionText');
    elements.partnerPrefsCard = document.getElementById('partnerPrefsCard');
    elements.editPrefsBtn = document.getElementById('editPrefsBtn');
    elements.settingsBtn = document.getElementById('settingsBtn');
    elements.summaryBtn = document.getElementById('summaryBtn');
    elements.refreshBtn = document.getElementById('refreshBtn');
    elements.summaryModal = document.getElementById('summaryModal');
    elements.closeSummaryBtn = document.getElementById('closeSummaryBtn');
    elements.summaryContent = document.getElementById('summaryContent');
    elements.footerDate = document.getElementById('footerDate');
  }

  function bindEvents() {
    elements.confirmBtn.addEventListener('click', () => handleAction('confirmed'));
    elements.laterBtn.addEventListener('click', () => handleAction('later'));
    elements.skipBtn.addEventListener('click', () => handleAction('skipped'));
    elements.settingsBtn.addEventListener('click', openSettings);
    elements.editPrefsBtn.addEventListener('click', openSettings);
    elements.summaryBtn.addEventListener('click', showSummary);
    elements.refreshBtn.addEventListener('click', refreshData);
    elements.closeSummaryBtn.addEventListener('click', hideSummary);
    
    elements.summaryModal.addEventListener('click', (e) => {
      if (e.target === elements.summaryModal) {
        hideSummary();
      }
    });
  }

  async function loadData() {
    try {
      const [reminders, forecast, settings, partnerPrefs] = await Promise.all([
        ReminderEngine.getTodayReminders(),
        ReminderEngine.getThreeDayForecast(),
        AppStorage.getSettings(),
        AppStorage.getPartnerPrefs()
      ]);

      state.reminders = reminders;
      state.forecast = forecast;
      state.settings = settings;
      state.partnerPrefs = partnerPrefs;
      state.stageSummary = ReminderEngine.getStageSummary(reminders);

      renderHero();
      renderForecast();
      renderAllReminders();
      renderPartnerPrefs();
    } catch (error) {
      console.error('加载数据失败:', error);
    }
  }

  function renderHero() {
    const summary = state.stageSummary;
    if (!summary) return;

    elements.heroDot.style.backgroundColor = summary.color;
    elements.heroStageLabel.textContent = getStageLabel(summary.mainStage);
    elements.heroText.textContent = summary.text;
    
    if (summary.nearest) {
      elements.heroDetail.textContent = `距离${summary.nearest.name}还有${summary.nearest.daysUntil}天`;
    } else {
      elements.heroDetail.textContent = '享受当下的二人时光吧~';
    }
  }

  function getStageLabel(stage) {
    const labels = {
      today: '🎯 今天有重要日子',
      soon: '🔥 即将到来',
      planning: '📋 计划中',
      calm: '☀️ 状态平稳',
      all_clear: '✨ 一切安好'
    };
    return labels[stage] || '正常';
  }

  function renderForecast() {
    elements.forecastCards.innerHTML = state.forecast.map(day => {
      let bodyHtml = '';
      
      if (day.hasConflict && day.reminders.length > 1) {
        const names = day.reminders.map(r => r.name).join(' + ');
        const resolution = day.reminders[0].conflictResolution || 'merge';
        const label = day.dayOffset === 0 ? '今天' : day.dayOffset + '天';
        bodyHtml = `
          <div class="forecast-item-name conflict">⚡ ${names}</div>
          <div class="forecast-item-days">${label}</div>
          <div class="forecast-conflict-hint">${ReminderEngine.getConflictLabel(resolution)}</div>
        `;
      } else if (day.reminders.length > 0) {
        const reminder = day.reminders[0];
        const label = day.dayOffset === 0 ? '今天' : day.dayOffset + '天';
        bodyHtml = `
          <div class="forecast-item-name">${reminder.name}</div>
          <div class="forecast-item-days">${label}</div>
        `;
      } else {
        bodyHtml = '<div class="forecast-empty">无安排</div>';
      }

      return `
        <div class="forecast-card ${day.isToday ? 'is-today' : ''} ${day.hasConflict ? 'has-conflict' : ''}">
          <div class="forecast-day">${day.dayLabel}</div>
          <div class="forecast-date">${day.weekday} ${day.date.slice(5)}</div>
          <div class="forecast-body">
            ${bodyHtml}
          </div>
        </div>
      `;
    }).join('');
  }

  function renderAllReminders() {
    const reminders = state.reminders;
    elements.reminderCount.textContent = reminders.length;

    if (reminders.length === 0) {
      elements.allRemindersList.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">🎉</div>
          <div class="empty-state-text">暂无提醒，去设置里添加吧</div>
        </div>
      `;
      return;
    }

    const typeLabels = {
      anniversary: '纪念日',
      birthday: '生日',
      travel: '旅行',
      other: '其他'
    };

    elements.allRemindersList.innerHTML = reminders.map(r => {
      const priorityClass = r.priority >= 7 ? 'high' : r.priority >= 4 ? 'medium' : 'low';
      const daysClass = r.daysUntil <= 2 ? 'urgent' : r.daysUntil <= 7 ? 'soon' : '';
      const typeLabel = typeLabels[r.type] || '其他';
      const conflictHtml = r.hasConflict ? `<span class="conflict-badge">${ReminderEngine.getConflictLabel(r.conflictResolution)}</span>` : '';

      return `
        <div class="reminder-row ${priorityClass} ${r.hasConflict ? 'has-conflict' : ''}">
          <div class="reminder-row-info">
            <h4>${r.name} ${conflictHtml}</h4>
            <p>${r.stage.label}</p>
            <span class="reminder-row-type">${typeLabel}</span>
          </div>
          <div class="reminder-row-days ${daysClass}">
            <div class="days-num">${r.daysUntil}</div>
            <div class="days-label">天后</div>
          </div>
        </div>
      `;
    }).join('');
  }

  function renderPartnerPrefs() {
    const prefs = state.partnerPrefs;
    if (!prefs) return;

    const styleLabels = {
      gentle: '温柔体贴型',
      direct: '直接表达型',
      humorous: '幽默逗趣型'
    };

    const timeLabels = {
      morning: '早上',
      afternoon: '下午',
      evening: '晚上',
      anytime: '随时都可以'
    };

    let html = '';

    html += `
      <div class="pref-item">
        <div class="pref-label">偏好的沟通方式</div>
        <div class="pref-value">${styleLabels[prefs.communicationStyle] || '未设置'}</div>
      </div>
    `;

    if (prefs.bestTimeToTalk) {
      html += `
        <div class="pref-item">
          <div class="pref-label">适合聊天的时间</div>
          <div class="pref-value">${timeLabels[prefs.bestTimeToTalk] || '未设置'}</div>
        </div>
      `;
    }

    if (prefs.likes && prefs.likes.length > 0) {
      html += `
        <div class="pref-item">
          <div class="pref-label">她喜欢</div>
          <div class="pref-tags">
            ${prefs.likes.map(l => `<span class="pref-tag">${l}</span>`).join('')}
          </div>
        </div>
      `;
    }

    if (prefs.dislikes && prefs.dislikes.length > 0) {
      html += `
        <div class="pref-item">
          <div class="pref-label">她不喜欢</div>
          <div class="pref-tags">
            ${prefs.dislikes.map(d => `<span class="pref-tag dislike">${d}</span>`).join('')}
          </div>
        </div>
      `;
    }

    if (prefs.note) {
      html += `
        <div class="pref-item">
          <div class="pref-label">备注</div>
          <div class="pref-value">${prefs.note}</div>
        </div>
      `;
    }

    if (!html) {
      html = '<div class="prefs-loading">还没有设置偏好，去添加吧~</div>';
    }

    elements.partnerPrefsCard.innerHTML = html;
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
    elements.suggestionText.textContent = `💡 ${suggestion}`;

    flashButton(action);
  }

  function flashButton(action) {
    const btnMap = {
      confirmed: elements.confirmBtn,
      later: elements.laterBtn,
      skipped: elements.skipBtn
    };
    const btn = btnMap[action];
    if (btn) {
      btn.style.transform = 'scale(0.97)';
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
      return '这个月还没有记录，从今天开始行动吧~ 每一次小小的用心，她都会感受到的。';
    }
    if (summary.rate >= 80) {
      return '表现很棒！继续保持，她一定能感受到你的用心 ❤️ 好男友就是你！';
    }
    if (summary.rate >= 50) {
      return '还不错，再加把劲。小细节积累起来就是大感动~ 下个月争取更好！';
    }
    return '这个月可能有点忙，记得多花点心思在她身上哦。感情需要经营，加油！';
  }

  function hideSummary() {
    elements.summaryModal.classList.add('hidden');
  }

  function refreshData() {
    const btn = elements.refreshBtn;
    btn.style.transform = 'rotate(360deg)';
    btn.style.transition = 'transform 0.5s';
    
    loadData().then(() => {
      setTimeout(() => {
        btn.style.transform = '';
        btn.style.transition = '';
      }, 500);
    });
  }

  function updateDateDisplay() {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const date = now.getDate();
    const weekday = ['日', '一', '二', '三', '四', '五', '六'][now.getDay()];
    elements.footerDate.textContent = `${year}年${month}月${date}日 周${weekday}`;
  }

  document.addEventListener('DOMContentLoaded', init);
})();
