'use strict';

const jwt = require('jsonwebtoken');

function authenticateToken(req, res, next) {
  const SECRET_KEY = process.env.JWT_SECRET;
  if (!SECRET_KEY) {
    throw new Error('❌ Missing required env var: JWT_SECRET must be set in .env');
  }

  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: "Access Denied" });

  jwt.verify(token, SECRET_KEY, (err, user) => {
    if (err) return res.status(403).json({ error: "Invalid Token" });
    req.user = user;
    next();
  });
}

module.exports = {
  authenticateToken
};
