/**
 * Main Application Module & Controller
 */

import { loadCachedData, fetchLiveData } from './api.js';
import { 
  indexDataset,
  detectDeptCode, 
  isResultNotice, 
  getDeptIcon, 
  getItemsForDept, 
  updateTabNotificationCounts, 
  getFilteredNotices 
} from './filter.js';
import { 
  escapeHTML, 
  formatPdfUrl, 
  openPdfModal, 
  closePdfModal, 
  copyLink, 
  handleNoticeClick, 
  handlePdfView, 
  debounce,
  initSecurityProtections 
} from './utils.js';

// Global window bindings for inline HTML handlers
window.handleNoticeClick = handleNoticeClick;
window.handlePdfView = handlePdfView;
window.copyLink = copyLink;

// Application State
const LS_ACTIVE_DEPT = "sastc_active_dept";
const LS_SEEN_KEYS = "sastc_seen_keys";

let activeDept = localStorage.getItem(LS_ACTIVE_DEPT) || "SASTC";
let noticesData = [];
let resultsData = [];
let masterDataset = [];
let seenNoticeKeys = new Set();
let deferredPrompt = null;

// DOM Element References
let searchInput, clearBtn, noticeList, noticeCount, deptButtons, offlineBanner, installBtn;

document.addEventListener("DOMContentLoaded", () => {
  // Bind DOM elements
  searchInput = document.getElementById("searchInput");
  clearBtn = document.getElementById("clearBtn");
  noticeList = document.getElementById("noticeList");
  noticeCount = document.getElementById("noticeCount");
  deptButtons = document.querySelectorAll(".dept-btn");
  offlineBanner = document.getElementById("offlineBanner");
  installBtn = document.getElementById("installBtn");

  // Load seen notice keys
  try {
    const savedKeys = JSON.parse(localStorage.getItem(LS_SEEN_KEYS) || "[]");
    seenNoticeKeys = new Set(savedKeys);
  } catch (e) { seenNoticeKeys = new Set(); }

  // Load cached/fallback data immediately
  const cached = loadCachedData();
  noticesData = cached.noticesData;
  resultsData = cached.resultsData;

  // Pre-index master dataset ONCE on startup
  rebuildMasterDataset();

  // Initialize UI State
  initSecurityProtections();
  initEventListeners();
  updateOnlineStatus();

  // Set initial filter tab and render
  setDeptFilter(activeDept);

  // Fetch live API data in background
  fetchLiveData().then(live => {
    if (live.noticesData) noticesData = live.noticesData;
    if (live.resultsData) resultsData = live.resultsData;
    rebuildMasterDataset();
    updateTabNotificationCounts(masterDataset, seenNoticeKeys);
    renderNotices();
  });

  // Image Fallback
  const logoImg = document.getElementById("logoImg");
  if (logoImg) {
    logoImg.onerror = () => {
      logoImg.onerror = null;
      logoImg.src = 'https://placehold.co/48x48/2563eb/ffffff?text=SASTC';
    };
  }
});

/**
 * Rebuilds pre-indexed master dataset whenever noticesData or resultsData change
 */
function rebuildMasterDataset() {
  masterDataset = indexDataset(noticesData, resultsData);
}

/**
 * Service Worker Registration
 */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then(reg => console.log("SW registered successfully:", reg.scope))
      .catch(err => console.warn("SW registration failed:", err));
  });
}

/**
 * Network Status Helper
 */
function updateOnlineStatus() {
  if (offlineBanner) {
    offlineBanner.style.display = navigator.onLine ? "none" : "flex";
  }
}
window.addEventListener("online", () => {
  updateOnlineStatus();
  fetchLiveData().then(live => {
    if (live.noticesData) noticesData = live.noticesData;
    if (live.resultsData) resultsData = live.resultsData;
    rebuildMasterDataset();
    updateTabNotificationCounts(masterDataset, seenNoticeKeys);
    renderNotices();
  });
});
window.addEventListener("offline", updateOnlineStatus);

/**
 * Active Department Filter Handler
 */
