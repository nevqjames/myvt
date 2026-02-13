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
    // 1. Find all quotes (>>ID) on the page
    const allQuotes = document.querySelectorAll('.quote-link');
    
    allQuotes.forEach(link => {
        // Get the ID of the post DOING the quoting (The Child)
        const replierDiv = link.closest('[id^="post_"]');
        if (!replierDiv) return;
        const replierId = replierDiv.id.replace("post_", "");

        // Get the ID of the post BEING quoted (The Parent)
        const href = link.getAttribute('href');
        if (!href || !href.includes('#post_')) return;
        const targetId = href.split('#post_')[1];

        // 2. Find the Parent's backlink container
        const container = document.getElementById('backlinks_' + targetId);
        
        if (container) {
            // 3. CHECK: Does this backlink ALREADY exist?
            // We search for an existing link pointing to the Replier ID
            const exists = container.querySelector(`a[href="#post_${replierId}"]`);

            if (!exists) {
                // Limit to 10 backlinks to prevent overflow
                if (container.childElementCount < 10) {
                    const displayId = replierId.substring(1, 8);
                    
                    // Create the little red link
                    const newLink = document.createElement('a');
                    newLink.href = `#post_${replierId}`;
                    newLink.className = 'backlink';
                    newLink.innerHTML = `&gt;&gt;${displayId}`;
                    
                    // Add Hover Effects
                    newLink.onmouseenter = () => highlightPost(replierId);
                    newLink.onmouseleave = () => unhighlightPost(replierId);
                    
                    container.appendChild(newLink);
                }
            }
        }
    });
}