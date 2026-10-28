require("dotenv").config();
const path = require("path");
const express = require("express");
const session = require("express-session");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const { router: authRouter } = require("./routes/auth");
const studentsRouter = require("./routes/students");
const attendanceRouter = require("./routes/attendance");
const { requireAdmin } = require("./middleware/auth");

const app = express();
const PORT = Number(process.env.PORT || 3000);
const isProduction = process.env.NODE_ENV === "production";

if (!process.env.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD.length < 12) {
  console.error("Configuration error: set ADMIN_PASSWORD to a password at least 12 characters long in backend/.env.");
  process.exit(1);
}
if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) {
  console.error("Configuration error: set SESSION_SECRET to a random secret at least 32 characters long in backend/.env.");
  process.exit(1);
}
if (isProduction) app.set("trust proxy", 1);

app.disable("x-powered-by");
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: "50kb" }));
app.use(session({
  name: "attendance.sid",
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: isProduction,
    sameSite: "strict",
    maxAge: 2 * 60 * 60 * 1000
  }
}));

app.get("/api/health", (_req, res) => res.json({ ok: true, service: "student-attendance-tracker" }));
app.use("/api/auth", rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: "draft-8", legacyHeaders: false }), authRouter);
app.use("/api/students", requireAdmin, studentsRouter);
app.use("/api/attendance", requireAdmin, attendanceRouter);
app.use(express.static(path.join(__dirname, "..", "frontend")));
app.get(/.*/, (_req, res) => res.sendFile(path.join(__dirname, "..", "frontend", "index.html")));

app.use((err, _req, res, _next) => {
  console.error("Request failed:", err.message);
  if (res.headersSent) return;
  res.status(err.status || 500).json({ error: err.status && err.status < 500 ? err.message : "An unexpected server error occurred." });
});

app.listen(PORT, () => console.log(`Student Attendance Tracker running at http://localhost:${PORT}`));
