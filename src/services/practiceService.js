const API_URL = "http://localhost:8000";

function authHeaders() {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// ประวัติการฝึกทั้งหมดของ user ที่ login อยู่ (ล่าสุด 50 รายการ, มี is_correct ต่อคำ)
export async function getPracticeHistory() {
  const token = localStorage.getItem("token");
  if (!token) return [];

  try {
    const res = await fetch(`${API_URL}/practice-history`, {
      headers: authHeaders(),
    });
    if (!res.ok) return [];
    return await res.json();
  } catch (error) {
    console.error("ดึงประวัติการฝึกล้มเหลว:", error);
    return [];
  }
}

// สรุปความคืบหน้าแยกตามหมวดหมู่ ของ user ที่ login อยู่
export async function getProgressOverview() {
  const token = localStorage.getItem("token");
  if (!token) return [];

  try {
    const res = await fetch(`${API_URL}/progress/me/overview`, {
      headers: authHeaders(),
    });
    if (!res.ok) return [];
    return await res.json();
  } catch (error) {
    console.error("ดึงความคืบหน้าล้มเหลว:", error);
    return [];
  }
}

// คำนี้ผู้ใช้เคยฝึก "ผ่าน" แล้วหรือยัง (ดูจาก history ที่ดึงมาแล้ว ไม่ยิง API ซ้ำต่อคำ)
export function isSaved(history, word) {
  if (!word) return false;
  return history.some((log) => log.is_correct && log.lesson?.word === word);
}

// อัดคลิปเสร็จแล้วส่งไปเทียบท่ากับ Ground Truth — backend เช็คผ่าน sign_engine และบันทึกลง
// PracticeLog ให้อัตโนมัติถ้า login อยู่ (ดู backend/app/routers/practice_compare.py)
export async function saveAfterPractice({ word, lessonId, videoBlob }) {
  const formData = new FormData();
  formData.append("word", word);
  formData.append("lesson_id", lessonId || "1");
  formData.append("file", videoBlob, "practice.webm");

  const res = await fetch(`${API_URL}/practice-compare/compare`, {
    method: "POST",
    headers: authHeaders(),
    body: formData,
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(errText || `เกิดข้อผิดพลาด (${res.status})`);
  }

  return res.json();
}
