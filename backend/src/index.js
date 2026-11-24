// IdeaNote backend: Cloudflare Worker + D1
// Xác thực bằng header "Authorization: Bearer <API_SECRET>"
// Đồng bộ kiểu "bản mới nhất thắng" dựa trên updated_at.

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });

export default {
  async fetch(request, env) {
    const auth = request.headers.get("authorization") || "";
    if (!env.API_SECRET || auth !== `Bearer ${env.API_SECRET}`) {
      return json({ error: "unauthorized" }, 401);
    }

    const url = new URL(request.url);

    // GET /notes?since=<ms>  -> các ghi chú thay đổi sau mốc since (gồm cả đã xoá)
    if (request.method === "GET" && url.pathname === "/notes") {
      const since = Number(url.searchParams.get("since") || 0);
      const { results } = await env.DB.prepare(
        "SELECT * FROM notes WHERE updated_at > ? ORDER BY updated_at ASC"
      )
        .bind(since)
        .all();
      return json({ notes: results, now: Date.now() });
    }

    // POST /notes  body: { notes: [...] } -> upsert, bản có updated_at mới hơn thắng
    if (request.method === "POST" && url.pathname === "/notes") {
      const body = await request.json();
      const list = Array.isArray(body.notes) ? body.notes : [];
      const stmt = env.DB.prepare(
        `INSERT INTO notes (id, project, type, priority, status, title, body, created_at, updated_at, deleted)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           project=excluded.project, type=excluded.type, priority=excluded.priority,
           status=excluded.status, title=excluded.title, body=excluded.body,
           updated_at=excluded.updated_at, deleted=excluded.deleted
         WHERE excluded.updated_at > notes.updated_at`
      );
      if (list.length) {
        await env.DB.batch(
          list.map((n) =>
            stmt.bind(
              String(n.id),
              String(n.project || ""),
              String(n.type || "idea"),
              String(n.priority || "medium"),
              String(n.status || "new"),
              String(n.title || ""),
              String(n.body || ""),
              Number(n.created_at || Date.now()),
              Number(n.updated_at || Date.now()),
              n.deleted ? 1 : 0
            )
          )
        );
      }
      return json({ ok: true, count: list.length });
    }

    return json({ error: "not found" }, 404);
  },
};
