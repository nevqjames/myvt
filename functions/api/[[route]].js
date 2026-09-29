// ========================================================
// CLOUDFLARE PAGES FUNCTIONS: D1 REST API ENDPOINT
// This file executes on Cloudflare Pages using context.env.DB
// ========================================================

const BOARDS = {
    'myvt':  { title: '/myvt/ - MY VTuber',             type: 'sfw' },
    'vt':    { title: '/vt/ - SEA & Global VTuber',     type: 'sfw' },
    'vg':    { title: '/vg/ - Video Games',             type: 'sfw' },
    'amg':   { title: '/amg/ - Anime & Manga',          type: 'sfw' },
    'ca':    { title: '/ca/ - Cosplay & Art',           type: 'sfw' },
    'tech':  { title: '/tech/ - Tech Stuff',            type: 'sfw' },
    'mamak': { title: '/mamak/ - MY Stuff & Off-topic', type: 'sfw' },
    'rqr':   { title: '/rqr/ - Board Request & Report', type: 'sfw' },
    'myvth': { title: '/myvth/ - MY VTuber Ecchi & H',  type: 'nsfw' },
    'vth':   { title: '/vth/ - Vtuber Ecchi & H',       type: 'nsfw' },
    'hm':    { title: '/hm/ - H Media',                 type: 'nsfw' },
    'hg':    { title: '/hg/ - H Games',                 type: 'nsfw' }
};

const ARCHIVE_TIME_MS = 3 * 24 * 60 * 60 * 1000;

function json(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': '*'
        }
    });
}

async function getUser(request, env) {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
    const token = authHeader.substring(7);
    try {
        const session = await env.DB.prepare(
            'SELECT token, user_id, role, username, display_title FROM sessions WHERE token = ?'
        ).bind(token).first();
        return session || null;
    } catch {
        return null;
    }
}

