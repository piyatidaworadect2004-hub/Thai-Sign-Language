import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import Login from "./pages/Login";
import Home from "./pages/Home";
import Lesson from "./pages/Lesson";
import Practice from "./pages/Practice";
import Register from "./pages/Register";
import AdminDashboard from './pages/Admim/AdminDashboard';

// 1. สร้างตัวกรองตรวจตั๋ว (Protected Route)
// ทำหน้าที่เช็กว่ามี Token อยู่ในเครื่องไหม ถ้าไม่มีจะเตะกลับไปหน้า Login ทันที
function ProtectedRoute({ children }) {
  const token = localStorage.getItem("token"); // ดึง token ที่เก็บไว้ตอน login สำเร็จ
  
  if (!token) {
    // ไม่มี Token = ยังไม่ได้ล็อกอิน -> ส่งกลับไปหน้า Login
    return <Navigate to="/login" replace />;
  }

  // มี Token -> อนุญาตให้เข้าถึงหน้านั้นๆ ได้
  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* เปิดเว็บแล้วไปหน้า Login */}
        <Route
          path="/"
          element={<Navigate to="/login" replace />}
        />

        {/* หน้า Login */}
        <Route
          path="/login"
          element={<Login />}
        />

        {/* หน้า Register */}
        <Route
          path="/register"
          element={<Register />}
        />

        {/* ============================================================== */}
        {/* กลุ่มหน้าเว็บที่ต้อง Login ก่อนเท่านั้นถึงจะเข้าได้ (ใช้ ProtectedRoute คลุมไว้) */}
        {/* ============================================================== */}
        
        {/* หน้า Home */}
        <Route
          path="/home"
          element={
            <ProtectedRoute>
              <Home />
            </ProtectedRoute>
          }
        />

        {/* หน้าเรียน */}
        <Route
          path="/lesson/:id"
          element={
            <ProtectedRoute>
              <Lesson />
            </ProtectedRoute>
          }
        />

        {/* หน้าฝึก */}
        <Route
          path="/practice/:id"
          element={
            <ProtectedRoute>
              <Practice />
            </ProtectedRoute>
          }
        />

        {/* 🟢 หน้าจัดการระบบสำหรับแอดมิน */}
        <Route
          path="/admin-dashboard"
          element={
            <ProtectedRoute>
              <AdminDashboard />
            </ProtectedRoute>
          }
        />

        {/* ถ้าพิมพ์ URL ผิด ให้กลับ Login */}
        <Route
          path="*"
          element={<Navigate to="/login" replace />}
        />

      </Routes>
    </BrowserRouter>
  );
}