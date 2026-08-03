import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Navbar() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [isAdmin, setIsAdmin] = useState(false); // 👈 สร้าง State เช็กสิทธิ์แอดมิน

  useEffect(() => {
    // 🔍 ดึงข้อมูลที่เซฟไว้ตอน Login
    const storedUsername = localStorage.getItem('username');
    const storedRole = localStorage.getItem('role'); // 👈 ดึงค่า role มาเช็ก

    if (storedUsername) {
      setUsername(storedUsername);
    }

    // 🛡️ ถ้า role เป็น admin ให้เปลี่ยนค่าเป็น true
    if (storedRole === 'admin') {
      setIsAdmin(true);
    }
  }, []);

  // 🚪 ฟังก์ชันกดออกจากระบบ
  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    localStorage.removeItem('role'); // 👈 ลบ role ออกตอน Logout ด้วย
    navigate('/login');
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

        {/* ⚙️ ปุ่มเมนูแอดมิน (จะแสดงก็ต่อเมื่อ isAdmin เป็น true) */}
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