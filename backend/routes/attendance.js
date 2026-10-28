const express = require("express");
const supabase = require("../supabase");
const router = express.Router();
const validDate = (value) => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0,10) === value;

router.get("/", async (req, res) => {
  const date = req.query.date;
  if (date && !validDate(date)) return res.status(400).json({ error: "Date must use YYYY-MM-DD format." });
  let query = supabase.from("attendance").select("id,student_id,attendance_date,status,created_at,students!inner(full_name,roll_number,course)").order("attendance_date", { ascending: false }).order("created_at", { ascending: false }).limit(1000);
  if (date) query = query.eq("attendance_date", date);
  const { data, error } = await query;
  if (error) { console.error("Attendance read failed:", error.message); return res.status(500).json({ error: "Could not load attendance records." }); }
  let records = data.map(r => ({ id:r.id, student_id:r.student_id, attendance_date:r.attendance_date, status:r.status, created_at:r.created_at, student_name:r.students.full_name, roll_number:r.students.roll_number, course:r.students.course }));
  const search = typeof req.query.search === "string" ? req.query.search.trim().toLowerCase().slice(0,100) : "";
  if (search) records = records.filter(r => [r.student_name,r.roll_number,r.course].some(v=>String(v||"").toLowerCase().includes(search)));
  if (date) {
    const { data: students, error: studentError } = await supabase.from("students").select("id,full_name,roll_number,course").order("full_name");
    if (studentError) { console.error("Student list failed:", studentError.message); return res.status(500).json({ error: "Could not load student details." }); }
    const byStudent = new Map(records.map(r=>[r.student_id,r]));
    records = students.map(s=>byStudent.get(s.id) || { student_id:s.id, attendance_date:date, status:null, student_name:s.full_name, roll_number:s.roll_number, course:s.course });
  }
  res.json({ records });
});

router.post("/bulk", async (req, res) => {
  const date = req.body?.date;
  const records = req.body?.records;
  if (!validDate(date)) return res.status(400).json({ error: "A valid date in YYYY-MM-DD format is required." });
  if (!Array.isArray(records) || records.length < 1 || records.length > 500) return res.status(400).json({ error: "Provide between 1 and 500 attendance records." });
  const seen = new Set();
  for (const record of records) {
    if (!record || typeof record.student_id !== "string" || !["present","absent"].includes(record.status)) return res.status(400).json({ error: "Each record needs a student ID and status of present or absent." });
    if (seen.has(record.student_id)) return res.status(400).json({ error: "A student can appear only once in a save request." });
    seen.add(record.student_id);
  }
  const rows = records.map(record=>({ student_id:record.student_id, attendance_date:date, status:record.status }));
  const { data, error } = await supabase.from("attendance").upsert(rows,{onConflict:"student_id,attendance_date"}).select("id");
  if (error) {
    if (error.code === "23503") return res.status(400).json({ error: "One or more selected students do not exist." });
    console.error("Attendance save failed:", error.message);
    return res.status(500).json({ error: "Could not save attendance records." });
  }
  res.json({ saved:data.length });
});
module.exports = router;
