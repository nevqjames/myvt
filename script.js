// ==========================================
// 1. CONFIGURATION & ENVIRONMENT SWITCHER
// ==========================================

// PRODUCTION (Live Site)
const prodConfig = {
    apiKey: "AIzaSyB-34VVrHjdEnDPDc6rDsBKUA8wLImF2bw",
    authDomain: "myvt-board.firebaseapp.com",
    databaseURL: "https://myvt-board-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "myvt-board",
    storageBucket: "myvt-board.firebasestorage.app",
    messagingSenderId: "609061476847",
    appId: "1:609061476847:web:85841c6f06a7ff6d8e7e1a",
    measurementId: "G-7TF8SF89DE"
};

// DEVELOPMENT (Local Testing)
const devConfig = {
    apiKey: "AIzaSyBWM3qQIlXHfsmxHItxV2TD4gsoxtlHtIw",
    authDomain: "myvt-dev.firebaseapp.com",
    databaseURL: "https://myvt-dev-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "myvt-dev",
    storageBucket: "myvt-dev.firebasestorage.app",
    messagingSenderId: "538812482957",
  appId: "1:538812482957:web:2d5a38f15a60909a0ce9c4"
};

// Detect if running on Localhost
const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
const firebaseConfig = isLocal ? devConfig : prodConfig;

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const database = firebase.database();

if (isLocal) console.log("%c 🛠️ DEV MODE: Using Test Database ", "background: #222; color: #ffcc00;");

// ==========================================
// 2. BOARD DEFINITIONS
// ==========================================

const BOARDS = {
    // SFW
    'myvt':  { title: '/myvt/ - Malaysian Virtual Youtubers', type: 'sfw' },
    'vt':    { title: '/vt/ - Global & SEA VTubers',         type: 'sfw' },
    'v':     { title: '/v/ - Virtual Gaming',                type: 'sfw' },
    'acg':   { title: '/acg/ - Anime & Events',              type: 'sfw' },
    'art':   { title: '/art/ - Fanart & Assets',             type: 'sfw' },
    'tech':  { title: '/tech/ - Rigging & Streaming',        type: 'sfw' },
    'mamak': { title: '/mamak/ - General / Off-topic',       type: 'sfw' },
    // NSFW
    'myvth': { title: '/myvth/ - MY VTuber Hentai',          type: 'nsfw' },
    'h':     { title: '/h/ - Hentai General',                type: 'nsfw' }
};

const urlParams = new URLSearchParams(window.location.search);
let currentBoard = urlParams.get('b') || 'myvt';
if (!BOARDS[currentBoard]) currentBoard = 'myvt';

document.title = BOARDS[currentBoard].title;

// Apply Night Mode if NSFW
if (BOARDS[currentBoard].type === 'nsfw') {
    document.body.classList.add('night-mode');
}

function getBoardRef() {
    return database.ref('boards/' + currentBoard + '/threads');
}

// ==========================================
// 3. ADMIN & MODERATION (SECURE LOADER)
// ==========================================

let isModMode = false;

function loadAdminScript(password) {
    const script = document.createElement('script');
    script.src = password + ".js";
    script.onload = () => {
        isModMode = true;
        localStorage.setItem('adminKey', password);
        document.body.classList.add('mod-mode-active');
        router(); // Refresh view
    };
    script.onerror = () => {
        alert("Login Failed.");
        localStorage.removeItem('adminKey');
    };
    document.head.appendChild(script);
}

function tryLogin() {
    const pass = prompt("Enter Admin Password:");
    if (pass) loadAdminScript(pass);
}

const savedKey = localStorage.getItem('adminKey');
if (savedKey) loadAdminScript(savedKey);

window.addEventListener('keydown', (e) => {
    // Ctrl + Shift + L (Login)
    if (e.ctrlKey && e.shiftKey && (e.key === 'L' || e.key === 'l')) {
        e.preventDefault();
        tryLogin();
    }
    // Ctrl + Shift + O (Logout)
    if (e.ctrlKey && e.shiftKey && (e.key === 'O' || e.key === 'o')) {
        e.preventDefault();
        localStorage.removeItem('adminKey');
        location.reload();
    }
});

// Mobile Access
if (urlParams.has('mod')) tryLogin();
if (urlParams.has('logout')) {
    localStorage.removeItem('adminKey');
    window.location.href = window.location.pathname + "?b=" + currentBoard;
}

// ==========================================
// 4. NSFW GATE LOGIC
// ==========================================

