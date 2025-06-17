// routes/post.js
const express = require('express');
const router = express.Router();
const postController = require('../controllers/postController');
const { verifyToken } = require('../middlewares/auth');

// 전체 게시글 목록
router.get('/', postController.getAllPosts);

// 게시글 등록 (로그인 필요)
router.post('/', verifyToken, postController.createPost);

// 게시글 상세 조회
router.get('/:id', postController.getPostById);

// 게시글 수정/삭제 (로그인 필요)
router.put('/:id', verifyToken, postController.updatePost);
router.delete('/:id', verifyToken, postController.deletePost);

module.exports = router;
