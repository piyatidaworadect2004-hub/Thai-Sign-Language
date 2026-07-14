import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import Login from "./pages/Login";
import Home from "./pages/Home";
import Lesson from "./pages/Lesson";
import Practice from "./pages/Practice";
import Register from "./pages/Register";

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

        {/* หน้า Home */}
        <Route
          path="/home"
          element={<Home />}
        />

        {/* หน้าเรียน */}
        <Route
          path="/lesson/:id"
          element={<Lesson />}
        />

        {/* หน้าฝึก */}
        <Route
          path="/practice/:id"
          element={<Practice />}
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