// server/controllers/planController.js
const db = require('../db'); // ← 필요시 '../lib/db'로 변경

const parseJSON = (v, fb) => {
  try { return typeof v === 'string' ? JSON.parse(v) : (v ?? fb); }
  catch { return fb; }
};

// ───────────── 공개(공유) 피드 ─────────────
async function listSharedPlans(req, res) {
  try {
    const [rows] = await db.query(
      `SELECT id, title, country, region, start_date, end_date, is_shared, created_at
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

// ───────────── 내 계획 목록 ─────────────
async function listPlans(req, res) {
  const userId = req.user.id;
  try {
    const [rows] = await db.query(
      `SELECT id, title, country, region, start_date, end_date, is_shared, created_at, updated_at
       FROM plans WHERE user_id=? ORDER BY updated_at DESC`, [userId]
    );
    res.json(rows);
  } catch (e) {
    console.error('[listPlans]', e);
    res.status(500).json({ error: 'listPlans failed' });
  }
}

// ───────────── 단건 조회(편집용) ─────────────
async function getPlanById(req, res) {
  const { id } = req.params;
  const userId = req.user.id;
  try {
    const [[plan]] = await db.query(
      `SELECT id,user_id,title,country,region,prefs,start_date,end_date,notes,is_shared,created_at,updated_at
       FROM plans WHERE id=? AND user_id=?`, [id, userId]
    );
    if (!plan) return res.status(404).json({ error: 'not found' });

    const [items] = await db.query(
      `SELECT day,time,place_name,address,lat,lng,memo,sort_order,place_id,opening_hours
       FROM plan_items WHERE plan_id=? ORDER BY day ASC, sort_order ASC`, [id]
    );

    res.json({
      ...plan,
      prefs: parseJSON(plan.prefs, []),
      notes: parseJSON(plan.notes, {}),
      items: items.map(it => ({ ...it, opening_hours: parseJSON(it.opening_hours, null) })),
    });
  } catch (e) {
    console.error('[getPlanById]', e);
    res.status(500).json({ error: 'getPlanById failed' });
  }
}

// ───────────── 생성 ─────────────
async function createPlan(req, res) {
  const { title, start_date, end_date, notes, items, country, region, prefs, is_shared } = req.body;
  const userId = req.user.id;
  if (!title?.trim()) return res.status(400).json({ error: 'title 필요' });
  if (!country?.trim() || !region?.trim()) return res.status(400).json({ error: 'country/region 필요' });

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

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
        JSON.stringify(notes || {}),
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
        it.opening_hours ? (typeof it.opening_hours === 'string' ? it.opening_hours : JSON.stringify(it.opening_hours)) : null,
      ]);
      await conn.query(
        `INSERT INTO plan_items
         (plan_id,day,time,place_name,address,lat,lng,memo,sort_order,place_id,opening_hours)
         VALUES ?`, [values]
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

// ───────────── 수정 ─────────────
async function updatePlan(req, res) {
  const { id } = req.params;
  const { title, start_date, end_date, notes, items, country, region, prefs, is_shared } = req.body;
  const userId = req.user.id;

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [[own]] = await conn.query(`SELECT id FROM plans WHERE id=? AND user_id=?`, [id, userId]);
    if (!own) { await conn.rollback(); return res.status(404).json({ error: 'not found' }); }

    if (!title?.trim()) return res.status(400).json({ error: 'title 필요' });
    if (!country?.trim() || !region?.trim()) return res.status(400).json({ error: 'country/region 필요' });

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
        JSON.stringify(notes || {}),
        is_shared ? 1 : 0,
        id,
        userId,
      ]
    );

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
        it.opening_hours ? (typeof it.opening_hours === 'string' ? it.opening_hours : JSON.stringify(it.opening_hours)) : null,
      ]);
      await conn.query(
        `INSERT INTO plan_items
         (plan_id,day,time,place_name,address,lat,lng,memo,sort_order,place_id,opening_hours)
         VALUES ?`, [values]
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

// ───────────── 삭제 ─────────────
async function deletePlan(req, res) {
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

// ───────────── 공유 on/off ─────────────
async function sharePlan(req, res) {
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

// ───────────── 공유 상세(읽기전용) ─────────────
async function getPlanReadonlyAware(req, res) {
  const { id } = req.params;
  try {
    const [[plan]] = await db.query(
      `SELECT id,user_id,title,country,region,prefs,start_date,end_date,notes,is_shared,created_at,updated_at
       FROM plans WHERE id=?`, [id]
    );
    if (!plan) return res.status(404).json({ error: 'not found' });
    if (!plan.is_shared) return res.status(403).json({ error: 'not shared' });

    const [items] = await db.query(
      `SELECT day,time,place_name,address,lat,lng,memo,sort_order,place_id,opening_hours
       FROM plan_items WHERE plan_id=? ORDER BY day ASC, sort_order ASC`, [id]
    );

    res.json({
      ...plan,
      prefs: parseJSON(plan.prefs, []),
      notes: parseJSON(plan.notes, {}),
      items: items.map(it => ({ ...it, opening_hours: parseJSON(it.opening_hours, null) })),
    });
  } catch (e) {
    console.error('[getPlanReadonlyAware]', e);
    res.status(500).json({ error: 'getPlanReadonlyAware failed' });
  }
}

// ───────────── 공유본 복사 ─────────────
async function copySharedPlan(req, res) {
  const { id } = req.params;
  const userId = req.user.id;
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [[src]] = await conn.query(
      `SELECT id,title,country,region,prefs,start_date,end_date,notes,is_shared
       FROM plans WHERE id=?`, [id]
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
        typeof src.notes === 'string' ? src.notes : JSON.stringify(src.notes || {}),
        0, // 복사본은 기본 비공개
      ]
    );
    const newId = ins.insertId;

    const [items] = await conn.query(
      `SELECT day,time,place_name,address,lat,lng,memo,sort_order,place_id,opening_hours
       FROM plan_items WHERE plan_id=? ORDER BY day ASC, sort_order ASC`, [id]
    );
    if (items.length) {
      const vals = items.map((it, i) => [
        newId, it.day, it.time || null, it.place_name || null, it.address || null,
        it.lat ?? null, it.lng ?? null, it.memo || null,
        Number.isInteger(it.sort_order) ? it.sort_order : i,
        it.place_id || null,
        typeof it.opening_hours === 'string' ? it.opening_hours : (it.opening_hours ? JSON.stringify(it.opening_hours) : null),
      ]);
      await conn.query(
        `INSERT INTO plan_items
         (plan_id,day,time,place_name,address,lat,lng,memo,sort_order,place_id,opening_hours)
         VALUES ?`, [vals]
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

// ───────────── 하나의 exports로 통일 ─────────────
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

