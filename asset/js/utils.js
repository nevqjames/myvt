// ==========================================
// UTILS.JS - Helpers & Text Processing
// ==========================================

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
    formatted = formatted.replace(quoteRegex, (m, id) => 
        `<a href="#post_${id}" class="quote-link">>>${id.substring(1,8)}</a>`
    );
    
    // Greentext (>text)
    const greenRegex = /^(&gt;[^&].*)$/gm;
    formatted = formatted.replace(greenRegex, '<span style="color:#2e7d32;">$1</span>'); // Adjusted green for P3R theme
    
    return formatted;
}

function quotePost(id) {
    const box = document.getElementById('commentInput');
    box.value += `>>${id}\n`;
    box.focus();
    if(currentThreadId) document.getElementById('postForm').scrollIntoView();
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
    document.querySelectorAll('.backlink-container').forEach(el => el.innerHTML = "");
    const allComments = document.querySelectorAll('.comment');
    
    allComments.forEach(commentDiv => {
        const replierDiv = commentDiv.closest('[id^="post_"]'); 
        if (!replierDiv) return;
        const replierId = replierDiv.id.replace("post_", "");
        
        const links = commentDiv.querySelectorAll('.quote-link');
        links.forEach(link => {
            const href = link.getAttribute('href');
            if(!href || !href.includes('#post_')) return;
            const targetId = href.split('#post_')[1];
            
            const container = document.getElementById('backlinks_' + targetId);
            if (container) {
                // Prevent duplicate links
                if (!container.querySelector(`[href="#post_${replierId}"]`)) {
                    if (container.childElementCount < 10) {
                        const displayId = replierId.substring(1,8);
                        container.innerHTML += `<a href="#post_${replierId}" class="backlink" 
                            onmouseenter="highlightPost('${replierId}')" 
                            onmouseleave="unhighlightPost('${replierId}')">&gt;&gt;${displayId}</a>`;
                    }
                }
            }
        });
    });
}