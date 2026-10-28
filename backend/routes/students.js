const express = require("express");
const supabase = require("../supabase");
const router = express.Router();

function validateStudent(body) {
  const full_name = typeof body.full_name === "string" ? body.full_name.trim() : "";
  const roll_number = typeof body.roll_number === "string" ? body.roll_number.trim() : "";
  const course = typeof body.course === "string" ? body.course.trim() : "";
  const email = typeof body.email === "string" && body.email.trim() ? body.email.trim().toLowerCase() : null;
  if (!full_name || full_name.length > 100) return { error: "Full name is required and must be at most 100 characters." };
  if (!roll_number || roll_number.length > 30) return { error: "Roll number is required and must be at most 30 characters." };
  if (course.length > 100) return { error: "Course must be at most 100 characters." };
  if (email && (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) return { error: "Enter a valid email address." };
  return { data: { full_name, roll_number, course: course || null, email } };
}
function dbError(error, res) {
  if (error.code === "23505") return res.status(409).json({ error: "That roll number is already registered." });
  console.error("Student database operation failed:", error.message);
  return res.status(500).json({ error: "Could not complete the student database operation." });
}
router.get("/", async (_req, res) => {
  const { data, error } = await supabase.from("students").select("id,full_name,roll_number,course,email,created_at").order("full_name");
  if (error) return dbError(error, res);
  res.json({ students: data });
});
router.post("/", async (req, res) => {
  const validated = validateStudent(req.body || {});
  if (validated.error) return res.status(400).json({ error: validated.error });
  const { data, error } = await supabase.from("students").insert(validated.data).select("id,full_name,roll_number,course,email,created_at").single();
  if (error) return dbError(error, res);
  res.status(201).json({ student: data });
});
router.put("/:id", async (req, res) => {
  const validated = validateStudent(req.body || {});
  if (validated.error) return res.status(400).json({ error: validated.error });
  const { data, error } = await supabase.from("students").update(validated.data).eq("id", req.params.id).select("id,full_name,roll_number,course,email,created_at").maybeSingle();
  if (error) return dbError(error, res);
  if (!data) return res.status(404).json({ error: "Student not found." });
  res.json({ student: data });
});
router.delete("/:id", async (req, res) => {
  const { data, error } = await supabase.from("students").delete().eq("id", req.params.id).select("id").maybeSingle();
  if (error) return dbError(error, res);
  if (!data) return res.status(404).json({ error: "Student not found." });
  res.status(204).end();
});
module.exports = router;
