import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../../components/Navbar';

const NAV_ITEMS = [
  { key: 'overview', label: 'แดชบอร์ด', icon: '📊' },
  { key: 'users', label: 'จัดการผู้ใช้', icon: '👥' },
  { key: 'categories', label: 'จัดการบทเรียน', icon: '🗂️' },
  { key: 'lessons', label: 'จัดการคำศัพท์', icon: '📚' },
  { key: 'reports', label: 'ผลการประเมิน', icon: '📈' },
  { key: 'login-logs', label: 'ประวัติ Login', icon: '🕒' },
];

const CATEGORY_BAR_COLORS = ['bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-amber-500', 'bg-pink-500', 'bg-indigo-500'];

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
  const [uploadingNewVideo, setUploadingNewVideo] = useState(false);
  const [dragActiveNew, setDragActiveNew] = useState(false);

  // ★ เพิ่ม: แก้ไข video_url ของคำที่มีอยู่แล้ว (แยกจากฟอร์มเพิ่มคำใหม่ด้านบน)
  const [editingVideoId, setEditingVideoId] = useState(null);
  const [editingVideoUrl, setEditingVideoUrl] = useState('');
  const [uploadingEditVideoId, setUploadingEditVideoId] = useState(null);

  // ★ เพิ่ม: สร้าง Ground Truth อัตโนมัติจากวิดีโอตัวอย่าง (video_url) ของคำนั้น
  const [buildingGtId, setBuildingGtId] = useState(null);

  // ★ เพิ่ม: ฟอร์ม + ค้นหา สำหรับแท็บ "จัดการบทเรียน" (หมวดหมู่)
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryLevel, setNewCategoryLevel] = useState('ง่าย');
  const [newCategoryDescription, setNewCategoryDescription] = useState('');
  const [addingCategory, setAddingCategory] = useState(false);
  const [categorySearch, setCategorySearch] = useState('');

  // ★ เพิ่ม: ค้นหา/กรอง สำหรับตารางผู้ใช้และคำศัพท์
  const [userSearch, setUserSearch] = useState('');
  const [lessonSearch, setLessonSearch] = useState('');
  const [lessonCategoryFilter, setLessonCategoryFilter] = useState('');

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

      // ★ เพิ่ม: โหลด login logs แบบเงียบๆ ไว้ล่วงหน้า ใช้โชว์เป็น "กิจกรรมล่าสุด" ในแดชบอร์ด
      fetchLoginLogsData();
    } catch (error) {
      console.error('Error fetching admin data:', error);
    }
  };

  // ★ แยกออกจาก handleOpenLoginLogs เดิม: ไม่ alert ไม่สลับแท็บ ใช้โหลดแบบพื้นหลังสำหรับแดชบอร์ด
  const fetchLoginLogsData = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('http://127.0.0.1:8000/admin/login-logs', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setLoginLogs(data);
      }
    } catch (error) {
      console.error('Error fetching login logs:', error);
    }
  };

  const handleOpenLoginLogs = async () => {
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

  // ★ เพิ่ม: อัปโหลดไฟล์วิดีโอจากเครื่องแทนการวางลิงก์ — คืนค่า URL ที่ backend เก็บไว้ให้แล้ว
  const uploadVideoFile = async (file) => {
    const token = localStorage.getItem('token');
    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch('http://127.0.0.1:8000/lessons/upload-video', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData,
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.detail || 'อัปโหลดวิดีโอไม่สำเร็จ');
    }
    return data.video_url;
  };

  const handleNewVideoFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingNewVideo(true);
    try {
      const url = await uploadVideoFile(file);
      setNewLessonVideoUrl(url);
    } catch (error) {
      alert(error.message);
    } finally {
      setUploadingNewVideo(false);
      e.target.value = ''; // เผื่อเลือกไฟล์เดิมซ้ำได้อีกครั้ง
    }
  };

  // ★ เพิ่ม: ลากไฟล์วิดีโอมาวางในกล่อง dropzone ของฟอร์มเพิ่มคำศัพท์ใหม่
  const handleNewVideoDrop = async (e) => {
    e.preventDefault();
    setDragActiveNew(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    setUploadingNewVideo(true);
    try {
      const url = await uploadVideoFile(file);
      setNewLessonVideoUrl(url);
    } catch (error) {
      alert(error.message);
    } finally {
      setUploadingNewVideo(false);
    }
  };

  const handleEditVideoFileChange = async (e, lessonId) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingEditVideoId(lessonId);
    try {
      const url = await uploadVideoFile(file);
      setEditingVideoUrl(url);
    } catch (error) {
      alert(error.message);
    } finally {
      setUploadingEditVideoId(null);
      e.target.value = '';
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

  // ★ เพิ่มใหม่: เพิ่มหมวดหมู่บทเรียน (ใช้ POST /categories/ ที่ backend มีอยู่แล้วแต่ยังไม่เคยมี UI)
  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) {
      alert('กรุณากรอกชื่อหมวดหมู่');
      return;
    }

    setAddingCategory(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('http://127.0.0.1:8000/categories/', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: newCategoryName.trim(),
          description: newCategoryDescription.trim() || null,
          level: newCategoryLevel,
          total_words: 0,
          image: '',
        }),
      });

      if (res.ok) {
        alert('เพิ่มหมวดหมู่สำเร็จ');
        setNewCategoryName('');
        setNewCategoryLevel('ง่าย');
        setNewCategoryDescription('');
        fetchAllData();
      } else {
        const errData = await res.json();
        alert(errData.detail || 'เพิ่มหมวดหมู่ไม่สำเร็จ');
      }
    } catch (error) {
      console.error('Error adding category:', error);
      alert('เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์');
    } finally {
      setAddingCategory(false);
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

  const handleChangeRole = async (userId, currentRole, newRole, userLabel) => {
    if (currentRole === newRole) return;

    const currentUsername = localStorage.getItem('username');
    if (newRole === 'user' && userLabel && currentUsername && userLabel === currentUsername) {
      alert('ไม่สามารถลดสิทธิ์ของตัวเองได้');
      return;
    }

    const confirmMsg =
      newRole === 'admin'
        ? 'คุณต้องการเปลี่ยนสิทธิ์ผู้ใช้นี้ให้เป็น Admin ใช่หรือไม่?'
        : 'คุณต้องการลดสิทธิ์ผู้ใช้นี้กลับเป็น User ใช่หรือไม่?';
    if (!window.confirm(confirmMsg)) return;

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`http://127.0.0.1:8000/auth/users/${userId}/role`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ role: newRole })
      });

      if (res.ok) {
        alert(newRole === 'admin' ? 'อัปเดตสิทธิ์เป็น Admin สำเร็จ' : 'ลดสิทธิ์กลับเป็น User สำเร็จ');
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

  const activeLessonCount = lessons.filter((l) => l.is_active).length;
  const activeLessonPct = lessons.length ? Math.round((activeLessonCount / lessons.length) * 100) : 0;
  const maxLessonsPerCategory = Math.max(1, ...categories.map((c) => lessons.filter((l) => l.category_id === c.id).length));

  const filteredCategories = categories.filter((c) =>
    c.name.toLowerCase().includes(categorySearch.toLowerCase())
  );

  const filteredUsers = users.filter((u) => {
    const label = `${u.username || ''} ${u.email || ''}`.toLowerCase();
    return label.includes(userSearch.toLowerCase());
  });

  const filteredLessons = lessons.filter((l) => {
    const matchesSearch = l.title.toLowerCase().includes(lessonSearch.toLowerCase());
    const matchesCategory = !lessonCategoryFilter || String(l.category_id) === String(lessonCategoryFilter);
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 sm:px-8 py-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">⚙️ ระบบจัดการหลังบ้าน (Admin Dashboard)</h1>
        <p className="text-gray-600 mb-8">ยินดีต้อนรับเข้าสู่ระบบจัดการสำหรับผู้ดูแลระบบ</p>

        <div className="flex flex-col md:flex-row gap-6 items-start">
          {/* Sidebar */}
          <aside className="w-full md:w-56 shrink-0">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 md:sticky md:top-24">
              <p className="px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wide">เมนูจัดการ</p>
              <nav className="space-y-1">
                {NAV_ITEMS.map((item) => (
                  <button
                    key={item.key}
                    onClick={() => (item.key === 'login-logs' ? handleOpenLoginLogs() : setActiveTab(item.key))}
                    className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition text-left ${
                      activeTab === item.key
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <span>{item.icon}</span>
                    {item.label}
                  </button>
                ))}
              </nav>
            </div>
          </aside>

          {/* เนื้อหาหลัก */}
          <div className="flex-1 min-w-0 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            {activeTab === 'overview' && (
              <div>
                <h2 className="text-xl font-bold text-gray-800 mb-1">แดชบอร์ดผู้ดูแลระบบ</h2>
                <p className="text-gray-500 text-sm mb-6">ภาพรวมข้อมูลระบบ ณ ปัจจุบัน</p>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                  <div className="bg-white p-5 rounded-xl border border-gray-200">
                    <p className="text-xs text-gray-400 mb-1">👥 ผู้ใช้ทั้งหมด</p>
                    <p className="text-2xl font-bold text-green-600">{users.length}</p>
                  </div>
                  <div className="bg-white p-5 rounded-xl border border-gray-200">
                    <p className="text-xs text-gray-400 mb-1">🗂️ หมวดหมู่</p>
                    <p className="text-2xl font-bold text-indigo-600">{categories.length}</p>
                  </div>
                  <div className="bg-white p-5 rounded-xl border border-gray-200">
                    <p className="text-xs text-gray-400 mb-1">📚 คำศัพท์ทั้งหมด</p>
                    <p className="text-2xl font-bold text-blue-600">{lessons.length}</p>
                  </div>
                  <div className="bg-white p-5 rounded-xl border border-gray-200">
                    <p className="text-xs text-gray-400 mb-1">✅ เปิดใช้งานแล้ว</p>
                    <p className="text-2xl font-bold text-purple-600">
                      {activeLessonPct}% <span className="text-sm text-gray-400 font-normal">({activeLessonCount}/{lessons.length})</span>
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-2 border border-gray-200 rounded-xl p-5">
                    <h3 className="font-bold text-gray-800 mb-4">จำนวนคำศัพท์ต่อหมวดหมู่</h3>
                    <div className="space-y-3">
                      {categories.map((cat, i) => {
                        const count = lessons.filter((l) => l.category_id === cat.id).length;
                        const pct = Math.round((count / maxLessonsPerCategory) * 100);
                        return (
                          <div key={cat.id}>
                            <div className="flex justify-between text-sm mb-1">
                              <span className="text-gray-600">{cat.name}</span>
                              <span className="text-gray-400">{count} คำ</span>
                            </div>
                            <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                              <div
                                className={`h-2.5 rounded-full ${CATEGORY_BAR_COLORS[i % CATEGORY_BAR_COLORS.length]}`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                      {categories.length === 0 && (
                        <p className="text-sm text-gray-400">ยังไม่มีหมวดหมู่ — ไปเพิ่มที่แท็บ "จัดการบทเรียน"</p>
                      )}
                    </div>
                  </div>

                  <div className="border border-gray-200 rounded-xl p-5">
                    <h3 className="font-bold text-gray-800 mb-4">เข้าสู่ระบบล่าสุด</h3>
                    {loginLogs.length === 0 ? (
                      <p className="text-sm text-gray-400">ยังไม่มีข้อมูลการเข้าสู่ระบบ</p>
                    ) : (
                      <ul className="space-y-3">
                        {loginLogs.slice(0, 6).map((log) => (
                          <li key={log.id} className="text-sm">
                            <p className="text-gray-700 font-medium truncate">{log.email}</p>
                            <p className="text-gray-400 text-xs">{new Date(log.login_time).toLocaleString('th-TH')}</p>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'users' && (
              <div>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                  <h2 className="text-xl font-bold text-gray-800">👥 รายชื่อผู้ใช้งานในระบบ ({users.length})</h2>
                  <input
                    type="text"
                    placeholder="ค้นหาผู้ใช้ (ชื่อ/อีเมล)..."
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
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
                      {filteredUsers.map((u) => (
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
                                onClick={() => handleChangeRole(u.id, u.role, 'admin')}
                                className="bg-blue-100 text-blue-700 px-3 py-1 rounded-lg hover:bg-blue-200 transition text-xs font-medium"
                              >
                                ⭐ ตั้งเป็น Admin
                              </button>
                            ) : (
                              <button
                                onClick={() => handleChangeRole(u.id, u.role, 'user', u.email || u.username)}
                                className="bg-red-100 text-red-600 px-3 py-1 rounded-lg hover:bg-red-200 transition text-xs font-medium"
                              >
                                ⬇ ลดเป็น User
                              </button>
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
                      {filteredUsers.length === 0 && (
                        <tr>
                          <td colSpan="5" className="px-6 py-8 text-center text-sm text-gray-500">
                            ไม่พบผู้ใช้ที่ตรงกับคำค้นหา
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === 'categories' && (
              <div>
                <h2 className="text-xl font-bold text-gray-800 mb-4">🗂️ จัดการหมวดหมู่บทเรียน</h2>

                <div className="mb-6 bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <input
                      type="text"
                      placeholder="ชื่อหมวดหมู่ใหม่... (เช่น ครอบครัว)"
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                      className="border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <select
                      value={newCategoryLevel}
                      onChange={(e) => setNewCategoryLevel(e.target.value)}
                      className="border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="ง่าย">ง่าย</option>
                      <option value="ปานกลาง">ปานกลาง</option>
                      <option value="ยาก">ยาก</option>
                    </select>
                  </div>

                  <textarea
                    placeholder="คำอธิบายหมวดหมู่ (ไม่บังคับ)"
                    value={newCategoryDescription}
                    onChange={(e) => setNewCategoryDescription(e.target.value)}
                    rows={2}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />

                  <button
                    onClick={handleAddCategory}
                    disabled={addingCategory}
                    className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 transition disabled:bg-gray-400"
                  >
                    {addingCategory ? 'กำลังเพิ่ม...' : '+ เพิ่มหมวดหมู่'}
                  </button>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
                  <h3 className="font-semibold text-gray-700">หมวดหมู่ทั้งหมด ({categories.length})</h3>
                  <input
                    type="text"
                    placeholder="ค้นหาหมวดหมู่..."
                    value={categorySearch}
                    onChange={(e) => setCategorySearch(e.target.value)}
                    className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">หมวดหมู่</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">จำนวนคำศัพท์</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ระดับ</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">คำอธิบาย</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {filteredCategories.map((cat) => (
                        <tr key={cat.id}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{cat.name}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {lessons.filter((l) => l.category_id === cat.id).length} คำ
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{cat.level || '-'}</td>
                          <td className="px-6 py-4 text-sm text-gray-500">{cat.description || '-'}</td>
                        </tr>
                      ))}
                      {filteredCategories.length === 0 && (
                        <tr>
                          <td colSpan="4" className="px-6 py-8 text-center text-sm text-gray-500">
                            ยังไม่มีหมวดหมู่ — เพิ่มด้านบนได้เลย
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === 'lessons' && (
              <div>
                <h2 className="text-xl font-bold text-gray-800 mb-4">📚 จัดการคำศัพท์ภาษามือ</h2>

                {/* ★ แก้ใหม่: ฟอร์มเพิ่มบทเรียน แบ่ง 2 คอลัมน์ — ซ้ายกรอกข้อมูล ขวาลากไฟล์วิดีโอ */}
                <div className="mb-6 bg-gray-50 border border-gray-200 rounded-xl p-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-3">
                      <input
                        type="text"
                        placeholder="ชื่อคำศัพท์ใหม่... (เช่น สวัสดี)"
                        value={newLessonTitle}
                        onChange={(e) => setNewLessonTitle(e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />

                      <select
                        value={newLessonCategoryId}
                        onChange={(e) => setNewLessonCategoryId(e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">-- เลือกหมวดหมู่ --</option>
                        {categories.map((cat) => (
                          <option key={cat.id} value={cat.id}>
                            {cat.name}
                          </option>
                        ))}
                      </select>

                      <textarea
                        placeholder="คำอธิบาย (ไม่บังคับ)"
                        value={newLessonDescription}
                        onChange={(e) => setNewLessonDescription(e.target.value)}
                        rows={4}
                        className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    {/* dropzone วิดีโอ */}
                    <div
                      onDragOver={(e) => { e.preventDefault(); setDragActiveNew(true); }}
                      onDragLeave={() => setDragActiveNew(false)}
                      onDrop={handleNewVideoDrop}
                      className={`flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-xl p-4 text-center transition min-h-[160px] ${
                        dragActiveNew ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-white'
                      }`}
                    >
                      {uploadingNewVideo ? (
                        <p className="text-sm text-gray-500">⏳ กำลังอัปโหลด...</p>
                      ) : newLessonVideoUrl ? (
                        <>
                          <span className="text-2xl">✅</span>
                          <p className="text-sm text-green-600 font-medium">มีวิดีโอแล้ว</p>
                          <p className="text-xs text-gray-400 break-all px-2">{newLessonVideoUrl}</p>
                        </>
                      ) : (
                        <>
                          <span className="text-2xl">🎬</span>
                          <p className="text-sm text-gray-500">ลากไฟล์วิดีโอมาวางที่นี่</p>
                        </>
                      )}

                      <label className="text-xs text-blue-600 hover:text-blue-700 underline cursor-pointer">
                        หรือเลือกไฟล์จากเครื่อง
                        <input
                          type="file"
                          accept="video/*"
                          onChange={handleNewVideoFileChange}
                          disabled={uploadingNewVideo}
                          className="hidden"
                        />
                      </label>

                      <input
                        type="text"
                        placeholder="หรือวาง Video URL ที่นี่"
                        value={newLessonVideoUrl}
                        onChange={(e) => setNewLessonVideoUrl(e.target.value)}
                        className="w-full mt-1 border border-gray-300 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <button
                    onClick={handleAddLesson}
                    disabled={addingLesson || uploadingNewVideo}
                    className="mt-3 bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 transition disabled:bg-gray-400"
                  >
                    {addingLesson ? 'กำลังเพิ่ม...' : '+ เพิ่มคำศัพท์'}
                  </button>
                  <p className="text-xs text-gray-400 mt-2">
                    * คำใหม่จะเริ่มต้นเป็น "ปิดใช้งาน" เสมอ ไปเปิดใช้งานที่ตารางด้านล่างหลัง AI ตรวจจับคำนี้ได้แล้ว
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
                  <h3 className="font-semibold text-gray-700">คำศัพท์ทั้งหมด ({lessons.length})</h3>
                  <div className="flex flex-wrap gap-2">
                    <select
                      value={lessonCategoryFilter}
                      onChange={(e) => setLessonCategoryFilter(e.target.value)}
                      className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">ทุกหมวดหมู่</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                    <input
                      type="text"
                      placeholder="ค้นหาคำศัพท์..."
                      value={lessonSearch}
                      onChange={(e) => setLessonSearch(e.target.value)}
                      className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
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
                      {filteredLessons.map((lesson) => (
                        <tr key={lesson.id}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{lesson.id}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{lesson.title}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {getCategoryName(lesson.category_id)}
                          </td>
                          {/* ★ เพิ่มใหม่: แก้ไข video_url ของคำที่มีอยู่แล้ว */}
                          <td className="px-6 py-4 text-sm text-gray-500">
                            {editingVideoId === lesson.id ? (
                              <div className="flex items-center gap-2 flex-wrap">
                                <input
                                  type="text"
                                  autoFocus
                                  value={editingVideoUrl}
                                  onChange={(e) => setEditingVideoUrl(e.target.value)}
                                  placeholder="วาง Video URL ที่นี่"
                                  className="border border-gray-300 rounded-lg px-2 py-1 text-xs w-40 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                                <label className="text-xs text-blue-500 hover:text-blue-700 underline cursor-pointer">
                                  {uploadingEditVideoId === lesson.id ? '⏳ กำลังอัปโหลด...' : '📁 อัปโหลดไฟล์'}
                                  <input
                                    type="file"
                                    accept="video/*"
                                    onChange={(e) => handleEditVideoFileChange(e, lesson.id)}
                                    disabled={uploadingEditVideoId === lesson.id}
                                    className="hidden"
                                  />
                                </label>
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
                      {filteredLessons.length === 0 && (
                        <tr>
                          <td colSpan="6" className="px-6 py-8 text-center text-sm text-gray-500">
                            ไม่พบคำศัพท์ที่ตรงกับเงื่อนไข
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === 'reports' && (
              <div>
                <h2 className="text-xl font-bold text-gray-800 mb-1">📈 ผลการประเมินและความคืบหน้า</h2>
                <p className="text-gray-500 text-sm mb-4">
                  {selectedUserLabel ? (
                    <>ความคืบหน้าของ <span className="font-semibold text-gray-700">{selectedUserLabel}</span> แยกตามหมวดหมู่</>
                  ) : (
                    'เลือกผู้ใช้จากแท็บ "จัดการผู้ใช้" แล้วกด "ดูความคืบหน้า" เพื่อแสดงรายงานที่นี่'
                  )}
                </p>

                {reports.length === 0 ? (
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center text-sm text-gray-500">
                    ยังไม่ได้เลือกผู้ใช้ หรือไม่มีข้อมูลความคืบหน้า
                  </div>
                ) : (
                  <>
                    {/* legend — 2 series ต้องมี legend เสมอ */}
                    <div className="flex items-center gap-5 text-xs text-gray-500 mb-3">
                      <span className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-sm" style={{ background: '#2a78d6' }} />
                        ความคืบหน้า (% คำที่เคยฝึก)
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-sm" style={{ background: '#eb6834' }} />
                        ความแม่นยำเฉลี่ย (%)
                      </span>
                    </div>

                    {/* กราฟแท่งเทียบ 2 ตัวชี้วัดต่อหมวดหมู่ */}
                    <div className="overflow-x-auto border border-gray-200 rounded-xl p-4 mb-4">
                      <svg
                        viewBox={`0 0 560 ${28 + reports.length * 56 + 8}`}
                        role="img"
                        aria-label={`กราฟความคืบหน้าและความแม่นยำเฉลี่ยของ ${selectedUserLabel || 'ผู้ใช้'} แยกตามหมวดหมู่`}
                        className="w-full"
                        style={{ minWidth: 480 }}
                      >
                        {/* gridlines + tick labels (0/25/50/75/100%) */}
                        {[0, 25, 50, 75, 100].map((pct) => {
                          const x = 180 + (pct / 100) * 340;
                          const bottomY = 28 + reports.length * 56;
                          return (
                            <g key={pct}>
                              <line x1={x} y1={20} x2={x} y2={bottomY} stroke="#e5e7eb" strokeWidth="1" />
                              <text x={x} y={14} textAnchor="middle" fontSize="10" fill="#9ca3af">{pct}%</text>
                            </g>
                          );
                        })}

                        {reports.map((r, i) => {
                          const rowY = 28 + i * 56;
                          const groupCenter = rowY + 28;
                          const completion = Math.min(r.completion_percentage, 100);
                          const correctness = Math.min(r.correctness_percentage, 100);
                          const plotW = 340;
                          const leftX = 180;

                          const roundedBar = (value, y) => {
                            const w = (value / 100) * plotW;
                            const rr = Math.min(4, w);
                            if (w <= 0) return '';
                            return `M${leftX},${y} h${w - rr} a${rr},${rr} 0 0 1 ${rr},${rr} v${14 - 2 * rr} a${rr},${rr} 0 0 1 ${-rr},${rr} h${-(w - rr)} Z`;
                          };

                          const bar1Y = groupCenter - 2 - 14;
                          const bar2Y = groupCenter + 2;

                          return (
                            <g key={r.category_id}>
                              <title>
                                {r.category_name}: ความคืบหน้า {completion}%, ความแม่นยำเฉลี่ย {correctness}%
                              </title>

                              <text
                                x={leftX - 10}
                                y={groupCenter}
                                textAnchor="end"
                                dominantBaseline="middle"
                                fontSize="12"
                                fill="#374151"
                              >
                                {r.category_name}
                              </text>

                              <path d={roundedBar(completion, bar1Y)} fill="#2a78d6" />
                              <text x={leftX + (completion / 100) * plotW + 6} y={bar1Y + 7} dominantBaseline="middle" fontSize="10" fill="#52514e">
                                {completion}%
                              </text>

                              <path d={roundedBar(correctness, bar2Y)} fill="#eb6834" />
                              <text x={leftX + (correctness / 100) * plotW + 6} y={bar2Y + 7} dominantBaseline="middle" fontSize="10" fill="#52514e">
                                {correctness}%
                              </text>
                            </g>
                          );
                        })}
                      </svg>
                    </div>

                    {/* table view — ตัวเลขจริงครบทุกหมวด (accessibility: ไม่ต้องพึ่งกราฟอย่างเดียว) */}
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-sm">
                        <thead>
                          <tr className="text-left text-xs text-gray-400 border-b border-gray-100">
                            <th className="py-2 pr-4 font-medium">หมวดหมู่</th>
                            <th className="py-2 pr-4 font-medium">ฝึกไปแล้ว</th>
                            <th className="py-2 pr-4 font-medium">ความคืบหน้า</th>
                            <th className="py-2 font-medium">ความแม่นยำเฉลี่ย</th>
                          </tr>
                        </thead>
                        <tbody>
                          {reports.map((r) => (
                            <tr key={r.category_id} className="border-b border-gray-50">
                              <td className="py-2 pr-4 text-gray-700">{r.category_name}</td>
                              <td className="py-2 pr-4 text-gray-500">{r.words_practiced} / {r.total_words} คำ</td>
                              <td className="py-2 pr-4 text-gray-500">{r.completion_percentage}%</td>
                              <td className="py-2 text-gray-500">{r.correctness_percentage}%</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
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
    </div>
  );
}
