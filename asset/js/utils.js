// ==========================================
// UTILS.JS - Helpers & Text Processing
// ==========================================

// Get list of my own posts from storage
const MY_POSTS = JSON.parse(localStorage.getItem('my_posts') || "[]");

function escapeHtml(text) {
    if (!text) return "";
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function formatComment(text) {
    if (!text) return "";
    let formatted = escapeHtml(text);
    
    // Quote Links (>>ID)
    const quoteRegex = /&gt;&gt;([a-zA-Z0-9\-_]+)/g;
    formatted = formatted.replace(quoteRegex, (m, id) => {
        // Check if I own this post ID
        const isMe = MY_POSTS.includes(id);
        const youTag = isMe ? ` <span style="font-weight:bold; font-style:italic; font-size:0.9em;">(You)</span>` : "";
        
        return `<a href="#post_${id}" class="quote-link">>>${id.substring(1,8)}</a>${youTag}`;
    });
    
    // 2. NEW: Auto-Linkify URLs (http/https)
    // Matches http:// or https:// followed by non-whitespace characters
    const urlRegex = /(https?:\/\/[^\s<]+)/g;
    formatted = formatted.replace(urlRegex, (url) => {
        return `<a href="${url}" target="_blank" style="color:var(--main-accent); text-decoration:underline;">${url}</a>`;
    });

    // 3. Greentext (>text)
    const greenRegex = /^(&gt;[^&].*)$/gm;
    formatted = formatted.replace(greenRegex, '<span style="color:#2e7d32;">$1</span>');
    
    return formatted;
}

function quotePost(postId, threadId) {
    // Scenario 1: We are on the Board View (or a different thread)
    // We need to jump to the correct thread first.
    if (!currentThreadId || currentThreadId !== threadId) {
        // Save the quote to browser memory
        sessionStorage.setItem('pending_quote', '>>' + postId);
        
        // Redirect to the correct thread
        window.location.hash = '#thread_' + threadId;
        return;
    }

    // Scenario 2: We are already in the correct thread
    const box = document.getElementById('commentInput');
    
    // Add new line if box isn't empty
    const prefix = box.value.length > 0 ? '\n' : '';
    
    box.value += `${prefix}>>${postId}\n`;
    box.focus();
    
    // Scroll to form
    document.getElementById('postForm').scrollIntoView();
}

function highlightPost(id) { 
    const el = document.getElementById('post_'+id); 
    if(el) el.style.boxShadow = "0 0 10px var(--main-accent)"; 
}

function unhighlightPost(id) { 
    const el = document.getElementById('post_'+id); 
    if(el) el.style.boxShadow = ""; 
}

function generateBacklinks() {
    // 1. Clear ALL existing backlinks first. 
    // This ensures we start fresh and catch updates without duplication logic issues.
    document.querySelectorAll('.backlink-container').forEach(el => el.innerHTML = "");

    // 2. Scan every comment on the page
    const allComments = document.querySelectorAll('.comment');
    
    allComments.forEach(commentDiv => {
        // Identify the Replier (The Child)
        const replierDiv = commentDiv.closest('[id^="post_"]'); 
        if (!replierDiv) return;
        const replierId = replierDiv.id.replace("post_", "");

        // Find every quote (>>ID) in this comment
        const links = commentDiv.querySelectorAll('.quote-link');
        
        links.forEach(link => {
            // Identify the Target (The Parent)
            const href = link.getAttribute('href');
            if(!href || !href.includes('#post_')) return;
            
            // Extract pure ID
            const targetId = href.split('#post_')[1];
            
            // 3. Find the container of the Parent post
            const container = document.getElementById('backlinks_' + targetId);
            
            if (container) {
                // Limit visual clutter (max 15 backlinks)
                if (container.childElementCount < 15) {
                    const displayId = replierId.substring(1,8);
                    
                    // Create the link
                    const newLink = document.createElement('a');
                    newLink.href = `#post_${replierId}`;
                    newLink.className = 'backlink';
                    newLink.innerHTML = `&gt;&gt;${displayId}`;
                    
                    // Add Highlight Events
                    newLink.onmouseenter = () => highlightPost(replierId);
                    newLink.onmouseleave = () => unhighlightPost(replierId);
                    
                    container.appendChild(newLink);
                }
            }
        });
    });
}