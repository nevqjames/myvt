// --- CONFIGURATION ---
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

// --- ADMIN SETTINGS ---
const MOD_PASSWORD = "myvt_admin_2024"; 
let isModMode = false;

if (localStorage.getItem('isMod') === 'true') {
    isModMode = true;
    document.body.classList.add('mod-mode-active');
}

window.addEventListener('keydown', (e) => {
    if (e.shiftKey && e.key === 'L') {
        const pass = prompt("Enter Moderator Password:");
        if (pass === MOD_PASSWORD) {
            isModMode = true;
            localStorage.setItem('isMod', 'true');
            document.body.classList.add('mod-mode-active');
            alert("Mod Mode Active!");
        }
    }
    if (e.shiftKey && e.key === 'O') {
        localStorage.removeItem('isMod');
        location.reload();
    }
});

let currentThreadId = null;

// --- 1. ROUTING ---
window.addEventListener('hashchange', router);
window.addEventListener('load', router);

function router() {
    const hash = window.location.hash;
    if (hash.startsWith("#thread_")) {
        const id = hash.replace("#thread_", "");
        currentThreadId = id;
        loadThreadView(id);
    } else if (!hash.startsWith("#post_")) {
        currentThreadId = null;
        loadBoardView();
    }
}

// --- 2. VIEW LOGIC ---
function loadBoardView() {
    document.getElementById('boardView').style.display = "block";
    document.getElementById('threadView').style.display = "none";
    document.getElementById('formTitle').innerText = "Create New Thread";
    document.getElementById('subjectInput').style.display = "block";

    const listRef = database.ref('boards/myvt/threads');
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
            div.innerHTML += renderThreadCard(thread.id, thread, true);
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

// --- 3. RENDER FUNCTIONS ---
function renderThreadCard(id, data, isPreview) {
    const date = new Date(data.timestamp).toLocaleString();
    const replyLink = isPreview ? `<a href="#thread_${id}" class="reply-link">[Reply]</a>` : "";
    const delBtn = `<span class="admin-delete-btn" onclick="deleteThread('${id}')">[Delete Thread]</span>`;

    return `
    <div class="thread-card" id="post_${id}">
        ${renderImage(data.image)}
        <div class="post-info">
            <span class="subject">${data.subject || ""}</span>
            <span class="name">${data.name}</span>
            <span class="time">${date}</span>
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
    const delBtn = `<span class="admin-delete-btn" onclick="deleteReply('${threadId}', '${id}')">[Delete]</span>`;

    return `
    <div class="reply" id="post_${id}">
        <div class="post-info">
            <span class="name">${data.name}</span>
            <span class="time">${date}</span>
            <span class="post-id" onclick="quotePost('${id}')">No. ${id.substring(1,8)}</span>
            ${delBtn}
        </div>
        <br>
        ${renderImage(data.image)}
        <blockquote class="comment">${formatComment(data.comment)}</blockquote>
        <div class="backlink-container" id="backlinks_${id}"></div>
    </div>`;
}

// --- 4. FORMATTING & QUOTES ---

function formatComment(text) {
    if (!text) return "";
    
    let formatted = escapeHtml(text);

    // Turn &gt;&gt;ID into Links
    const quoteRegex = /&gt;&gt;([a-zA-Z0-9\-_]+)/g;
    formatted = formatted.replace(quoteRegex, function(match, id) {
        return `<a href="#post_${id}" class="quote-link">>>${id.substring(1,8)}</a>`;
    });

    // Greentext logic
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
        const replierPostDiv = commentDiv.closest('[id^="post_"]'); 
        if (!replierPostDiv) return;
        const replierId = replierPostDiv.id.replace("post_", "");
        const links = commentDiv.querySelectorAll('.quote-link');
        links.forEach(link => {
            const href = link.getAttribute('href');
            if (!href) return;
            const targetId = href.replace("#post_", "");
            const backlinkContainer = document.getElementById('backlinks_' + targetId);
            if (backlinkContainer && backlinkContainer.childElementCount < 10) {
                backlinkContainer.innerHTML += `<a href="#post_${replierId}" class="backlink" onmouseenter="highlightPost('${replierId}')" onmouseleave="unhighlightPost('${replierId}')">&gt;&gt;${replierId.substring(1,8)}</a>`;
            }
        });
    });
}

// --- 5. MODERATION ---
function deleteThread(threadId) {
    if (confirm("Delete thread?")) database.ref('boards/myvt/threads/' + threadId).remove();
}
function deleteReply(threadId, replyId) {
    if (confirm("Delete reply?")) database.ref('boards/myvt/threads/' + threadId + '/replies/' + replyId).remove();
}

// --- 6. SUBMIT ---
document.getElementById('postForm').addEventListener('submit', function(e) {
    e.preventDefault();
    const name = document.getElementById('nameInput').value || "Anonymous";
    const comment = document.getElementById('commentInput').value;
    const image = document.getElementById('imageInput').value;
    if (!comment) return alert("Comment required");
    
    if (image) {
        const allowed = /(\.jpg|\.jpeg|\.png|\.gif|\.webp)$/i;
        if (!allowed.exec(image)) return alert("Invalid Image URL");
    }

    const now = Date.now();
    const postData = { name, comment, image, timestamp: now };

    if (currentThreadId) {
        database.ref('boards/myvt/threads/' + currentThreadId + '/replies').push(postData);
        database.ref('boards/myvt/threads/' + currentThreadId).update({ lastUpdated: now });
    } else {
        postData.subject = document.getElementById('subjectInput').value;
        postData.lastUpdated = now;
        database.ref('boards/myvt/threads').push(postData);
    }

    document.getElementById('commentInput').value = "";
    document.getElementById('imageInput').value = "";
    document.getElementById('subjectInput').value = "";
});

// --- 7. HELPERS ---
function highlightPost(id) {
    const el = document.getElementById('post_' + id);
    if(el) el.style.background = "#f5c0c0";
}
function unhighlightPost(id) {
    const el = document.getElementById('post_' + id);
    if(el) el.style.background = "";
}
function renderImage(url) {
    if (!url) return "";
    return `<img src="${url}" class="thread-image" onclick="openLightbox('${url}')">`;
}
function openLightbox(url) {
    document.getElementById('lightboxImg').src = url;
    document.getElementById('lightbox').style.display = 'flex';
}
function closeLightbox() {
    document.getElementById('lightbox').style.display = 'none';
}
function escapeHtml(text) {
    if (!text) return "";
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}