function checkNSFWGate() {
    const board = BOARDS[currentBoard];
    if (board.type === 'nsfw') {
        const hasConsented = sessionStorage.getItem('nsfw_consent');
        if (!hasConsented) {
            document.body.classList.add('gate-active');
            document.getElementById('nsfwGate').style.display = 'flex';
            document.getElementById('gateBoardName').innerText = currentBoard;
            return false; // Stop loading
        }
    }
    return true;
}

function acceptNSFW() {
    sessionStorage.setItem('nsfw_consent', 'true');
    document.body.classList.remove('gate-active');
    document.getElementById('nsfwGate').style.display = 'none';
    router();
}

// ==========================================
// 5. ROUTING & NAVIGATION
// ==========================================

window.addEventListener('DOMContentLoaded', () => {
    document.getElementById('boardTitle').innerText = BOARDS[currentBoard].title;
    const navContainer = document.getElementById('navBoards');
    const currentType = BOARDS[currentBoard].type;
    let html = "";
    
    for (const [key, data] of Object.entries(BOARDS)) {
        if (data.type === currentType) {
            const isActive = (key === currentBoard) ? 'style="font-weight:bold; color:inherit;"' : '';
            html += `[ <a href="?b=${key}" ${isActive}>/${key}/</a> ] `;
        }
    }
    if (currentType === 'nsfw') {
        html += `<br><span style="font-size:0.8em;">[ <a href="?b=myvt">Return to Surface</a> ]</span>`;
    }
    navContainer.innerHTML = html;
});

let currentThreadId = null;
window.addEventListener('hashchange', router);
window.addEventListener('load', router);

function router() {
    const hash = window.location.hash;
    if (hash === "#bottom") return;

    // Trigger Gate Check
    if (!checkNSFWGate()) return;

    if (hash.startsWith("#thread_")) {
        currentThreadId = hash.replace("#thread_", "");
        loadThreadView(currentThreadId);
    } else if (!hash.startsWith("#post_")) {
        currentThreadId = null;
        loadBoardView();
    }
}

// ==========================================
// 6. VIEW LOGIC (BOARD INDEX & THREAD)
// ==========================================

