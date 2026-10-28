const express = require("express");
const router = express.Router();

router.post("/login", (req, res, next) => {
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  if (!password || password.length > 200 || password !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: "Incorrect admin password." });
  }
  req.session.regenerate((error) => {
    if (error) return next(error);
    req.session.isAdmin = true;
    req.session.save((saveError) => {
      if (saveError) return next(saveError);
      res.json({ authenticated: true });
    });
  });
});
router.get("/me", (req, res) => res.json({ authenticated: req.session?.isAdmin === true }));
router.post("/logout", (req, res, next) => {
  if (!req.session) return res.json({ ok: true });
  req.session.destroy((error) => {
    if (error) return next(error);
    res.clearCookie("attendance.sid", { httpOnly: true, sameSite: "strict", secure: process.env.NODE_ENV === "production" });
    res.json({ ok: true });
  });
});
module.exports = { router };
