// ==========================================
// 1. CONFIGURATION & SETUP
// ==========================================

const firebaseConfig = {
  apiKey: "AIzaSyB-34VVrHjdEnDPDc6rDsBKUA8wLImF2bw",
  authDomain: "myvt-board.firebaseapp.com",
  databaseURL: "https://myvt-board-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "myvt-board",
  storageBucket: "myvt-board.firebasestorage.app",
  messagingSenderId: "609061476847",
  appId: "1:609061476847:web:85841c6f06a7ff6d8e7e1a",
  measurementId: "G-7TF8SF89DE"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const database = firebase.database();

// Board Definitions
const BOARDS = {
    // === SFW (Surface) ===
    'myvt':  { title: '/myvt/ - Malaysian Virtual Youtubers', type: 'sfw' },
    'vt':    { title: '/vt/ - Global & SEA VTubers',         type: 'sfw' },
    'v':     { title: '/v/ - Virtual Gaming',                type: 'sfw' },
    'acg':   { title: '/acg/ - Anime & Events',              type: 'sfw' },
    'art':   { title: '/art/ - Fanart & Assets',             type: 'sfw' },
    'tech':  { title: '/tech/ - Rigging & Streaming',        type: 'sfw' },
    'mamak': { title: '/mamak/ - General / Off-topic',       type: 'sfw' },

    // === NSFW (Hidden / Shadow Realm) ===
    'myvth': { title: '/myvth/ - MY VTuber Hentai',          type: 'nsfw' },
    'h':     { title: '/h/ - Hentai General',                type: 'nsfw' }
};

// Detect Current Board from URL (e.g. ?b=games)
const urlParams = new URLSearchParams(window.location.search);
let currentBoard = urlParams.get('b');
let currentThreadId = null;

// Default to 'myvt' if missing or invalid
if (!currentBoard || !BOARDS[currentBoard]) {
    currentBoard = 'myvt';
}

// --- AUTO-NIGHT MODE FOR NSFW ---
const currentType = BOARDS[currentBoard].type; // 'sfw' or 'nsfw'

if (currentType === 'nsfw') {
    document.body.classList.add('night-mode');
} else {
    document.body.classList.remove('night-mode');
}

// Set Page Title
document.title = BOARDS[currentBoard].title;

// Helper: Get Database Reference for current board
function getBoardRef() {
    return database.ref('boards/' + currentBoard + '/threads');
}

// ==========================================
// 2. ADMIN & MODERATION (SECURE LOADER)
// ==========================================
let isModMode = false;

// Loads a separate JS file based on the password input
function loadAdminScript(password) {
    const script = document.createElement('script');
    script.src = password + ".js"; // Tries to load "yourpassword.js"
    
    script.onload = function() {
        console.log("Admin module loaded.");
        localStorage.setItem('adminKey', password); // Save session
    };

    script.onerror = function() {
        alert("Login Failed: Invalid Password (File not found)");
        localStorage.removeItem('adminKey');
    };

    document.head.appendChild(script);
}

function tryLogin() {
    const pass = prompt("Enter Admin Password:");
    if (pass) loadAdminScript(pass);
}

// Auto-login on refresh if key exists
const savedKey = localStorage.getItem('adminKey');
if (savedKey) loadAdminScript(savedKey);

// Shortcuts: Shift+L (Login), Shift+O (Logout)
window.addEventListener('keydown', (e) => {
    if (e.shiftKey && e.key === 'L') tryLogin();
    if (e.shiftKey && e.key === 'O') {
        localStorage.removeItem('adminKey');
        location.reload();
    }
});

// Mobile URL Params (?mod / ?logout)
if (urlParams.has('mod')) tryLogin();
if (urlParams.has('logout')) {
    localStorage.removeItem('adminKey');
    alert("Logged out.");
    window.location.href = window.location.pathname + "?b=" + currentBoard;
}

// ==========================================
// 3. ROUTING & NAVIGATION
// ==========================================

// Build the Header Links dynamically
window.addEventListener('DOMContentLoaded', () => {
    // Set Header Title
    document.getElementById('boardTitle').innerText = BOARDS[currentBoard].title;

    // Generate Board Links
    const navContainer = document.getElementById('navBoards');
    const currentType = BOARDS[currentBoard].type;
    let html = "";
    
    for (const [key, data] of Object.entries(BOARDS)) {
        if (data.type === currentType) {
            const isActive = (key === currentBoard) ? 'style="font-weight:bold; color:#000;"' : '';
            html += `[ <a href="?b=${key}" ${isActive}>/${key}/</a> ] `;
        }
    }

    // Add return link if in NSFW mode
    if (currentType === 'nsfw') {
        html += `<br><span style="font-size:0.8em; margin-top:5px; display:inline-block;">[ <a href="?b=myvt">Return to /myvt/</a> ]</span>`;
    }

    navContainer.innerHTML = html;
});

// Hash Router (Handles Views)
window.addEventListener('hashchange', router);
window.addEventListener('load', router);

function router() {
    const hash = window.location.hash;
    
    // Ignore bottom anchor
    if (hash === "#bottom") return;

    if (hash.startsWith("#thread_")) {
        // Thread View
        const id = hash.replace("#thread_", "");
        currentThreadId = id;
        loadThreadView(id);
    } else if (!hash.startsWith("#post_")) {
        // Board View
        currentThreadId = null;
        loadBoardView();
    }
}

// ==========================================
// 4. VIEW LOGIC
// ==========================================

function loadBoardView() {
    document.getElementById('boardView').style.display = "block";
    document.getElementById('threadView').style.display = "none";
    document.getElementById('formTitle').innerText = "Create New Thread";
    document.getElementById('subjectInput').style.display = "block";

    const listRef = getBoardRef();
    
    // Listen for data (Limit 20 threads)
    listRef.orderByChild('lastUpdated').limitToLast(20).on('value', (snapshot) => {
        const div = document.getElementById('threadList');
        div.innerHTML = "";
        const data = snapshot.val();
        if (!data) return;

        // Convert to array and reverse (Newest bump first)
        const sortedThreads = [];
        snapshot.forEach((childSnap) => {
            sortedThreads.push({ id: childSnap.key, ...childSnap.val() });
        });
        sortedThreads.reverse();

        sortedThreads.forEach((thread) => {
            // A. Render OP
            let threadHtml = renderThreadCard(thread.id, thread, true);

            // B. Render Latest 2 Replies (Preview)
            if (thread.replies) {
                const repliesArr = Object.entries(thread.replies);
                // Sort Oldest -> Newest
                repliesArr.sort((a, b) => a[1].timestamp - b[1].timestamp);
                // Get last 2
                const lastTwo = repliesArr.slice(-2);
                
                lastTwo.forEach(([rId, rData]) => {
                    threadHtml += renderReply(rId, rData, thread.id);
                });
            }

            // C. Separator
            threadHtml += '<hr class="thread-separator">';
            div.innerHTML += threadHtml;
        });
    });
}

function loadThreadView(threadId) {
    document.getElementById('boardView').style.display = "none";
    document.getElementById('threadView').style.display = "block";
    document.getElementById('formTitle').innerText = "Reply to Thread " + threadId.substring(1,8);
    document.getElementById('subjectInput').style.display = "none";

    // Load OP
    database.ref('boards/' + currentBoard + '/threads/' + threadId).on('value', (snap) => {
        const op = snap.val();
        if(!op) {
            // Thread deleted? Go back.
            if(window.location.hash.includes(threadId)) window.location.hash = "";
            return;
        }
        document.getElementById('opContainer').innerHTML = renderThreadCard(threadId, op, false);
    });

    // Load Replies
    database.ref('boards/' + currentBoard + '/threads/' + threadId + '/replies').on('value', (snapshot) => {
        const div = document.getElementById('repliesContainer');
        div.innerHTML = "";
        const data = snapshot.val();
        if (data) {
            Object.entries(data).forEach(([id, reply]) => {
                div.innerHTML += renderReply(id, reply, threadId);
            });
        }
        // Generate backlinks after rendering
        setTimeout(generateBacklinks, 500);
    });
}

// ==========================================
// 5. RENDER FUNCTIONS
// ==========================================

function renderThreadCard(id, data, isPreview) {
    const date = new Date(data.timestamp).toLocaleString();
    const replyLink = isPreview ? `<a href="#thread_${id}" class="reply-link">[Reply]</a>` : "";
    
    // IP hidden unless Mod
    const ipHtml = isModMode ? `<span style="color: blue; font-weight:bold;"> [IP: ${data.ip || '?'}]</span>` : "";
    
    // Delete Button (Only active if mod script loaded)
    const delBtn = isModMode ? `<span class="admin-delete-btn" onclick="deleteThread('${id}')">[Delete Thread]</span>` : "";

    return `
    <div class="thread-card" id="post_${id}">
        ${renderImage(data.image)}
        <div class="post-info">
            <span class="subject">${data.subject || ""}</span>
            <span class="name">${data.name}</span>
            <span class="time">${date}</span> ${ipHtml}
            <span class="post-id" onclick="quotePost('${id}')">No. ${id.substring(1,8)}</span>
            ${replyLink}
            ${delBtn}
        </div>
        <blockquote class="comment">${formatComment(data.comment)}</blockquote>
        <div class="backlink-container" id="backlinks_${id}"></div>
    </div>`;
}

function renderReply(id, data, threadId) {
    const date = new Date(data.timestamp).toLocaleString();
    const ipHtml = isModMode ? `<span style="color: blue; font-weight:bold;"> [IP: ${data.ip || '?'}]</span>` : "";
    const delBtn = isModMode ? `<span class="admin-delete-btn" onclick="deleteReply('${threadId}', '${id}')">[Delete]</span>` : "";

    return `
    <div class="reply" id="post_${id}">
        <div class="post-info">
            <span class="name">${data.name}</span>
            <span class="time">${date}</span> ${ipHtml}
            <span class="post-id" onclick="quotePost('${id}')">No. ${id.substring(1,8)}</span>
            ${delBtn}
        </div>
        <br>
        ${renderImage(data.image)}
        <blockquote class="comment">${formatComment(data.comment)}</blockquote>
        <div class="backlink-container" id="backlinks_${id}"></div>
    </div>`;
}

// ==========================================
// 6. FORMATTING, QUOTES & IMAGES
// ==========================================

function formatComment(text) {
    if (!text) return "";
    let formatted = escapeHtml(text);
    
    // 1. Quote Links (>>ID)
    const quoteRegex = /&gt;&gt;([a-zA-Z0-9\-_]+)/g;
    formatted = formatted.replace(quoteRegex, (m, id) => `<a href="#post_${id}" class="quote-link">>>${id.substring(1,8)}</a>`);
    
    // 2. Greentext (>text)
    const greenRegex = /^(&gt;[^&].*)$/gm;
    formatted = formatted.replace(greenRegex, '<span style="color:#789922;">$1</span>');
    
    return formatted;
}

function quotePost(id) {
    const box = document.getElementById('commentInput');
    box.value += `>>${id}\n`;
    box.focus();
    // Scroll to form if inside thread
    if(currentThreadId) document.getElementById('postForm').scrollIntoView();
}

function generateBacklinks() {
    // Clear old links
    document.querySelectorAll('.backlink-container').forEach(el => el.innerHTML = "");
    
    const allComments = document.querySelectorAll('.comment');
    allComments.forEach(commentDiv => {
        // Who is replying?
        const replierDiv = commentDiv.closest('[id^="post_"]'); 
        if (!replierDiv) return;
        const replierId = replierDiv.id.replace("post_", "");
        
        // Who are they quoting?
        const links = commentDiv.querySelectorAll('.quote-link');
        links.forEach(link => {
            const href = link.getAttribute('href');
            if(!href) return;
            const targetId = href.replace("#post_", "");
            
            const container = document.getElementById('backlinks_' + targetId);
            // Limit to 10 backlinks per post
            if (container && container.childElementCount < 10) {
                container.innerHTML += `<a href="#post_${replierId}" class="backlink" onmouseenter="highlightPost('${replierId}')" onmouseleave="unhighlightPost('${replierId}')">&gt;&gt;${replierId.substring(1,8)}</a>`;
            }
        });
    });
}

function highlightPost(id) { const el = document.getElementById('post_'+id); if(el) el.style.background = "#f5c0c0"; }
function unhighlightPost(id) { const el = document.getElementById('post_'+id); if(el) el.style.background = ""; }

function renderImage(url) { 
    return url ? `<img src="${url}" class="thread-image" onclick="openLightbox('${url}')">` : ""; 
}
function openLightbox(url) { 
    document.getElementById('lightboxImg').src = url; 
    document.getElementById('lightbox').style.display = 'flex'; 
}
function closeLightbox() { 
    document.getElementById('lightbox').style.display = 'none'; 
}
function escapeHtml(t) { 
    return t ? t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;") : ""; 
}

// ==========================================
// 7. SUBMIT LOGIC (VALIDATION + IP)
// ==========================================

// Helper: Check if URL loads an image
function validateImageUrl(url) {
    return new Promise((resolve) => {
        if (!url) { resolve(true); return; }
        const img = new Image();
        img.onload = () => resolve(true);
        img.onerror = () => resolve(false);
        img.src = url;
        setTimeout(() => resolve(false), 5000);
    });
}

document.getElementById('postForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const name = document.getElementById('nameInput').value || "Anonymous";
    const comment = document.getElementById('commentInput').value;
    const image = document.getElementById('imageInput').value.trim();
    
    if (!comment) return alert("Comment required");

    // UI Feedback
    const btn = e.target.querySelector('button');
    const oldText = btn.innerText;
    btn.disabled = true;
    btn.innerText = "Processing...";

    // 1. Validate Image
    if (image) {
        const isValid = await validateImageUrl(image);
        if (!isValid) {
            alert("Invalid Image URL (Must be a direct link to JPG/PNG/GIF).");
            btn.disabled = false;
            btn.innerText = oldText;
            return;
        }
    }

    // 2. Fetch IP
    let userIP = "Unknown";
    try {
        const resp = await fetch('https://api.ipify.org?format=json');
        const data = await resp.json();
        userIP = data.ip;
    } catch (err) { console.error("IP Fetch failed"); }

    const now = Date.now();
    const postData = { name, comment, image, timestamp: now, ip: userIP };

    try {
        if (currentThreadId) {
            // Reply: Push data + Update Thread Bump
            await database.ref('boards/' + currentBoard + '/threads/' + currentThreadId + '/replies').push(postData);
            await database.ref('boards/' + currentBoard + '/threads/' + currentThreadId).update({ lastUpdated: now });
        } else {
            // New Thread
            postData.subject = document.getElementById('subjectInput').value;
            postData.lastUpdated = now;
            await getBoardRef().push(postData);
        }

        // Cleanup
        document.getElementById('commentInput').value = "";
        document.getElementById('imageInput').value = "";
        document.getElementById('subjectInput').value = "";
        
        // If new thread, reload board to see it
        if (!currentThreadId) setTimeout(() => loadBoardView(), 500);

    } catch (err) {
        alert("Database Error: " + err.message);
    } finally {
        btn.disabled = false;
        btn.innerText = oldText;
    }
});

