// --- STEP 1: CONFIGURATION ---
const firebaseConfig = {
  apiKey: "AIzaSyB-34VVrHjdEnDPDc6rDsBKUA8wLImF2bw",
  authDomain: "myvt-board.firebaseapp.com",
  databaseURL: "https://myvt-board-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "myvt-board",
  storageBucket: "myvt-board.firebasestorage.app",
  messagingSenderId: "609061476847",
  appId: "1:609061476847:web:85841c6f06a7ff6d8e7e1a",
  measurementId: "G-7TF8SF89DE"
}; // <--- FIXED: Closed the object here

firebase.initializeApp(firebaseConfig);
const database = firebase.database();

let currentThreadId = null;

// --- 1. ROUTING ---
window.addEventListener('hashchange', router);
window.addEventListener('load', router);

function router() {
    const hash = window.location.hash;
    // Check if we are linking to a specific post anchor (e.g. #post_123)
    if (hash.startsWith("#thread_")) {
        const id = hash.replace("#thread_", "");
        currentThreadId = id;
        loadThreadView(id);
    } else if (!hash.startsWith("#post_")) {
        currentThreadId = null;
        loadBoardView();
    }
    // If it starts with #post_, we do nothing and let the browser scroll naturally
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
            // NOTE: We do NOT generate backlinks on the Board Index (too slow)
            div.innerHTML += renderThreadCard(thread.id, thread, true);
        });
    });
}

function loadThreadView(threadId) {
    document.getElementById('boardView').style.display = "none";
    document.getElementById('threadView').style.display = "block";
    document.getElementById('formTitle').innerText = "Reply to Thread " + threadId.substring(1,8);
    document.getElementById('subjectInput').style.display = "none";

    // 1. Load OP
    database.ref('boards/myvt/threads/' + threadId).once('value').then((snap) => {
        const op = snap.val();
        if(!op) return;
        
        document.getElementById('opContainer').innerHTML = renderThreadCard(threadId, op, false); // False = Not preview
    });

    // 2. Load Replies
    database.ref('boards/myvt/threads/' + threadId + '/replies').on('value', (snapshot) => {
        const div = document.getElementById('repliesContainer');
        div.innerHTML = "";
        const data = snapshot.val();
        
        if (data) {
            Object.entries(data).forEach(([id, reply]) => {
                div.innerHTML += renderReply(id, reply);
            });
        }
        
        // --- NEW: GENERATE BACKLINKS ---
        // After all HTML is injected, we calculate who replied to who
        setTimeout(generateBacklinks, 500);
    });
}

// --- 3. RENDER FUNCTIONS (HTML GENERATION) ---

// Render OP (Thread Starter)
function renderThreadCard(id, data, isPreview) {
    const displayId = id.substring(1,8); // Shorten ID for display
    const date = new Date(data.timestamp).toLocaleString();
    const replyLink = isPreview ? `<a href="#thread_${id}" class="reply-link">[Reply]</a>` : "";
    
    // On Click ID -> Quote this post
    const idHtml = `<span class="post-id" onclick="quotePost('${id}')">No. ${displayId}</span>`;

    return `
    <div class="thread-card" id="post_${id}">
        ${renderImage(data.image)}
        <div class="post-info">
            <span class="subject">${data.subject || ""}</span>
            <span class="name">${data.name}</span>
            <span class="time">${date}</span>
            ${idHtml}
            ${replyLink}
        </div>
        <blockquote class="comment">${formatComment(data.comment)}</blockquote>
        <div class="backlink-container" id="backlinks_${id}"></div> <!-- Container for incoming links -->
    </div>`;
}

// Render Reply
function renderReply(id, data) {
    const displayId = id.substring(1,8);
    const date = new Date(data.timestamp).toLocaleString();
    const idHtml = `<span class="post-id" onclick="quotePost('${id}')">No. ${displayId}</span>`;

    return `
    <div class="reply" id="post_${id}">
        <div class="post-info">
            <span class="name">${data.name}</span>
            <span class="time">${date}</span>
            ${idHtml}
        </div>
        <br>
        ${renderImage(data.image)}
        <blockquote class="comment">${formatComment(data.comment)}</blockquote>
        <div class="backlink-container" id="backlinks_${id}"></div>
    </div>`;
}

// --- 4. QUOTING & BACKLINK LOGIC ---

