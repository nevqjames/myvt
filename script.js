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

// State Variables
let currentThreadId = null; // If null, we are on the main board. If set, we are viewing a thread.

// --- 1. ROUTING (SWITCHING PAGES) ---
// Listen for URL changes (like index.html#thread_123)
window.addEventListener('hashchange', router);
window.addEventListener('load', router);

function router() {
    const hash = window.location.hash;
    
    if (hash.startsWith("#thread_")) {
        // VIEW: SINGLE THREAD
        const id = hash.replace("#thread_", "");
        currentThreadId = id;
        loadThreadView(id);
    } else {
        // VIEW: BOARD INDEX
        currentThreadId = null;
        loadBoardView();
    }
}

// --- 2. VIEW LOGIC ---

function loadBoardView() {
    document.getElementById('boardView').style.display = "block";
    document.getElementById('threadView').style.display = "none";
    document.getElementById('formTitle').innerText = "Create New Thread";
    document.getElementById('subjectInput').style.display = "block"; // Show Subject for new threads

    const listRef = database.ref('boards/myvt/threads');
    listRef.limitToLast(20).on('value', (snapshot) => {
        const div = document.getElementById('threadList');
        div.innerHTML = "";
        const data = snapshot.val();
        if (!data) return;

        // Convert to array and reverse
        Object.entries(data).reverse().forEach(([id, thread]) => {
            // Only show the OP (Original Post) info here
            div.innerHTML += `
            <div class="thread-card">
                ${renderImage(thread.image)}
                <div class="post-info">
                    <span class="subject">${thread.subject || ""}</span>
                    <span class="name">${thread.name}</span>
                    <span class="time">${new Date(thread.timestamp).toLocaleString()}</span>
                    <a href="#thread_${id}" class="reply-link">[Reply]</a>
                </div>
                <blockquote class="comment">${escapeHtml(thread.comment)}</blockquote>
            </div>`;
        });
    });
}

function loadThreadView(threadId) {
    document.getElementById('boardView').style.display = "none";
    document.getElementById('threadView').style.display = "block";
    document.getElementById('formTitle').innerText = "Reply to Thread " + threadId.substring(0,6);
    document.getElementById('subjectInput').style.display = "none"; // Hide Subject for replies

    // 1. Load OP (The main thread starter)
    database.ref('boards/myvt/threads/' + threadId).once('value').then((snap) => {
        const op = snap.val();
        document.getElementById('opContainer').innerHTML = `
            <div class="thread-card">
                ${renderImage(op.image)}
                <div class="post-info">
                    <span class="subject">${op.subject || ""}</span>
                    <span class="name">${op.name}</span>
                    <span class="time">${new Date(op.timestamp).toLocaleString()}</span>
                    <span class="post-id">No. ${threadId}</span>
                </div>
                <blockquote class="comment">${escapeHtml(op.comment)}</blockquote>
            </div>`;
    });

    // 2. Load Replies (Live Listener)
    database.ref('boards/myvt/threads/' + threadId + '/replies').on('value', (snapshot) => {
        const div = document.getElementById('repliesContainer');
        div.innerHTML = "";
        const data = snapshot.val();
        if (!data) return;

        Object.entries(data).forEach(([id, reply]) => {
            div.innerHTML += `
            <div class="reply">
                <div class="post-info">
                    <span class="name">${reply.name}</span>
                    <span class="time">${new Date(reply.timestamp).toLocaleString()}</span>
                    <span class="post-id">No. ${id.substring(1,8)}</span>
                </div>
                <br>
                ${renderImage(reply.image)}
                <blockquote class="comment">${escapeHtml(reply.comment)}</blockquote>
            </div>`;
        });
    });
}

// --- 3. SUBMIT LOGIC ---
document.getElementById('postForm').addEventListener('submit', function(e) {
    e.preventDefault();

    const name = document.getElementById('nameInput').value || "Anonymous";
    const comment = document.getElementById('commentInput').value;
    const image = document.getElementById('imageInput').value;
    
    if (!comment) return alert("Comment is required");

    const postData = {
        name: name,
        comment: comment,
        image: image,
        timestamp: Date.now()
    };

    if (currentThreadId) {
        // CASE A: We are replying to an existing thread
        database.ref('boards/myvt/threads/' + currentThreadId + '/replies').push(postData);
    } else {
        // CASE B: We are making a NEW thread
        postData.subject = document.getElementById('subjectInput').value; // Add subject only for threads
        database.ref('boards/myvt/threads').push(postData);
    }

    // Clear form
    document.getElementById('commentInput').value = "";
    document.getElementById('imageInput').value = "";
    document.getElementById('subjectInput').value = "";
});

// --- HELPER FUNCTIONS ---
function renderImage(url) {
    if (!url) return "";
    return `<a href="${url}" target="_blank"><img src="${url}" class="thread-image"></a>`;
}

function escapeHtml(text) {
    if (!text) return "";
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}