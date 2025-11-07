// server/controllers/planController.js
const db = require('../db'); // 경로 맞춰 사용

// 안전 JSON 파서
const parseJSON = (v, fb) => {
  try { return typeof v === 'string' ? JSON.parse(v) : (v ?? fb); }
  catch { return fb; }
};

// notes 정규화: thumbnailUrl/camel → thumbnail_url/snake 로 흡수
function normalizeNotes(input, body = {}) {
  const n = parseJSON(input, {});
  const fixed = { ...n };

  // 1) notes 내부 camel → snake 흡수
  const camelInNotes = n?.thumbnailUrl;
  const snakeInNotes = n?.thumbnail_url;
  if (!snakeInNotes && camelInNotes) fixed.thumbnail_url = camelInNotes;

  // 2) body(top-level)에도 있을 수 있으니 흡수
  const topSnake = body?.thumbnail_url;
  const topCamel = body?.thumbnailUrl || body?.thumbnail; // 방어적으로 몇 가지 더
  if (!fixed.thumbnail_url && (topSnake || topCamel)) {
    fixed.thumbnail_url = topSnake || topCamel;
  }

  return fixed;
}

/* ───────────── 공유 목록 ───────────── */
async function listSharedPlans(req, res) {
  try {
    const [rows] = await db.query(
      `SELECT
         id, user_id, title, country, region,
         start_date, end_date, is_shared,
         created_at, updated_at,
         /* notes.thumbnail_url OR notes.thumbnailUrl → thumbnail_url 로 통일 */
         COALESCE(
          NULLIF(JSON_UNQUOTE(JSON_EXTRACT(notes, '$.thumbnail_url')), ''),
          NULLIF(JSON_UNQUOTE(JSON_EXTRACT(notes, '$.thumbnailUrl')), ''),
          NULLIF(JSON_UNQUOTE(JSON_EXTRACT(notes, '$.thumbnail')), ''),
          NULLIF(JSON_UNQUOTE(JSON_EXTRACT(notes, '$.coverUrl')), ''),
          NULLIF(JSON_UNQUOTE(JSON_EXTRACT(notes, '$.cover_url')), '')
        ) AS thumbnail_url
       FROM plans
       WHERE is_shared = 1
       ORDER BY created_at DESC
       LIMIT 100`
    );
    res.json(rows);
  } catch (e) {
    console.error('[listSharedPlans]', e);
    res.status(500).json({ error: 'listSharedPlans failed' });
  }
}

/* ───────────── 내 목록 ───────────── */
async function listPlans(req, res) {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ error: '로그인이 필요합니다.' });
    }
    const userId = req.user.id;

    const [rows] = await db.query(
      `SELECT
         id, user_id, title, country, region,
         start_date, end_date, is_shared,
         created_at, updated_at,
         COALESCE(
          NULLIF(JSON_UNQUOTE(JSON_EXTRACT(notes, '$.thumbnail_url')), ''),
          NULLIF(JSON_UNQUOTE(JSON_EXTRACT(notes, '$.thumbnailUrl')), ''),
          NULLIF(JSON_UNQUOTE(JSON_EXTRACT(notes, '$.thumbnail')), ''),
          NULLIF(JSON_UNQUOTE(JSON_EXTRACT(notes, '$.coverUrl')), ''),
          NULLIF(JSON_UNQUOTE(JSON_EXTRACT(notes, '$.cover_url')), '')
        ) AS thumbnail_url
       FROM plans
       WHERE user_id = ?
       ORDER BY updated_at DESC`,
      [userId]
    );
    res.json(rows);
  } catch (e) {
    console.error('[listPlans]', e);
    res.status(500).json({ error: 'listPlans failed' });
  }
}

/* ───────────── 단건 조회(편집용) ───────────── */
async function getPlanById(req, res) {
  if (!req.user || !req.user.id) {
    return res.status(401).json({ error: '로그인이 필요합니다.' });
  }
  const { id } = req.params;
  const userId = req.user.id;

  try {
    const [[plan]] = await db.query(
      `SELECT id,user_id,title,country,region,prefs,start_date,end_date,notes,is_shared,created_at,updated_at
       FROM plans WHERE id=? AND user_id=?`,
      [id, userId]
    );
    if (!plan) return res.status(404).json({ error: 'not found' });

    const [items] = await db.query(
      `SELECT day,time,place_name,address,lat,lng,memo,sort_order,place_id,opening_hours
       FROM plan_items WHERE plan_id=? ORDER BY day ASC, sort_order ASC`,
      [id]
    );

    res.json({
      ...plan,
      prefs: parseJSON(plan.prefs, []),
      notes: normalizeNotes(plan.notes),
      items: items.map(it => ({
        ...it,
        opening_hours: parseJSON(it.opening_hours, null),
      })),
    });
  } catch (e) {
    console.error('[getPlanById]', e);
    res.status(500).json({ error: 'getPlanById failed' });
  }
}

