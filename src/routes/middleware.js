const jwt = require('jsonwebtoken');

function attachUserOptional(req, _res, next) {
  try {
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
      req.user = { id: String(decoded.userId), username: decoded.username, email: decoded.email, role: decoded.role };
    }
  } catch (e) {
    // ignore, user stays undefined
  }
  next();
}

function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  next();
}

function authenticateToken(req, res, next) {
  try {
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    
    if (!token) {
      return res.status(401).json({ error: 'Access token required' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    req.user = { 
      userId: String(decoded.userId), 
      username: decoded.username, 
      email: decoded.email, 
      role: decoded.role 
    };
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

module.exports = { attachUserOptional, requireAuth, authenticateToken };


