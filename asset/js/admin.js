// ==========================================
// ADMIN.JS - Authentication & Shortcuts
// ==========================================

function loadAdminScript(password) {
    const script = document.createElement('script');
    script.src = password + ".js";
    script.onload = () => {
        isModMode = true;
        localStorage.setItem('adminKey', password);
        document.body.classList.add('mod-mode-active');
        // Refresh router to show buttons
        if (typeof router === 'function') router(); 
    };
    script.onerror = () => {
        alert("Login Failed.");
        localStorage.removeItem('adminKey');
    };
    document.head.appendChild(script);
}

function tryLogin() {
    const pass = prompt("Enter Admin Password:");
    if (pass) loadAdminScript(pass);
}

// Auto-login on load
const savedKey = localStorage.getItem('adminKey');
if (savedKey) loadAdminScript(savedKey);

// Keyboard Shortcuts
window.addEventListener('keydown', (e) => {
    // Ctrl + Shift + L (Login)
    if (e.ctrlKey && e.shiftKey && (e.key === 'L' || e.key === 'l')) {
        e.preventDefault();
        tryLogin();
    }
    // Ctrl + Shift + O (Logout)
    if (e.ctrlKey && e.shiftKey && (e.key === 'O' || e.key === 'o')) {
        e.preventDefault();
        localStorage.removeItem('adminKey');
        location.reload();
    }
});

// Mobile Access
if (urlParams.has('mod')) tryLogin();
if (urlParams.has('logout')) {
    localStorage.removeItem('adminKey');
    location.reload();
}