function setDeptFilter(dept) {
  activeDept = dept;
  localStorage.setItem(LS_ACTIVE_DEPT, dept);

  // Mark all current NEW notices in this tab as seen
  const deptItems = getItemsForDept(dept, masterDataset);
  deptItems.forEach(item => {
    if (item._isNew) {
      seenNoticeKeys.add(item._key);
    }
  });
  localStorage.setItem(LS_SEEN_KEYS, JSON.stringify(Array.from(seenNoticeKeys)));

  deptButtons.forEach(btn => {
    const selected = btn.dataset.dept === dept;
    btn.classList.toggle("active", selected);
    btn.setAttribute("aria-pressed", selected ? "true" : "false");
  });

  updateTabNotificationCounts(masterDataset, seenNoticeKeys);
  renderNotices();
}

/**
 * Main Render Engine
 */
function renderNotices() {
  const query = searchInput ? searchInput.value : "";
  const filtered = getFilteredNotices(query, activeDept, masterDataset);

  if (noticeCount) {
    noticeCount.textContent = filtered.length;
  }

  if (filtered.length === 0) {
    noticeList.innerHTML = `
      <div class="state-box">
        <i class="fa-regular fa-folder-open"></i>
        <span>No notices found for this selection.</span>
      </div>
    `;
    return;
  }

  noticeList.innerHTML = filtered.map((item) => {
    const isResult = item._isResult !== undefined ? item._isResult : isResultNotice(item);
    const displayBadge = isResult ? "RESULT" : (item._deptCode || detectDeptCode(`${item.department || ''} ${item.title || ''}`));
    const deptIcon = getDeptIcon(displayBadge);

    const isNewNotice = item._isNew;

    const rawLink = item.url || item.pdf_url || item.link || item.pdf || item.result_url || "#";
    const pdfUrl = formatPdfUrl(rawLink);

    const title = escapeHTML(item.title || "Untitled Notice");
    const department = escapeHTML(item.department || "");
    const category = escapeHTML(item.category || (isResult ? "Result" : "General"));
    const date = escapeHTML(item.date || "N/A");

    return `
      <div class="card ${isNewNotice ? 'card-new' : ''}">
        <div class="card-header">
          <div class="badges">
            <span class="badge-dept ${displayBadge}">
              <i class="${deptIcon}"></i> ${displayBadge}
            </span>
            ${isNewNotice ? '<span class="badge-new"><i class="fa-solid fa-bolt"></i> NEW</span>' : ''}
          </div>
          <span class="date"><i class="fa-regular fa-calendar"></i> ${date}</span>
        </div>

        <a href="${pdfUrl || '#'}" class="notice-title" onclick="handleNoticeClick(event, '${pdfUrl}', '${escapeHTML(title)}')">
          ${title}
        </a>

        <div class="card-footer">
          <span class="category-tag">
            <i class="fa-solid fa-tag"></i> ${category}${department ? ` • ${department}` : ""}
          </span>
          <div class="btn-actions">
            <button type="button" class="btn-share" onclick="copyLink('${pdfUrl}')" title="Copy Link">
              <i class="fa-regular fa-copy"></i>
            </button>
            <button type="button" class="btn-view" onclick="handlePdfView(event, '${pdfUrl}', '${escapeHTML(title)}')">
              <span>View PDF</span> <i class="fa-solid fa-arrow-up-right-from-square"></i>
            </button>
          </div>
        </div>
      </div>
    `;
  }).join("");
}

/**
 * Event Listeners Initialization
 */
