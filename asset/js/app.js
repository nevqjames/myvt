// ==========================================
// APP.JS - Core Logic, Routing, Rendering
// ==========================================

// --- NSFW GATE ---
function checkNSFWGate() {
    if (currentBoard && BOARDS[currentBoard].type === 'nsfw') {
        if (!sessionStorage.getItem('nsfw_consent')) {
            document.body.classList.add('gate-active');
            document.getElementById('nsfwGate').style.display = 'flex';
            document.getElementById('gateBoardName').innerText = currentBoard;
            return false;
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

// --- ROUTER ---
window.addEventListener('hashchange', router);
window.addEventListener('load', router);

function router() {
    const hash = window.location.hash;
    if (hash === "#bottom") return;

    // View Elements
    const homeView = document.getElementById('homeView');
    const boardView = document.getElementById('boardView');
    const threadView = document.getElementById('threadView');
    const formWrapper = document.getElementById('formWrapper');
    const topDivider = document.getElementById('topDivider');

    document.body.classList.remove('night-mode');

    // 1. HOME PAGE
    if (!currentBoard || !BOARDS[currentBoard]) {
        homeView.style.display = "block";
        boardView.style.display = "none";
        threadView.style.display = "none";
        formWrapper.style.display = "none";
        topDivider.style.display = "none";
        document.getElementById('boardTitle').innerText = "MYVT - Portal";
        document.title = "MYVT - Portal";
        return;
    }

    // 2. BOARD / THREAD MODE
    homeView.style.display = "none";
    formWrapper.style.display = "block";
    topDivider.style.display = "block";
    
    document.title = BOARDS[currentBoard].title;
    document.getElementById('boardTitle').innerText = BOARDS[currentBoard].title;
    
    // Apply P5 Night Mode
    if (BOARDS[currentBoard].type === 'nsfw') document.body.classList.add('night-mode');

    if (!checkNSFWGate()) return;

    if (hash.startsWith("#thread_")) {
        currentThreadId = hash.replace("#thread_", "");
        loadThreadView(currentThreadId);
    } else {
        currentThreadId = null;
        loadBoardView();
    }
}

// Build Header Links
window.addEventListener('DOMContentLoaded', () => {
    const navContainer = document.getElementById('navBoards');
    if (!currentBoard || !BOARDS[currentBoard]) return; // Don't build nav on home
    
    const currentType = BOARDS[currentBoard].type;
    let html = "";
    for (const [key, data] of Object.entries(BOARDS)) {
        if (data.type === currentType) {
            const isActive = (key === currentBoard) ? 'style="font-weight:900; border-bottom: 2px solid;"' : '';
            html += `[ <a href="?b=${key}" ${isActive}>/${key}/</a> ] `;
        }
    }
    if (currentType === 'nsfw') html += `<br><span style="font-size:0.8em;">[ <a href="?b=myvt">Return to Surface</a> ]</span>`;
    navContainer.innerHTML = html;
});

// --- VIEW LOADERS ---
function loadBoardView() {
    document.getElementById('boardView').style.display = "block";
    document.getElementById('threadView').style.display = "none";
    document.getElementById('formTitle').innerText = "Create New Thread";
    document.getElementById('subjectInput').style.display = "block";

    getBoardRef().orderByChild('lastUpdated').limitToLast(20).on('value', (snapshot) => {
        const div = document.getElementById('threadList');
        div.innerHTML = "";
        const data = snapshot.val();
        if (!data) return;

        const sortedThreads = [];
        snapshot.forEach((childSnap) => { sortedThreads.push({ id: childSnap.key, ...childSnap.val() }); });
        
        sortedThreads.reverse().forEach((thread) => {
            const totalReplies = thread.replies ? Object.keys(thread.replies).length : 0;
            let threadHtml = renderThreadCard(thread.id, thread, true, totalReplies);

            if (thread.replies) {
                const repliesArr = Object.entries(thread.replies).sort((a, b) => a[1].timestamp - b[1].timestamp);
                repliesArr.slice(-2).forEach(([rId, rData]) => {
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

    // 1. Load OP (Original Post)
    database.ref('boards/' + currentBoard + '/threads/' + threadId).on('value', (snap) => {
        const op = snap.val();
        if(!op) { 
            // Handle deletion
            if(window.location.hash.includes(threadId)) window.location.hash = ""; 
            return; 
        }
        document.getElementById('opContainer').innerHTML = renderThreadCard(threadId, op, false);
        
        // Trigger backlinks immediately after OP loads
        generateBacklinks();
    });

    // 2. Load Replies (The part that updates live)
    database.ref('boards/' + currentBoard + '/threads/' + threadId + '/replies').on('value', (snapshot) => {
        const div = document.getElementById('repliesContainer');
        div.innerHTML = "";
        const data = snapshot.val();
        
        if (data) {
            Object.entries(data).forEach(([id, reply]) => {
                div.innerHTML += renderReply(id, reply, threadId);
            });
        }

        // --- FIX: TRIPLE TRIGGER STRATEGY ---
        // 1. Run immediately (for fast PCs)
        generateBacklinks(); 
        
        // 2. Run after 100ms (standard delay)
        setTimeout(generateBacklinks, 100); 
        
        // 3. Run after 500ms (catch-all for laggy mobile rendering)
        setTimeout(generateBacklinks, 500);
    });
}

// --- RENDERERS ---
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
            <span style="cursor:pointer;" onclick="window.location.hash='#thread_${id}'">View Context &#9660;</span>
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

// --- SUBMIT ---
document.getElementById('postForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    const comment = document.getElementById('commentInput').value;
    const image = document.getElementById('imageInput').value.trim();
    if (!comment) return alert("Comment required");

    const btn = document.getElementById('submitBtn');
    btn.disabled = true; btn.innerText = "Sending...";

    if (!(await validateMediaUrl(image))) { 
        alert("Invalid URL"); 
        btn.disabled = false; btn.innerText = "Submit Post"; return; 
    }

    let userIP = "Unknown";
    try { const resp = await fetch('https://api.ipify.org?format=json'); const data = await resp.json(); userIP = data.ip; } catch (err) {}

    const now = Date.now();
    const postData = { name: document.getElementById('nameInput').value || "Anonymous", comment, image, timestamp: now, ip: userIP };

    try {
        if (currentThreadId) {
            await database.ref('boards/' + currentBoard + '/threads/' + currentThreadId + '/replies').push(postData);
            await database.ref('boards/' + currentBoard + '/threads/' + currentThreadId).update({ lastUpdated: now });
        } else {
            postData.subject = document.getElementById('subjectInput').value;
            postData.lastUpdated = now;
            await getBoardRef().push(postData);
        }
        document.getElementById('commentInput').value = document.getElementById('imageInput').value = document.getElementById('subjectInput').value = "";
    } catch(e) { alert("Error: " + e.message); }
    finally { 
        btn.disabled = false; btn.innerText = "Submit Post"; 
        if (!currentThreadId) setTimeout(loadBoardView, 500); 
    }
});