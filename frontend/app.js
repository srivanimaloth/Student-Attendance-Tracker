const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const state = { students: [], attendance: [], currentView: "dashboard", pendingConfirm: null };

const todayISO = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`;
};
const niceDate = (value) => value ? new Date(`${value}T00:00:00`).toLocaleDateString(undefined,{day:"numeric",month:"short",year:"numeric"}) : "—";
const escapeHTML = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
const initials = (name) => String(name || "?").trim().split(/\s+/).slice(0,2).map(part=>part[0]||"").join("").toUpperCase();
const statusBadge = (status) => `<span class="status ${status === "present" ? "present" : status === "absent" ? "absent" : "unmarked"}">${status ? escapeHTML(status[0].toUpperCase()+status.slice(1)) : "Not marked"}</span>`;

async function api(path, options = {}) {
  const response = await fetch(path, {
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options
  });
  const body = response.status === 204 ? null : await response.json().catch(() => ({}));
  if (response.status === 401) {
    showLogin();
    throw new Error(body?.error || "Please sign in again.");
  }
  if (!response.ok) throw new Error(body?.error || "Something went wrong. Please try again.");
  return body;
}
function showNotice(message, type = "success") {
  const notice = $("#notice");
  notice.textContent = message;
  notice.className = `notice ${type}`;
  window.scrollTo({top:0,behavior:"smooth"});
  window.clearTimeout(showNotice.timer);
  showNotice.timer = window.setTimeout(()=>notice.classList.add("hidden"),5000);
}
function showLogin() {
  $("#appView").classList.add("hidden");
  $("#loginView").classList.remove("hidden");
  $("#password").value = "";
}
function showApp() {
  $("#loginView").classList.add("hidden");
  $("#appView").classList.remove("hidden");
  $("#todayLabel").textContent = new Date().toLocaleDateString(undefined,{weekday:"short",day:"numeric",month:"short"});
}
function setView(view) {
  state.currentView = view;
  $$(".page-view").forEach(section => section.classList.toggle("hidden", section.id !== `${view}View`));
  $$(".nav-item").forEach(button => button.classList.toggle("active", button.dataset.view === view));
  const titles = {dashboard:["OVERVIEW","Dashboard"],students:["DIRECTORY","Students"],attendance:["DAILY REGISTER","Mark attendance"],records:["HISTORY","Attendance records"]};
  $("#pageEyebrow").textContent = titles[view][0];
  $("#pageTitle").textContent = titles[view][1];
  if (view === "students") renderStudents();
  if (view === "attendance") loadAttendanceForDate();
  if (view === "records") loadRecords();
}
async function loadAll() {
  const [studentsData, attendanceData] = await Promise.all([
    api("/api/students"),
    api(`/api/attendance?date=${encodeURIComponent($("#attendanceDate").value || todayISO())}`)
  ]);
  state.students = studentsData.students;
  state.attendance = attendanceData.records;
  renderDashboard();
  if (state.currentView === "students") renderStudents();
  if (state.currentView === "attendance") renderAttendance();
  if (state.currentView === "records") loadRecords();
}
function renderDashboard() {
  const todayRecords = state.attendance;
  const present = todayRecords.filter(record=>record.status==="present").length;
  const absent = todayRecords.filter(record=>record.status==="absent").length;
  const marked = present+absent;
  $("#statStudents").textContent = state.students.length;
  $("#statPresent").textContent = present;
  $("#statAbsent").textContent = absent;
  $("#statRate").textContent = marked ? `${Math.round(present/marked*100)}%` : "—";
  const rows = todayRecords.slice(0,7);
  $("#dashboardAttendance").innerHTML = rows.length ? `<table><thead><tr><th>Student</th><th>Roll number</th><th>Status</th></tr></thead><tbody>${rows.map(record=>`<tr><td><div class="student-cell"><div class="student-avatar">${escapeHTML(initials(record.student_name))}</div><div><strong>${escapeHTML(record.student_name)}</strong><small>${escapeHTML(record.course || "No course")}</small></div></div></td><td>${escapeHTML(record.roll_number)}</td><td>${statusBadge(record.status)}</td></tr>`).join("")}</tbody></table>` : emptyState("No attendance marked yet","Register students and mark attendance for today.");
}
function emptyState(title, description) { return `<div class="empty-state"><strong>${escapeHTML(title)}</strong>${escapeHTML(description)}</div>`; }
function renderStudents() {
  const query = ($("#studentSearch").value || "").trim().toLowerCase();
  const list = state.students.filter(s=>[s.full_name,s.roll_number,s.course,s.email].some(value=>String(value||"").toLowerCase().includes(query)));
  $("#studentCount").textContent = `${list.length} of ${state.students.length} students`;
  $("#studentsTable").innerHTML = list.length ? `<table><thead><tr><th>Student</th><th>Roll number</th><th>Course / class</th><th>Email</th><th>Actions</th></tr></thead><tbody>${list.map(s=>`<tr><td><div class="student-cell"><div class="student-avatar">${escapeHTML(initials(s.full_name))}</div><div><strong>${escapeHTML(s.full_name)}</strong><small>Added ${niceDate(String(s.created_at||"").slice(0,10))}</small></div></div></td><td>${escapeHTML(s.roll_number)}</td><td>${escapeHTML(s.course||"—")}</td><td>${escapeHTML(s.email||"—")}</td><td><div class="row-actions"><button class="mini-button" data-edit-student="${s.id}">Edit</button><button class="mini-button delete" data-delete-student="${s.id}">Delete</button></div></td></tr>`).join("")}</tbody></table>` : emptyState(query?"No matching students":"No students registered",query?"Try a different search term.":"Click Add student to register your first student.");
}
async function loadAttendanceForDate() {
  const date = $("#attendanceDate").value || todayISO();
  $("#attendanceDateHeading").textContent = `Attendance · ${niceDate(date)}`;
  try {
    const result = await api(`/api/attendance?date=${encodeURIComponent(date)}`);
    state.attendance = result.records;
    renderAttendance();
    renderDashboard();
  } catch(error) { showNotice(error.message,"error"); }
}
function renderAttendance() {
  const date = $("#attendanceDate").value || todayISO();
  $("#attendanceDateHeading").textContent = `Attendance · ${niceDate(date)}`;
  if (!state.students.length) {
    $("#attendanceTable").innerHTML = emptyState("No students available","Add students in the Students section before marking attendance.");
    return;
  }
  const byStudent = new Map(state.attendance.map(r=>[r.student_id,r.status]));
  $("#attendanceTable").innerHTML = `<table><thead><tr><th>Student</th><th>Roll number</th><th>Course</th><th>Status for ${escapeHTML(niceDate(date))}</th></tr></thead><tbody>${state.students.map(s=>`<tr><td><div class="student-cell"><div class="student-avatar">${escapeHTML(initials(s.full_name))}</div><div><strong>${escapeHTML(s.full_name)}</strong></div></div></td><td>${escapeHTML(s.roll_number)}</td><td>${escapeHTML(s.course||"—")}</td><td><select class="attendance-select" data-attendance-student="${s.id}" aria-label="Attendance for ${escapeHTML(s.full_name)}"><option value="">Not marked</option><option value="present" ${byStudent.get(s.id)==="present"?"selected":""}>Present</option><option value="absent" ${byStudent.get(s.id)==="absent"?"selected":""}>Absent</option></select></td></tr>`).join("")}</tbody></table>`;
}
async function saveAttendance() {
  const date = $("#attendanceDate").value || todayISO();
  const records = $$("[data-attendance-student]").map(select=>({student_id:select.dataset.attendanceStudent,status:select.value})).filter(record=>record.status);
  if (!records.length) { showNotice("Choose Present or Absent for at least one student.","error"); return; }
  $("#saveAttendance").disabled = true;
  try {
    const result = await api("/api/attendance/bulk",{method:"POST",body:JSON.stringify({date,records})});
    showNotice(`Saved ${result.saved} attendance record${result.saved===1?"":"s"}.`);
    await loadAll();
  } catch(error) { showNotice(error.message,"error"); }
  finally { $("#saveAttendance").disabled = false; }
}
async function loadRecords() {
  const params = new URLSearchParams();
  if ($("#recordDate").value) params.set("date",$("#recordDate").value);
  const search = ($("#recordSearch").value||"").trim();
  if (search) params.set("search",search);
  try {
    const result = await api(`/api/attendance?${params.toString()}`);
    const records = result.records;
    $("#recordsTable").innerHTML = records.length ? `<table><thead><tr><th>Date</th><th>Student</th><th>Roll number</th><th>Course</th><th>Status</th><th>Action</th></tr></thead><tbody>${records.map(r=>`<tr><td>${escapeHTML(niceDate(r.attendance_date))}</td><td><div class="student-cell"><div class="student-avatar">${escapeHTML(initials(r.student_name))}</div><div><strong>${escapeHTML(r.student_name)}</strong></div></div></td><td>${escapeHTML(r.roll_number)}</td><td>${escapeHTML(r.course||"—")}</td><td>${statusBadge(r.status)}</td><td><button class="mini-button" data-edit-record="${r.student_id}" data-record-date="${escapeHTML(r.attendance_date)}" data-record-status="${escapeHTML(r.status)}">Edit status</button></td></tr>`).join("")}</tbody></table>` : emptyState("No attendance records found","Try another date or search term.");
  } catch(error) { showNotice(error.message,"error"); }
}
function openStudentDialog(student = null) {
  $("#studentForm").reset();
  $("#studentId").value = student?.id || "";
  $("#studentDialogTitle").textContent = student ? "Edit student" : "Add student";
  $("#studentName").value = student?.full_name || "";
  $("#rollNumber").value = student?.roll_number || "";
  $("#course").value = student?.course || "";
  $("#email").value = student?.email || "";
  $("#studentFormMessage").textContent = "";
  $("#studentDialog").showModal();
}
function confirmAction(title,text,buttonText,action) {
  $("#confirmTitle").textContent=title;$("#confirmText").textContent=text;$("#confirmAction").textContent=buttonText;
  state.pendingConfirm=action;$("#confirmDialog").showModal();
}

$("#loginForm").addEventListener("submit",async event=>{
  event.preventDefault();$("#loginMessage").textContent="";
  try { await api("/api/auth/login",{method:"POST",body:JSON.stringify({password:$("#password").value})});showApp();await loadAll();setView("dashboard"); }
  catch(error){$("#loginMessage").textContent=error.message;}
});
$("#logoutButton").addEventListener("click",async()=>{try{await api("/api/auth/logout",{method:"POST",body:JSON.stringify({})});}catch{}showLogin();});
$$(".nav-item").forEach(button=>button.addEventListener("click",()=>setView(button.dataset.view)));
$$("[data-goto]").forEach(button=>button.addEventListener("click",()=>setView(button.dataset.goto)));
$("#refreshButton").addEventListener("click",()=>loadAll().then(()=>showNotice("Data refreshed.")).catch(error=>showNotice(error.message,"error")));
$("#studentSearch").addEventListener("input",renderStudents);
$("#addStudentButton").addEventListener("click",()=>openStudentDialog());
$("#closeStudentDialog").addEventListener("click",()=>$("#studentDialog").close());
$("#cancelStudentDialog").addEventListener("click",()=>$("#studentDialog").close());
$("#studentForm").addEventListener("submit",async event=>{
  event.preventDefault();
  const id=$("#studentId").value;
  const payload={full_name:$("#studentName").value.trim(),roll_number:$("#rollNumber").value.trim(),course:$("#course").value.trim(),email:$("#email").value.trim()||null};
  const submit=event.submitter;submit.disabled=true;$("#studentFormMessage").textContent="";
  try{
    await api(id?`/api/students/${id}`:"/api/students",{method:id?"PUT":"POST",body:JSON.stringify(payload)});
    $("#studentDialog").close();showNotice(id?"Student details updated.":"Student added successfully.");await loadAll();setView("students");
  }catch(error){$("#studentFormMessage").textContent=error.message;}
  finally{submit.disabled=false;}
});
$("#studentsTable").addEventListener("click",event=>{
  const edit=event.target.closest("[data-edit-student]");
  const remove=event.target.closest("[data-delete-student]");
  if(edit){const student=state.students.find(s=>s.id===edit.dataset.editStudent);if(student)openStudentDialog(student);}
  if(remove){const student=state.students.find(s=>s.id===remove.dataset.deleteStudent);if(student)confirmAction("Delete student?",`Delete ${student.full_name} (${student.roll_number}) and their attendance records? This cannot be undone.`,"Delete student",async()=>{await api(`/api/students/${student.id}`,{method:"DELETE"});showNotice("Student and related attendance records deleted.");await loadAll();setView("students");});}
});
$("#attendanceDate").value=todayISO();$("#recordDate").value=todayISO();
$("#attendanceDate").addEventListener("change",loadAttendanceForDate);
$("#markAllPresent").addEventListener("click",()=>$$("[data-attendance-student]").forEach(select=>select.value="present"));
$("#markAllAbsent").addEventListener("click",()=>$$("[data-attendance-student]").forEach(select=>select.value="absent"));
$("#saveAttendance").addEventListener("click",saveAttendance);
$("#recordDate").addEventListener("change",loadRecords);
$("#recordSearch").addEventListener("input",()=>{window.clearTimeout(loadRecords.timer);loadRecords.timer=window.setTimeout(loadRecords,250);});
$("#clearRecordFilters").addEventListener("click",()=>{$("#recordDate").value="";$("#recordSearch").value="";loadRecords();});
$("#recordsTable").addEventListener("click",event=>{
  const edit=event.target.closest("[data-edit-record]");if(!edit)return;
  const select=document.createElement("select");select.className="attendance-select";
  select.innerHTML=`<option value="present" ${edit.dataset.recordStatus==="present"?"selected":""}>Present</option><option value="absent" ${edit.dataset.recordStatus==="absent"?"selected":""}>Absent</option>`;
  const save=document.createElement("button");save.className="mini-button";save.textContent="Save";
  const cancel=document.createElement("button");cancel.className="mini-button";cancel.textContent="Cancel";
  const cell=edit.parentElement;cell.replaceChildren(select,save,cancel);
  cancel.addEventListener("click",loadRecords);
  save.addEventListener("click",async()=>{try{await api("/api/attendance/bulk",{method:"POST",body:JSON.stringify({date:edit.dataset.recordDate,records:[{student_id:edit.dataset.editRecord,status:select.value}]})});showNotice("Attendance status updated.");await loadRecords();await loadAll();}catch(error){showNotice(error.message,"error");}});
});
$("#confirmDialog").addEventListener("close",async()=>{if($("#confirmDialog").returnValue==="confirm"&&state.pendingConfirm){const action=state.pendingConfirm;state.pendingConfirm=null;try{await action();}catch(error){showNotice(error.message,"error");}}else state.pendingConfirm=null;});
(async function init(){try{const result=await api("/api/auth/me");if(result.authenticated){showApp();await loadAll();}else showLogin();}catch{showLogin();}})();
