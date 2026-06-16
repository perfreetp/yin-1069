(function () {
  const state = {
    settings: null,
    specialDays: [],
    partnerPrefs: null,
    editingDayId: null,
    likes: [],
    dislikes: []
  };

  const elements = {};

  function init() {
    cacheElements();
    bindEvents();
    loadData();
  }

  function cacheElements() {
    elements.toneInputs = document.querySelectorAll('input[name="tone"]');
    elements.frequency = document.getElementById('frequency');
    elements.reminderTime = document.getElementById('reminderTime');
    elements.autoIncreasePriority = document.getElementById('autoIncreasePriority');
    elements.advanceDays = document.getElementById('advanceDays');
    elements.specialDaysList = document.getElementById('specialDaysList');
    elements.addDayBtn = document.getElementById('addDayBtn');
    elements.addDayModal = document.getElementById('addDayModal');
    elements.closeDayModal = document.getElementById('closeDayModal');
    elements.cancelDayBtn = document.getElementById('cancelDayBtn');
    elements.confirmDayBtn = document.getElementById('confirmDayBtn');
    elements.dayName = document.getElementById('dayName');
    elements.dayMonth = document.getElementById('dayMonth');
    elements.dayDay = document.getElementById('dayDay');
    elements.dayType = document.getElementById('dayType');
    elements.dayNote = document.getElementById('dayNote');
    elements.communicationStyle = document.getElementById('communicationStyle');
    elements.bestTimeToTalk = document.getElementById('bestTimeToTalk');
    elements.likesTags = document.getElementById('likesTags');
    elements.likeInput = document.getElementById('likeInput');
    elements.dislikesTags = document.getElementById('dislikesTags');
    elements.dislikeInput = document.getElementById('dislikeInput');
    elements.partnerNote = document.getElementById('partnerNote');
    elements.saveBtn = document.getElementById('saveBtn');
    elements.saveStatus = document.getElementById('saveStatus');
    elements.exportDataBtn = document.getElementById('exportDataBtn');
    elements.importDataBtn = document.getElementById('importDataBtn');
    elements.importFile = document.getElementById('importFile');
    elements.resetDataBtn = document.getElementById('resetDataBtn');
  }

  function bindEvents() {
    elements.addDayBtn.addEventListener('click', openAddDayModal);
    elements.closeDayModal.addEventListener('click', closeDayModal);
    elements.cancelDayBtn.addEventListener('click', closeDayModal);
    elements.confirmDayBtn.addEventListener('click', handleDaySubmit);
    
    elements.likeInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        addLike();
      }
    });
    
    elements.dislikeInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        addDislike();
      }
    });

    elements.saveBtn.addEventListener('click', saveAll);
    elements.exportDataBtn.addEventListener('click', exportData);
    elements.importDataBtn.addEventListener('click', () => elements.importFile.click());
    elements.importFile.addEventListener('change', handleImport);
    elements.resetDataBtn.addEventListener('click', resetData);

    elements.addDayModal.addEventListener('click', (e) => {
      if (e.target === elements.addDayModal) {
        closeDayModal();
      }
    });
  }

  async function loadData() {
    const [settings, specialDays, partnerPrefs] = await Promise.all([
      AppStorage.getSettings(),
      AppStorage.getSpecialDays(),
      AppStorage.getPartnerPrefs()
    ]);

    state.settings = settings;
    state.specialDays = specialDays;
    state.partnerPrefs = partnerPrefs;
    state.likes = [...(partnerPrefs.likes || [])];
    state.dislikes = [...(partnerPrefs.dislikes || [])];

    renderSettings();
    renderSpecialDays();
    renderPartnerPrefs();
    renderTags();
  }

  function renderSettings() {
    elements.toneInputs.forEach(input => {
      input.checked = input.value === state.settings.tone;
    });

    elements.frequency.value = state.settings.frequency || 'daily';
    elements.reminderTime.value = state.settings.reminderTime;
    elements.autoIncreasePriority.checked = state.settings.autoIncreasePriority;
    elements.advanceDays.value = state.settings.advanceDays;
  }

  function renderSpecialDays() {
    if (state.specialDays.length === 0) {
      elements.specialDaysList.innerHTML = '<div class="days-empty">还没有添加重要日子，点击右上角添加</div>';
      return;
    }

    const typeLabels = {
      anniversary: '纪念日',
      birthday: '生日',
      travel: '旅行',
      other: '其他'
    };

    const sortedDays = [...state.specialDays].sort((a, b) => {
      const dateA = ReminderEngine.getNextOccurrence(a.month, a.day);
      const dateB = ReminderEngine.getNextOccurrence(b.month, b.day);
      return dateA - dateB;
    });

    elements.specialDaysList.innerHTML = sortedDays.map(day => {
      const daysUntil = ReminderEngine.daysUntil(ReminderEngine.getNextOccurrence(day.month, day.day));
      const conflictLabel = day.conflictResolution ? ` <span class="day-conflict-badge">${ReminderEngine.getConflictLabel(day.conflictResolution)}</span>` : '';
      
      return `
        <div class="day-item ${day.conflictResolution ? 'has-conflict' : ''}" data-id="${day.id}">
          <div class="day-item-info">
            <h4>
              ${day.name}
              <span class="day-type-badge">${typeLabels[day.type] || '其他'}</span>
              ${conflictLabel}
            </h4>
            <p>${day.month}月${day.day}日 · 还有${daysUntil}天</p>
          </div>
          <div class="day-actions">
            <button class="day-edit-btn" data-id="${day.id}">编辑</button>
            <button class="day-delete-btn" data-id="${day.id}">删除</button>
          </div>
        </div>
      `;
    }).join('');

    document.querySelectorAll('.day-edit-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.target.dataset.id;
        openEditDayModal(id);
      });
    });

    document.querySelectorAll('.day-delete-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.target.dataset.id;
        deleteDay(id);
      });
    });
  }

  function renderPartnerPrefs() {
    elements.communicationStyle.value = state.partnerPrefs.communicationStyle;
    elements.bestTimeToTalk.value = state.partnerPrefs.bestTimeToTalk;
    elements.partnerNote.value = state.partnerPrefs.note || '';
  }

  function renderTags() {
    elements.likesTags.innerHTML = state.likes.map((tag, index) => `
      <span class="tag-item">
        ${tag}
        <span class="tag-remove" data-index="${index}" data-type="like">✕</span>
      </span>
    `).join('');

    elements.dislikesTags.innerHTML = state.dislikes.map((tag, index) => `
      <span class="tag-item dislike">
        ${tag}
        <span class="tag-remove" data-index="${index}" data-type="dislike">✕</span>
      </span>
    `).join('');

    document.querySelectorAll('.tag-remove').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const index = parseInt(e.target.dataset.index);
        const type = e.target.dataset.type;
        removeTag(index, type);
      });
    });
  }

  function addLike() {
    const value = elements.likeInput.value.trim();
    if (value && !state.likes.includes(value)) {
      state.likes.push(value);
      elements.likeInput.value = '';
      renderTags();
    }
  }

  function addDislike() {
    const value = elements.dislikeInput.value.trim();
    if (value && !state.dislikes.includes(value)) {
      state.dislikes.push(value);
      elements.dislikeInput.value = '';
      renderTags();
    }
  }

  function removeTag(index, type) {
    if (type === 'like') {
      state.likes.splice(index, 1);
    } else {
      state.dislikes.splice(index, 1);
    }
    renderTags();
  }

  function openAddDayModal() {
    state.editingDayId = null;
    elements.dayName.value = '';
    elements.dayMonth.value = '1';
    elements.dayDay.value = '';
    elements.dayType.value = 'anniversary';
    elements.dayNote.value = '';
    elements.confirmDayBtn.textContent = '添加';
    elements.addDayModal.classList.remove('hidden');
    elements.dayName.focus();
  }

  function openEditDayModal(id) {
    const day = state.specialDays.find(d => d.id === id);
    if (!day) return;

    state.editingDayId = id;
    elements.dayName.value = day.name;
    elements.dayMonth.value = day.month;
    elements.dayDay.value = day.day;
    elements.dayType.value = day.type;
    elements.dayNote.value = day.note || '';
    elements.confirmDayBtn.textContent = '保存';
    elements.addDayModal.classList.remove('hidden');
  }

  function closeDayModal() {
    elements.addDayModal.classList.add('hidden');
    state.editingDayId = null;
  }

  function handleDaySubmit() {
    const name = elements.dayName.value.trim();
    const month = parseInt(elements.dayMonth.value);
    const day = parseInt(elements.dayDay.value);
    const type = elements.dayType.value;
    const note = elements.dayNote.value.trim();

    if (!name || !day || day < 1 || day > 31) {
      alert('请填写完整且正确的信息');
      return;
    }

    const existingOnSameDay = state.specialDays.filter(d => {
      if (state.editingDayId && d.id === state.editingDayId) return false;
      return d.month === month && d.day === day;
    });

    if (existingOnSameDay.length > 0) {
      const existingNames = existingOnSameDay.map(d => d.name).join('、');
      const hasTravel = existingOnSameDay.some(d => d.type === 'travel') || type === 'travel';
      
      let resolution = 'merge';
      if (hasTravel) {
        resolution = 'traveling';
      }

      const conflictLabels = {
        traveling: '标记为旅行中（简化安排）',
        merge: '合并提醒（一起庆祝）',
        reschedule: '提示改期'
      };

      const choices = Object.entries(conflictLabels).map(([key, label]) => `${key}: ${label}`).join('\n');
      const userChoice = confirm(
        `⚠️ ${month}月${day}日已有「${existingNames}」，存在冲突。\n\n点击"确定"将${resolution === 'traveling' ? '标记为旅行中（简化安排）' : '合并提醒（一起庆祝）'}。\n点击"取消"放弃添加，手动调整日期。`
      );

      if (!userChoice) return;

      if (state.editingDayId) {
        const index = state.specialDays.findIndex(d => d.id === state.editingDayId);
        if (index !== -1) {
          state.specialDays[index] = {
            ...state.specialDays[index],
            name,
            month,
            day,
            type,
            note,
            conflictResolution: resolution
          };
        }
      } else {
        state.specialDays.push({
          id: Date.now().toString(),
          name,
          month,
          day,
          type,
          note,
          conflictResolution: resolution
        });
      }

      existingOnSameDay.forEach(d => {
        const idx = state.specialDays.findIndex(s => s.id === d.id);
        if (idx !== -1 && !state.specialDays[idx].conflictResolution) {
          state.specialDays[idx].conflictResolution = resolution;
        }
      });

      renderSpecialDays();
      closeDayModal();
      showSaveStatus('已保存（含冲突处理）');
      return;
    }

    if (state.editingDayId) {
      const index = state.specialDays.findIndex(d => d.id === state.editingDayId);
      if (index !== -1) {
        state.specialDays[index] = {
          ...state.specialDays[index],
          name,
          month,
          day,
          type,
          note
        };
        delete state.specialDays[index].conflictResolution;
      }
    } else {
      state.specialDays.push({
        id: Date.now().toString(),
        name,
        month,
        day,
        type,
        note
      });
    }

    renderSpecialDays();
    closeDayModal();
    showSaveStatus('已保存');
  }

  function deleteDay(id) {
    if (!confirm('确定要删除这个日子吗？')) return;
    
    state.specialDays = state.specialDays.filter(d => d.id !== id);
    renderSpecialDays();
    showSaveStatus('已删除');
  }

  async function saveAll() {
    const tone = document.querySelector('input[name="tone"]:checked').value;
    const settings = {
      tone,
      frequency: elements.frequency.value,
      reminderTime: elements.reminderTime.value,
      autoIncreasePriority: elements.autoIncreasePriority.checked,
      advanceDays: parseInt(elements.advanceDays.value)
    };

    const partnerPrefs = {
      communicationStyle: elements.communicationStyle.value,
      bestTimeToTalk: elements.bestTimeToTalk.value,
      likes: state.likes,
      dislikes: state.dislikes,
      note: elements.partnerNote.value.trim()
    };

    await Promise.all([
      AppStorage.saveSettings(settings),
      AppStorage.saveSpecialDays(state.specialDays),
      AppStorage.savePartnerPrefs(partnerPrefs)
    ]);

    state.settings = settings;
    state.partnerPrefs = partnerPrefs;

    showSaveStatus('设置已保存 ✓');
  }

  function showSaveStatus(text) {
    elements.saveStatus.textContent = text;
    elements.saveStatus.classList.add('show');
    setTimeout(() => {
      elements.saveStatus.classList.remove('show');
    }, 2000);
  }

  async function exportData() {
    const allData = await AppStorage.getAll();
    const dataStr = JSON.stringify(allData, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `伴侣提醒数据_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    
    URL.revokeObjectURL(url);
  }

  function handleImport(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = JSON.parse(event.target.result);
        
        if (!confirm('导入将覆盖现有数据，确定继续吗？')) {
          return;
        }

        const promises = [];
        for (const key in data) {
          promises.push(AppStorage.set(key, data[key]));
        }
        await Promise.all(promises);
        
        await loadData();
        showSaveStatus('导入成功 ✓');
      } catch (err) {
        alert('导入失败：文件格式不正确');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  async function resetData() {
    if (!confirm('确定要重置所有数据吗？此操作不可恢复！')) return;
    if (!confirm('真的确定吗？所有设置和记录都会消失！')) return;

    await chrome.storage.local.clear();
    await loadData();
    showSaveStatus('数据已重置');
  }

  document.addEventListener('DOMContentLoaded', init);
})();
