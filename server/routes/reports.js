// server/routes/reports.js
const express = require('express');
const router = express.Router();
const { verifyToken, requireAdmin } = require('../middlewares/auth');
const ctrl = require('../controllers/reportController');

router.post('/', verifyToken, ctrl.create);
router.post('/:id/resolve', verifyToken, requireAdmin, ctrl.resolve);

module.exports = router;