/* ───────────── 생성 ───────────── */
async function createPlan(req, res) {
  const { title, start_date, end_date, notes, items, country, region, prefs, is_shared } = req.body;

  if (!req.user || !req.user.id) {
    return res.status(401).json({ error: '로그인이 필요합니다.' });
  }
  const userId = req.user.id;

  if (!title?.trim()) return res.status(400).json({ error: 'title 필요' });
  if (!country?.trim() || !region?.trim()) return res.status(400).json({ error: 'country/region 필요' });

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const safeNotes = normalizeNotes(notes, req.body);

    const [r] = await conn.query(
      `INSERT INTO plans (user_id,title,country,region,prefs,start_date,end_date,notes,is_shared,created_at,updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,NOW(),NOW())`,
      [
        userId,
        title,
        country || null,
        region || null,
        prefs ? JSON.stringify(prefs) : '[]',
        start_date || null,
        end_date || null,
        JSON.stringify(safeNotes || {}),
        is_shared ? 1 : 0,
      ]
    );
    const planId = r.insertId;

    if (Array.isArray(items) && items.length) {
      const values = items.map((it, i) => [
        planId,
        it.day,
        it.time || null,
        it.place_name || null,
        it.address || null,
        it.lat ?? null,
        it.lng ?? null,
        it.memo || null,
        Number.isInteger(it.sort_order) ? it.sort_order : i,
        it.place_id || null,
        it.opening_hours
          ? (typeof it.opening_hours === 'string' ? it.opening_hours : JSON.stringify(it.opening_hours))
          : null,
      ]);
      await conn.query(
        `INSERT INTO plan_items
         (plan_id,day,time,place_name,address,lat,lng,memo,sort_order,place_id,opening_hours)
         VALUES ?`,
        [values]
      );
    }

    await conn.commit();
    res.json({ id: planId });
  } catch (e) {
    await conn.rollback();
    console.error('[createPlan]', e);
    res.status(500).json({ error: 'plan create failed' });
  } finally {
    conn.release();
  }
}

/* ───────────── 수정 ───────────── */
async function updatePlan(req, res) {
  const { id } = req.params;
  const { title, start_date, end_date, notes, items, country, region, prefs, is_shared } = req.body;

  if (!req.user || !req.user.id) {
    return res.status(401).json({ error: '로그인이 필요합니다.' });
  }
  const userId = req.user.id;

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [[own]] = await conn.query(`SELECT id FROM plans WHERE id=? AND user_id=?`, [id, userId]);
    if (!own) { await conn.rollback(); return res.status(404).json({ error: 'not found' }); }

    if (!title?.trim()) return res.status(400).json({ error: 'title 필요' });
    if (!country?.trim() || !region?.trim()) return res.status(400).json({ error: 'country/region 필요' });

    const safeNotes = normalizeNotes(notes, req.body);

    await conn.query(
      `UPDATE plans
       SET title=?, country=?, region=?, prefs=?, start_date=?, end_date=?, notes=?, is_shared=?, updated_at=NOW()
       WHERE id=? AND user_id=?`,
      [
        title,
        country || null,
        region || null,
        prefs ? JSON.stringify(prefs) : '[]',
        start_date || null,
        end_date || null,
        JSON.stringify(safeNotes || {}),
        is_shared ? 1 : 0,
        id,
        userId,
      ]
    );

    // items 전체 교체(현재 구조 유지)
    await conn.query(`DELETE FROM plan_items WHERE plan_id=?`, [id]);
    if (Array.isArray(items) && items.length) {
      const values = items.map((it, i) => [
        id,
        it.day,
        it.time || null,
        it.place_name || null,
        it.address || null,
        it.lat ?? null,
        it.lng ?? null,
        it.memo || null,
        Number.isInteger(it.sort_order) ? it.sort_order : i,
        it.place_id || null,
        it.opening_hours
          ? (typeof it.opening_hours === 'string' ? it.opening_hours : JSON.stringify(it.opening_hours))
          : null,
      ]);
      await conn.query(
        `INSERT INTO plan_items
         (plan_id,day,time,place_name,address,lat,lng,memo,sort_order,place_id,opening_hours)
         VALUES ?`,
        [values]
      );
    }

    await conn.commit();
    res.json({ ok: true });
  } catch (e) {
    await conn.rollback();
    console.error('[updatePlan]', e);
    res.status(500).json({ error: 'plan update failed' });
  } finally {
    conn.release();
  }
}

/* ───────────── 삭제 ───────────── */
async function deletePlan(req, res) {
  if (!req.user || !req.user.id) {
    return res.status(401).json({ error: '로그인이 필요합니다.' });
  }
  const { id } = req.params;
  const userId = req.user.id;

  try {
    await db.query(`DELETE FROM plan_items WHERE plan_id=?`, [id]);
    const [r] = await db.query(`DELETE FROM plans WHERE id=? AND user_id=?`, [id, userId]);
    if (!r.affectedRows) return res.status(404).json({ error: 'not found' });
    res.json({ ok: true });
  } catch (e) {
    console.error('[deletePlan]', e);
    res.status(500).json({ error: 'deletePlan failed' });
  }
}

