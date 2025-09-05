// server/routes/plans.js
const express = require('express');
const router = express.Router();
const {
  listSharedPlans,
  listPlans,
  getPlanById,
  getPlanReadonlyAware,
  createPlan,
  updatePlan,
  deletePlan,
  sharePlan,
  unsharePlan,
  copySharedPlan,
} = require('../controllers/planController');
const { verifyToken } = require('../middlewares/auth');

// 공개
router.get('/shared', listSharedPlans);
router.get('/:id/readonly', getPlanReadonlyAware);

// 보호
router.get('/', verifyToken, listPlans);
router.post('/', verifyToken, createPlan);
router.post('/:id/share', verifyToken, sharePlan);
router.delete('/:id/share', verifyToken, unsharePlan);
router.post('/:id/copy', verifyToken, copySharedPlan);

// 파라미터 라우트는 마지막
router.get('/:id', verifyToken, getPlanById);
router.put('/:id', verifyToken, updatePlan);
router.delete('/:id', verifyToken, deletePlan);

module.exports = router;
