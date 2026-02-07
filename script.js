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
    if (hash.startsWith("#thread_")) {
        const id = hash.replace("#thread_", "");
        currentThreadId = id;
        loadThreadView(id);
    } else {
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
            div.innerHTML += `
            <div class="thread-card">
                ${renderImage(thread.image)}
                <div class="post-info">
                    <span class="subject">${thread.subject || ""}</span>
                    <span class="name">${thread.name}</span>
                    <span class="time">${new Date(thread.timestamp).toLocaleString()}</span>
                    <a href="#thread_${thread.id}" class="reply-link">[Reply]</a>
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
    document.getElementById('subjectInput').style.display = "none";

    database.ref('boards/myvt/threads/' + threadId).once('value').then((snap) => {
        const op = snap.val();
        if(!op) return;
        
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

    // VALIDATION: Check Image Extension
    if (image) {
        // Regex to check if end of string matches allowed extensions
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

// --- 4. LIGHTBOX & HELPER FUNCTIONS ---

// Modified Render Function for Lightbox
function renderImage(url) {
    if (!url) return "";
    // Note: onclick calls openLightbox with the URL
    return `<img src="${url}" class="thread-image" onclick="openLightbox('${url}')">`;
}

// Open the overlay
function openLightbox(url) {
    const lb = document.getElementById('lightbox');
    const img = document.getElementById('lightboxImg');
    
    img.src = url; // Set the big image
    lb.style.display = 'flex'; // Show the overlay
}

// Close the overlay
function closeLightbox() {
    document.getElementById('lightbox').style.display = 'none';
    document.getElementById('lightboxImg').src = ""; // Clear src to stop memory leaks
}

function escapeHtml(text) {
    if (!text) return "";
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}