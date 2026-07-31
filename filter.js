/**
 * Department Detection & Filtering Module
 */

import { getNoticeDate, getNoticeKey, normalizeSearchText } from './utils.js';

export const ALLOWED_DEPTS = ["RESULT", "SASTC", "CSE", "AG", "BBA"];

/**
 * Department Detection Logic
 */
export function detectDeptCode(text) {
  const clean = String(text || "").toUpperCase().replace(/\./g, " ");

  // 1. SASTC
  if (/\bSASTC\b/i.test(clean)) {
    return "SASTC";
  }

  // 2. CSE
  if (/\b(CSE|COMPUTER|COMPUTING|সিএসই|কম্পিউটার)\b/i.test(clean)) {
    return "CSE";
  }

  // 3. BBA & Management
  if (/\b(BBA|BUSINESS|MANAGEMENT|ACCOUNTING|FINANCE|MARKETING|MANAGEMENT STUDIES|ব্যবসায়|ব্যবস্থাপনা|বিবিএ)\b/i.test(clean)) {
    return "BBA";
  }

  // 4. Agriculture (AG) - excludes Agricultural Engineering
  if (/\b(AG\s*ENGG|AGRICULTURAL\s*ENG|AGRICULTURAL\s*ENGINEERING|কৃষি\s*প্রকৌশল)\b/i.test(clean)) {
    return "GENERAL";
  }
  if (/\b(AG|AGRICULTURE|AGRICULTURAL|CROP|HORTICULTURE|SOIL|PLANT|AGRONOMY|AGRICULTURIST|কৃষি)\b/i.test(clean)) {
    return "AG";
  }

  return "GENERAL";
}

export function isResultNotice(item) {
  if (!item) return false;
  if (item.isResultApi || item.category === "Result" || item.category === "ফলাফল") return true;
  const text = `${item.category || ''} ${item.title || ''} ${item.department || ''}`.toLowerCase();
  return text.includes("result") || text.includes("ফলাফল");
}

export function isNoticeNew(item) {
  const d = getNoticeDate(item);
  if (!d) return false;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  return diffDays >= 0 && diffDays <= 1;
}

export function getDeptIcon(dept) {
  switch (dept) {
    case "SASTC": return "fa-solid fa-microchip";
    case "CSE": return "fa-solid fa-code";
    case "AG": return "fa-solid fa-wheat-awn";
    case "BBA": return "fa-solid fa-chart-line";
    case "RESULT": return "fa-solid fa-square-poll-vertical";
    default: return "fa-solid fa-building-columns";
  }
}

/**
 * Pre-indexes items ONCE when data is loaded/updated.
 * Pre-computes key, dept code, result status, new status, timestamp, and searchable text.
 */
export function indexDataset(noticesData, resultsData) {
  const combined = [...noticesData, ...resultsData];
  const seen = new Set();
  const masterDataset = [];

  for (let i = 0; i < combined.length; i++) {
    const item = combined[i];
    const key = item._key || getNoticeKey(item);

    if (seen.has(key)) continue;
    seen.add(key);

    const deptCode = item._deptCode || detectDeptCode(`${item.department || ''} ${item.title || ''}`);
    const isResult = item._isResult !== undefined ? item._isResult : isResultNotice(item);
    const searchableText = item._searchableText || normalizeSearchText(`${item.title || ""} ${item.department || ""} ${item.category || ""} ${item.date || ""}`);
    const dateObj = getNoticeDate(item);
    const dateMs = item._dateMs !== undefined ? item._dateMs : (dateObj ? dateObj.getTime() : 0);
    const isNew = isNoticeNew(item);

    masterDataset.push({
      ...item,
      _key: key,
      _deptCode: deptCode,
      _isResult: isResult,
      _searchableText: searchableText,
      _dateMs: dateMs,
      _isNew: isNew
    });
  }

  // Pre-sort master dataset by dateMs descending
  masterDataset.sort((a, b) => b._dateMs - a._dateMs);

  return masterDataset;
}

/**
 * Get pre-indexed items for a specific department
 */
export function getItemsForDept(dept, masterDataset) {
  if (dept === "RESULT") {
    return masterDataset.filter(item => item._isResult && item._deptCode === "SASTC");
  }

  return masterDataset.filter(item => !item._isResult && item._deptCode === dept);
}

/**
 * Notification Counter Logic using pre-indexed master dataset
 */
export function updateTabNotificationCounts(masterDataset, seenNoticeKeys) {
  ALLOWED_DEPTS.forEach(dept => {
    const badgeEl = document.getElementById(`badge-${dept}`);
    if (!badgeEl) return;

    const deptItems = getItemsForDept(dept, masterDataset);

    let unreadCount = 0;
    for (let i = 0; i < deptItems.length; i++) {
      const item = deptItems[i];
      if (item._isNew && !seenNoticeKeys.has(item._key)) {
        unreadCount++;
      }
    }

    if (unreadCount > 0) {
      badgeEl.textContent = unreadCount;
      badgeEl.style.display = "inline-block";
    } else {
      badgeEl.style.display = "none";
    }
  });
}

/**
 * Fast & Smooth Search Engine using pre-indexed dataset
 * - Reuses pre-computed _searchableText & _dateMs
 * - Zero array merging or re-indexing during keypress
 */
export function getFilteredNotices(query, activeDept, masterDataset) {
  const normalizedQuery = normalizeSearchText(query);

  // Restore exact department items if search is empty
  if (!normalizedQuery) {
    return getItemsForDept(activeDept, masterDataset);
  }

  const tokens = normalizedQuery.split(" ").filter(t => t.length > 0);
  if (tokens.length === 0) {
    return getItemsForDept(activeDept, masterDataset);
  }

  const numTokens = tokens.length;
  const scoredItems = [];

  for (let i = 0; i < masterDataset.length; i++) {
    const item = masterDataset[i];
    const text = item._searchableText;
    let score = 0;

    for (let j = 0; j < numTokens; j++) {
      if (text.includes(tokens[j])) {
        score++;
      }
    }

    if (score > 0) {
      scoredItems.push({
        item,
        score,
        dateMs: item._dateMs
      });
    }
  }

  // Rank by match score descending, then dateMs descending
  scoredItems.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return b.dateMs - a.dateMs;
  });

  return scoredItems.map(s => s.item);
}
