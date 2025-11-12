// server/routes/reviews.js
const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middlewares/auth');
const ctrl = require('../controllers/reviewController');

router.post('/', verifyToken, ctrl.createOrUpdate);

module.exports = router;
