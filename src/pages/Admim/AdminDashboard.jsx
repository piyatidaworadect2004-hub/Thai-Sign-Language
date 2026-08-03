import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../../components/Navbar';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  const [lessons, setLessons] = useState([]);
  const [users, setUsers] = useState([]);
  const [reports, setReports] = useState([]);
  const [loginLogs, setLoginLogs] = useState([]);
  const [newLessonTitle, setNewLessonTitle] = useState('');

  useEffect(() => {
    const role = localStorage.getItem('role');
    if (role !== 'admin') {
      alert('คุณไม่มีสิทธิ์เข้าถึงหน้านี้!');
      navigate('/home');
    } else {
      setLoading(false);
      fetchAllData();
    }
  }, [navigate]);

  const fetchAllData = async () => {
    const token = localStorage.getItem('token');
    const headers = { 
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };

    try {
      // ดึงข้อมูลบทเรียน
      const lessonsRes = await fetch('http://127.0.0.1:8000/lessons', { headers });
      if (lessonsRes.ok) {
        const lessonsData = await lessonsRes.json();
        setLessons(lessonsData);
      }

      // ดึงข้อมูลรายชื่อผู้ใช้งาน
      const usersRes = await fetch('http://127.0.0.1:8000/auth/users', { headers });
      if (usersRes.ok) {
        const usersData = await usersRes.json();
        setUsers(usersData);
      }
    } catch (error) {
      console.error('Error fetching admin data:', error);
    }
  };

  const fetchLoginLogs = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('http://127.0.0.1:8000/admin/login-logs', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setLoginLogs(data);
        setActiveTab('login-logs');
      } else {
        alert('ไม่สามารถดึงประวัติการเข้าสู่ระบบได้');
      }
    } catch (error) {
      console.error('Error fetching login logs:', error);
      alert('เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์');
    }
  };

  const handleDeleteLesson = async (lessonId) => {
    if (!window.confirm('คุณต้องการลบบทเรียนนี้ใช่หรือไม่?')) return;
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`http://127.0.0.1:8000/lessons/${lessonId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        alert('ลบบทเรียนสำเร็จ');
        fetchAllData();
      } else {
        alert('ลบบทเรียนไม่สำเร็จ');
      }
    } catch (error) {
      alert('เกิดข้อผิดพลาดในการลบบทเรียน');
    }
  };

  const handleViewUserProgress = async (userId) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`http://127.0.0.1:8000/progress/user/${userId}/overview`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setReports(data);
        setActiveTab('reports');
      } else {
        alert('ไม่สามารถดึงข้อมูลความคืบหน้าของ User นี้ได้');
      }
    } catch (error) {
      alert('เกิดข้อผิดพลาดในการดึงรายงาน');
    }
  };

  // ฟังก์ชันสำหรับอัปเดตสิทธิ์ผู้ใช้เป็น Admin
  const handleMakeAdmin = async (userId, currentRole) => {
    if (currentRole === 'admin') {
      alert('ผู้ใช้นี้มีสิทธิ์เป็น Admin อยู่แล้ว');
      return;
    }

    if (!window.confirm('คุณต้องการเปลี่ยนสิทธิ์ผู้ใช้นี้ให้เป็น Admin ใช่หรือไม่?')) return;

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`http://127.0.0.1:8000/auth/users/${userId}/role`, {
        method: 'PUT',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ role: 'admin' })
      });

      if (res.ok) {
        alert('อัปเดตสิทธิ์เป็น Admin สำเร็จ');
        fetchAllData(); // โหลดข้อมูลผู้ใช้ใหม่เพื่อรีเฟรชตาราง
      } else {
        const errData = await res.json();
        alert(errData.detail || 'อัปเดตสิทธิ์ไม่สำเร็จ');
      }
    } catch (error) {
      console.error('Error updating user role:', error);
      alert('เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์');
    }
  };

  if (loading) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      
      <div className="max-w-7xl mx-auto px-8 py-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">⚙️ ระบบจัดการหลังบ้าน (Admin Dashboard)</h1>
        <p className="text-gray-600 mb-8">ยินดีต้อนรับเข้าสู่ระบบจัดการสำหรับผู้ดูแลระบบ</p>

        {/* เมนูกล่องการ์ดจัดการต่างๆ */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex flex-col justify-between">
            <div>
              <h3 className="text-xl font-semibold text-blue-600 mb-2">📚 จัดการบทเรียน</h3>
              <p className="text-gray-500 text-sm mb-4">เพิ่ม ลบ หรือแก้ไขวิดีโอและหมวดหมู่บทเรียนภาษามือ</p>
            </div>
            <button 
              onClick={() => setActiveTab('lessons')}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition self-start"
            >
              จัดการบทเรียน
            </button>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex flex-col justify-between">
            <div>
              <h3 className="text-xl font-semibold text-green-600 mb-2">👥 จัดการผู้ใช้งาน</h3>
              <p className="text-gray-500 text-sm mb-4">ตรวจสอบรายชื่อสมาชิกและสิทธิ์การใช้งานในระบบ</p>
            </div>
            <button 
              onClick={() => setActiveTab('users')}
              className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 transition self-start"
            >
              ดูรายชื่อผู้ใช้
            </button>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex flex-col justify-between">
            <div>
              <h3 className="text-xl font-semibold text-purple-600 mb-2">📊 ตรวจสอบผลการทดสอบ</h3>
              <p className="text-gray-500 text-sm mb-4">ดูสถิติคะแนนและประวัติการฝึกฝนของผู้เรียน</p>
            </div>
            <button 
              onClick={() => setActiveTab('reports')}
              className="bg-purple-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-purple-700 transition self-start"
            >
              ดูรายงานผล
            </button>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex flex-col justify-between">
            <div>
              <h3 className="text-xl font-semibold text-amber-600 mb-2">🕒 ประวัติ Login</h3>
              <p className="text-gray-500 text-sm mb-4">ตรวจสอบประวัติว่ามี User คนไหนเข้าสู่ระบบบ้าง</p>
            </div>
            <button 
              onClick={fetchLoginLogs}
              className="bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-amber-700 transition self-start"
            >
              ดูประวัติ Login
            </button>
          </div>
        </div>

        {/* พื้นที่แสดงผลตาม Tab ที่เลือก */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          {activeTab === 'overview' && (
            <div className="text-center py-12 text-gray-500">
              👈 กรุณาคลิกปุ่มจากการ์ดด้านบนเพื่อเลือกจัดการข้อมูล
            </div>
          )}

          {activeTab === 'lessons' && (
            <div>
              <h2 className="text-xl font-bold text-gray-800 mb-4">📚 จัดการบทเรียนภาษามือ</h2>
              <div className="mb-6 flex gap-4">
                <input 
                  type="text" 
                  placeholder="ชื่อบทเรียนใหม่..." 
                  value={newLessonTitle}
                  onChange={(e) => setNewLessonTitle(e.target.value)}
                  className="border border-gray-300 rounded-lg px-4 py-2 flex-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button 
                  onClick={() => alert('ฟังก์ชันเพิ่มบทเรียน')}
                  className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 transition"
                >
                  + เพิ่มบทเรียน
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ชื่อบทเรียน</th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">จัดการ</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {lessons.map((lesson) => (
                      <tr key={lesson.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{lesson.id}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{lesson.title}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-center text-sm">
                          <button 
                            onClick={() => handleDeleteLesson(lesson.id)}
                            className="bg-red-100 text-red-600 px-3 py-1 rounded-lg hover:bg-red-200 transition"
                          >
                            ลบ
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'users' && (
            <div>
              <h2 className="text-xl font-bold text-gray-800 mb-4">👥 รายชื่อผู้ใช้งานในระบบ</h2>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">อีเมล / ชื่อผู้ใช้</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">สิทธิ์ (Role)</th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">การจัดการสิทธิ์</th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">ความคืบหน้า</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {users.map((u) => (
                      <tr key={u.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{u.id}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{u.email || u.username}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          <span className={`px-2 py-1 rounded text-xs font-semibold ${u.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-700'}`}>
                            {u.role}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center text-sm">
                          {u.role !== 'admin' ? (
                            <button 
                              onClick={() => handleMakeAdmin(u.id, u.role)}
                              className="bg-blue-100 text-blue-700 px-3 py-1 rounded-lg hover:bg-blue-200 transition text-xs font-medium"
                            >
                              ⭐ ตั้งเป็น Admin
                            </button>
                          ) : (
                            <span className="text-xs text-gray-400">เป็น Admin อยู่แล้ว</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center text-sm">
                          <button 
                            onClick={() => handleViewUserProgress(u.id)}
                            className="bg-purple-100 text-purple-700 px-3 py-1 rounded-lg hover:bg-purple-200 transition text-xs font-medium"
                          >
                            ดูความคืบหน้า
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'reports' && (
            <div>
              <h2 className="text-xl font-bold text-gray-800 mb-4">📊 รายงานผลการฝึกฝนและความคืบหน้า</h2>
              <p className="text-gray-500 text-sm mb-4">แสดงข้อมูลภาพรวมคะแนนและประวัติการฝึกท่าภาษามือของผู้ใช้ที่เลือก</p>
              
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <pre className="text-xs text-gray-700 overflow-x-auto">
                  {reports.length > 0 ? JSON.stringify(reports, null, 2) : 'ยังไม่ได้เลือกผู้ใช้ หรือไม่มีข้อมูลความคืบหน้า'}
                </pre>
              </div>
            </div>
          )}

          {activeTab === 'login-logs' && (
            <div>
              <h2 className="text-xl font-bold text-gray-800 mb-4">🕒 ประวัติการเข้าสู่ระบบ (Login History)</h2>
              <p className="text-gray-500 text-sm mb-4">บันทึกข้อมูลว่ามีบัญชีผู้ใช้งานใดบ้างที่ทำการ Login เข้ามาในระบบ</p>
              
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID ผู้ใช้</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">อีเมล</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">เวลาที่เข้าสู่ระบบ</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {loginLogs.length > 0 ? (
                      loginLogs.map((log) => (
                        <tr key={log.id}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{log.user_id}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{log.email}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {new Date(log.login_time).toLocaleString('th-TH')}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="3" className="px-6 py-8 text-center text-sm text-gray-500">
                          ไม่มีข้อมูลประวัติการเข้าสู่ระบบ
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}