/* ───────────── 공유 on/off ───────────── */
async function sharePlan(req, res) {
  if (!req.user || !req.user.id) {
    return res.status(401).json({ error: '로그인이 필요합니다.' });
  }
  const { id } = req.params;
  const userId = req.user.id;
  try {
    await db.query(`UPDATE plans SET is_shared=1 WHERE id=? AND user_id=?`, [id, userId]);
    res.json({ shared: true });
  } catch (e) {
    console.error('[sharePlan]', e);
    res.status(500).json({ error: 'sharePlan failed' });
  }
}
async function unsharePlan(req, res) {
  if (!req.user || !req.user.id) {
    return res.status(401).json({ error: '로그인이 필요합니다.' });
  }
  const { id } = req.params;
  const userId = req.user.id;
  try {
    await db.query(`UPDATE plans SET is_shared=0 WHERE id=? AND user_id=?`, [id, userId]);
    res.json({ shared: false });
  } catch (e) {
    console.error('[unsharePlan]', e);
    res.status(500).json({ error: 'unsharePlan failed' });
  }
}

/* ───────────── 공유 상세(읽기전용) ───────────── */
async function getPlanReadonlyAware(req, res) {
  const { id } = req.params;
  try {
    const [[plan]] = await db.query(
      `SELECT id,user_id,title,country,region,prefs,start_date,end_date,notes,is_shared,created_at,updated_at
       FROM plans WHERE id=?`,
      [id]
    );
    if (!plan) return res.status(404).json({ error: 'not found' });
    if (!plan.is_shared) return res.status(403).json({ error: 'not shared' });

    const [items] = await db.query(
      `SELECT day,time,place_name,address,lat,lng,memo,sort_order,place_id,opening_hours
       FROM plan_items WHERE plan_id=? ORDER BY day ASC, sort_order ASC`,
      [id]
    );

    res.json({
      ...plan,
      prefs: parseJSON(plan.prefs, []),
      notes: normalizeNotes(plan.notes),
      items: items.map(it => ({
        ...it,
        opening_hours: parseJSON(it.opening_hours, null),
      })),
    });
  } catch (e) {
    console.error('[getPlanReadonlyAware]', e);
    res.status(500).json({ error: 'getPlanReadonlyAware failed' });
  }
}

/* ───────────── 공유본 복사 ───────────── */
async function copySharedPlan(req, res) {
  if (!req.user || !req.user.id) {
    return res.status(401).json({ error: '로그인이 필요합니다.' });
  }
  const { id } = req.params;
  const userId = req.user.id;

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [[src]] = await conn.query(
      `SELECT id,title,country,region,prefs,start_date,end_date,notes,is_shared
       FROM plans WHERE id=?`,
      [id]
    );
    if (!src || !src.is_shared) {
      await conn.rollback();
      return res.status(404).json({ error: 'not copyable' });
    }

    const [ins] = await conn.query(
      `INSERT INTO plans (user_id,title,country,region,prefs,start_date,end_date,notes,is_shared,created_at,updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,NOW(),NOW())`,
      [
        userId,
        `${src.title} - 복사`,
        src.country || null,
        src.region || null,
        typeof src.prefs === 'string' ? src.prefs : JSON.stringify(src.prefs || []),
        src.start_date || null,
        src.end_date || null,
        JSON.stringify(normalizeNotes(src.notes) || {}),
        0, // 복사본은 기본 비공개
      ]
    );
    const newId = ins.insertId;

    const [items] = await conn.query(
      `SELECT day,time,place_name,address,lat,lng,memo,sort_order,place_id,opening_hours
       FROM plan_items WHERE plan_id=? ORDER BY day ASC, sort_order ASC`,
      [id]
    );
    if (items.length) {
      const vals = items.map((it, i) => [
        newId,
        it.day,
        it.time || null,
        it.place_name || null,
        it.address || null,
        it.lat ?? null,
        it.lng ?? null,
        it.memo || null,
        Number.isInteger(it.sort_order) ? it.sort_order : i,
        it.place_id || null,
        typeof it.opening_hours === 'string'
          ? it.opening_hours
          : (it.opening_hours ? JSON.stringify(it.opening_hours) : null),
      ]);
      await conn.query(
        `INSERT INTO plan_items
         (plan_id,day,time,place_name,address,lat,lng,memo,sort_order,place_id,opening_hours)
         VALUES ?`,
        [vals]
      );
    }

    await conn.commit();
    res.json({ newPlanId: newId });
  } catch (e) {
    await conn.rollback();
    console.error('[copySharedPlan]', e);
    res.status(500).json({ error: 'copySharedPlan failed' });
  } finally {
    conn.release();
  }
}

module.exports = {
  listSharedPlans,
  listPlans,
  getPlanById,
  createPlan,
  updatePlan,
  deletePlan,
  sharePlan,
  unsharePlan,
  getPlanReadonlyAware,
  copySharedPlan,
};
