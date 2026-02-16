const jwt = require('jsonwebtoken');

function checkAuthenticated(req, res, next) {
  // Check session-based authentication (for web views)
  if (req.isAuthenticated()) {
    res.locals.user = req.user;  // Make user available to views
    return next();
  }

  // Check JWT token from Authorization header (for API calls)
  let token = req.headers.authorization?.split(' ')[1];
  
  // Also check for JWT in cookies (for web views)
  if (!token && req.cookies?.authToken) {
    token = req.cookies.authToken;
  }

  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
      req.user = decoded;
      res.locals.user = decoded;  // Make user available to views
      return next();
    } catch (error) {
      console.error('JWT verification failed:', error.message);
    }
  }

  // If it's an API request, return JSON error
  if (req.path.startsWith('/api/')) {
    return res.status(401).json({ message: "please login" });
  }

  // If it's a web request, redirect to login
  res.redirect('/login');
}

function checkNotAuthenticated(req, res, next) {
  // Check session-based authentication
  if (req.isAuthenticated()) {
    return res.redirect('/');
  }

  // Check JWT token
  const token = req.headers.authorization?.split(' ')[1];
  if (token) {
    try {
      jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
      return res.redirect('/');
    } catch (error) {
      console.error('JWT verification failed:', error.message);
    }
  }

  next();
}

function verifyJWT(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

module.exports = {
  checkAuthenticated,
  checkNotAuthenticated,
  verifyJWT,
};