import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../../components/Navbar';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  const [lessons, setLessons] = useState([]);
  const [categories, setCategories] = useState([]); // ★ เพิ่ม: ใช้ทำ dropdown เลือกหมวดหมู่
  const [users, setUsers] = useState([]);
  const [reports, setReports] = useState([]);
  const [selectedUserLabel, setSelectedUserLabel] = useState('');
  const [loginLogs, setLoginLogs] = useState([]);

  // ★ เพิ่ม: state สำหรับฟอร์มเพิ่มบทเรียน (เดิมมีแค่ newLessonTitle อย่างเดียว)
  const [newLessonTitle, setNewLessonTitle] = useState('');
  const [newLessonCategoryId, setNewLessonCategoryId] = useState('');
  const [newLessonDescription, setNewLessonDescription] = useState('');
  const [newLessonVideoUrl, setNewLessonVideoUrl] = useState('');
  const [addingLesson, setAddingLesson] = useState(false);

  // ★ เพิ่ม: แก้ไข video_url ของคำที่มีอยู่แล้ว (แยกจากฟอร์มเพิ่มคำใหม่ด้านบน)
  const [editingVideoId, setEditingVideoId] = useState(null);
  const [editingVideoUrl, setEditingVideoUrl] = useState('');

  // ★ เพิ่ม: สร้าง Ground Truth อัตโนมัติจากวิดีโอตัวอย่าง (video_url) ของคำนั้น
  const [buildingGtId, setBuildingGtId] = useState(null);

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
      const lessonsRes = await fetch('http://127.0.0.1:8000/lessons', { headers });
      if (lessonsRes.ok) {
        const lessonsData = await lessonsRes.json();
        setLessons(lessonsData);
      }

      // ★ เพิ่ม: ดึงข้อมูลหมวดหมู่ ใช้ทำ dropdown ตอนเพิ่มบทเรียน + โชว์ชื่อหมวดในตาราง
      const categoriesRes = await fetch('http://127.0.0.1:8000/categories', { headers });
      if (categoriesRes.ok) {
        const categoriesData = await categoriesRes.json();
        setCategories(categoriesData);
      }

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

  // ★ เพิ่มใหม่: ฟังก์ชันเพิ่มบทเรียนจริง (แทนที่ alert เดิม)
  const handleAddLesson = async () => {
    if (!newLessonTitle.trim()) {
      alert('กรุณากรอกชื่อคำศัพท์');
      return;
    }
    if (!newLessonCategoryId) {
      alert('กรุณาเลือกหมวดหมู่');
      return;
    }
    if (!newLessonVideoUrl.trim()) {
      alert('กรุณาใส่ Video URL ตัวอย่าง (ใช้สร้าง Ground Truth ให้คำนี้ต่อได้เลย)');
      return;
    }

    setAddingLesson(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('http://127.0.0.1:8000/lessons', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          category_id: Number(newLessonCategoryId),
          title: newLessonTitle.trim(),
          description: newLessonDescription.trim() || null,
          video_url: newLessonVideoUrl.trim() || null,
          is_active: false, // ★ ตั้งค่าเริ่มต้นเป็น false เสมอ กันเผลอเปิดคำที่ AI ยังตรวจจับไม่ได้
        }),
      });

      if (res.ok) {
        alert('เพิ่มคำศัพท์สำเร็จ');
        setNewLessonTitle('');
        setNewLessonCategoryId('');
        setNewLessonDescription('');
        setNewLessonVideoUrl('');
        fetchAllData();
      } else {
        const errData = await res.json();
        alert(errData.detail || 'เพิ่มคำศัพท์ไม่สำเร็จ');
      }
    } catch (error) {
      console.error('Error adding lesson:', error);
      alert('เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์');
    } finally {
      setAddingLesson(false);
    }
  };

  // ★ เพิ่มใหม่: toggle is_active ของคำศัพท์ (ฟีเจอร์หลักที่ต้องใช้บ่อยที่สุด)
  const handleToggleActive = async (lessonId, currentValue) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`http://127.0.0.1:8000/lessons/${lessonId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ is_active: !currentValue }),
      });

      if (res.ok) {
        setLessons((prev) =>
          prev.map((l) => (l.id === lessonId ? { ...l, is_active: !currentValue } : l))
        );
      } else {
        alert('เปลี่ยนสถานะไม่สำเร็จ');
      }
    } catch (error) {
      console.error('Error toggling is_active:', error);
      alert('เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์');
    }
  };

  const startEditVideo = (lesson) => {
    setEditingVideoId(lesson.id);
    setEditingVideoUrl(lesson.video_url || '');
  };

  const cancelEditVideo = () => {
    setEditingVideoId(null);
    setEditingVideoUrl('');
  };

  const saveVideoUrl = async (lessonId) => {
    try {
      const token = localStorage.getItem('token');
      const trimmedUrl = editingVideoUrl.trim() || null;
      const res = await fetch(`http://127.0.0.1:8000/lessons/${lessonId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ video_url: trimmedUrl }),
      });

      if (res.ok) {
        setLessons((prev) =>
          prev.map((l) => (l.id === lessonId ? { ...l, video_url: trimmedUrl } : l))
        );
        cancelEditVideo();
      } else {
        alert('บันทึก Video URL ไม่สำเร็จ');
      }
    } catch (error) {
      console.error('Error saving video_url:', error);
      alert('เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์');
    }
  };

  const handleBuildGroundTruth = async (lesson) => {
    if (!lesson.video_url) {
      alert('คำนี้ยังไม่มี Video URL ตัวอย่าง ใส่ก่อนถึงจะสร้าง Ground Truth ได้');
      return;
    }

    setBuildingGtId(lesson.id);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`http://127.0.0.1:8000/practice-compare/build-ground-truth/${lesson.id}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      });

      const data = await res.json();

      if (res.ok) {
        alert(`สร้าง Ground Truth สำเร็จ (${data.num_frames} เฟรม, ${data.num_samples} ตัวอย่างสะสม) — เปิดใช้งานคำนี้ให้อัตโนมัติแล้ว`);
        setLessons((prev) =>
          prev.map((l) => (l.id === lesson.id ? { ...l, is_active: true } : l))
        );
      } else {
        alert(data.detail || 'สร้าง Ground Truth ไม่สำเร็จ');
      }
    } catch (error) {
      console.error('Error building ground truth:', error);
      alert('เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์');
    } finally {
      setBuildingGtId(null);
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

  const handleViewUserProgress = async (userId, userLabel) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`http://127.0.0.1:8000/progress/user/${userId}/overview`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setReports(data);
        setSelectedUserLabel(userLabel || `User #${userId}`);
        setActiveTab('reports');
      } else {
        alert('ไม่สามารถดึงข้อมูลความคืบหน้าของ User นี้ได้');
      }
    } catch (error) {
      alert('เกิดข้อผิดพลาดในการดึงรายงาน');
    }
  };

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
        fetchAllData();
      } else {
        const errData = await res.json();
        alert(errData.detail || 'อัปเดตสิทธิ์ไม่สำเร็จ');
      }
    } catch (error) {
      console.error('Error updating user role:', error);
      alert('เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์');
    }
  };

  // ★ เพิ่ม: หาชื่อหมวดหมู่จาก category_id เพื่อโชว์ในตาราง (แทนที่จะโชว์แค่เลข id)
  const getCategoryName = (categoryId) => {
    const cat = categories.find((c) => c.id === categoryId);
    return cat ? cat.name : `หมวด #${categoryId}`;
  };

  if (loading) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <div className="max-w-7xl mx-auto px-8 py-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">⚙️ ระบบจัดการหลังบ้าน (Admin Dashboard)</h1>
        <p className="text-gray-600 mb-8">ยินดีต้อนรับเข้าสู่ระบบจัดการสำหรับผู้ดูแลระบบ</p>

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

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          {activeTab === 'overview' && (
            <div className="text-center py-12 text-gray-500">
              👈 กรุณาคลิกปุ่มจากการ์ดด้านบนเพื่อเลือกจัดการข้อมูล
            </div>
          )}

          {activeTab === 'lessons' && (
            <div>
              <h2 className="text-xl font-bold text-gray-800 mb-4">📚 จัดการคำศัพท์ภาษามือ</h2>

              {/* ★ แก้ใหม่: ฟอร์มเพิ่มบทเรียน ครบทุก field ที่ backend ต้องการ */}
              <div className="mb-6 bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <input
                    type="text"
                    placeholder="ชื่อคำศัพท์ใหม่... (เช่น สวัสดี)"
                    value={newLessonTitle}
                    onChange={(e) => setNewLessonTitle(e.target.value)}
                    className="border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />

                  <select
                    value={newLessonCategoryId}
                    onChange={(e) => setNewLessonCategoryId(e.target.value)}
                    className="border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">-- เลือกหมวดหมู่ --</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>

                <input
                  type="text"
                  placeholder="คำอธิบาย (ไม่บังคับ)"
                  value={newLessonDescription}
                  onChange={(e) => setNewLessonDescription(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />

                <input
                  type="text"
                  required
                  placeholder="Video URL * (บังคับใส่ — ใช้สร้าง Ground Truth ให้คำนี้)"
                  value={newLessonVideoUrl}
                  onChange={(e) => setNewLessonVideoUrl(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />

                <button
                  onClick={handleAddLesson}
                  disabled={addingLesson}
                  className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 transition disabled:bg-gray-400"
                >
                  {addingLesson ? 'กำลังเพิ่ม...' : '+ เพิ่มคำศัพท์'}
                </button>
                <p className="text-xs text-gray-400">
                  * คำใหม่จะเริ่มต้นเป็น "ปิดใช้งาน" เสมอ ไปเปิดใช้งานที่ตารางด้านล่างหลัง AI ตรวจจับคำนี้ได้แล้ว
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ชื่อคำศัพท์</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">หมวดหมู่</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">วิดีโอ</th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">สถานะ</th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">จัดการ</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {lessons.map((lesson) => (
                      <tr key={lesson.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{lesson.id}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{lesson.title}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {getCategoryName(lesson.category_id)}
                        </td>
                        {/* ★ เพิ่มใหม่: แก้ไข video_url ของคำที่มีอยู่แล้ว */}
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {editingVideoId === lesson.id ? (
                            <div className="flex items-center gap-2">
                              <input
                                type="text"
                                autoFocus
                                value={editingVideoUrl}
                                onChange={(e) => setEditingVideoUrl(e.target.value)}
                                placeholder="วาง Video URL ที่นี่"
                                className="border border-gray-300 rounded-lg px-2 py-1 text-xs w-48 focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                              <button
                                onClick={() => saveVideoUrl(lesson.id)}
                                className="text-green-600 hover:text-green-800 text-xs font-semibold"
                              >
                                บันทึก
                              </button>
                              <button
                                onClick={cancelEditVideo}
                                className="text-gray-400 hover:text-gray-600 text-xs"
                              >
                                ยกเลิก
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <span className={lesson.video_url ? 'text-green-600 text-xs font-medium' : 'text-gray-400 text-xs'}>
                                {lesson.video_url ? '✅ มีวิดีโอ' : '— ไม่มี'}
                              </span>
                              <button
                                onClick={() => startEditVideo(lesson)}
                                className="text-blue-500 hover:text-blue-700 text-xs underline"
                              >
                                แก้ไข
                              </button>
                            </div>
                          )}
                        </td>
                        {/* ★ เพิ่มใหม่: toggle is_active */}
                        <td className="px-6 py-4 whitespace-nowrap text-center text-sm">
                          <button
                            onClick={() => handleToggleActive(lesson.id, lesson.is_active)}
                            className={`px-3 py-1 rounded-full text-xs font-semibold transition ${
                              lesson.is_active
                                ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                            }`}
                          >
                            {lesson.is_active ? '✅ เปิดใช้งาน' : '⚪ ปิดใช้งาน'}
                          </button>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center text-sm space-x-2">
                          <button
                            onClick={() => handleBuildGroundTruth(lesson)}
                            disabled={!lesson.video_url || buildingGtId === lesson.id}
                            title={!lesson.video_url ? 'ต้องมี Video URL ก่อน' : 'ประมวลผลวิดีโอตัวอย่างเป็น Ground Truth ให้คำนี้'}
                            className="bg-indigo-100 text-indigo-700 px-3 py-1 rounded-lg hover:bg-indigo-200 transition disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
                          >
                            {buildingGtId === lesson.id ? '⏳ กำลังสร้าง...' : '🎯 สร้าง Ground Truth'}
                          </button>
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
                            onClick={() => handleViewUserProgress(u.id, u.email || u.username)}
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
              <h2 className="text-xl font-bold text-gray-800 mb-1">📊 รายงานผลการฝึกฝนและความคืบหน้า</h2>
              <p className="text-gray-500 text-sm mb-4">
                {selectedUserLabel ? (
                  <>ความคืบหน้าของ <span className="font-semibold text-gray-700">{selectedUserLabel}</span> แยกตามหมวดหมู่</>
                ) : (
                  'แสดงข้อมูลภาพรวมคะแนนและประวัติการฝึกท่าภาษามือของผู้ใช้ที่เลือก'
                )}
              </p>

              {reports.length === 0 ? (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center text-sm text-gray-500">
                  ยังไม่ได้เลือกผู้ใช้ หรือไม่มีข้อมูลความคืบหน้า
                </div>
              ) : (
                <div className="space-y-4">
                  {reports.map((r) => (
                    <div key={r.category_id} className="border border-gray-200 rounded-xl p-4">
                      <div className="flex items-center justify-between mb-1">
                        <h3 className="font-semibold text-gray-800">{r.category_name}</h3>
                        <span className="text-sm font-bold text-blue-600">
                          {r.completion_percentage}%
                        </span>
                      </div>

                      <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden mb-2">
                        <div
                          className="h-3 rounded-full bg-blue-500 transition-all"
                          style={{ width: `${Math.min(r.completion_percentage, 100)}%` }}
                        />
                      </div>

                      <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-gray-500">
                        <span>ฝึกไปแล้ว {r.words_practiced} / {r.total_words} คำ</span>
                        <span>ความใกล้เคียงเฉลี่ย: {r.correctness_percentage}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
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