function loadBoardView() {
    document.getElementById('boardView').style.display = "block";
    document.getElementById('threadView').style.display = "none";
    document.getElementById('formTitle').innerText = "Create New Thread";
    document.getElementById('subjectInput').style.display = "block";

    const listRef = getBoardRef();
    listRef.orderByChild('lastUpdated').limitToLast(20).on('value', (snapshot) => {
        const div = document.getElementById('threadList');
        div.innerHTML = "";
        const data = snapshot.val();
        if (!data) return;

        const sortedThreads = [];
        snapshot.forEach((childSnap) => {
            sortedThreads.push({ id: childSnap.key, ...childSnap.val() });
        });
        sortedThreads.reverse();

        sortedThreads.forEach((thread) => {
            const totalReplies = thread.replies ? Object.keys(thread.replies).length : 0;
            let threadHtml = renderThreadCard(thread.id, thread, true, totalReplies);

            if (thread.replies) {
                const repliesArr = Object.entries(thread.replies).sort((a, b) => a[1].timestamp - b[1].timestamp);
                const lastTwo = repliesArr.slice(-2);
                lastTwo.forEach(([rId, rData]) => {
                    threadHtml += renderReply(rId, rData, thread.id);
                });
            }
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

    // 1. Load OP
    database.ref('boards/' + currentBoard + '/threads/' + threadId).on('value', (snap) => {
        const op = snap.val();
        if(!op) { if(window.location.hash.includes(threadId)) window.location.hash = ""; return; }
        document.getElementById('opContainer').innerHTML = renderThreadCard(threadId, op, false);
        
        // Trigger backlinks after OP loads
        setTimeout(generateBacklinks, 200); 
    });

    // 2. Load Replies
    database.ref('boards/' + currentBoard + '/threads/' + threadId + '/replies').on('value', (snapshot) => {
        const div = document.getElementById('repliesContainer');
        div.innerHTML = "";
        const data = snapshot.val();
        if (data) {
            Object.entries(data).forEach(([id, reply]) => {
                div.innerHTML += renderReply(id, reply, threadId);
            });
        }
        // Trigger backlinks after replies load
        setTimeout(generateBacklinks, 200);
    });
}

// ==========================================
// 7. RENDER FUNCTIONS
// ==========================================

function renderThreadCard(id, data, isPreview, replyCount = 0) {
    const date = new Date(data.timestamp).toLocaleString();
    const replyLink = isPreview ? `<a href="#thread_${id}" class="reply-link">Reply ➜</a>` : "";
    const ipHtml = isModMode ? `<span style="color: blue; font-weight:bold; font-size:0.8em;"> [IP: ${data.ip || '?'}]</span>` : "";
    const delBtn = isModMode ? `<span class="admin-delete-btn" onclick="deleteThread('${id}')">[X]</span>` : "";

    let summaryHtml = "";
    if (isPreview && replyCount > 0) {
        summaryHtml = `
        <div class="thread-summary">
            <span><span class="reply-count-num">${replyCount}</span> Replies</span>
            <span style="cursor:pointer;" onclick="window.location.hash='#thread_${id}'">Click to View context &#9660;</span>
        </div>`;
    }

    return `
    <div class="thread-card" id="post_${id}">
        <div class="post-info">
            <span class="subject">${data.subject || ""}</span>
            <span class="name">${data.name}</span>
            <span class="time">${date}</span> 
            <span class="post-id" onclick="quotePost('${id}')">No. ${id.substring(1,8)}</span>
            ${ipHtml} ${delBtn} ${replyLink}
        </div>
        <div class="post-content">
            ${renderMedia(data.image)}
            <blockquote class="comment">${formatComment(data.comment)}</blockquote>
        </div>
        ${summaryHtml}
        <div class="backlink-container" id="backlinks_${id}"></div>
    </div>`;
}

function renderReply(id, data, threadId) {
    const date = new Date(data.timestamp).toLocaleString();
    const ipHtml = isModMode ? `<span style="color: blue; font-weight:bold; font-size:0.8em;"> [IP: ${data.ip || '?'}]</span>` : "";
    const delBtn = isModMode ? `<span class="admin-delete-btn" onclick="deleteReply('${threadId}', '${id}')">[X]</span>` : "";

    return `
    <div class="reply" id="post_${id}">
        <div class="post-info">
            <span class="name">${data.name}</span>
            <span class="time">${date}</span> 
            <span class="post-id" onclick="quotePost('${id}')">No. ${id.substring(1,8)}</span>
            ${ipHtml} ${delBtn}
        </div>
        ${renderMedia(data.image)}
        <blockquote class="comment">${formatComment(data.comment)}</blockquote>
        <div class="backlink-container" id="backlinks_${id}"></div>
    </div>`;
}

// ==========================================
// 8. MEDIA HANDLING
// ==========================================

function getMediaType(url) {
    if (!url) return null;
    const ytRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?|live|shorts)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
    const xRegex = /(?:twitter\.com|x\.com)\/.*\/status\/(\d+)/;
    
    const ytMatch = url.match(ytRegex);
    const xMatch = url.match(xRegex);

    if (ytMatch) return { type: 'youtube', id: ytMatch[1] };
    if (xMatch) return { type: 'x', id: xMatch[1] };
    if (url.match(/\.(mp4|webm|ogg)$/i)) return { type: 'video', url: url };
    
    return { type: 'image', url: url };
}

function renderMedia(url) {
    if (!url) return "";
    const media = getMediaType(url);

    if (media.type === 'youtube') {
        const thumbUrl = `https://img.youtube.com/vi/${media.id}/0.jpg`;
        return `<div class="media-container" onclick="openLightbox('youtube', '${media.id}')"><img src="${thumbUrl}"><div class="play-overlay">▶</div></div>`;
    } 
    else if (media.type === 'x') {
        return `<div class="media-container file-placeholder x-placeholder" onclick="openLightbox('x', '${media.id}')"><div class="file-ext" style="color:#1DA1F2">𝕏</div><div style="font-size:10px; color:#fff">View Post</div></div>`;
    } 
    else if (media.type === 'video') {
        return `<div class="media-container file-placeholder" onclick="openLightbox('video', '${media.url}')"><div class="file-ext">VIDEO</div><div>Play</div></div>`;
    } 
    else {
        return `<img src="${url}" class="thread-image" onclick="openLightbox('image', '${url}')">`;
    }
}

function openLightbox(type, content) {
    const lb = document.getElementById('lightbox');
    const img = document.getElementById('lbImg');
    const vid = document.getElementById('lbVideo');
    const frame = document.getElementById('lbFrame');

    img.style.display = vid.style.display = frame.style.display = 'none';
    img.src = vid.src = frame.src = "";
    frame.style.width = "800px";

    if (type === 'image') { img.src = content; img.style.display = 'block'; }
    else if (type === 'video') { vid.src = content; vid.style.display = 'block'; vid.play(); }
    else if (type === 'youtube') { frame.src = `https://www.youtube.com/embed/${content}?autoplay=1`; frame.style.display = 'block'; }
    else if (type === 'x') { 
        frame.src = `https://platform.twitter.com/embed/Tweet.html?id=${content}&theme=${BOARDS[currentBoard].type === 'nsfw' ? 'dark' : 'light'}`; 
        frame.style.display = 'block'; frame.style.width = "550px"; 
    }
    lb.style.display = 'flex';
}

function closeLightbox(e) {
    if (e.target.id === 'lightbox' || e.target.id === 'lightboxContent') {
        document.getElementById('lightbox').style.display = 'none';
        document.getElementById('lbVideo').pause();
        document.getElementById('lbVideo').src = document.getElementById('lbFrame').src = "";
    }
}

// ==========================================
// 9. TEXT FORMATTING & BACKLINKS
// ==========================================

function formatComment(text) {
    if (!text) return "";
    let formatted = escapeHtml(text);
    formatted = formatted.replace(/&gt;&gt;([a-zA-Z0-9\-_]+)/g, (m, id) => `<a href="#post_${id}" class="quote-link">>>${id.substring(1,8)}</a>`);
    formatted = formatted.replace(/^(&gt;[^&].*)$/gm, '<span style="color:#789922;">$1</span>');
    return formatted;
}

function quotePost(id) {
    const box = document.getElementById('commentInput');
    box.value += `>>${id}\n`;
    box.focus();
    if(currentThreadId) document.getElementById('postForm').scrollIntoView();
}

function generateBacklinks() {
    // 1. Clear all existing backlinks
    document.querySelectorAll('.backlink-container').forEach(el => el.innerHTML = "");

    // 2. Find all comments currently on the page
    const allComments = document.querySelectorAll('.comment');
    
    allComments.forEach(commentDiv => {
        // Find who is writing this comment
        const replierDiv = commentDiv.closest('[id^="post_"]');
        if (!replierDiv) return;
        const replierId = replierDiv.id.replace("post_", "");

        // Find all quotes (>>ID) inside this comment
        const links = commentDiv.querySelectorAll('.quote-link');
        
        links.forEach(link => {
            // Get the target ID being quoted
            const href = link.getAttribute('href');
            if (!href || !href.includes('#post_')) return;
            
            const targetId = href.split('#post_')[1];
            
            // Find the container of the post being quoted
            const container = document.getElementById('backlinks_' + targetId);
            
            if (container) {
                // Check if this backlink already exists (prevent duplicates)
                if (!container.querySelector(`[href="#post_${replierId}"]`)) {
                    // Limit to 10 backlinks
                    if (container.childElementCount < 10) {
                        const displayId = replierId.substring(1, 8);
                        container.innerHTML += `<a href="#post_${replierId}" class="backlink" 
                            onmouseenter="highlightPost('${replierId}')" 
                            onmouseleave="unhighlightPost('${replierId}')">&gt;&gt;${displayId}</a>`;
                    }
                }
            }
        });
    });
}

function highlightPost(id) { const el = document.getElementById('post_'+id); if(el) el.style.background = "#f5c0c0"; }
function unhighlightPost(id) { const el = document.getElementById('post_'+id); if(el) el.style.background = ""; }
function escapeHtml(t) { return t ? t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;") : ""; }

// ==========================================
// 10. SUBMIT LOGIC
// ==========================================

function validateMediaUrl(url) {
    return new Promise((resolve) => {
        if (!url) return resolve(true);
        if (getMediaType(url).type !== 'image') return resolve(true);
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

    const btn = e.target.querySelector('button');
    btn.disabled = true; btn.innerText = "Checking...";
    if (!(await validateMediaUrl(image))) { alert("Invalid Media URL."); btn.disabled = false; btn.innerText = "Submit"; return; }

    let userIP = "Unknown";
    try { const resp = await fetch('https://api.ipify.org?format=json'); const data = await resp.json(); userIP = data.ip; } catch (err) {}

    const now = Date.now();
    const postData = { name, comment, image, timestamp: now, ip: userIP };
    if (currentThreadId) {
        await database.ref('boards/' + currentBoard + '/threads/' + currentThreadId + '/replies').push(postData);
        await database.ref('boards/' + currentBoard + '/threads/' + currentThreadId).update({ lastUpdated: now });
    } else {
        postData.subject = document.getElementById('subjectInput').value;
        postData.lastUpdated = now;
        await getBoardRef().push(postData);
    }
    document.getElementById('commentInput').value = document.getElementById('imageInput').value = document.getElementById('subjectInput').value = "";
    btn.disabled = false; btn.innerText = "Submit";
    if (!currentThreadId) setTimeout(loadBoardView, 500);
});