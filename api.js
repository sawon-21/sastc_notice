/**
 * API and Data Fetching Module
 */

import { getNoticeKey } from './utils.js';

export const NOTICES_API_URL = "https://raw.githubusercontent.com/sawon-21/hstu-notice/main/notices.json";
export const RESULTS_API_URL = "https://raw.githubusercontent.com/sawon-21/hstu-notice/refs/heads/main/results.json";

export const LS_NOTICES_CACHE = "sastc_notices_cache";
export const LS_RESULTS_CACHE = "sastc_results_cache";

export function parseResponseData(data) {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.notices)) return data.notices;
  if (data && Array.isArray(data.results)) return data.results;
  if (data && Array.isArray(data.data)) return data.data;
  return [];
}

export function deduplicateList(list) {
  const seen = new Set();
  return list.filter(item => {
    const key = getNoticeKey(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function sortNotices(list) {
  return [...list].sort((a, b) => {
    const da = new Date(a.date || 0).getTime();
    const db = new Date(b.date || 0).getTime();
    return db - da;
  });
}

export function getFallbackNoticesData() {
  const d = (daysAgo) => {
    const date = new Date(Date.now() - daysAgo * 86400000);
    return date.toISOString().split('T')[0];
  };

  return [
    {
      "title": "SASTC Department Academic Class Routine and Exam Schedule",
      "date": d(1),
      "department": "SASTC",
      "category": "Routine",
      "url": "https://hstu.ac.bd/uploads/notice/sastc_routine.pdf"
    },
    {
      "title": "CSE 3rd Year 1st Semester Final Examination Schedule Published",
      "date": d(2),
      "department": "Computer Science and Engineering (CSE)",
      "category": "Routine",
      "url": "https://hstu.ac.bd/uploads/notice/cse_exam.pdf"
    },
    {
      "title": "BBA Management & Accounting Course Midterm Examination Routine",
      "date": d(3),
      "department": "Business Administration (BBA)",
      "category": "Routine",
      "url": "https://hstu.ac.bd/uploads/notice/bba_mid.pdf"
    },
    {
      "title": "Faculty of Agriculture (AG) MS Thesis Submission Notice",
      "date": d(10),
      "department": "Faculty of Agriculture (AG)",
      "category": "Academic",
      "url": "https://hstu.ac.bd/uploads/notice/ag_thesis.pdf"
    }
  ];
}

export function getFallbackResultsData() {
  const d = (daysAgo) => {
    const date = new Date(Date.now() - daysAgo * 86400000);
    return date.toISOString().split('T')[0];
  };

  return [
    {
      "title": "SASTC 2nd Year 2nd Semester Final Examination Result Published",
      "date": d(2),
      "department": "SASTC",
      "category": "Result",
      "url": "https://hstu.ac.bd/uploads/results/sastc_2_2_result.pdf",
      "isResultApi": true
    },
    {
      "title": "SASTC 1st Year 1st Semester Academic Result Announcement",
      "date": d(12),
      "department": "SASTC",
      "category": "Result",
      "url": "https://hstu.ac.bd/uploads/results/sastc_1_1_result.pdf",
      "isResultApi": true
    }
  ];
}

export function loadCachedData() {
  let notices = [];
  let results = [];

  try {
    notices = JSON.parse(localStorage.getItem(LS_NOTICES_CACHE) || "[]");
  } catch (e) { notices = []; }

  try {
    results = JSON.parse(localStorage.getItem(LS_RESULTS_CACHE) || "[]");
  } catch (e) { results = []; }

  if (!Array.isArray(notices) || notices.length === 0) {
    notices = getFallbackNoticesData();
  }
  if (!Array.isArray(results) || results.length === 0) {
    results = getFallbackResultsData();
  }

  return { noticesData: notices, resultsData: results };
}

export async function fetchLiveData() {
  try {
    const [noticesRes, resultsRes] = await Promise.allSettled([
      fetch(NOTICES_API_URL).then(res => res.ok ? res.json() : Promise.reject("Notices fetch failed")),
      fetch(RESULTS_API_URL).then(res => res.ok ? res.json() : Promise.reject("Results fetch failed"))
    ]);

    let notices = [];
    let results = [];

    if (noticesRes.status === "fulfilled") {
      const rawList = parseResponseData(noticesRes.value);
      if (rawList.length > 0) {
        notices = rawList;
        localStorage.setItem(LS_NOTICES_CACHE, JSON.stringify(notices));
      }
    }

    if (resultsRes.status === "fulfilled") {
      const rawResults = parseResponseData(resultsRes.value);
      if (rawResults.length > 0) {
        results = rawResults.map(item => ({
          ...item,
          category: item.category || "Result",
          isResultApi: true
        }));
        localStorage.setItem(LS_RESULTS_CACHE, JSON.stringify(results));
      }
    }

    return {
      noticesData: notices.length > 0 ? notices : null,
      resultsData: results.length > 0 ? results : null
    };
  } catch (err) {
    console.warn("External API fetch failed; operating on cached/fallback data.", err);
    return { noticesData: null, resultsData: null };
  }
}
