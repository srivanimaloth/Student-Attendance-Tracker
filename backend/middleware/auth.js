function requireAdmin(req, res, next) {
  if (req.session && req.session.isAdmin === true) return next();
  return res.status(401).json({ error: "Please sign in as administrator." });
}
module.exports = { requireAdmin };
