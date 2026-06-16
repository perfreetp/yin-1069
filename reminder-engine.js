(function (global) {
  const ReminderEngine = {
    STAGES: [
      { id: 'far', minDays: 15, maxDays: 999, label: '还早，可以慢慢准备', color: '#9CA3AF' },
      { id: 'planning', minDays: 7, maxDays: 14, label: '该开始计划了', color: '#60A5FA' },
      { id: 'approaching', minDays: 3, maxDays: 6, label: '快到了，记得安排', color: '#F59E0B' },
      { id: 'soon', minDays: 1, maxDays: 2, label: '就在这两天！', color: '#EF4444' },
      { id: 'today', minDays: 0, maxDays: 0, label: '就是今天！', color: '#DC2626' },
      { id: 'passed', minDays: -999, maxDays: -1, label: '已过', color: '#9CA3AF' }
    ],

    TONES: {
      gentle: {
        name: '温柔体贴',
        templates: {
          far: '还有{days}天，不急，慢慢想想要怎么给她惊喜~',
          planning: '还有{days}天就到{name}了，可以开始想想怎么庆祝了。',
          approaching: '还有{days}天就是{name}，记得提前安排好时间哦。',
          soon: '就剩{days}天了！{name}就要到了，准备好了吗？',
          today: '今天是{name}！记得跟她说一声，或者准备点小惊喜~',
          passed: '{name}已经过了，记得复盘一下，下次做得更好。'
        }
      },
      direct: {
        name: '直接提醒',
        templates: {
          far: '{name}还有{days}天。',
          planning: '{name}还有{days}天，开始计划。',
          approaching: '{name}还有{days}天，该安排了。',
          soon: '{name}还有{days}天，别忘了。',
          today: '今天是{name}，行动。',
          passed: '{name}已过。'
        }
      },
      humorous: {
        name: '幽默调侃',
        templates: {
          far: '距离{name}还有{days}天，你的求生欲还在休假吗？',
          planning: '{days}天后就是{name}了，再不准备要跪搓衣板了~',
          approaching: '还有{days}天！{name}倒计时开始，你的钱包准备好了吗？',
          soon: '警报！{name}还有{days}天到达战场，请做好准备！',
          today: '叮咚~今天是{name}！表现机会来了，兄弟加油！',
          passed: '{name}已经过去了，希望你还活着...'
        }
      }
    },

    SUGGESTIONS: {
      confirmed: [
        '晚上主动问她今天过得怎么样',
        '准备一个小礼物，不用贵，用心就好',
        '带她去吃她喜欢的餐厅',
        '认真听她说话，放下手机',
        '给她一个大大的拥抱',
        '说一句"你今天真好看"',
        '帮她分担点家务'
      ],
      later: [
        '定个闹钟，别再忘了',
        '记在手机日历里',
        '先在心里打个草稿，想说什么'
      ],
      skipped: [
        '没关系，下次记得就好',
        '可以补一个小惊喜',
        '真心比 timing 更重要'
      ]
    },

    getNextOccurrence(month, day) {
      const today = new Date();
      const thisYear = today.getFullYear();
      let date = new Date(thisYear, month - 1, day);
      if (date < today) {
        date = new Date(thisYear + 1, month - 1, day);
      }
      return date;
    },

    daysUntil(date) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const target = new Date(date);
      target.setHours(0, 0, 0, 0);
      const diffTime = target - today;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays;
    },

    getStage(daysUntil) {
      return this.STAGES.find(s => daysUntil >= s.minDays && daysUntil <= s.maxDays) || this.STAGES[0];
    },

    getPriority(specialDay, daysUntil, settings) {
      let priority = 0;
      const stage = this.getStage(daysUntil);
      
      const stagePriority = {
        far: 1,
        planning: 2,
        approaching: 4,
        soon: 7,
        today: 10,
        passed: 0
      };
      priority += stagePriority[stage.id] || 1;

      const typePriority = {
        anniversary: 3,
        birthday: 5,
        travel: 2,
        other: 1
      };
      priority += typePriority[specialDay.type] || 1;

      if (settings.autoIncreasePriority && daysUntil <= 3) {
        priority += 2;
      }

      return Math.min(priority, 10);
    },

    getReminderText(specialDay, daysUntil, tone = 'gentle') {
      const stage = this.getStage(daysUntil);
      const toneConfig = this.TONES[tone] || this.TONES.gentle;
      let template = toneConfig.templates[stage.id] || toneConfig.templates.far;
      
      return template
        .replace('{name}', specialDay.name)
        .replace('{days}', Math.abs(daysUntil));
    },

    getRandomSuggestion(action) {
      const suggestions = this.SUGGESTIONS[action] || this.SUGGESTIONS.confirmed;
      return suggestions[Math.floor(Math.random() * suggestions.length)];
    },

    detectConflicts(specialDays) {
      const conflictMap = {};
      specialDays.forEach(day => {
        const key = `${day.month}-${day.day}`;
        if (!conflictMap[key]) {
          conflictMap[key] = [];
        }
        conflictMap[key].push(day);
      });

      const conflicts = {};
      for (const key in conflictMap) {
        if (conflictMap[key].length > 1) {
          const days = conflictMap[key];
          const hasTravel = days.some(d => d.type === 'travel');
          const resolved = days.map(d => {
            const existing = d.conflictResolution;
            if (existing) return d;
            if (hasTravel && d.type !== 'travel') {
              return { ...d, conflictResolution: 'traveling' };
            }
            return { ...d, conflictResolution: 'merge' };
          });
          conflicts[key] = resolved;
        }
      }
      return conflicts;
    },

    getConflictLabel(resolution) {
      const labels = {
        traveling: '🧳 旅行中，可能需要简化安排',
        merge: '📅 同日多项，建议合并庆祝',
        reschedule: '🔄 建议改期'
      };
      return labels[resolution] || '';
    },

    async getTodayReminders() {
      const [specialDays, settings] = await Promise.all([
        AppStorage.getSpecialDays(),
        AppStorage.getSettings()
      ]);

      const conflicts = this.detectConflicts(specialDays);

      const today = new Date();
      let reminders = specialDays
        .map(day => {
          const nextDate = this.getNextOccurrence(day.month, day.day);
          const days = this.daysUntil(nextDate);
          const stage = this.getStage(days);
          const priority = this.getPriority(day, days, settings);
          const text = this.getReminderText(day, days, settings.tone);
          const conflictKey = `${day.month}-${day.day}`;
          const conflictInfo = conflicts[conflictKey] || null;

          return {
            ...day,
            nextDate: nextDate.toISOString(),
            daysUntil: days,
            stage,
            priority,
            text,
            hasConflict: !!conflictInfo,
            conflictResolution: day.conflictResolution || (conflictInfo ? (conflictInfo.find(c => c.id === day.id) || {}).conflictResolution : null)
          };
        })
        .filter(r => r.daysUntil >= 0);

      const frequency = settings.frequency || 'daily';
      if (frequency === 'approaching') {
        reminders = reminders.filter(r => r.daysUntil <= 3);
      } else if (frequency === 'today') {
        reminders = reminders.filter(r => r.daysUntil === 0);
      }

      return reminders.sort((a, b) => a.daysUntil - b.daysUntil);
    },

    async getUpcomingDays(days = 3) {
      const reminders = await this.getTodayReminders();
      return reminders.filter(r => r.daysUntil <= days);
    },

    getStageSummary(reminders) {
      if (reminders.length === 0) {
        return {
          mainStage: 'all_clear',
          text: '最近没有需要特别准备的日子，好好享受二人时光吧~',
          color: '#10B981'
        };
      }

      const nearest = reminders[0];
      
      if (nearest.daysUntil === 0) {
        return {
          mainStage: 'today',
          text: `今天是${nearest.name}！记得有所表示哦~`,
          color: '#DC2626',
          nearest
        };
      }

      if (nearest.daysUntil <= 3) {
        return {
          mainStage: 'soon',
          text: `${nearest.name}还有${nearest.daysUntil}天就到了，该行动了！`,
          color: '#EF4444',
          nearest
        };
      }

      if (nearest.daysUntil <= 7) {
        return {
          mainStage: 'planning',
          text: `${nearest.name}还有${nearest.daysUntil}天，可以开始计划了。`,
          color: '#F59E0B',
          nearest
        };
      }

      return {
        mainStage: 'calm',
        text: `最近的${nearest.name}还有${nearest.daysUntil}天，时间还充裕。`,
        color: '#10B981',
        nearest
      };
    },

    async getThreeDayForecast() {
      const [specialDays, settings] = await Promise.all([
        AppStorage.getSpecialDays(),
        AppStorage.getSettings()
      ]);

      const conflicts = this.detectConflicts(specialDays);

      const forecast = [];
      const today = new Date();

      for (let i = 0; i < 3; i++) {
        const date = new Date(today);
        date.setDate(today.getDate() + i);
        
        const dayReminders = specialDays.filter(day => {
          const nextDate = this.getNextOccurrence(day.month, day.day);
          nextDate.setHours(0, 0, 0, 0);
          const target = new Date(date);
          target.setHours(0, 0, 0, 0);
          return nextDate.getTime() === target.getTime();
        }).map(day => {
          const conflictKey = `${day.month}-${day.day}`;
          const conflictInfo = conflicts[conflictKey];
          const conflictItem = conflictInfo ? conflictInfo.find(c => c.id === day.id) : null;
          
          return {
            ...day,
            daysUntil: i,
            text: this.getReminderText(day, i, settings.tone),
            hasConflict: !!conflictInfo,
            conflictResolution: day.conflictResolution || (conflictItem ? conflictItem.conflictResolution : null)
          };
        });

        const dateConflictKey = `${date.getMonth() + 1}-${date.getDate()}`;
        const dayConflict = conflicts[dateConflictKey];

        forecast.push({
          date: date.toISOString().split('T')[0],
          weekday: ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][date.getDay()],
          isToday: i === 0,
          dayOffset: i,
          dayLabel: i === 0 ? '今天' : i === 1 ? '明天' : '后天',
          reminders: dayReminders,
          hasConflict: !!dayConflict,
          conflictCount: dayConflict ? dayConflict.length : 0
        });
      }

      return forecast;
    },

    hasConflict(date) {
      return false;
    }
  };

  global.ReminderEngine = ReminderEngine;
})(typeof window !== 'undefined' ? window : globalThis);
