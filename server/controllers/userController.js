// server/controllers/userController.js

const path = require('path');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const db = require('../db');


// PUT /api/users/me (multipart)  → 이메일 변경 지원
// body: nickname?, bio?, email?, currentPassword?
exports.updateMe = async (req, res) => {
  const id = req.user.id;
  const nickname = req.body.nickname ?? null;
  const bio = req.body.bio ?? null;
  const newEmail = req.body.email ?? null;
  const currentPassword = req.body.currentPassword ?? null;
  const file = req.file; // avatar

  const avatarUrl = file ? `/uploads/avatars/${file.filename}` : null;
  let conn;

  try {
    const conn = await db.getConnection();

    // 이메일 변경 처리
    if (newEmail !== null) {
      // 비밀번호 검증(일반/카카오 모두 가능 요구였지만,
      // 카카오 계정은 비밀번호가 없으므로 프론트에서 currentPassword 입력을 받되
      // DB에 password가 null/빈값이면 검증 생략)
      const [r] = await conn.query(
        'SELECT password FROM users WHERE id = ?',
        [id]
      );
      const hashed = r[0]?.password || null;

      if (hashed) {
        if (!currentPassword) {
          conn.release();
          return res.status(400).json({
            error: '현재 비밀번호를 입력해 주세요.',
            code: 'PW_REQUIRED',
          });
        }
        const ok = await bcrypt.compare(currentPassword, hashed);
        if (!ok) {
          conn.release();
          return res.status(400).json({
            error: '현재 비밀번호가 올바르지 않습니다.',
            code: 'PW_INVALID',
          });
        }
      }
      // 이메일, 검증 초기화, 토큰 발급(이메일 인증용)
      const token = crypto.randomBytes(24).toString('hex');
      const expires = new Date(Date.now() + 1000 * 60 * 30); // 30분
      await conn.query(
        `UPDATE users
         SET email = ?, email_verified = 0, email_verify_token = ?, email_verify_expires = ?
         WHERE id = ?`,
        [newEmail, token, expires, id]
      );

      // TODO: 실제 발송 로직 연결 (SMTP)
      // await sendVerifyEmail(newEmail, token);

      // 나머지 필드 업데이트도 이어서 처리(아래 sets 로)
    }

    // 동적 업데이트
    const sets = [];
    const params = [];
    if (nickname !== null) { sets.push('nickname = ?'); params.push(nickname); }
    if (bio !== null) { sets.push('bio = ?'); params.push(bio); }
    if (avatarUrl) { sets.push('avatar_url = ?'); params.push(avatarUrl); }

    if (sets.length) {
      const sql = `UPDATE users SET ${sets.join(', ')} WHERE id = ?`;
      params.push(id);
      await conn.query(sql, params);
    }

    // ✅ 최종 프로필 다시 조회해서 avatarUrl, nickname 포함해 응답
    const [[u]] = await conn.query(
      `SELECT id, email, nickname, role,
              created_at,
              avatar_url,
              bio,
              kakao_id,
              email_verified,
              CASE WHEN password IS NULL OR password = '' THEN 0 ELSE 1 END AS has_password
       FROM users
       WHERE id = ?`,
      [id]
    );

    conn.release();

    return res.json({
      message: '프로필 저장 완료',
      id: u.id,
      email: u.email,
      nickname: u.nickname,
      role: u.role,
      created_at: u.created_at,
      avatarUrl: u.avatar_url || '',
      bio: u.bio || '',
      kakaoId: u.kakao_id || null,
      emailVerified: !!u.email_verified,
      has_password: u.has_password,
    });
  } catch (e) {
    console.error(e);
    if (conn) conn.release();
    return res.status(500).json({ error: '프로필 저장 실패' });
  }

};

/**
 * DELETE /api/users/me
 * - 일반계정: currentPassword 필요
 * - 카카오전용: confirm=true 필요
 * - 실제 삭제 대신 '익명화' 업데이트로 처리 (FK 보호)
 */
exports.deleteMe = async (req, res) => {
  const id = req.user.id;
  const { currentPassword, confirm } = req.body || {};

  const conn = await db.getConnection();
  try {
    const [[u]] = await conn.query(
      'SELECT id, email, password, kakao_id FROM users WHERE id = ?',
      [id]
    );
    if (!u) { conn.release(); return res.status(404).json({ error: '사용자 없음' }); }

    // 비밀번호 존재 → 반드시 확인
    if (u.password) {
      if (!currentPassword) {
        conn.release();
        return res.status(400).json({ error: '현재 비밀번호를 입력해 주세요.' });
      }
      const ok = await bcrypt.compare(currentPassword, u.password);
      if (!ok) {
        conn.release();
        return res.status(400).json({ error: '현재 비밀번호가 올바르지 않습니다.' });
      }
    } else {
      // 소셜 전용이면 한 번 더 확인만 요구
      if (!confirm) {
        conn.release();
        return res.status(400).json({ error: '탈퇴 확인이 필요합니다.', code: 'CONFIRM_REQUIRED' });
      }
    }

    // 익명화(소프트 삭제 유사)
    const anonEmail = `deleted+${u.id}@example.invalid`;
    const anonNick = `탈퇴회원${u.id}`;
    await conn.query(
      `UPDATE users SET
          email = ?,
          password = NULL,
          nickname = ?,
          bio = '',
          avatar_url = NULL,
          kakao_id = NULL,
          email_verified = 0,
          email_verify_token = NULL,
          email_verify_expires = NULL,
          reset_code = NULL,
          reset_code_expires = NULL
        WHERE id = ?`,
      [anonEmail, anonNick, u.id]
    );

    conn.release();
    return res.json({ ok: true });
  } catch (e) {
    conn.release();
    console.error(e);
    return res.status(500).json({ error: '회원탈퇴 처리 실패' });
  }
};

