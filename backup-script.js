// --- 1. CONFIGURATION ---
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

firebase.initializeApp(firebaseConfig);
const database = firebase.database();

// --- 2. ADMIN & MODERATION LOGIC ---
const MOD_PASSWORD = "myvt_admin_2024"; 
let isModMode = false;

function tryLogin() {
    const pass = prompt("Enter Moderator Password:");
    if (pass === MOD_PASSWORD) {
        isModMode = true;
        localStorage.setItem('isMod', 'true');
        document.body.classList.add('mod-mode-active');
        alert("Mod Mode Active!");
        window.history.replaceState({}, document.title, window.location.pathname + window.location.hash);
        location.reload(); 
    } else {
        alert("Wrong password.");
    }
}

if (localStorage.getItem('isMod') === 'true') {
    isModMode = true;
    document.body.classList.add('mod-mode-active');
}

const urlParams = new URLSearchParams(window.location.search);
if (urlParams.has('mod')) tryLogin();
if (urlParams.has('logout')) {
    localStorage.removeItem('isMod');
    alert("Logged out.");
    window.location.href = window.location.pathname + window.location.hash;
}

window.addEventListener('keydown', (e) => {
    if (e.shiftKey && e.key === 'L') tryLogin();
    if (e.shiftKey && e.key === 'O') {
        localStorage.removeItem('isMod');
        location.reload();
    }
});

// --- 3. ROUTING ---
let currentThreadId = null;

window.addEventListener('hashchange', router);
window.addEventListener('load', router);

function router() {
    const hash = window.location.hash;

    // NEW: If the user clicked "Bottom", do nothing and let the HTML anchor handle it
    if (hash === "#bottom") return; 

    if (hash.startsWith("#thread_")) {
        const id = hash.replace("#thread_", "");
        currentThreadId = id;
        loadThreadView(id);
    } else if (!hash.startsWith("#post_")) {
        currentThreadId = null;
        loadBoardView();
    }
}

// --- 4. VIEW LOGIC ---

function loadBoardView() {
    document.getElementById('boardView').style.display = "block";
    document.getElementById('threadView').style.display = "none";
    document.getElementById('formTitle').innerText = "Create New Thread";
    document.getElementById('subjectInput').style.display = "block";

    // Use currentBoard variable (defaults to 'myvt' if you haven't set up the board switcher yet)
    const boardName = typeof currentBoard !== 'undefined' ? currentBoard : 'myvt';
    
    const listRef = database.ref('boards/' + boardName + '/threads');
    
    listRef.orderByChild('lastUpdated').limitToLast(20).on('value', (snapshot) => {
        const div = document.getElementById('threadList');
        div.innerHTML = "";
        const data = snapshot.val();
        if (!data) return;

        // 1. Sort Threads (Newest Bump at Top)
        const sortedThreads = [];
        snapshot.forEach((childSnap) => {
            sortedThreads.push({ id: childSnap.key, ...childSnap.val() });
        });
        sortedThreads.reverse();

        // 2. Loop through each thread
        sortedThreads.forEach((thread) => {
            // A. Render the Main Post (OP)
            let threadHtml = renderThreadCard(thread.id, thread, true);

            // B. Render the Latest 2 Replies (Preview)
            if (thread.replies) {
                // Convert replies object to array: [[id, data], [id, data]...]
                const repliesArr = Object.entries(thread.replies);
                
                // Sort by time (Oldest -> Newest) so they read correctly
                repliesArr.sort((a, b) => a[1].timestamp - b[1].timestamp);

                // Slice the last 2 items
                const lastTwo = repliesArr.slice(-2);

                // Render them
                lastTwo.forEach(([rId, rData]) => {
                    threadHtml += renderReply(rId, rData, thread.id);
                });
            }

            // C. Add the Divider
            threadHtml += '<hr class="thread-separator">';

            // D. Inject into page
            div.innerHTML += threadHtml;
        });
    });
}

function loadThreadView(threadId) {
    document.getElementById('boardView').style.display = "none";
    document.getElementById('threadView').style.display = "block";
    document.getElementById('formTitle').innerText = "Reply to Thread " + threadId.substring(1,8);
    document.getElementById('subjectInput').style.display = "none";

    database.ref('boards/myvt/threads/' + threadId).on('value', (snap) => {
        const op = snap.val();
        if(!op) {
            if(window.location.hash.includes(threadId)) window.location.hash = "";
            return;
        }
        document.getElementById('opContainer').innerHTML = renderThreadCard(threadId, op, false);
    });

    database.ref('boards/myvt/threads/' + threadId + '/replies').on('value', (snapshot) => {
        const div = document.getElementById('repliesContainer');
        div.innerHTML = "";
        const data = snapshot.val();
        if (data) {
            Object.entries(data).forEach(([id, reply]) => {
                div.innerHTML += renderReply(id, reply, threadId);
            });
        }
        setTimeout(generateBacklinks, 500);
    });
}

