// backend/app.js
require('dotenv').config(); 
const express = require('express');
const cors = require('cors');
const authRouter = require('./routes/auth');
const adminRouter = require('./routes/admin');
const postRoutes = require('./routes/post');
const mateRoutes = require('./routes/mate');
const plansRouter = require('./routes/plans');
const placesRouter = require('./routes/places');



const app = express();
app.use(cors());
app.use(express.json());
app.use('/auth', authRouter);
app.use('/admin', adminRouter);
app.use('/api/posts', postRoutes);
app.use('/api/mates', mateRoutes);
app.use('/api/chats', require('./routes/chat'));
app.use('/api/plans', plansRouter);
app.use('/api/places', placesRouter);
const PORT = 4000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
