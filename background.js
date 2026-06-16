importScripts('storage.js', 'reminder-engine.js');

const Background = {
  async init() {
    this.setupAlarm();
    this.setupListeners();
  },

  async initializeDefaultData() {
    try {
      const [settings, specialDays, partnerPrefs] = await Promise.all([
        AppStorage.getSettings(),
        AppStorage.getSpecialDays(),
        AppStorage.getPartnerPrefs()
      ]);

      const reminders = await ReminderEngine.getTodayReminders();
      this.updateBadge(reminders);

      console.log('默认数据初始化完成');
    } catch (error) {
      console.error('初始化默认数据失败:', error);
    }
  },

  setupAlarm() {
    chrome.alarms.get('dailyReminder', async (alarm) => {
      if (!alarm) {
        const settings = await AppStorage.getSettings();
        const [hours, minutes] = settings.reminderTime.split(':').map(Number);
        
        const now = new Date();
        const target = new Date();
        target.setHours(hours, minutes, 0, 0);
        
        if (target <= now) {
          target.setDate(target.getDate() + 1);
        }

        chrome.alarms.create('dailyReminder', {
          when: target.getTime(),
          periodInMinutes: 24 * 60
        });
      }
    });

    chrome.alarms.get('priorityCheck', (alarm) => {
      if (!alarm) {
        chrome.alarms.create('priorityCheck', {
          periodInMinutes: 60
        });
      }
    });
  },

  setupListeners() {
    chrome.alarms.onAlarm.addListener((alarm) => {
      if (alarm.name === 'dailyReminder') {
        this.handleDailyReminder();
      } else if (alarm.name === 'priorityCheck') {
        this.checkPriorityIncrease();
      }
    });

    chrome.runtime.onInstalled.addListener((details) => {
      if (details.reason === 'install') {
        this.initializeDefaultData();
      }
      this.init();
    });

    chrome.runtime.onStartup.addListener(() => {
      this.init();
    });

    chrome.storage.onChanged.addListener(async (changes, area) => {
      if (area === 'local') {
        if (changes.settings) {
          const newSettings = changes.settings.newValue;
          this.updateAlarmTime(newSettings.reminderTime);
          
          if (!newSettings.autoIncreasePriority) {
            chrome.action.setBadgeText({ text: '' });
          } else {
            const reminders = await ReminderEngine.getTodayReminders();
            this.updateBadge(reminders);
          }
        }
        if (changes.specialDays) {
          const settings = await AppStorage.getSettings();
          if (settings.autoIncreasePriority) {
            const reminders = await ReminderEngine.getTodayReminders();
            this.updateBadge(reminders);
          }
        }
      }
    });

    chrome.notifications.onClicked.addListener((notificationId) => {
      this.handleNotificationClick(notificationId);
    });
  },

  async handleDailyReminder() {
    try {
      const settings = await AppStorage.getSettings();
      const reminders = await ReminderEngine.getTodayReminders();
      const upcoming = reminders.filter(r => r.daysUntil <= 3 && r.daysUntil >= 0);

      if (upcoming.length > 0) {
        const nearest = upcoming[0];
        const title = nearest.daysUntil === 0 
          ? `今天是${nearest.name}！` 
          : `${nearest.name}还有${nearest.daysUntil}天`;
        
        const message = nearest.text;
        const notificationPriority = (settings.autoIncreasePriority && nearest.priority >= 7) ? 2 : nearest.priority >= 4 ? 1 : 0;

        chrome.notifications.create(`reminder_${nearest.id}`, {
          type: 'basic',
          iconUrl: 'icons/icon128.png',
          title,
          message,
          priority: notificationPriority,
          requireInteraction: settings.autoIncreasePriority && nearest.daysUntil <= 1,
          buttons: [
            { title: '已确认' },
            { title: '稍后' }
          ]
        });
      }

      this.checkMonthlySummary();
    } catch (error) {
      console.error('每日提醒出错:', error);
    }
  },

  async checkPriorityIncrease() {
    try {
      const settings = await AppStorage.getSettings();
      const reminders = await ReminderEngine.getTodayReminders();

      if (!settings.autoIncreasePriority) {
        chrome.action.setBadgeText({ text: '' });
        return;
      }

      const urgent = reminders.filter(r => r.daysUntil <= 1 && r.daysUntil >= 0);

      this.updateBadge(reminders);

      if (urgent.length > 0) {
        const today = new Date().toDateString();
        const lastNotified = await this.getLastPriorityNotificationDate();
        
        if (lastNotified !== today) {
          const nearest = urgent[0];
          chrome.notifications.create(`priority_${nearest.id}_${Date.now()}`, {
            type: 'basic',
            iconUrl: 'icons/icon128.png',
            title: `🔔 ${nearest.name}就在眼前！`,
            message: `别忘了今天有所表示哦~`,
            priority: 2,
            requireInteraction: true
          });
          
          await this.setLastPriorityNotificationDate(today);
        }
      }
    } catch (error) {
      console.error('优先级检查出错:', error);
    }
  },

  async updateBadge(reminders) {
    try {
      const settings = await AppStorage.getSettings();
      
      if (!settings.autoIncreasePriority) {
        chrome.action.setBadgeText({ text: '' });
        return;
      }

      const urgentCount = reminders.filter(r => r.daysUntil <= 3 && r.daysUntil >= 0).length;
      
      if (urgentCount > 0) {
        chrome.action.setBadgeText({ text: urgentCount.toString() });
        chrome.action.setBadgeBackgroundColor({ color: '#ef4444' });
      } else {
        chrome.action.setBadgeText({ text: '' });
      }
    } catch (error) {
      console.error('更新角标失败:', error);
    }
  },

  async getLastPriorityNotificationDate() {
    return new Promise((resolve) => {
      chrome.storage.local.get('lastPriorityNotification', (result) => {
        resolve(result.lastPriorityNotification || '');
      });
    });
  },

  async setLastPriorityNotificationDate(date) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ lastPriorityNotification: date }, resolve);
    });
  },

  updateAlarmTime(timeStr) {
    chrome.alarms.clear('dailyReminder', () => {
      const [hours, minutes] = timeStr.split(':').map(Number);
      
      const now = new Date();
      const target = new Date();
      target.setHours(hours, minutes, 0, 0);
      
      if (target <= now) {
        target.setDate(target.getDate() + 1);
      }

      chrome.alarms.create('dailyReminder', {
        when: target.getTime(),
        periodInMinutes: 24 * 60
      });
    });
  },

  async handleNotificationClick(notificationId) {
    if (notificationId.startsWith('reminder_')) {
      chrome.windows.create({
        url: 'window.html',
        type: 'popup',
        width: 420,
        height: 560,
        focused: true
      });
    }
  },

  async checkMonthlySummary() {
    const now = new Date();
    const today = now.getDate();
    
    if (today >= 28 && today <= 31) {
      const summaryShownKey = `summaryShown_${now.getFullYear()}_${now.getMonth()}`;
      
      const result = await new Promise((resolve) => {
        chrome.storage.local.get(summaryShownKey, resolve);
      });

      if (!result[summaryShownKey]) {
        const summary = await AppStorage.getMonthlySummary(now.getFullYear(), now.getMonth() + 1);
        
        if (summary.total > 0) {
          let message;
          if (summary.rate >= 80) {
            message = `本月执行率${summary.rate}%，表现很棒！继续保持~`;
          } else if (summary.rate >= 50) {
            message = `本月执行率${summary.rate}%，还不错，下月继续加油！`;
          } else {
            message = `本月执行率${summary.rate}%，下个月要多花点心思啦~`;
          }

          chrome.notifications.create('monthly_summary', {
            type: 'basic',
            iconUrl: 'icons/icon128.png',
            title: '📊 本月小结',
            message,
            priority: 1
          });

          await new Promise((resolve) => {
            chrome.storage.local.set({ [summaryShownKey]: true }, resolve);
          });
        }
      }
    }
  }
};

Background.init();

chrome.notifications.onButtonClicked.addListener(async (notificationId, buttonIndex) => {
  if (notificationId.startsWith('reminder_')) {
    const reminderId = notificationId.replace('reminder_', '');
    
    if (buttonIndex === 0) {
      await AppStorage.addRecord({
        action: 'confirmed',
        reminderId,
        reminderName: '系统提醒',
        timestamp: Date.now()
      });
      chrome.notifications.clear(notificationId);
    } else if (buttonIndex === 1) {
      await AppStorage.addRecord({
        action: 'later',
        reminderId,
        reminderName: '系统提醒',
        timestamp: Date.now()
      });
      chrome.notifications.clear(notificationId);
    }
  }
});