// --- 5. RENDER FUNCTIONS ---

function renderThreadCard(id, data, isPreview) {
    const date = new Date(data.timestamp).toLocaleString();
    const replyLink = isPreview ? `<a href="#thread_${id}" class="reply-link">[Reply]</a>` : "";
    const ipHtml = isModMode ? `<span style="color: blue;"> [IP: ${data.ip || '?.?.?.?'}]</span>` : "";
    const delBtn = `<span class="admin-delete-btn" onclick="deleteThread('${id}')">[Delete Thread]</span>`;

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
    const ipHtml = isModMode ? `<span style="color: blue;"> [IP: ${data.ip || '?.?.?.?'}]</span>` : "";
    const delBtn = `<span class="admin-delete-btn" onclick="deleteReply('${threadId}', '${id}')">[Delete]</span>`;

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

// --- 6. FORMATTING, QUOTES & BACKLINKS ---

function formatComment(text) {
    if (!text) return "";
    let formatted = escapeHtml(text);
    // Quote Links (Matches escaped &gt;&gt;)
    const quoteRegex = /&gt;&gt;([a-zA-Z0-9\-_]+)/g;
    formatted = formatted.replace(quoteRegex, (m, id) => `<a href="#post_${id}" class="quote-link">>>${id.substring(1,8)}</a>`);
    // Greentext
    const greenRegex = /^(&gt;[^&].*)$/gm;
    formatted = formatted.replace(greenRegex, '<span style="color:#789922;">$1</span>');
    return formatted;
}

function quotePost(id) {
    const box = document.getElementById('commentInput');
    box.value += `>>${id}\n`;
    box.focus();
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

// --- 7. SUBMIT LOGIC (SMART IMAGE VALIDATION + IP) ---

function validateImageUrl(url) {
    return new Promise((resolve) => {
        if (!url) { resolve(true); return; }
        const img = new Image();
        img.onload = () => resolve(true);
        img.onerror = () => resolve(false);
        img.src = url;
        setTimeout(() => resolve(false), 5000); // Timeout
    });
}

document.getElementById('postForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    const name = document.getElementById('nameInput').value || "Anonymous";
    const comment = document.getElementById('commentInput').value;
    const image = document.getElementById('imageInput').value.trim();
    if (!comment) return alert("Comment required");

    const btn = e.target.querySelector('button');
    btn.disabled = true;
    btn.innerText = "Checking...";

    // Smart Validation
    if (image) {
        const isValid = await validateImageUrl(image);
        if (!isValid) {
            alert("Invalid Image! URL is broken or not an image.");
            btn.disabled = false;
            btn.innerText = "Submit";
            return;
        }
    }

    // Fetch IP
    let userIP = "Unknown";
    try {
        const resp = await fetch('https://api.ipify.org?format=json');
        const data = await resp.json();
        userIP = data.ip;
    } catch (err) {}

    const now = Date.now();
    const postData = { name, comment, image, timestamp: now, ip: userIP };

    if (currentThreadId) {
        await database.ref('boards/myvt/threads/' + currentThreadId + '/replies').push(postData);
        await database.ref('boards/myvt/threads/' + currentThreadId).update({ lastUpdated: now });
    } else {
        postData.subject = document.getElementById('subjectInput').value;
        postData.lastUpdated = now;
        await database.ref('boards/myvt/threads').push(postData);
    }

    document.getElementById('commentInput').value = "";
    document.getElementById('imageInput').value = "";
    document.getElementById('subjectInput').value = "";
    btn.disabled = false;
    btn.innerText = "Submit";
});

// --- 8. MODERATION ---
function deleteThread(id) { if(confirm("Delete thread?")) database.ref('boards/myvt/threads/'+id).remove(); }
function deleteReply(tId, rId) { if(confirm("Delete post?")) database.ref('boards/myvt/threads/'+tId+'/replies/'+rId).remove(); }

// --- 9. HELPERS ---
function highlightPost(id) { const el = document.getElementById('post_'+id); if(el) el.style.background = "#f5c0c0"; }
function unhighlightPost(id) { const el = document.getElementById('post_'+id); if(el) el.style.background = ""; }
function renderImage(url) { return url ? `<img src="${url}" class="thread-image" onclick="openLightbox('${url}')">` : ""; }
function openLightbox(url) { document.getElementById('lightboxImg').src = url; document.getElementById('lightbox').style.display = 'flex'; }
function closeLightbox() { document.getElementById('lightbox').style.display = 'none'; }

function escapeHtml(t) { return t ? t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;") : ""; }

