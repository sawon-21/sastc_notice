import { initializeApp } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-app.js";
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signInWithRedirect,
  getRedirectResult,
  onAuthStateChanged, 
  signOut 
} from "https://www.gstatic.com/firebasejs/12.17.0/firebase-auth.js";
import { 
  getFirestore, 
  collection, 
  addDoc, 
  getDocs, 
  deleteDoc,
  doc,
  query, 
  serverTimestamp 
} from "https://www.gstatic.com/firebasejs/12.17.0/firebase-firestore.js";

// Whitelisted Admin Emails
const ALLOWED_ADMIN_EMAILS = [
  "mehedialhasansawon@gmail.com",
  "nihokaita@gmail.com"
];

// Firebase Setup Config
const firebaseConfig = {
  apiKey: "AIzaSyCwsKB0jN8YquS7O8RkAmXLeoXJmYh-m1Q",
  authDomain: "sastcportal.firebaseapp.com",
  projectId: "sastcportal",
  storageBucket: "sastcportal.firebasestorage.app",
  messagingSenderId: "1094320731520",
  appId: "1:1094320731520:web:3974776c8eb12423327d65",
  measurementId: "G-KJH08WZ77J"
};

// Initialize Firebase Services
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

// DOM Elements
const loginSection = document.getElementById("loginSection");
const unauthorizedSection = document.getElementById("unauthorizedSection");
const dashboardSection = document.getElementById("dashboardSection");

const userInfoArea = document.getElementById("userInfoArea");
const userEmailSpan = document.getElementById("userEmail");
const userAvatarImg = document.getElementById("userAvatar");

const googleLoginBtn = document.getElementById("googleLoginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const unauthLogoutBtn = document.getElementById("unauthLogoutBtn");

const noticeForm = document.getElementById("noticeForm");
const loginAlert = document.getElementById("loginAlert");
const publishAlert = document.getElementById("publishAlert");

const recentNoticesBody = document.getElementById("recentNoticesBody");
const tableSearchInput = document.getElementById("tableSearchInput");

let loadedNotices = [];

// Initialize Default Date to Today
const noticeDateInput = document.getElementById("noticeDate");
if (noticeDateInput) {
  noticeDateInput.valueAsDate = new Date();
}

// Handle Redirect Login Results
getRedirectResult(auth).catch((error) => {
  console.error("Redirect Login Error:", error);
});

// 1. Auth State Observer
onAuthStateChanged(auth, (user) => {
  if (user) {
    const email = (user.email || "").toLowerCase();
    
    // Check Email Whitelist
    if (ALLOWED_ADMIN_EMAILS.length === 0 || ALLOWED_ADMIN_EMAILS.map(e => e.toLowerCase()).includes(email)) {
      userEmailSpan.innerText = user.email;
      if (user.photoURL) {
        userAvatarImg.src = user.photoURL;
        userAvatarImg.style.display = "block";
      }

      loginSection.classList.add("hidden");
      unauthorizedSection.classList.add("hidden");
      dashboardSection.classList.remove("hidden");
      userInfoArea.classList.remove("hidden");

      loadPublishedNotices();
    } else {
      loginSection.classList.add("hidden");
      dashboardSection.classList.add("hidden");
      userInfoArea.classList.add("hidden");
      unauthorizedSection.classList.remove("hidden");
    }
  } else {
    loginSection.classList.remove("hidden");
    unauthorizedSection.classList.add("hidden");
    dashboardSection.classList.add("hidden");
    userInfoArea.classList.add("hidden");
  }
});

// 2. Google Login Action
googleLoginBtn.addEventListener("click", async () => {
  hideAlert(loginAlert);
  try {
    await signInWithPopup(auth, googleProvider);
  } catch (error) {
    if (error.code === 'auth/popup-blocked' || error.code === 'auth/popup-closed-by-user') {
      try {
        await signInWithRedirect(auth, googleProvider);
      } catch (redirectErr) {
        showAlert(loginAlert, "danger", "Failed to sign in. Please allow browser popups.");
      }
    } else {
      showAlert(loginAlert, "danger", `Sign-in Error: ${error.message}`);
    }
  }
});

// Logout Events
const logout = () => signOut(auth);
if (logoutBtn) logoutBtn.addEventListener("click", logout);
if (unauthLogoutBtn) unauthLogoutBtn.addEventListener("click", logout);

// 3. Publish Notice Handler
noticeForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const publishBtn = document.getElementById("publishBtn");

  const title = document.getElementById("noticeTitle").value.trim();
  const department = document.getElementById("noticeDept").value;
  const category = document.getElementById("noticeCategory").value;
  const date = document.getElementById("noticeDate").value;
  const description = document.getElementById("noticeDescription").value.trim();
  const pdfUrl = document.getElementById("pdfUrl").value.trim();

  if (!title || !description || !date) {
    showAlert(publishAlert, "danger", "Please fill in all required fields.");
    return;
  }

  publishBtn.disabled = true;
  publishBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin me-1"></i> Publishing...`;

  try {
    await addDoc(collection(db, "notices"), {
      title: title,
      department: department,
      category: category,
      date: date,
      description: description,
      pdf_url: pdfUrl || "",
      createdAt: serverTimestamp()
    });

    showAlert(publishAlert, "success", "Notice published successfully!");
    noticeForm.reset();
    if (noticeDateInput) noticeDateInput.valueAsDate = new Date();
    
    loadPublishedNotices();
  } catch (err) {
    console.error("Firestore Save Error: ", err);
    showAlert(publishAlert, "danger", "Failed to publish notice. Check your Firestore rules.");
  } finally {
    publishBtn.disabled = false;
    publishBtn.innerHTML = `Publish Broadcast`;
  }
});