// GET /api/users/me  → kakaoId, created_at 포함 + 신뢰 캐시
exports.getMe = async (req, res) => {
  const id = req.user && req.user.id;
  if (!id) {
    // 토큰은 있는데 파싱이 안됐을 때 방어 코드
    return res.status(401).json({ error: 'UNAUTHORIZED' });
  }

  let conn;
  try {
    conn = await db.getConnection();

    const [rows] = await conn.query(
      `
      SELECT
        id,
        email,
        nickname,
        role,
        avatar_url,
        bio,
        created_at,
        email_verified,
        CASE WHEN password IS NULL OR password = '' THEN 0 ELSE 1 END AS has_password
      FROM users
      WHERE id = ?
      `,
      [id]
    );

    if (!rows[0]) {
      return res.status(404).json({ error: 'USER_NOT_FOUND' });
    }

    const u = rows[0];

    // ✅ 프론트에서 쓰기 좋은 camelCase 형태로 내려보내기
    return res.json({
      id: u.id,
      email: u.email,
      nickname: u.nickname,
      role: u.role,
      avatarUrl: u.avatar_url || '',
      bio: u.bio || '',
      created_at: u.created_at,
      emailVerified: !!u.email_verified,
      has_password: u.has_password,
    });
  } catch (e) {
    console.error('[/api/users/me] DB error:', e);
    return res.status(500).json({ error: '프로필 로드 실패' });
  } finally {
    if (conn) conn.release();
  }
};

// GET /api/users/:id/trust  → 개요 카드 + 별자리 그래프 데이터
exports.getTrust = async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: 'id가 필요합니다.' });

  const conn = await db.getConnection();
  try {
    // 요약지표(뷰가 있으면 그걸 사용)
    let summary = { positive_ratio: 0, unique_partners: 0, trips_total: 0 };
    try {
      const [v] = await conn.query('SELECT * FROM user_trust_summary WHERE user_id=?', [id]);
      if (v?.length) {
        summary = {
          positive_ratio: Number(v[0].positive_ratio || 0),
          unique_partners: Number(v[0].unique_partners || 0),
          trips_total: Number(v[0].trips_total || 0),
        };
      } else {
        // 뷰 미존재 시 fallback
        const [[r0]] = await conn.query(
          `SELECT SUM(CASE WHEN emotion='positive' THEN 1 ELSE 0 END)/NULLIF(COUNT(*),0) AS pr
             FROM reviews WHERE target_id=?`, [id]);
        const [[r1]] = await conn.query(
          `SELECT COUNT(DISTINCT partner_id) AS up, COALESCE(SUM(trips_count),0) AS tt
             FROM travel_relations WHERE user_id=?`, [id]);
        summary = {
          positive_ratio: Number(r0?.pr || 0),
          unique_partners: Number(r1?.up || 0),
          trips_total: Number(r1?.tt || 0),
        };
      }
    } catch {}

    // 전체 리뷰 개수
    const [[reviewRow]] = await conn.query(
      `SELECT COUNT(*) AS cnt FROM reviews WHERE target_id=?`,
      [id]
    );
    const reviewCount = Number(reviewRow.cnt || 0);

    // 긍정 비율 (positive_ratio는 0~1이므로 %로 변환)
    const positivePercent = Math.round((summary.positive_ratio || 0) * 100);

    // 상위 키워드(간단 집계)
    const [tagsRows] = await conn.query(
      `SELECT tags FROM reviews WHERE target_id=? AND tags IS NOT NULL LIMIT 200`,
      [id]
    );
    const freq = {};
    for (const row of tagsRows) {
      try {
        const arr = JSON.parse(row.tags);
        if (Array.isArray(arr)) arr.forEach(t => {
          const k = String(t).trim(); if (!k) return;
          freq[k] = (freq[k] || 0) + 1;
        });
      } catch {}
    }
    const topTags = Object.entries(freq)
      .sort((a,b)=>b[1]-a[1]).slice(0,8).map(([k])=>k);

    // 별자리 그래프 데이터 (상위 12명)
    const [rels] = await conn.query(
      `SELECT partner_id AS id, relation_strength AS w
         FROM travel_relations
        WHERE user_id=?
        ORDER BY w DESC
        LIMIT 12`,
      [id]
    );
    const nodes = rels.map(r => ({ id: r.id, weight: Number(r.w || 0) }));
    const edges = rels.map(r => ({ source: id, target: r.id, weight: Number(r.w || 0) }));

    // 아우라/별자리 캐시
    const [[u]] = await conn.query(
      `SELECT aura_tone, aura_intensity, aura_score, constellation_score FROM users WHERE id=?`,
      [id]
    );

    conn.release();
    return res.json({
      aura: u ? { tone: u.aura_tone, intensity: u.aura_intensity, score: u.aura_score } : null,
      constellation: {
        score: u ? u.constellation_score : 0,
        level: (u?.constellation_score>=80?5:u?.constellation_score>=60?4:u?.constellation_score>=40?3:u?.constellation_score>=20?2:1),
        nodes, edges,
        uniquePartners: summary.unique_partners,
        trips: summary.trips_total,
        positiveRatio: summary.positive_ratio,
      },
      topTags,
      reviewCount,           
      positivePercent 
    });
  } catch (e) {
    try { conn.release(); } catch {}
    console.error('getTrust error', e);
    return res.status(500).json({ error: '신뢰 지표 로드 실패' });
  }
};