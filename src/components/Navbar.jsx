import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom'; // 🟢 เพิ่ม Link ถ้ารองรับ หรือใช้ a ตามโค้ดเดิม

export default function Navbar() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const storedUsername = localStorage.getItem('username');
    const storedRole = localStorage.getItem('role');

    if (storedUsername) {
      setUsername(storedUsername);
    }

    if (storedRole === 'admin') {
      setIsAdmin(true);
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    localStorage.removeItem('role');
    navigate('/login');
  };

  return (
    <nav className="flex items-center justify-between px-8 py-4 bg-white shadow-sm">
      {/* ฝั่งซ้าย: ชื่อโปรเจกต์ */}
      <div 
        className="text-xl font-bold text-blue-600 cursor-pointer" 
        onClick={() => navigate('/home')}
      >
        Thai Sign Learning
      </div>

      {/* ฝั่งขวา: รายการเมนู และ ส่วนชื่อผู้ใช้/Logout */}
      <div className="flex items-center space-x-6 font-medium text-gray-700">
        <a href="/home" className="hover:text-blue-600 transition">หน้าหลัก</a>
        <a href="/lessons" className="hover:text-blue-600 transition">บทเรียน</a>
        <a href="/practice" className="hover:text-blue-600 transition">ฝึก AI</a>
        <a href="/quiz" className="hover:text-blue-600 transition">แบบทดสอบ</a>

        {/* 📊 เมนูกดไปหน้าแดชบอร์ดความคืบหน้า */}
        <a 
          href="/dashboard" 
          className="text-blue-600 font-bold hover:text-blue-800 transition bg-blue-50 px-3 py-1 rounded-full text-sm border border-blue-200"
        >
          📊 แดชบอร์ด
        </a>

        {/* ⚙️ ปุ่มเมนูแอดมิน (แสดงเฉพาะแอดมิน) */}
        {isAdmin && (
          <a 
            href="/admin-dashboard" 
            className="text-red-600 font-bold hover:text-red-800 transition bg-red-50 px-3 py-1 rounded-full text-sm border border-red-200"
          >
            ⚙️ จัดการระบบ (Admin)
          </a>
        )}

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