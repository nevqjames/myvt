// ==========================================
// 1. CONFIGURATION & SETUP
// ==========================================

// --- 1. CONFIGURATIONS ---

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

// --- ENVIRONMENT DETECTION ---
const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
const firebaseConfig = isLocal ? devConfig : prodConfig;

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const database = firebase.database();

// Visual indicator so you don't accidentally delete things in the wrong DB
if (isLocal) {
    console.log("%c 🛠️ DEV MODE: Using Test Database ", "background: #222; color: #ffcc00; font-size: 12px;");
}

// Board Definitions
const BOARDS = {
    // === SFW (Surface) ===
    'myvt':  { title: '/myvt/ - Malaysian Virtual Youtubers', type: 'sfw' },
    'vt':    { title: '/vt/ - Global & SEA VTubers',          type: 'sfw' },
    'vg':    { title: '/vg/ - Video Games',                  type: 'sfw' },
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

// Set Page Title
document.title = BOARDS[currentBoard].title;

// Auto-Night Mode for NSFW Boards
if (BOARDS[currentBoard].type === 'nsfw') {
    document.body.classList.add('night-mode');
} else {
    document.body.classList.remove('night-mode');
}

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
        isModMode = true;
        document.body.classList.add('mod-mode-active');
        // Reload views to show delete buttons
        if(currentThreadId) loadThreadView(currentThreadId);
        else loadBoardView();
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

// PC Keyboard Shortcuts (Updated to Ctrl + Shift)
window.addEventListener('keydown', (e) => {
    // Login: Ctrl + Shift + L
    if (e.ctrlKey && e.shiftKey && (e.key === 'L' || e.key === 'l')) {
        e.preventDefault(); // Stops the browser from doing anything else with this combo
        tryLogin();
    }
    // Logout: Ctrl + Shift + O
    if (e.ctrlKey && e.shiftKey && (e.key === 'O' || e.key === 'o')) {
        e.preventDefault();
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
            const isActive = (key === currentBoard) ? 'style="font-weight:bold; color:inherit;"' : '';
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
    
    // Listen for data (Limit 20 threads, sorted by last update/bump)
    listRef.orderByChild('lastUpdated').limitToLast(20).on('value', (snapshot) => {
        const div = document.getElementById('threadList');
        div.innerHTML = "";
        const data = snapshot.val();
        if (!data) return;

        // 1. Convert to array and reverse (Newest bump first)
        const sortedThreads = [];
        snapshot.forEach((childSnap) => {
            sortedThreads.push({ id: childSnap.key, ...childSnap.val() });
        });
        sortedThreads.reverse();

        // 2. Loop through each thread to build the view
        sortedThreads.forEach((thread) => {
            // NEW: Calculate the total number of replies in this thread
            const totalReplies = thread.replies ? Object.keys(thread.replies).length : 0;

            // A. Render the Main Post (OP) 
            // We pass 'true' for isPreview and the 'totalReplies' count
            let threadHtml = renderThreadCard(thread.id, thread, true, totalReplies);

            // B. Render the Preview of the latest 2 replies
            if (thread.replies) {
                const repliesArr = Object.entries(thread.replies);
                
                // Sort replies by timestamp (Oldest to Newest)
                repliesArr.sort((a, b) => a[1].timestamp - b[1].timestamp);
                
                // Take only the last 2 for the board index preview
                const lastTwo = repliesArr.slice(-2);
                
                lastTwo.forEach(([rId, rData]) => {
                    threadHtml += renderReply(rId, rData, thread.id);
                });
            }

            // C. Add the separator line between threads
            threadHtml += '<hr class="thread-separator">';
            
            // D. Inject into the DOM
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

function renderThreadCard(id, data, isPreview, replyCount = 0) {
    const date = new Date(data.timestamp).toLocaleString();
    
    // Reply Link (Now smaller and distinct)
    const replyLink = isPreview ? `<a href="#thread_${id}" class="reply-link">Reply ➜</a>` : "";
    
    // IP hidden unless Mod
    const ipHtml = isModMode ? `<span style="color: blue; font-weight:bold; font-size:0.8em;"> [IP: ${data.ip || '?'}]</span>` : "";
    
    // Delete Button
    const delBtn = isModMode ? `<span class="admin-delete-btn" onclick="deleteThread('${id}')">[X]</span>` : "";

    // Summary (X Replies) - Moves to bottom
    let summaryHtml = "";
    if (isPreview && replyCount > 0) {
        summaryHtml = `
        <div class="thread-summary">
            <span class="reply-count-num">${replyCount}</span> Replies 
            <span style="float:right; cursor:pointer;" onclick="window.location.hash='#thread_${id}'">Click to View context &#9660;</span>
        </div>`;
    }

    return `
    <div class="thread-card" id="post_${id}">
        <!-- 1. HEADER ROW (Full Width) -->
        <div class="post-info">
            <span class="subject">${data.subject || ""}</span>
            <span class="name">${data.name}</span>
            <span class="time">${date}</span> 
            <span class="post-id" onclick="quotePost('${id}')">No. ${id.substring(1,8)}</span>
            ${ipHtml}
            ${delBtn}
            ${replyLink} <!-- Floats Right -->
        </div>

        <!-- 2. CONTENT ROW (Image + Text) -->
        <div class="post-content">
            ${renderMedia(data.image)}
            <blockquote class="comment">${formatComment(data.comment)}</blockquote>
        </div>

        <!-- 3. FOOTER ROW (Replies Count) -->
        ${summaryHtml}
        
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
        ${renderMedia(data.image)}
        <blockquote class="comment">${formatComment(data.comment)}</blockquote>
        <div class="backlink-container" id="backlinks_${id}"></div>
    </div>`;
}

// ==========================================
// 6. MEDIA HANDLING (YOUTUBE / VIDEO / IMG)
// ==========================================

function getMediaType(url) {
    if (!url) return null;
    
    // 1. YouTube
    const ytRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?|live|shorts)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
    const ytMatch = url.match(ytRegex);
    if (ytMatch) return { type: 'youtube', id: ytMatch[1] };

    // 2. X / Twitter (New)
    const xRegex = /(?:twitter\.com|x\.com)\/.*\/status\/(\d+)/;
    const xMatch = url.match(xRegex);
    if (xMatch) return { type: 'x', id: xMatch[1] };

    // 3. Direct Video
    if (url.match(/\.(mp4|webm|ogg)$/i)) return { type: 'video', url: url };

    return { type: 'image', url: url };
}

function renderMedia(url) {
    if (!url) return "";
    const media = getMediaType(url);

    if (media.type === 'youtube') {
        const thumbUrl = `https://img.youtube.com/vi/${media.id}/0.jpg`;
        return `
        <div class="media-container" onclick="openLightbox('youtube', '${media.id}')">
            <img src="${thumbUrl}">
            <div class="play-overlay">▶</div>
        </div>`;
    } 
    else if (media.type === 'x') {
        // We show a blue/black X placeholder since thumbnails are hard to get
        return `
        <div class="media-container file-placeholder x-placeholder" onclick="openLightbox('x', '${media.id}')">
            <div class="file-ext" style="color:#1DA1F2">𝕏</div>
            <div style="font-size:10px">Click to load Post</div>
        </div>`;
    }
    else if (media.type === 'video') {
        return `
        <div class="media-container file-placeholder" onclick="openLightbox('video', '${media.url}')">
            <div class="file-ext">VIDEO</div>
            <div>Click to Play</div>
        </div>`;
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

    img.style.display = 'none'; img.src = "";
    vid.style.display = 'none'; vid.src = "";
    frame.style.display = 'none'; frame.src = "";

    if (type === 'image') {
        img.src = content;
        img.style.display = 'block';
    } else if (type === 'video') {
        vid.src = content;
        vid.style.display = 'block';
    } else if (type === 'youtube') {
        frame.src = `https://www.youtube.com/embed/${content}?autoplay=1`;
        frame.style.display = 'block';
    } else if (type === 'x') {
        // Use the official Twitter embed frame
        frame.src = `https://platform.twitter.com/embed/Tweet.html?id=${content}&theme=dark`;
        frame.style.display = 'block';
        // X embeds usually look better in a narrower frame
        frame.style.width = "550px"; 
    }
    lb.style.display = 'flex';
}

function closeLightbox(e) {
    // Only close if clicking background, not content
    if (e.target.id === 'lightbox' || e.target.id === 'lightboxContent') {
        document.getElementById('lightbox').style.display = 'none';
        document.getElementById('lbVideo').pause();
        document.getElementById('lbVideo').src = "";
        document.getElementById('lbFrame').src = "";
    }
}

// ==========================================
// 7. FORMATTING, QUOTES & BACKLINKS
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
    if(currentThreadId) document.getElementById('postForm').scrollIntoView();
}

function generateBacklinks() {
    document.querySelectorAll('.backlink-container').forEach(el => el.innerHTML = "");
    const allComments = document.querySelectorAll('.comment');
    allComments.forEach(commentDiv => {
        const replierDiv = commentDiv.closest('[id^="post_"]'); 
        if (!replierDiv) return;
        const replierId = replierDiv.id.replace("post_", "");
        const links = commentDiv.querySelectorAll('.quote-link');
        links.forEach(link => {
            const href = link.getAttribute('href');
            if(!href) return;
            const targetId = href.replace("#post_", "");
            const container = document.getElementById('backlinks_' + targetId);
            if (container && container.childElementCount < 10) {
                container.innerHTML += `<a href="#post_${replierId}" class="backlink" onmouseenter="highlightPost('${replierId}')" onmouseleave="unhighlightPost('${replierId}')">&gt;&gt;${replierId.substring(1,8)}</a>`;
            }
        });
    });
}

function highlightPost(id) { const el = document.getElementById('post_'+id); if(el) el.style.background = "#f5c0c0"; }
function unhighlightPost(id) { const el = document.getElementById('post_'+id); if(el) el.style.background = ""; }
function escapeHtml(t) { return t ? t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;") : ""; }


// ==========================================
// 8. SUBMIT LOGIC (SMART MEDIA + IP)
// ==========================================

function validateMediaUrl(url) {
    return new Promise((resolve) => {
        if (!url) { resolve(true); return; }

        // 1. Check YouTube Regex (Live, Shorts, VOD, Standard)
        const ytRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?|live|shorts)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
        if (url.match(ytRegex)) { resolve(true); return; }

        // 2. Check Video Extension
        if (url.match(/\.(mp4|webm|ogg)$/i)) { resolve(true); return; }

        // 3. Check X / Twitter Regex (New)
        const xRegex = /(?:twitter\.com|x\.com)\/.*\/status\/(\d+)/;
        if (url.match(xRegex)) { resolve(true); return; }

        // 4. Fallback: Check if Image
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

    // 1. Validate Media
    if (image) {
        const isValid = await validateMediaUrl(image);
        if (!isValid) {
            alert("Invalid Media URL! Must be an Image, MP4/WebM, or YouTube link.");
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