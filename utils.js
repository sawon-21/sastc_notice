/**
 * Utility functions for SASTC Portal
 */

export function escapeHTML(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function normalizeSearchText(text) {
  if (!text) return "";
  return String(text)
    .toLowerCase()
    .replace(/[।\,\-\_\.\:\;\']/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function getNoticeKey(item) {
  return item._key || `${item.title || ''}_${item.date || ''}_${item.url || item.pdf_url || item.link || ''}`;
}

export function getNoticeDate(item) {
  if (!item || !item.date) return null;
  const d = new Date(item.date);
  return isNaN(d.getTime()) ? null : d;
}

export function formatPdfUrl(rawLink) {
  if (!rawLink || rawLink === "#") return "";
  let url = String(rawLink).trim();
  if (url.startsWith("/")) {
    url = "https://hstu.ac.bd" + url;
  } else if (!url.startsWith("http://") && !url.startsWith("https://")) {
    url = "https://" + url;
  }
  return url;
}

/**
 * Debounce helper for fast and smooth search input
 */
export function debounce(func, wait = 180) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

export function openPdfModal(url, title) {
  const modal = document.getElementById("pdfModal");
  const pdfFrame = document.getElementById("pdfFrame");
  const modalTitle = document.getElementById("modalNoticeTitle");
  const modalDirectLink = document.getElementById("modalDirectLink");

  if (!modal || !pdfFrame) return;

  modalTitle.textContent = title || "Notice Document";
  modalDirectLink.href = url || "#";

  if (url && url !== "#") {
    if (url.endsWith(".pdf") || url.includes("/pdf") || url.includes("drive.google")) {
      pdfFrame.src = `https://docs.google.com/viewer?url=${encodeURIComponent(url)}&embedded=true`;
    } else {
      pdfFrame.src = url;
    }
  } else {
    pdfFrame.src = "about:blank";
  }

  modal.classList.add("active");
}

export function closePdfModal() {
  const modal = document.getElementById("pdfModal");
  const pdfFrame = document.getElementById("pdfFrame");
  if (modal) modal.classList.remove("active");
  if (pdfFrame) pdfFrame.src = "about:blank";
}

let toastTimer;
export function showToast(message, iconClass = "fa-circle-check") {
  const toast = document.getElementById("toast");
  const toastMsg = document.getElementById("toastMsg");
  const toastIcon = document.getElementById("toastIcon");
  if (!toast || !toastMsg) return;

  toastMsg.textContent = message;
  if (toastIcon) toastIcon.className = `fa-solid ${iconClass}`;
  toast.classList.add("show");

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove("show");
  }, 2500);
}

export function copyLink(url) {
  if (!url || url === "#") {
    showToast("No valid link available to copy", "fa-circle-exclamation");
    return;
  }

  const textArea = document.createElement("textarea");
  textArea.value = url;
  textArea.style.position = "fixed";
  textArea.style.left = "-9999px";
  document.body.appendChild(textArea);
  textArea.select();
  try {
    document.execCommand("copy");
    showToast("Link copied to clipboard!", "fa-circle-check");
  } catch (err) {
    showToast("Failed to copy link", "fa-circle-xmark");
  }
  document.body.removeChild(textArea);
}

export function handleNoticeClick(e, url, title) {
  if (e) e.preventDefault();
  if (url && url !== "#") openPdfModal(url, title);
}

export function handlePdfView(e, url, title) {
  if (e) e.preventDefault();
  if (url && url !== "#") {
    openPdfModal(url, title);
  } else {
    showToast("PDF document link unavailable", "fa-circle-exclamation");
  }
}

export function initSecurityProtections() {
  document.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    return false;
  });

  document.addEventListener("dragstart", (e) => e.preventDefault());

  document.addEventListener("selectstart", (e) => {
    if (e.target.tagName !== "INPUT" && e.target.tagName !== "TEXTAREA") {
      e.preventDefault();
    }
  });

  document.addEventListener("keydown", (e) => {
    const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
    const modifier = isMac ? e.metaKey : e.ctrlKey;
    const keyLower = (e.key || "").toLowerCase();

    const isF12 = e.key === "F12" || e.keyCode === 123;
    const isInspect = modifier && e.shiftKey && (keyLower === "i" || keyLower === "j" || keyLower === "c");
    const isViewSource = modifier && keyLower === "u";
    const isSavePage = modifier && keyLower === "s";
    const isPrint = modifier && keyLower === "p";
    const isSelectAll = modifier && keyLower === "a" && e.target.tagName !== "INPUT";

    if (isF12 || isInspect || isViewSource || isSavePage || isPrint || isSelectAll) {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }
  });
}

/**
 * Calculates and returns tag text and CSS class based on creation timestamp.
 * @param {string|number|Date} dateInput - Created date/timestamp
 * @returns {{ text: string, className: string } | null}
 */
export function getTagInfo(dateInput) {
  if (!dateInput) return null;

  const createdDate = new Date(dateInput);
  const now = new Date();
  const diffInMs = now - createdDate;

  // Invalid date or future date check
  if (isNaN(createdDate.getTime()) || diffInMs < 0) return null;

  const diffInHours = diffInMs / (1000 * 60 * 60);

  // Less than 24 hours -> NEW Tag
  if (diffInHours < 24) {
    return { text: 'NEW', className: 'tag-new' };
  }

  // Calculate full days passed
  const diffInDays = Math.floor(diffInHours / 24);

  // 1 to 3 days ago
  if (diffInDays >= 1 && diffInDays <= 3) {
    const label = `${diffInDays} ${diffInDays === 1 ? 'day' : 'days'} ago`;
    return { text: label, className: 'tag-recent' };
  }

  // Older than 3 days -> No Tag
  return null;
}

/**
 * Helper to format standard dates
 */
export function formatDate(dateInput) {
  if (!dateInput) return "";
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}
