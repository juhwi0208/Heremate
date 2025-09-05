// server/routes/mate.js
const express = require('express');
const router = express.Router();
const { searchMates } = require('../controllers/mateController');

router.get('/', searchMates); // /api/mates?location=제주&style=자연

module.exports = router;