// 4. Load Published Notices Table
async function loadPublishedNotices() {
  if (!recentNoticesBody) return;
  recentNoticesBody.innerHTML = `
    <tr>
      <td colspan="6" class="text-center text-muted py-5">
        <i class="fa-solid fa-spinner fa-spin me-2"></i> Loading published notices...
      </td>
    </tr>`;

  try {
    const q = query(collection(db, "notices"));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      recentNoticesBody.innerHTML = `
        <tr>
          <td colspan="6" class="text-center text-muted py-5">
            No notices published yet.
          </td>
        </tr>`;
      return;
    }

    loadedNotices = [];
    querySnapshot.forEach((docSnap) => {
      loadedNotices.push({ id: docSnap.id, ...docSnap.data() });
    });

    // Client-side Sort Descending by Date
    loadedNotices.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

    renderNoticesTable(loadedNotices);
  } catch (err) {
    console.error("Fetch Error:", err);
    recentNoticesBody.innerHTML = `
      <tr>
        <td colspan="6" class="text-center text-danger py-5">
          Error loading notices.
        </td>
      </tr>`;
  }
}

// Render Table Rows
function renderNoticesTable(notices) {
  if (notices.length === 0) {
    recentNoticesBody.innerHTML = `
      <tr>
        <td colspan="6" class="text-center text-muted py-5">
          No matching notices found.
        </td>
      </tr>`;
    return;
  }

  let html = "";
  notices.forEach((item) => {
    const formattedDesc = autoLinkify(escapeHTML(item.description || ''));
    const pdfLinkHtml = item.pdf_url 
      ? `<a href="${escapeHTML(item.pdf_url)}" target="_blank" class="btn btn-sm btn-outline-danger py-0 px-2 fs-7 fw-semibold"><i class="fa-solid fa-file-pdf me-1"></i> PDF</a>`
      : `<span class="text-muted">-</span>`;

    html += `
      <tr class="bento-table-row">
        <td class="text-nowrap fw-medium text-secondary align-middle">${escapeHTML(item.date || 'N/A')}</td>
        <td class="align-middle">
          <div class="fw-bold text-dark mb-1">${escapeHTML(item.title)}</div>
          <div class="notice-cell-desc fs-7">${formattedDesc}</div>
        </td>
        <td class="align-middle text-center"><span class="badge bento-badge-dept">${escapeHTML(item.department || 'SASTC')}</span></td>
        <td class="align-middle text-center"><span class="badge bento-badge-cat">${escapeHTML(item.category || 'General')}</span></td>
        <td class="align-middle text-center">${pdfLinkHtml}</td>
        <td class="text-end align-middle">
          <button class="btn btn-sm text-secondary hover-danger fw-semibold px-2 py-1 transition" onclick="window.deleteNotice('${item.id}', '${escapeHTML(item.title)}')">
            <i class="fa-solid fa-trash"></i>
          </button>
        </td>
      </tr>
    `;
  });

  recentNoticesBody.innerHTML = html;
}

// Filter Table Search
if (tableSearchInput) {
  tableSearchInput.addEventListener("input", (e) => {
    const queryText = e.target.value.toLowerCase().trim();
    const filtered = loadedNotices.filter(n => 
      (n.title || "").toLowerCase().includes(queryText) ||
      (n.department || "").toLowerCase().includes(queryText) ||
      (n.category || "").toLowerCase().includes(queryText)
    );
    renderNoticesTable(filtered);
  });
}

// 5. Delete Notice Action
window.deleteNotice = async function(id, title) {
  const confirmDelete = confirm(`Are you sure you want to delete "${title}"?`);
  if (!confirmDelete) return;

  try {
    await deleteDoc(doc(db, "notices", id));
    showAlert(publishAlert, "success", "Notice deleted successfully.");
    loadPublishedNotices();
  } catch (err) {
    console.error("Delete Error:", err);
    showAlert(publishAlert, "danger", "Failed to delete notice.");
  }
};

// Helper Utility Functions
function showAlert(element, type, message) {
  if (!element) return;
  element.className = `alert alert-${type} fs-7 mb-3 bento-alert`;
  element.innerText = message;
  element.classList.remove("hidden");
  setTimeout(() => hideAlert(element), 5000);
}

function hideAlert(element) {
  if (element) element.classList.add("hidden");
}

function escapeHTML(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Converts plain text URLs inside description into clickable anchor links
function autoLinkify(text) {
  const urlPattern = /(https?:\/\/[^\s]+)/g;
  return text.replace(urlPattern, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
}
