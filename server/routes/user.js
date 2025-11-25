// server/routes/user.js
const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { verifyToken } = require('../middlewares/auth');
const ctrl = require('../controllers/userController');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('../config/cloudinary');


const router = express.Router();

// 업로드 저장 폴더 준비
const avatarStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'heremate/avatars', // Cloudinary 안에서의 폴더 이름(원하는대로)
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    transformation: [
      { width: 400, height: 400, crop: 'fill', gravity: 'face' },
    ],
  },
});

const upload = multer({ storage: avatarStorage });

// /api/users
router.get('/me', verifyToken, ctrl.getMe);
router.put('/me', verifyToken, upload.single('avatar'), ctrl.updateMe);
router.delete('/me', verifyToken, ctrl.deleteMe); // 🟢 Added

//router.get('/me', verifyToken, ctrl.getMe);
//router.put('/me', verifyToken, upload.single('avatar'), ctrl.updateMe);
//router.delete('/me', verifyToken, ctrl.deleteMe);

// ✅ 프로필 신뢰(별자리) 조회
router.get('/:id/trust', verifyToken, ctrl.getTrust);
router.get('/:id/trust/profile', verifyToken, ctrl.getTrustProfile);


module.exports = router;
