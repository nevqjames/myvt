// ==========================================
// MEDIA.JS - Images, Video, Lightbox, Upload
// ==========================================

const IMGBB_API_KEY = "6d885f930c72cd28e6520e6c7494704f";

// --- DETECTION & RENDERING ---
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

// --- LIGHTBOX ---
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
        // Dark theme for P5 mode, Light for P3R
        const theme = BOARDS[currentBoard].type === 'nsfw' ? 'dark' : 'light';
        frame.src = `https://platform.twitter.com/embed/Tweet.html?id=${content}&theme=${theme}`; 
        frame.style.display = 'block'; 
        frame.style.width = "550px"; 
    }
    lb.style.display = 'flex';
}

function closeLightbox(e) {
    if (e.target.id === 'lightbox' || e.target.id === 'lightboxContent') {
        document.getElementById('lightbox').style.display = 'none';
        document.getElementById('lbVideo').pause();
        document.getElementById('lbVideo').src = "";
        document.getElementById('lbFrame').src = "";
    }
}

// --- IMGBB UPLOAD ---
document.addEventListener('DOMContentLoaded', () => {
    const uploadBtn = document.getElementById('uploadBtn');
    if (!uploadBtn) return;
    const hiddenInput = document.getElementById('hiddenFileInput');
    const urlInput = document.getElementById('imageInput');

    uploadBtn.onclick = () => hiddenInput.click();

    hiddenInput.onchange = async () => {
        const file = hiddenInput.files[0];
        if (!file) return;

        uploadBtn.innerText = "UP..."; 
        uploadBtn.disabled = true;
        const formData = new FormData(); 
        formData.append("image", file);

        try {
            const resp = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, { method: "POST", body: formData });
            const result = await resp.json();
            if (result.success) { 
                urlInput.value = result.data.url; 
                urlInput.focus(); 
            } else {
                alert("Upload Failed: " + result.error.message);
            }
        } catch (err) { 
            alert("Network Error during upload"); 
        } finally { 
            uploadBtn.innerText = "Upload Image"; 
            uploadBtn.disabled = false; 
            hiddenInput.value = ""; 
        }
    };
});