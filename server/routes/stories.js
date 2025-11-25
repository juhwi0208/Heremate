// C:\Users\owner\Documents\GitHub\Heremate\server\routes\stories.js
const express = require('express');
const path = require('path');
const multer = require('multer');
const db = require('../db');
const { verifyToken } = require('../middlewares/auth');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('../config/cloudinary');

const router = express.Router();

/**
 * 업로드 설정
 * - 실제 경로: server/uploads/stories/...
 */
const storyStorage = new CloudinaryStorage({
  cloudinary,
  params: (req, file) => {
    const isVideo = file.mimetype.startsWith('video/');
    return {
      folder: 'heremate/stories', // Cloudinary 폴더명
      resource_type: isVideo ? 'video' : 'image',
      allowed_formats: [
        'jpg',
        'jpeg',
        'png',
        'webp',
        'mp4',
        'mov',
        'avi',
        'webm',
        'mkv',
      ],
      // 이미지만 리사이즈, 영상은 원본 유지
      transformation: isVideo
        ? []
        : [{ width: 1600, height: 900, crop: 'fill' }],
    };
  },
});

const upload = multer({ storage: storyStorage });

/**
 * 내부 헬퍼: 스토리 리스트 조회
 */
async function fetchStoriesList(res, userId) {
  const conn = await db.getConnection();
  try {
    let sql = `
      SELECT
        s.id,
        s.title,
        s.thumbnail_url,
        s.user_id,
        s.plan_id,
        s.like_count,
        s.comment_count,
        s.created_at,
        u.nickname,
        u.avatar_url
      FROM stories s
      JOIN users u ON s.user_id = u.id
    `;
    const params = [];

    if (userId) {
      sql += ' WHERE s.user_id = ?';
      params.push(userId);
    }

    sql += ' ORDER BY s.created_at DESC LIMIT 50';

    const [rows] = await conn.query(sql, params);
    res.json(rows || []);
  } catch (err) {
    console.error('[stories] list error', err);
    res.status(500).json({ error: '스토리 목록을 불러오지 못했습니다.' });
  } finally {
    conn.release();
  }
}

/**
 * GET /api/stories
 * - 전체 스토리 리스트
 * - ?me=1 이면 "내 스토리"만
 */
router.get('/', (req, res) => {
  const onlyMe = req.query.me === '1';

  if (onlyMe) {
    verifyToken(req, res, () => {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: '로그인이 필요합니다.' });
      }
      fetchStoriesList(res, userId);
    });
  } else {
    fetchStoriesList(res, null);
  }
});

/**
 * GET /api/stories/:id
 * - 스토리 상세 조회
 */
router.get('/:id', async (req, res) => {
  const { id } = req.params;

  const conn = await db.getConnection();
  try {
    const [[story]] = await conn.query(
      `
      SELECT
        s.*,
        u.nickname,
        u.avatar_url
      FROM stories s
      JOIN users u ON s.user_id = u.id
      WHERE s.id = ?
      `,
      [id]
    );

    if (!story) {
      conn.release();
      return res.status(404).json({ error: '스토리를 찾을 수 없습니다.' });
    }

    // media JSON 안전 처리
    let media = story.media;

    if (Array.isArray(media)) {
      // 그대로 사용
    } else if (typeof media === 'string') {
      try {
        media = JSON.parse(media) || [];
      } catch {
        media = [];
      }
    } else if (media == null) {
      media = [];
    }

    story.media = media;

    conn.release();
    res.json(story);
  } catch (err) {
    conn.release();
    console.error('[stories] detail error', err);
    res.status(500).json({ error: '스토리 정보를 불러오지 못했습니다.' });
  }
});

/**
 * POST /api/stories
 * - 새 스토리 생성 + 슬라이드별 caption 저장
 */
router.post(
  '/',
  verifyToken,
  upload.array('media', 10),
  async (req, res) => {
    const { title, description, plan_id, thumbnail_index } = req.body;
    const files = req.files || [];

    if (!title || !files.length) {
      return res
        .status(400)
        .json({ error: 'title과 media 파일은 필수입니다.' });
    }

    // 🔹 captions JSON 파싱 (프론트에서 index 기반으로 넘겨줌)
    let captionsMap = {};
    if (req.body.captions) {
      try {
        const parsed = JSON.parse(req.body.captions);
        if (Array.isArray(parsed)) {
          parsed.forEach((c) => {
            if (typeof c.index === 'number') {
              captionsMap[c.index] = c;
            }
          });
        }
      } catch (e) {
        console.warn('[stories] captions JSON parse error:', e.message);
      }
    }

    // 업로드된 파일을 media JSON 구조로 변환
    const media = files.map((file, index) => {
      const ext = path.extname(file.originalname || '').toLowerCase();
      const isVideo = ['.mp4', '.mov', '.avi', '.webm', '.mkv'].includes(ext);

      const capRaw = captionsMap[index] || {};
      const caption =
        capRaw.text && capRaw.text.trim().length > 0
          ? {
              text: capRaw.text.trim(),
              fontSize: capRaw.fontSize || 'md',
              color: capRaw.color || '#ffffff',
              position: capRaw.position || 'bottom',
            }
          : null;

      const url = file.path; // Cloudinary CDN URL (예: https://res.cloudinary.com/...)

      return {
        url,
        type: isVideo ? 'video' : 'image',
        index,
        caption,
      };
    });

    const thumbIdx =
      typeof thumbnail_index !== 'undefined'
        ? parseInt(thumbnail_index, 10)
        : 0;
    const thumbnail = media[thumbIdx]?.url || media[0].url;

    const conn = await db.getConnection();
    try {
      const [result] = await conn.query(
        `
        INSERT INTO stories
          (user_id, plan_id, title, description, thumbnail_url, media)
        VALUES (?, ?, ?, ?, ?, ?)
        `,
        [
          req.user.id,
          plan_id || null,
          title,
          description || '',
          thumbnail,
          JSON.stringify(media),
        ]
      );

      conn.release();
      res.json({ id: result.insertId });
    } catch (err) {
      conn.release();
      console.error('[stories] create error', err);
      res.status(500).json({ error: '스토리를 저장하지 못했습니다.' });
    }
  }
);

/**
 * POST /api/stories/:id/report
 * - 스토리 신고
 */
router.post('/:id/report', verifyToken, async (req, res) => {
  const storyId = parseInt(req.params.id, 10);
  const { reason = 'etc', severity, detail } = req.body || {};
  const reporterId = req.user.id;

  const conn = await db.getConnection();
  try {
    const [[story]] = await conn.query(
      'SELECT id, user_id FROM stories WHERE id = ?',
      [storyId]
    );
    if (!story) {
      conn.release();
      return res.status(404).json({ error: '스토리를 찾을 수 없습니다.' });
    }

    const targetUserId = story.user_id;
    const sev =
      Number.isInteger(Number(severity)) && Number(severity) > 0
        ? Number(severity)
        : 1;

    await conn.query(
      `
      INSERT INTO reports
        (reporter_id, target_user_id, context, reason, ref_id, severity, status, created_at, detail)
      VALUES
        (?, ?, 'story', ?, ?, ?, 'pending', NOW(), ?)
      `,
      [reporterId, targetUserId, reason, storyId, sev, detail || null]
    );

    conn.release();
    res.json({ ok: true });
  } catch (err) {
    conn.release();
    console.error('[stories] report error', err);
    res.status(500).json({ error: '신고 처리 중 오류가 발생했습니다.' });
  }
});

module.exports = router;