export async function onRequest(context) {
    const { request, env } = context;
    const url = new URL(request.url);
    const path = url.pathname.replace('/api/', '').split('/').filter(Boolean);
    const method = request.method;

    if (method === 'OPTIONS') {
        return new Response(null, {
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': '*'
            }
        });
    }

    const route = path[0] || '';
    const user = await getUser(request, env);

    try {
        // 1. GET /api/boards
        if (route === 'boards' && method === 'GET') {
            const stats = await env.DB.prepare(
                'SELECT board, COUNT(*) as thread_count, MAX(bumped_at) as last_activity FROM threads GROUP BY board'
            ).all();

            const statMap = {};
            if (stats.results) {
                for (const s of stats.results) statMap[s.board] = s;
            }

            const result = {};
            for (const [k, v] of Object.entries(BOARDS)) {
                result[k] = {
                    ...v,
                    thread_count: statMap[k]?.thread_count || 0,
                    last_activity: statMap[k]?.last_activity || 0
                };
            }
            return json({ success: true, boards: result });
        }

        // 2. GET /api/threads
        if (route === 'threads' && method === 'GET') {
            const board = url.searchParams.get('b');
            const isArchive = url.searchParams.get('view') === 'archive';
            if (!board || !BOARDS[board]) return json({ error: 'Invalid board' }, 400);

            const cutoff = Date.now() - ARCHIVE_TIME_MS;
            let sql = `
                SELECT t.*, (SELECT COUNT(*) FROM replies r WHERE r.thread_id = t.id) as reply_count
                FROM threads t WHERE t.board = ?
            `;
            if (isArchive) {
                sql += ` AND t.bumped_at < ${cutoff} ORDER BY t.bumped_at DESC LIMIT 100`;
            } else {
                sql += ` ORDER BY t.is_pinned DESC, t.bumped_at DESC LIMIT 50`;
            }

            const list = await env.DB.prepare(sql).bind(board).all();
            const threads = list.results || [];

            // Attach preview replies
            for (const th of threads) {
                const prev = await env.DB.prepare(
                    'SELECT * FROM (SELECT * FROM replies WHERE thread_id = ? ORDER BY created_at DESC LIMIT 3) ORDER BY created_at ASC'
                ).bind(th.id).all();
                th.preview_replies = prev.results || [];
            }

            return json({ success: true, threads });
        }

        // 3. GET /api/thread?id=...
        if (route === 'thread' && method === 'GET') {
            const id = url.searchParams.get('id');
            if (!id) return json({ error: 'Missing id' }, 400);

            const thread = await env.DB.prepare('SELECT * FROM threads WHERE id = ?').bind(id).first();
            if (!thread) return json({ error: 'Not found' }, 404);

            const replies = await env.DB.prepare('SELECT * FROM replies WHERE thread_id = ? ORDER BY created_at ASC').bind(id).all();
            return json({ success: true, thread, replies: replies.results || [] });
        }

        // 4. POST /api/threads
        if (route === 'threads' && method === 'POST') {
            const body = await request.json();
            const { board, name, subject, comment, media_url } = body;
            if (!board || !BOARDS[board] || !comment?.trim()) return json({ error: 'Invalid input' }, 400);

            const id = '-' + Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
            const now = Date.now();
            const clientIp = request.headers.get('cf-connecting-ip') || 'anon';

            await env.DB.prepare(`
                INSERT INTO threads (id, board, name, subject, comment, media_url, ip_hash, user_id, role, display_title, created_at, bumped_at, is_pinned, is_locked)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0)
            `).bind(
                id, board, (name?.trim() || 'Anonymous'), (subject?.trim() || ''), comment.trim(), (media_url?.trim() || ''),
                clientIp, user?.user_id || null, user?.role || null, user?.display_title || null, now, now
            ).run();

            const thread = await env.DB.prepare('SELECT * FROM threads WHERE id = ?').bind(id).first();
            return json({ success: true, thread });
        }

        // 5. POST /api/replies
        if (route === 'replies' && method === 'POST') {
            const body = await request.json();
            const { thread_id, name, comment, media_url } = body;
            if (!thread_id || !comment?.trim()) return json({ error: 'Missing comment or thread_id' }, 400);

            const thread = await env.DB.prepare('SELECT * FROM threads WHERE id = ?').bind(thread_id).first();
            if (!thread) return json({ error: 'Thread not found' }, 404);
            if (thread.is_locked) return json({ error: 'Thread is locked' }, 403);

            const id = '-' + Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
            const now = Date.now();
            const clientIp = request.headers.get('cf-connecting-ip') || 'anon';

            await env.DB.prepare(`
                INSERT INTO replies (id, thread_id, board, name, comment, media_url, ip_hash, user_id, role, display_title, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).bind(
                id, thread_id, thread.board, (name?.trim() || 'Anonymous'), comment.trim(), (media_url?.trim() || ''),
                clientIp, user?.user_id || null, user?.role || null, user?.display_title || null, now
            ).run();

            await env.DB.prepare('UPDATE threads SET bumped_at = ? WHERE id = ?').bind(now, thread_id).run();

            const reply = await env.DB.prepare('SELECT * FROM replies WHERE id = ?').bind(id).first();
            return json({ success: true, reply });
        }

        // 6. POST /api/auth/login
        if (route === 'auth' && path[1] === 'login' && method === 'POST') {
            const { username, password } = await request.json();
            const u = await env.DB.prepare('SELECT * FROM users WHERE username = ? COLLATE NOCASE').bind(username).first();
            if (!u) return json({ error: 'Invalid credentials' }, 401);

            // Simple session generation
            const token = crypto.randomUUID();
            await env.DB.prepare(
                'INSERT INTO sessions (token, user_id, role, username, display_title, created_at) VALUES (?, ?, ?, ?, ?, ?)'
            ).bind(token, u.id, u.role, u.username, u.display_title, Date.now()).run();

            return json({
                success: true,
                token,
                user: { id: u.id, username: u.username, role: u.role, display_title: u.display_title }
            });
        }

        // 7. GET /api/auth/me
        if (route === 'auth' && path[1] === 'me') {
            return json({ success: true, user });
        }

        // 8. Admin Moderation
        if (route === 'admin' && (user?.role === 'admin' || user?.role === 'mod')) {
            const sub = path[1];
            const body = await request.json();

            if (sub === 'delete') {
                if (body.type === 'thread') {
                    await env.DB.prepare('DELETE FROM threads WHERE id = ?').bind(body.id).run();
                } else if (body.type === 'reply') {
                    await env.DB.prepare('DELETE FROM replies WHERE id = ?').bind(body.id).run();
                }
                return json({ success: true });
            }
            if (sub === 'pin') {
                const th = await env.DB.prepare('SELECT is_pinned FROM threads WHERE id = ?').bind(body.thread_id).first();
                const newPinned = th?.is_pinned ? 0 : 1;
                await env.DB.prepare('UPDATE threads SET is_pinned = ? WHERE id = ?').bind(newPinned, body.thread_id).run();
                return json({ success: true, is_pinned: newPinned });
            }
            if (sub === 'lock') {
                const th = await env.DB.prepare('SELECT is_locked FROM threads WHERE id = ?').bind(body.thread_id).first();
                const newLocked = th?.is_locked ? 0 : 1;
                await env.DB.prepare('UPDATE threads SET is_locked = ? WHERE id = ?').bind(newLocked, body.thread_id).run();
                return json({ success: true, is_locked: newLocked });
            }
        }

        return json({ error: 'Not Found' }, 404);
    } catch (err) {
        return json({ error: err.message }, 500);
    }
}
