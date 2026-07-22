import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Navbar() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');

  useEffect(() => {
    // 🔍 ดึงชื่อผู้ใช้งานที่เซฟไว้ตอน Login
    const storedUsername = localStorage.getItem('username');
    if (storedUsername) {
      setUsername(storedUsername);
    }
  }, []);

  // 🚪 ฟังก์ชันกดออกจากระบบ
  const handleLogout = () => {
    localStorage.removeItem('token');     // ลบ Token
    localStorage.removeItem('username');  // ลบชื่อผู้ใช้
    navigate('/login');                   // เด้งกลับไปหน้า Login
  };

  return (
    <nav className="flex items-center justify-between px-8 py-4 bg-white shadow-sm">
      {/* ฝั่งซ้าย: ชื่อโปรเจกต์ */}
      <div className="text-xl font-bold text-blue-600">
        Thai Sign Learning
      </div>

      {/* ฝั่งขวา: รายการเมนู และ ส่วนชื่อผู้ใช้/Logout */}
      <div className="flex items-center space-x-6 font-medium text-gray-700">
        <a href="/home" className="hover:text-blue-600 transition">หน้าหลัก</a>
        <a href="#lessons" className="hover:text-blue-600 transition">บทเรียน</a>
        <a href="#predict" className="hover:text-blue-600 transition">ฝึก AI</a>
        <a href="#quiz" className="hover:text-blue-600 transition">แบบทดสอบ</a>

        {/* เส้นแบ่งโซน */}
        <span className="text-gray-300">|</span>

        {/* 👤 แสดงชื่อผู้ใช้งานและปุ่มออกจากระบบ */}
        <div className="flex items-center space-x-4">
          <span className="text-gray-900 font-semibold bg-gray-100 px-3 py-1 rounded-full text-sm">
            👤 {username || "ผู้ใช้งาน"}
          </span>
          <button 
            onClick={handleLogout}
            className="text-red-500 hover:text-red-700 font-medium text-sm transition focus:outline-none"
          >
            ออกจากระบบ
          </button>
        </div>
      </div>
    </nav>
  );
}