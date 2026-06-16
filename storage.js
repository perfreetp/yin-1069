(function (global) {
  const Storage = {
    KEYS: {
      SETTINGS: 'settings',
      REMINDERS: 'reminders',
      RECORDS: 'records',
      SPECIAL_DAYS: 'specialDays',
      PARTNER_PREFS: 'partnerPrefs'
    },

    async get(key) {
      return new Promise((resolve) => {
        chrome.storage.local.get(key, (result) => {
          resolve(result[key]);
        });
      });
    },

    async set(key, value) {
      return new Promise((resolve) => {
        chrome.storage.local.set({ [key]: value }, resolve);
      });
    },

    async getAll() {
      return new Promise((resolve) => {
        chrome.storage.local.get(null, resolve);
      });
    },

    async getSettings() {
      const settings = await this.get(this.KEYS.SETTINGS);
      return settings || this.getDefaultSettings();
    },

    async saveSettings(settings) {
      await this.set(this.KEYS.SETTINGS, settings);
    },

    getDefaultSettings() {
      return {
        tone: 'gentle',
        frequency: 'daily',
        reminderTime: '09:00',
        advanceDays: 3,
        autoIncreasePriority: true
      };
    },

    async getReminders() {
      const reminders = await this.get(this.KEYS.REMINDERS);
      return reminders || [];
    },

    async saveReminders(reminders) {
      await this.set(this.KEYS.REMINDERS, reminders);
    },

    async addReminder(reminder) {
      const reminders = await this.getReminders();
      reminder.id = Date.now().toString();
      reminder.createdAt = new Date().toISOString();
      reminders.push(reminder);
      await this.saveReminders(reminders);
      return reminder;
    },

    async updateReminder(id, updates) {
      const reminders = await this.getReminders();
      const index = reminders.findIndex(r => r.id === id);
      if (index !== -1) {
        reminders[index] = { ...reminders[index], ...updates };
        await this.saveReminders(reminders);
        return reminders[index];
      }
      return null;
    },

    async deleteReminder(id) {
      const reminders = await this.getReminders();
      const filtered = reminders.filter(r => r.id !== id);
      await this.saveReminders(filtered);
    },

    async getRecords() {
      const records = await this.get(this.KEYS.RECORDS);
      return records || [];
    },

    async addRecord(record) {
      const records = await this.getRecords();
      record.id = Date.now().toString();
      record.date = new Date().toISOString().split('T')[0];
      records.push(record);
      await this.set(this.KEYS.RECORDS, records);
      return record;
    },

    async getSpecialDays() {
      const days = await this.get(this.KEYS.SPECIAL_DAYS);
      return days || this.getDefaultSpecialDays();
    },

    async saveSpecialDays(days) {
      await this.set(this.KEYS.SPECIAL_DAYS, days);
    },

    getDefaultSpecialDays() {
      return [
        { id: 'valentines', name: '情人节', month: 2, day: 14, type: 'anniversary' },
        { id: 'qixi', name: '七夕', month: 8, day: 10, type: 'anniversary', note: '每年农历七月初七，日期需手动更新' }
      ];
    },

    async getPartnerPrefs() {
      const prefs = await this.get(this.KEYS.PARTNER_PREFS);
      return prefs || this.getDefaultPartnerPrefs();
    },

    async savePartnerPrefs(prefs) {
      await this.set(this.KEYS.PARTNER_PREFS, prefs);
    },

    getDefaultPartnerPrefs() {
      return {
        communicationStyle: 'gentle',
        likes: [],
        dislikes: [],
        bestTimeToTalk: 'evening',
        note: ''
      };
    },

    async getMonthlySummary(year, month) {
      const records = await this.getRecords();
      const monthStr = `${year}-${String(month).padStart(2, '0')}`;
      const monthRecords = records.filter(r => r.date.startsWith(monthStr));
      
      const confirmed = monthRecords.filter(r => r.action === 'confirmed').length;
      const later = monthRecords.filter(r => r.action === 'later').length;
      const skipped = monthRecords.filter(r => r.action === 'skipped').length;
      const total = monthRecords.length;

      return {
        year,
        month,
        total,
        confirmed,
        later,
        skipped,
        rate: total > 0 ? Math.round((confirmed / total) * 100) : 0,
        records: monthRecords
      };
    }
  };

  global.AppStorage = Storage;
})(typeof window !== 'undefined' ? window : globalThis);
