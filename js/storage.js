// ============================================================
// FileForge Storage — localStorage history & recent files
// ============================================================
const Storage = (() => {
  const HIST_KEY = 'fileforge_history';
  const RECENT_KEY = 'fileforge_recent';

  // --- History ---
  function getHistory() {
    try { return JSON.parse(localStorage.getItem(HIST_KEY)) || []; }
    catch { return []; }
  }

  function saveHistory(srcName, outName, type) {
    const list = getHistory();
    list.unshift({
      id: Date.now(),
      src: srcName,
      out: outName,
      type: type,
      time: new Date().toLocaleString('zh-CN')
    });
    if (list.length > 50) list.length = 50;
    localStorage.setItem(HIST_KEY, JSON.stringify(list));
  }

  function clearHistory() {
    localStorage.removeItem(HIST_KEY);
  }

  // --- Recent Files ---
  function getRecent() {
    try { return JSON.parse(localStorage.getItem(RECENT_KEY)) || []; }
    catch { return []; }
  }

  function addRecent(name, type, status) {
    const list = getRecent().filter(f => f.name !== name);
    list.unshift({ name, type, status, time: Date.now() });
    if (list.length > 10) list.length = 10;
    localStorage.setItem(RECENT_KEY, JSON.stringify(list));
  }

  function clearRecent() {
    localStorage.removeItem(RECENT_KEY);
  }

  return { getHistory, saveHistory, clearHistory, getRecent, addRecent, clearRecent };
})();