// Helper: When clicking a post number, insert ">>ID" into text box
function quotePost(id) {
    const box = document.getElementById('commentInput');
    const displayId = id.substring(1,8); // We use short ID for quoting to look nice
    // BUT internally we need to map this short ID back to long ID later if needed.
    // For this simple version, we will assume users quote the full ID if they type it,
    // or we just inject the full ID for accuracy.
    
    // Let's use Full ID for accuracy, but it looks ugly. 
    // Optimization: Inject Full ID.
    box.value += `>>${id}\n`;
    box.focus();
    
    // Scroll to form if in thread view
    if(currentThreadId) {
        document.getElementById('postForm').scrollIntoView();
    }
}

// Helper: Turn ">>ID" text into Blue Links
function formatComment(text) {
    if (!text) return "";
    let formatted = escapeHtml(text);

    // Regex: Find ">>" followed by characters (the ID)
    // We turn it into <a href="#post_ID" class="quote-link">>>ID</a>
    formatted = formatted.replace(/>>([a-zA-Z0-9\-_]+)/g, function(match, id) {
        // Display only first 8 chars of ID in the text to keep it clean
        const displayId = id.length > 8 ? id.substring(1,8) : id;
        return `<a href="#post_${id}" class="quote-link">&gt;&gt;${displayId}</a>`;
    });

    return formatted;
}

// Helper: The Magic Backlink Generator
function generateBacklinks() {
    // 1. Clear all existing backlinks (to prevent duplicates if real-time updates happen)
    document.querySelectorAll('.backlink-container').forEach(el => el.innerHTML = "");

    // 2. Find all comments on the page
    const allComments = document.querySelectorAll('.comment');

    allComments.forEach(commentDiv => {
        // Get the ID of the post WRITING the quote (The replier)
        // Structure is <div id="post_XYZ"> ... <blockquote ...>
        const replierPostDiv = commentDiv.closest('[id^="post_"]'); 
        if (!replierPostDiv) return;
        const replierId = replierPostDiv.id.replace("post_", "");

        // 3. Find links inside this comment
        const links = commentDiv.querySelectorAll('.quote-link');
        
        links.forEach(link => {
            // Get the ID being quoted (The target)
            const href = link.getAttribute('href'); // #post_XYZ
            if (!href) return;
            
            const targetId = href.replace("#post_", "");
            
            // 4. Find the container of the Target post
            const backlinkContainer = document.getElementById('backlinks_' + targetId);
            
            if (backlinkContainer) {
                // Constraint: Limit to 10 backlinks
                if (backlinkContainer.childElementCount < 10) {
                    const displayReplierId = replierId.substring(1,8);
                    
                    // Add the link: ">>1234567"
                    backlinkContainer.innerHTML += `<a href="#post_${replierId}" class="backlink" onmouseenter="highlightPost('${replierId}')" onmouseleave="unhighlightPost('${replierId}')">&gt;&gt;${displayReplierId}</a>`;
                }
            }
        });
    });
}

// Bonus: Highlight post when hovering over a backlink
function highlightPost(id) {
    const el = document.getElementById('post_' + id);
    if(el) el.style.background = "#f5c0c0"; // Light Red highlight
}
function unhighlightPost(id) {
    const el = document.getElementById('post_' + id);
    if(el) el.style.background = ""; // Reset
}

// --- 5. SUBMIT LOGIC ---
document.getElementById('postForm').addEventListener('submit', function(e) {
    e.preventDefault();

    const name = document.getElementById('nameInput').value || "Anonymous";
    const comment = document.getElementById('commentInput').value;
    const image = document.getElementById('imageInput').value;
    
    if (!comment) return alert("Comment is required");

    if (image) {
        const allowedExtensions = /(\.jpg|\.jpeg|\.png|\.gif|\.webp)$/i;
        if (!allowedExtensions.exec(image)) {
            return alert("Invalid Image! URL must end in .jpg, .png, .gif, or .webp");
        }
    }

    const now = Date.now();
    const postData = {
        name: name,
        comment: comment,
        image: image,
        timestamp: now
    };

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
    
    if (!currentThreadId) {
        setTimeout(() => loadBoardView(), 500); 
    }
});

// --- 6. LIGHTBOX & HELPERS ---
function renderImage(url) {
    if (!url) return "";
    return `<img src="${url}" class="thread-image" onclick="openLightbox('${url}')">`;
}

function openLightbox(url) {
    const lb = document.getElementById('lightbox');
    document.getElementById('lightboxImg').src = url;
    lb.style.display = 'flex';
}

function closeLightbox() {
    document.getElementById('lightbox').style.display = 'none';
    document.getElementById('lightboxImg').src = "";
}

function escapeHtml(text) {
    if (!text) return "";
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}