function initEventListeners() {
  // Department Tab buttons
  deptButtons.forEach(btn => {
    btn.addEventListener("click", () => setDeptFilter(btn.dataset.dept));
  });

  // Debounced Search Input Handler (180ms)
  const debouncedRender = debounce(() => renderNotices(), 180);

  if (searchInput) {
    searchInput.addEventListener("input", () => {
      if (clearBtn) {
        clearBtn.style.display = searchInput.value.trim() ? "block" : "none";
      }
      debouncedRender();
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      searchInput.value = "";
      clearBtn.style.display = "none";
      renderNotices();
    });
  }

  // Modal Controls
  const closeModalBtn = document.getElementById("closeModalBtn");
  const pdfModal = document.getElementById("pdfModal");
  if (closeModalBtn) closeModalBtn.addEventListener("click", closePdfModal);
  if (pdfModal) {
    pdfModal.addEventListener("click", (e) => {
      if (e.target === pdfModal) closePdfModal();
    });
  }

  // PWA Install Prompt
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
    if (installBtn) installBtn.style.display = "inline-flex";
  });

  if (installBtn) {
    installBtn.addEventListener("click", async () => {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        installBtn.style.display = "none";
      }
      deferredPrompt = null;
    });
  }
}




// 1. Configuration
const GEMINI_API_KEY = "AQ.Ab8RN6LjXW83mLjqWXXL42kWQbkDKdaQ76ukKY17JRSSbmhUTA"; // আপনার Gemini API Key দিন
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;

const SYSTEM_INSTRUCTION = `You are the official AI Assistant for "SASTC Portal (HSTU Sync)". Your job is to help HSTU students find relevant university notices based on the notice context provided to you.
Rules:
1. Language: Always respond in polite Bengali.
2. Accuracy: Use ONLY the provided notice data/context to answer. Never invent dates or details.
3. Concise Summary: Give a 1-2 sentence direct answer highlighting key details.
4. Fallback: If no relevant notice is found, say: "দুঃখিত, এই সংক্রান্ত কোনো নোটিশ পোর্টালে পাওয়া যায়নি।"`;

// 2. DOM Elements
const toggleBtn = document.getElementById("chat-toggle-btn");
const closeBtn = document.getElementById("chat-close-btn");
const chatWindow = document.getElementById("chat-window");
const sendBtn = document.getElementById("chat-send-btn");
const chatInput = document.getElementById("chat-input");
const messagesContainer = document.getElementById("chat-messages");

// 3. UI Toggle Handlers
toggleBtn.addEventListener("click", () => chatWindow.classList.toggle("chat-hidden"));
closeBtn.addEventListener("click", () => chatWindow.classList.add("chat-hidden"));

// 4. Send Message Event
sendBtn.addEventListener("click", handleSendMessage);
chatInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter") handleSendMessage();
});

async function handleSendMessage() {
  const query = chatInput.value.trim();
  if (!query) return;

  // Render User Message
  appendMessage(query, "user-message");
  chatInput.value = "";

  // Render Loading Indicator
  const loadingMsg = appendMessage("চিন্তা করছি...", "bot-message");

  // Fetch Data & Call API
  const response = await fetchNoticeDataAndAskGemini(query);
  
  // Replace Loading with AI Response
  loadingMsg.innerText = response;
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function appendMessage(text, className) {
  const msgDiv = document.createElement("div");
  msgDiv.className = `message ${className}`;
  msgDiv.innerText = text;
  messagesContainer.appendChild(msgDiv);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
  return msgDiv;
}

// 5. Get Cached Notices & Call Gemini API
async function fetchNoticeDataAndAskGemini(userQuery) {
  // আপনার ওয়েবসাইটের বিদ্যমান নোটিশ ডাটা অ্যারে সংগ্রহ (উদাহরণস্বরূপ window.cachedNotices)
  const currentNotices = window.cachedNotices || []; 

  const payload = {
    system_instruction: {
      parts: [{ text: SYSTEM_INSTRUCTION }]
    },
    contents: [
      {
        role: "user",
        parts: [
          { 
            text: `বর্তমান নোটিশ লিস্ট:\n${JSON.stringify(currentNotices)}\n\nব্যবহারকারীর প্রশ্ন: ${userQuery}` 
          }
        ]
      }
    ]
  };

  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (data.candidates && data.candidates[0].content.parts[0].text) {
      return data.candidates[0].content.parts[0].text;
    }
    return "দুঃখিত, উত্তর তৈরি করতে সমস্যা হয়েছে।";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "নেটওয়ার্ক ত্রুটি! অনুগ্রহ করে আবার চেষ্টা করুন।";
  }
}
