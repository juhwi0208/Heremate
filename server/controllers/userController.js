// server/controllers/userController.js

const path = require('path');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const db = require('../db');
const trust = require('../services/trustService');



// PUT /api/users/me (multipart)  → 이메일 변경 지원
// body: nickname?, bio?, email?, currentPassword?
exports.updateMe = async (req, res) => {
  const id = req.user.id;
  const nickname = req.body.nickname ?? null;
  const bio = req.body.bio ?? null;
  const newEmail = req.body.email ?? null;
  const currentPassword = req.body.currentPassword ?? null;
  const file = req.file; // avatar

  const avatarUrl = file ? file.path : null;
  let conn; 

  try {
    conn = await db.getConnection();

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


// GET /api/users/:id/trust  → 신뢰 지표 + 후기 키워드
exports.getTrustProfile = async (req, res) => {
  const targetId = Number(req.params.id);
  if (!targetId) {
    return res.status(400).json({ error: '잘못된 사용자 ID 입니다.' });
  }

  try {
    const profile = await trust.getUserTrustProfile(targetId);
    if (!profile) {
      return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
    }
    return res.json(profile);
  } catch (e) {
    console.error('GET /api/users/:id/trust error', e);
    return res.status(500).json({ error: '신뢰 지표 조회 실패' });
  }
};


// GET /api/users/:id/trust  → 아우라 + 별자리 + 후기 키워드
exports.getTrust = async (req, res) => {
  const targetId = Number(req.params.id || 0);
  if (!targetId) {
    return res.status(400).json({ error: '잘못된 사용자 id' });
  }

  const conn = await db.getConnection();
  try {
    // 1) 대상 유저 기본 정보 + 캐시된 점수
    const [[u]] = await conn.query(
      `SELECT id, nickname, avatar_url,
              aura_tone, aura_intensity, aura_score,
              constellation_score
         FROM users
        WHERE id = ?`,
      [targetId]
    );
    if (!u) {
      conn.release();
      return res.status(404).json({ error: '사용자 없음' });
    }

    // 2) 관계/여행 요약 (uniquePartners, trips, positiveRatio)
    const [[agg]] = await conn.query(
      `SELECT 
          COUNT(DISTINCT partner_id) AS uniquePartners,
          COALESCE(SUM(trips_count),0) AS trips,
          AVG(NULLIF(pos_ratio,0))       AS positiveRatio
        FROM travel_relations
        WHERE user_id = ?
          AND trips_count > 0`,
      [targetId]
    );

    const uniquePartners = Number(agg?.uniquePartners || 0);
    const trips = Number(agg?.trips || 0);
    const positiveRatio = agg?.positiveRatio != null
      ? Number(agg.positiveRatio)
      : null;

    // 3) 별자리 그래프용 파트너 목록 (상위 12명)
    const [rels] = await conn.query(
      `SELECT 
          tr.partner_id,
          tr.trips_count,
          tr.relation_strength,
          tr.pos_ratio,
          u2.nickname
         FROM travel_relations tr
         JOIN users u2 ON u2.id = tr.partner_id
        WHERE tr.user_id = ?
          AND tr.trips_count > 0   
        ORDER BY tr.relation_strength DESC
        LIMIT 12`,
      [targetId]
    );

    const partnerNodes = rels.map((r) => {
      const strength = Number(r.relation_strength || 0);
      const weight = Math.max(0.3, Math.min(1, strength || 0.5));
      return {
        id: r.partner_id,
        label: r.nickname,
        weight,
        trips: Number(r.trips_count || 1),
      };
    });

    const edges = partnerNodes.map((n) => ({
      source: targetId,
      target: n.id,
      weight: n.weight,
    }));

    // 4) 후기 키워드(topTags) 집계

  const [reviewRows] = await conn.query(
    `SELECT emotion, tags 
      FROM reviews 
      WHERE target_id = ?`,
    [targetId]
  );

  const tagCountMap = {};
  for (const r of reviewRows) {
    if (!r.tags) continue;

    let arr = null;

    // 1) 🔥 JSON 컬럼이면 이미 Array로 옴
    if (Array.isArray(r.tags)) {
      arr = r.tags;
    }
    // 2) 문자열인 경우 (TEXT, VARCHAR 저장 등)
    else if (typeof r.tags === "string") {
      try {
        const parsed = JSON.parse(r.tags);  // '[...]' 형태
        if (Array.isArray(parsed)) {
          arr = parsed;
        }
      } catch (e) {
        // CSV Fallback ('tag1,tag2')
        arr = r.tags
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
      }
    } else {
      continue;
    }

    if (!arr || !arr.length) continue;

    for (const t of arr) {
      if (typeof t !== "string") continue;
      const key = t.trim();
      if (!key) continue;
      tagCountMap[key] = (tagCountMap[key] || 0) + 1;
    }
  }

  // 사용량 기준 상위 10개 키워드만 노출
  const topTags = Object.entries(tagCountMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([tag]) => tag);
    // 5) 레벨/점수 계산 (users.constellation_score 기반)
    const rawScore = Number(u.constellation_score || 0);
    const level = Math.max(1, 1 + Math.floor(rawScore / 20));

    conn.release();

    return res.json({
      aura: {
        tone: u.aura_tone,
        intensity: u.aura_intensity,
        score: Number(u.aura_score || 0),
      },
      constellation: {
        level,
        score: rawScore,
        uniquePartners,
        trips,
        positiveRatio,
        nodes: partnerNodes,
        edges,
      },
      // 🔥 프로필 신뢰 페이지에서 쓰는 후기 키워드
      topTags,
    });
  } catch (e) {
    console.error(e);
    conn.release();
    return res.status(500).json({ error: '신뢰도 조회 실패' });
  }
};
