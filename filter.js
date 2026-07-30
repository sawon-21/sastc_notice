/**
 * Department Detection & Filtering Module
 */

import { getNoticeDate, getNoticeKey, normalizeSearchText } from './utils.js';
import { deduplicateList, sortNotices } from './api.js';

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

/**
 * NEW Notice Logic:
 * Publish date within the last 7 days (diffDays >= 0 && diffDays <= 7)
 */
export function isNoticeNew(item) {
  const d = getNoticeDate(item);
  if (!d) return false;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  return diffDays >= 0 && diffDays <= 7;
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
 * Department Filter Architecture
 */
export function getItemsForDept(dept, noticesData, resultsData) {
  const combined = deduplicateList([...noticesData, ...resultsData]);

  if (dept === "RESULT") {
    return combined.filter(item => {
      if (!isResultNotice(item)) return false;
      const text = `${item.department || ''} ${item.title || ''}`;
      return detectDeptCode(text) === "SASTC";
    });
  }

  return combined.filter(item => {
    if (isResultNotice(item)) return false;
    const text = `${item.department || ''} ${item.title || ''}`;
    return detectDeptCode(text) === dept;
  });
}

/**
 * Notification Counter Logic
 */
export function updateTabNotificationCounts(noticesData, resultsData, seenNoticeKeys) {
  ALLOWED_DEPTS.forEach(dept => {
    const badgeEl = document.getElementById(`badge-${dept}`);
    if (!badgeEl) return;

    const deptItems = getItemsForDept(dept, noticesData, resultsData);

    const unreadCount = deptItems.filter(item => {
      if (!isNoticeNew(item)) return false;
      const key = getNoticeKey(item);
      return !seenNoticeKeys.has(key);
    }).length;

    if (unreadCount > 0) {
      badgeEl.textContent = unreadCount;
      badgeEl.style.display = "inline-block";
    } else {
      badgeEl.style.display = "none";
    }
  });
}

/**
 * Global Search & Filter Pipeline
 */
export function getFilteredNotices(query, activeDept, noticesData, resultsData) {
  const normalizedQuery = normalizeSearchText(query);
  const allCombined = deduplicateList([...noticesData, ...resultsData]);

  if (normalizedQuery !== "") {
    // GLOBAL SEARCH: Ignore active tab, search across ALL notices and ALL results
    return sortNotices(allCombined.filter(item => {
      const fullText = normalizeSearchText(`${item.title || ""} ${item.department || ""} ${item.category || ""} ${item.date || ""}`);
      return fullText.includes(normalizedQuery);
    }));
  }

  // TAB FILTER: Restore selected tab filter exactly when search is empty
  return sortNotices(getItemsForDept(activeDept, noticesData, resultsData));
}
