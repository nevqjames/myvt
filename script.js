// --- STEP 1: CONFIGURATION ---
// Go to https://console.firebase.google.com/
// Create a new project -> Add Web App -> Copy config here
const firebaseConfig = {
  apiKey: "AIzaSyB-34VVrHjdEnDPDc6rDsBKUA8wLImF2bw",
  authDomain: "myvt-board.firebaseapp.com",
  projectId: "myvt-board",
  storageBucket: "myvt-board.firebasestorage.app",
  messagingSenderId: "609061476847",
  appId: "1:609061476847:web:85841c6f06a7ff6d8e7e1a",
  measurementId: "G-7TF8SF89DE"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const database = firebase.database();

// --- STEP 2: REFERENCES ---
// We store everything under 'boards/myvt'
const boardRef = database.ref('boards/myvt/posts');
const container = document.getElementById('boardContainer');

// --- STEP 3: SUBMIT NEW POST ---
document.getElementById('postForm').addEventListener('submit', function(e) {
    e.preventDefault(); // Stop page refresh

    const name = document.getElementById('nameInput').value || "Anonymous";
    const subject = document.getElementById('subjectInput').value;
    const comment = document.getElementById('commentInput').value;
    const imageUrl = document.getElementById('imageInput').value;

    if (!comment) return alert("Comment is required!");

    // Create the data object
    const newPost = {
        name: name,
        subject: subject,
        comment: comment,
        image: imageUrl,
        timestamp: Date.now()
    };

    // Push to Firebase (It creates a unique ID automatically)
    boardRef.push(newPost, (error) => {
        if (error) {
            alert("Error posting: " + error.message);
        } else {
            // Clear form on success
            document.getElementById('commentInput').value = "";
            document.getElementById('imageInput').value = "";
            document.getElementById('subjectInput').value = "";
        }
    });
});

// --- STEP 4: LOAD POSTS (Realtime) ---
// This runs once on load, and again every time someone posts
boardRef.limitToLast(50).on('value', (snapshot) => {
    container.innerHTML = ""; // Clear current list
    
    const data = snapshot.val();
    
    if (!data) {
        container.innerHTML = "<p style='text-align:center'>No threads yet. Be the first!</p>";
        return;
    }

    // Firebase returns an object of objects. We want an array to sort.
    // We reverse it to show newest threads at top (standard imageboard style)
    const postsArray = Object.entries(data).reverse();

    postsArray.forEach(([id, post]) => {
        renderPost(id, post);
    });
});

// --- STEP 5: RENDER HTML ---
function renderPost(id, post) {
    // Format Date
    const date = new Date(post.timestamp).toLocaleString();
    
    // Check if there is an image
    let imageHtml = "";
    if (post.image) {
        imageHtml = `<a href="${post.image}" target="_blank">
                        <img src="${post.image}" class="thread-image">
                     </a>`;
    }

    // Build the HTML
    const html = `
    <div class="thread" id="${id}">
        <div class="post-info">
            <span class="subject">${post.subject || ""}</span> 
            <span class="name">${post.name}</span> 
            <span class="time">${date}</span>
            <span class="post-id">No. ${id.substring(1,8)}</span> <!-- Fake ID -->
        </div>
        <br>
        ${imageHtml}
        <blockquote class="comment">${escapeHtml(post.comment)}</blockquote>
    </div>`;

    container.innerHTML += html;
}

// Security: Prevent HTML injection (XSS)
function escapeHtml(text) {
    if (!text) return text;
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}