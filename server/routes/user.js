// server/routes/user.js
const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { verifyToken } = require('../middlewares/auth');
const ctrl = require('../controllers/userController');

const router = express.Router();

// 업로드 저장 폴더 준비
const uploadDir = path.join(__dirname, '..', 'uploads', 'avatars');
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '');
    cb(null, `${req.user.id}_${Date.now()}${ext}`);
  }
});
const upload = multer({ storage });

// /api/users
router.get('/me', verifyToken, ctrl.getMe);
router.put('/me', verifyToken, upload.single('avatar'), ctrl.updateMe);
router.delete('/me', verifyToken, ctrl.deleteMe); // 🟢 Added
router.get('/me', verifyToken, ctrl.getMe);
router.put('/me', verifyToken, upload.single('avatar'), ctrl.updateMe);
router.delete('/me', verifyToken, ctrl.deleteMe);
// 🆕 신뢰 지표
router.get('/:id/trust', verifyToken, ctrl.getTrust);

module.exports = router;
