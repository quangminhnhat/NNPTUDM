function checkAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.json({ message: "please login" });
}

function checkNotAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return res.json({ message: "Already authenticated" });
  }
  next();
}

module.exports = {
  checkAuthenticated,
  checkNotAuthenticated,
};