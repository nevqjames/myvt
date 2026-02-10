// ==========================================
// CONFIG.JS - Setup & State
// ==========================================

// 1. FIREBASE CONFIG
const prodConfig = {
    apiKey: "AIzaSyB-34VVrHjdEnDPDc6rDsBKUA8wLImF2bw",
    authDomain: "myvt-board.firebaseapp.com",
    databaseURL: "https://myvt-board-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "myvt-board",
    storageBucket: "myvt-board.firebasestorage.app",
    messagingSenderId: "609061476847",
    appId: "1:609061476847:web:85841c6f06a7ff6d8e7e1a",
    measurementId: "G-7TF8SF89DE"
};

const devConfig = {
    apiKey: "AIzaSyBWM3qQIlXHfsmxHItxV2TD4gsoxtlHtIw",
    authDomain: "myvt-dev.firebaseapp.com",
    databaseURL: "https://myvt-dev-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "myvt-dev",
    storageBucket: "myvt-dev.firebasestorage.app",
    messagingSenderId: "538812482957",
    appId: "1:538812482957:web:2d5a38f15a60909a0ce9c4"
};

const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
const firebaseConfig = isLocal ? devConfig : prodConfig;

firebase.initializeApp(firebaseConfig);
const database = firebase.database();

if (isLocal) console.log("%c 🛠️ DEV MODE: Using Test Database ", "background: #222; color: #ffcc00;");

// 2. BOARD DEFINITIONS
const BOARDS = {
    // SFW
    'myvt':  { title: '/myvt/ - Malaysian Virtual Youtubers', type: 'sfw' },
    'vt':    { title: '/vt/ - Global & SEA VTubers',         type: 'sfw' },
    'v':     { title: '/v/ - Video Gaming',                  type: 'sfw' },
    'acg':   { title: '/acg/ - Anime & Events',              type: 'sfw' },
    'art':   { title: '/art/ - Fanart & Assets',             type: 'sfw' },
    'tech':  { title: '/tech/ - Rigging & Streaming',        type: 'sfw' },
    'mamak': { title: '/mamak/ - General / Off-topic',       type: 'sfw' },
    // NSFW
    'myvth': { title: '/myvth/ - MY VTuber Hentai',          type: 'nsfw' },
    'h':     { title: '/h/ - Hentai General',                type: 'nsfw' }
};

// 3. GLOBAL STATE
const urlParams = new URLSearchParams(window.location.search);
let currentBoard = urlParams.get('b'); 
let currentThreadId = null;
let isModMode = false; // Defined here so all files can see it

// Helper: Get Database Reference
function getBoardRef() {
    return database.ref('boards/' + currentBoard + '/threads');
}