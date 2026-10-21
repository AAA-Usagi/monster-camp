(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CampDomain = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const DIFFICULTIES = Object.freeze({
    easy: Object.freeze({ label: '轻松', reward: 10 }),
    normal: Object.freeze({ label: '普通', reward: 20 }),
    hard: Object.freeze({ label: '挑战', reward: 40 })
  });
  const validDifficulty = value => typeof value === 'string' && Object.hasOwn(DIFFICULTIES, value);
  const MILESTONES = [
    { coins: 30, name: '帐篷', caption: '有了一个可以歇脚的地方' },
    { coins: 100, name: '篝火', caption: '给忙碌的一天添一点温暖' },
    { coins: 250, name: '小屋', caption: '小小的努力，盖成了家' },
    { coins: 500, name: '花园', caption: '你照顾的事情，开花了' }
  ];
  const pad = n => String(n).padStart(2, '0');
  const dayKey = value => { const d = new Date(value); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
  const timeKey = value => { const d = new Date(value); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
  const validDate = s => {
    if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
    const d = new Date(`${s}T12:00:00`);
    return !Number.isNaN(+d) && dayKey(d) === s;
  };
  function number(s) {
    if (/^\d+$/.test(s)) return Number(s);
    const digits = { 零: 0, 〇: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
    if (s.includes('十')) { const [a, b] = s.split('十'); return (a ? digits[a] : 1) * 10 + (b ? digits[b] : 0); }
    return digits[s];
  }
  function parseInput(input, current = new Date()) {
    const rawInput = String(input || '').trim();
    const now = new Date(current);
    let scheduledDate = null, remindAt = null, warning = '', dateToken = '', timeToken = '';
    const relative = rawInput.match(/大后天|后天|明天|今天|今日/);
    const absolute = rawInput.match(/(?:(\d{4})年)?(\d{1,2})月(\d{1,2})[日号]?/);
    const iso = rawInput.match(/\b(\d{4})[-/](\d{1,2})[-/](\d{1,2})\b/);
    const weekday = rawInput.match(/(下下|下|本|这)?(?:周|星期)([一二三四五六日天])/);
    if (relative) {
      const d = new Date(now); d.setDate(d.getDate() + ({今天:0,今日:0,明天:1,后天:2,大后天:3}[relative[0]]));
      scheduledDate = dayKey(d); dateToken = relative[0];
    } else if (iso || absolute) {
      const m = iso || absolute;
      const year = Number(m[1] || now.getFullYear()), month = Number(m[2]), day = Number(m[3]);
      scheduledDate = `${year}-${pad(month)}-${pad(day)}`; dateToken = m[0];
      if (!validDate(scheduledDate)) { scheduledDate = null; warning = '这个日期不存在，请调整日期或移除时间。'; }
      else if (!m[1] && scheduledDate < dayKey(now)) {
        scheduledDate = `${year + 1}-${pad(month)}-${pad(day)}`;
        if (!validDate(scheduledDate)) { scheduledDate = null; warning = '下一年的这个日期不存在，请指定年份。'; }
      }
    } else if (weekday) {
      const n = {一:1,二:2,三:3,四:4,五:5,六:6,日:7,天:7}[weekday[2]];
      const day = now.getDay() || 7;
      let delta = n - day;
      if (weekday[1] === '下') delta += 7;
      else if (weekday[1] === '下下') delta += 14;
      else if (!weekday[1] && delta < 0) delta += 7;
      const d = new Date(now); d.setDate(d.getDate() + delta); scheduledDate = dayKey(d); dateToken = weekday[0];
    }
    let clock = rawInput.match(/(?:(凌晨|早上|上午|中午|下午|傍晚|晚上|晚间)\s*)?(\d{1,2}|[零〇一二两三四五六七八九十]{1,3})(?:[:：](\d{2})|[点时](?:(半|一刻|三刻)|([零〇一二两三四五六七八九十\d]{1,3})分?)?)/);
    // Colloquial "一点" in "有一点难/晚一点/清楚一点" is not a clock time.
    if (clock && !clock[1] && /^(一点|两点)$/.test(clock[0]) && (/(?:有|早|晚|快|慢|多|少|清楚)$/.test(rawInput.slice(0,clock.index)) || /^[点儿]/.test(rawInput.slice(clock.index+clock[0].length)))) clock = null;
    if (clock) {
      let hour = number(clock[2]);
      const minute = clock[3] ? Number(clock[3]) : clock[4] ? ({半:30,一刻:15,三刻:45}[clock[4]]) : clock[5] ? number(clock[5]) : 0;
      const period = clock[1];
      if (['下午','傍晚','晚上','晚间'].includes(period) && hour < 12) hour += 12;
      if (period === '中午' && hour < 11) hour += 12;
      if (['凌晨','早上','上午'].includes(period) && hour === 12) hour = 0;
      timeToken = clock[0];
      if (!(hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59)) warning = '这个时刻不正确，请重新选择。';
      else if (!warning) {
        scheduledDate ||= dayKey(now);
        const d = new Date(`${scheduledDate}T${pad(hour)}:${pad(minute)}:00`);
        remindAt = d.toISOString();
        if (+d <= +now) warning = '这个提醒时间已经过去，请调整时间，或移除提醒后保存。';
      }
    }
    let title = rawInput;
    if (dateToken) title = title.replace(dateToken, '');
    if (timeToken) title = title.replace(timeToken, '');
    title = title.replace(/^[\s，,：:]+|[\s，,：:]+$/g, '').trim() || rawInput;
    return { rawInput, title, scheduledDate, remindAt, warning, recognized: Boolean(dateToken || timeToken) };
  }
  function category(task, now = new Date()) {
    if (task.completedAt) return 'done';
    if (!task.scheduledDate) return 'unscheduled';
    return task.scheduledDate <= dayKey(now) ? 'today' : 'next';
  }
  function stats(state, now = new Date()) {
    const done = state.tasks.filter(t => t.completedAt);
    return { coins: done.reduce((sum, t) => sum + t.rewardEarned, 0), completed: done.length, today: done.filter(t => dayKey(t.completedAt) === dayKey(now)).length, pending: state.tasks.filter(t => !t.deletedAt && !t.completedAt).length };
  }
  function initialState() {
    return { version: 2, tasks: [], notices: [], unlocked: [], lastReviewDate: null,
      settings: { autoLaunch: true, reviewEnabled: true, reviewTime: '09:00', animations: true, floatPosition: null } };
  }
  function appearance(id) { return [...id].reduce((n, c) => (n * 31 + c.charCodeAt(0)) >>> 0, 0) % 12; }
  function validateTask(input, now, existing) {
    if (!input || typeof input.title !== 'string' || !input.title.trim()) throw new Error('先写下要做的事情。');
    if (input.title.length > 1000 || typeof input.rawInput !== 'string' || input.rawInput.length > 4000) throw new Error('内容太长了，请拆成几件事记录。');
    if (input.scheduledDate !== null && !validDate(input.scheduledDate)) throw new Error('请选择有效日期。');
    if (input.remindAt !== null) {
      if (typeof input.remindAt !== 'string' || Number.isNaN(Date.parse(input.remindAt))) throw new Error('请选择有效提醒时间。');
      if (!input.scheduledDate || dayKey(input.remindAt) !== input.scheduledDate) throw new Error('提醒时间需要和安排日期一致。');
      if (Date.parse(input.remindAt) <= +now && input.remindAt !== existing?.remindAt) throw new Error('提醒时间已经过去，请调整后保存。');
    }
    const difficulty = input.difficulty === undefined ? (existing?.difficulty || 'easy') : input.difficulty;
    if (!validDifficulty(difficulty)) throw new Error('请选择轻松、普通或挑战。');
    if (existing?.completedAt && difficulty !== existing.difficulty) throw new Error('先撤销完成，再调整任务难度。');
    return { title: input.title.trim(), rawInput: input.rawInput, scheduledDate: input.scheduledDate, remindAt: input.remindAt, difficulty };
  }
  function dismissTaskNotices(state, id, timestamp) {
    state.notices.forEach(n => { if (n.taskIds?.includes(id)) { n.taskIds = n.taskIds.filter(t => t !== id); if (!n.taskIds.length) n.readAt = timestamp; } });
  }
  function applyAction(state, action, now = new Date()) {
    const timestamp = new Date(now).toISOString();
    const coinsBefore = stats(state, now).coins;
    let task;
    if (action.type === 'create') {
      if (typeof action.id !== 'string' || !action.id) throw new Error('任务标识无效。');
      if (state.tasks.some(t => t.id === action.id)) return { changed: false, coinsDelta: 0 };
      const content = validateTask(action.input, now);
      task = { ...content, id: action.id, appearance: appearance(action.id), rewardEarned: 0, createdAt: timestamp, updatedAt: timestamp, completedAt: null, deletedAt: null, reminderDeliveredAt: null };
      state.tasks.push(task);
    } else if (['edit','complete','reopen','delete','restore','snooze'].includes(action.type)) {
      task = state.tasks.find(t => t.id === action.id);
      if (!task) throw new Error('没有找到这只小怪。');
      if (task.deletedAt && action.type !== 'restore') return { changed: false, coinsDelta: 0 };
      if (action.type === 'edit') {
        const content = validateTask(action.input, now, task);
        Object.assign(task, content);
        task.reminderDeliveredAt = null;
        dismissTaskNotices(state, task.id, timestamp);
        // Editing an already-past reminder must not reissue an old notification.
        if (task.remindAt && Date.parse(task.remindAt) <= +now) task.reminderDeliveredAt = timestamp;
      } else if (action.type === 'complete') {
        if (task.completedAt) return { changed: false, coinsDelta: 0 };
        task.completedAt = timestamp; task.rewardEarned = DIFFICULTIES[task.difficulty].reward;
        dismissTaskNotices(state, task.id, timestamp);
      } else if (action.type === 'reopen') {
        if (!task.completedAt) return { changed: false, coinsDelta: 0 };
        task.completedAt = null; task.rewardEarned = 0;
        if (task.remindAt && Date.parse(task.remindAt) <= +now) task.reminderDeliveredAt = timestamp;
      } else if (action.type === 'delete') { task.deletedAt = timestamp; dismissTaskNotices(state, task.id, timestamp); }
      else if (action.type === 'restore') { if (!task.deletedAt) return { changed: false, coinsDelta: 0 }; task.deletedAt = null; }
      else if (action.type === 'snooze') {
        if (task.completedAt) return { changed: false, coinsDelta: 0 };
        task.remindAt = new Date(+now + 600000).toISOString(); task.scheduledDate = dayKey(task.remindAt); task.reminderDeliveredAt = null;
        dismissTaskNotices(state, task.id, timestamp);
      }
      task.updatedAt = timestamp;
    } else if (action.type === 'settings') {
      const p = action.patch;
      if (!p || Object.keys(p).some(k => !['autoLaunch','reviewEnabled','reviewTime','animations','floatPosition'].includes(k))) throw new Error('设置无效。');
      for (const key of ['autoLaunch','reviewEnabled','animations']) if (key in p && typeof p[key] !== 'boolean') throw new Error('设置无效。');
      if ('reviewTime' in p && !/^([01]\d|2[0-3]):[0-5]\d$/.test(p.reviewTime)) throw new Error('回顾时间无效。');
      if ('floatPosition' in p && (!p.floatPosition || !Number.isFinite(p.floatPosition.x) || !Number.isFinite(p.floatPosition.y))) throw new Error('浮标位置无效。');
      Object.assign(state.settings, p);
    } else if (action.type === 'read-notices') {
      state.notices.forEach(n => { if (!n.readAt && (!action.id || n.id === action.id)) n.readAt = timestamp; });
    } else throw new Error('不支持的操作。');
    const coins = stats(state, now).coins;
    const unlockedNow = MILESTONES.filter(m => coins >= m.coins && !state.unlocked.includes(m.coins));
    state.unlocked.push(...unlockedNow.map(m => m.coins));
    return { changed: true, taskId: task?.id, unlockedNow, coinsDelta: coins - coinsBefore };
  }
  function reminderSweep(state, now = new Date()) {
    const timestamp = new Date(now).toISOString(), day = dayKey(now), notices = [];
    const pending = state.tasks.filter(t => !t.deletedAt && !t.completedAt);
    const due = pending.filter(t => t.remindAt && Date.parse(t.remindAt) <= +now && !t.reminderDeliveredAt);
    if (due.length) {
      due.forEach(t => { t.reminderDeliveredAt = timestamp; });
      notices.push({ id: `reminder-${timestamp}`, kind: 'reminder', title: due.length === 1 ? '小怪来敲门' : `${due.length} 只小怪来敲门`, body: due.length === 1 ? due[0].title : `有 ${due.length} 件事情到了提醒时间，点开一起看看。`, taskIds: due.map(t => t.id), createdAt: timestamp, readAt: null });
    }
    let changed = due.length > 0;
    if (state.settings.reviewEnabled && timeKey(now) >= state.settings.reviewTime && state.lastReviewDate !== day) {
      state.lastReviewDate = day; changed = true;
      const overdue = pending.filter(t => t.scheduledDate && t.scheduledDate < day).length;
      const today = pending.filter(t => t.scheduledDate === day).length;
      const unscheduled = pending.filter(t => !t.scheduledDate).length;
      notices.push({ id: `review-${day}`, kind: 'review', title: '营地早报 · 看看今天的安排', body: pending.length ? `今天 ${today} 件 · 逾期 ${overdue} 件 · 未定时间 ${unscheduled} 件` : '营地很安静。今天有什么想完成的小事？', taskIds: [], createdAt: timestamp, readAt: null });
    }
    state.notices.push(...notices);
    state.notices = state.notices.filter(n => !n.readAt || Date.parse(n.readAt) > +now - 30 * 86400000);
    return { changed, notices };
  }
  function validateShape(state, version) {
    if (!state || state.version !== version || !Array.isArray(state.tasks) || !Array.isArray(state.notices) || !Array.isArray(state.unlocked) || !state.settings) throw new Error('数据格式或版本不受支持。');
    const ids = new Set();
    const timestamp = v => v === null || (typeof v === 'string' && Number.isFinite(Date.parse(v)));
    for (const task of state.tasks) {
      if (!task || typeof task.id !== 'string' || !task.id || ids.has(task.id) || typeof task.title !== 'string' || !task.title.trim() || typeof task.rawInput !== 'string' || !Number.isInteger(task.appearance) || task.appearance < 0 || task.appearance > (version === 1 ? 5 : 11) || !(task.scheduledDate === null || validDate(task.scheduledDate)) || !['createdAt','updatedAt','completedAt','deletedAt','remindAt','reminderDeliveredAt'].every(k => timestamp(task[k])) || !task.createdAt || !task.updatedAt) throw new Error('任务记录损坏。');
      if (version === 2 && (!validDifficulty(task.difficulty) || !Number.isInteger(task.rewardEarned) || task.rewardEarned !== (task.completedAt ? DIFFICULTIES[task.difficulty].reward : 0))) throw new Error('任务难度或奖励记录损坏。');
      ids.add(task.id);
    }
    if (!state.unlocked.every(c => MILESTONES.some(m => m.coins === c))) throw new Error('营地记录损坏。');
    if (!['autoLaunch','reviewEnabled','animations'].every(k => typeof state.settings[k] === 'boolean') || !/^([01]\d|2[0-3]):[0-5]\d$/.test(state.settings.reviewTime)) throw new Error('设置记录损坏。');
    if (state.lastReviewDate !== null && !validDate(state.lastReviewDate)) throw new Error('回顾记录损坏。');
    const pos = state.settings.floatPosition;
    if (pos !== null && (!pos || !Number.isFinite(pos.x) || !Number.isFinite(pos.y))) throw new Error('位置记录损坏。');
    for (const n of state.notices) if (!n || typeof n.id !== 'string' || !['reminder','review'].includes(n.kind) || typeof n.title !== 'string' || typeof n.body !== 'string' || !Array.isArray(n.taskIds) || !n.taskIds.every(id => ids.has(id)) || !timestamp(n.createdAt) || !n.createdAt || !timestamp(n.readAt)) throw new Error('提醒记录损坏。');
    return state;
  }
  function validateState(state) { return validateShape(state, 2); }
  function migrateState(state) {
    if (state?.version !== 1) return validateState(state);
    validateShape(state, 1);
    const next = structuredClone(state);
    next.version = 2;
    next.tasks.forEach(task => { task.difficulty = 'easy'; task.rewardEarned = task.completedAt ? 10 : 0; });
    return validateState(next);
  }
  function clampFloat(position, areas, size = 78) {
    const first = areas[0];
    let p = position || { x: first.x + first.width - size, y: first.y + Math.round(first.height * 0.42) };
    const area = areas.find(a => p.x + size / 2 >= a.x && p.x + size / 2 < a.x + a.width && p.y + size / 2 >= a.y && p.y + size / 2 < a.y + a.height) || first;
    const right = p.x + size / 2 >= area.x + area.width / 2;
    return { x: Math.round(right ? area.x + area.width - size : area.x), y: Math.round(Math.max(area.y, Math.min(p.y, area.y + area.height - size))) };
  }
  return { MILESTONES, DIFFICULTIES, dayKey, timeKey, validDate, parseInput, category, stats, initialState, appearance, applyAction, reminderSweep, validateState, migrateState, clampFloat };
});
