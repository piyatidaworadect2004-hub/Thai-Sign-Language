import React, { useEffect, useState } from 'react';
import LessonManager from './LessonManager';
import { CARD, TH, INPUT, BTN_PRIMARY, BTN_GHOST, Field, SearchInput } from './adminUi';
import { useNavigate } from 'react-router-dom';

// title/subtitle ใช้เป็นหัวข้อของเนื้อหาฝั่งขวาเมื่อเลือกเมนูนั้น
const NAV_ITEMS = [
  { key: 'overview', label: 'Dashboard', icon: '▦', title: 'แดชบอร์ดผู้ดูแลระบบ', subtitle: 'ภาพรวมของระบบและกิจกรรมล่าสุดของผู้ใช้งาน' },
  { key: 'users', label: 'จัดการผู้ใช้งาน', icon: '👥', title: 'จัดการผู้ใช้งาน', subtitle: 'ดูรายชื่อ เปลี่ยนสิทธิ์ และติดตามความคืบหน้าของผู้ใช้' },
  { key: 'categories', label: 'จัดการบทเรียน', icon: '🗂️', title: 'จัดการบทเรียน', subtitle: 'เพิ่มและจัดการหมวดหมู่บทเรียนในระบบ' },
  { key: 'lessons', label: 'จัดการคำศัพท์', icon: '📚', title: 'จัดการคำศัพท์', subtitle: 'จัดการคำศัพท์และวิดีโอตัวอย่าง (ท่าต้นแบบ) ในหน้าเดียว' },
  { key: 'summary', label: 'รายงาน', icon: '📄', title: 'รายงาน', subtitle: 'สรุปภาพรวมการใช้งานระบบรายเดือน' },
];

// หน้าที่ไม่มีในเมนูซ้าย เปิดได้จากปุ่ม "ดูความคืบหน้า" ในตารางผู้ใช้ — ไฮไลต์เมนู parent แทน
const HIDDEN_VIEWS = [
  { key: 'reports', parent: 'users', title: 'ผลการประเมิน', subtitle: 'ความคืบหน้าและความแม่นยำของผู้ใช้แต่ละคน แยกตามหมวดหมู่' },
];

const CATEGORY_BAR_COLORS = ['bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-amber-500', 'bg-pink-500', 'bg-indigo-500'];
const SERIES_COMPLETION = '#2a78d6';
const SERIES_CORRECTNESS = '#eb6834';

// ★ อ่านข้อความ error จาก response ให้ละเอียด (status + detail) ใช้โชว์ใน alert
async function readError(res, fallback) {
  let msg = `${fallback} (HTTP ${res.status})`;
  try {
    const errData = await res.json();
    if (errData && errData.detail) {
      msg += `: ${typeof errData.detail === 'string' ? errData.detail : JSON.stringify(errData.detail)}`;
    }
  } catch {
    /* response ไม่ใช่ JSON */
  }
  return msg;
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  const [lessons, setLessons] = useState([]);
  const [categories, setCategories] = useState([]);
  const [users, setUsers] = useState([]);
  const [reports, setReports] = useState([]);
  const [selectedUserLabel, setSelectedUserLabel] = useState('');
  const [reportUserId, setReportUserId] = useState('');
  const [loginLogs, setLoginLogs] = useState([]);

  // ฟอร์ม + ค้นหา สำหรับแท็บ "จัดการบทเรียน" (หมวดหมู่)
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryLevel, setNewCategoryLevel] = useState('ง่าย');
  const [newCategoryDescription, setNewCategoryDescription] = useState('');
  const [addingCategory, setAddingCategory] = useState(false);
  const [categorySearch, setCategorySearch] = useState('');

  // ★ แก้ไขคำอธิบายหมวดหมู่
  const [editingCategoryId, setEditingCategoryId] = useState(null);
  const [editingDescription, setEditingDescription] = useState('');
  const [savingDescription, setSavingDescription] = useState(false);

  // ค้นหา/กรอง สำหรับตารางผู้ใช้
  const [userSearch, setUserSearch] = useState('');

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

      // โหลด login logs แบบเงียบๆ ไว้ล่วงหน้า ใช้โชว์เป็น "กิจกรรมล่าสุด" ในแดชบอร์ด
      fetchLoginLogsData();
    } catch (error) {
      console.error('Error fetching admin data:', error);
    }
  };

  // ไม่ alert ไม่สลับแท็บ ใช้โหลดแบบพื้นหลังสำหรับแดชบอร์ด
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
        setActiveTab('summary');
      } else {
        alert('ไม่สามารถดึงประวัติการเข้าสู่ระบบได้');
      }
    } catch (error) {
      console.error('Error fetching login logs:', error);
      alert('เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์');
    }
  };

  // เพิ่มหมวดหมู่บทเรียน (POST /categories/)
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
        alert(await readError(res, 'เพิ่มหมวดหมู่ไม่สำเร็จ'));
      }
    } catch (error) {
      console.error('Error adding category:', error);
      alert('เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์');
    } finally {
      setAddingCategory(false);
    }
  };

  // ★ แก้ไขคำอธิบายหมวดหมู่ (PATCH /categories/{id}/description)
  const startEditDescription = (cat) => {
    setEditingCategoryId(cat.id);
    setEditingDescription(cat.description || '');
  };

  const cancelEditDescription = () => {
    setEditingCategoryId(null);
    setEditingDescription('');
  };

  const handleSaveDescription = async (categoryId) => {
    setSavingDescription(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`http://127.0.0.1:8000/categories/${categoryId}/description`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ description: editingDescription.trim() }),
      });

      if (res.ok) {
        const data = await res.json();
        setCategories((prev) =>
          prev.map((c) => (c.id === categoryId ? { ...c, description: data.description } : c))
        );
        cancelEditDescription();
      } else {
        // ★ โชว์ status + detail เพื่อให้รู้สาเหตุทันที (เช่น 403/404/405/422)
        alert(await readError(res, 'แก้ไขคำอธิบายไม่สำเร็จ'));
      }
    } catch (error) {
      console.error('Error updating description:', error);
      alert('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ (ตรวจว่า backend รันอยู่ที่ 127.0.0.1:8000)');
    } finally {
      setSavingDescription(false);
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
        setReportUserId(String(userId));
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
        alert(await readError(res, 'อัปเดตสิทธิ์ไม่สำเร็จ'));
      }
    } catch (error) {
      console.error('Error updating user role:', error);
      alert('เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์');
    }
  };

  // หน้าแอดมินไม่มี Navbar แล้ว (ใช้ sidebar ของตัวเอง) — logout แบบเดียวกับ Navbar
  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    localStorage.removeItem('role');
    navigate('/login');
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

  const adminName = localStorage.getItem('username') || 'ผู้ดูแลระบบ';
  const activeNav = [...NAV_ITEMS, ...HIDDEN_VIEWS].find((n) => n.key === activeTab) || NAV_ITEMS[0];
  const highlightedNavKey = activeNav.parent || activeNav.key;

  const lessonCountByCategory = (categoryId) => lessons.filter((l) => l.category_id === categoryId).length;
  const activeCountByCategory = (categoryId) => lessons.filter((l) => l.category_id === categoryId && l.is_active).length;
  const topCategory = categories.reduce(
    (best, c) => (!best || lessonCountByCategory(c.id) > lessonCountByCategory(best.id) ? c : best),
    null
  );
  const adminCount = users.filter((u) => u.role === 'admin').length;
  const recentUsers = [...users].sort((a, b) => b.id - a.id).slice(0, 5);

  // รายงาน: นับผู้ใช้ "ไม่ซ้ำ" ที่เข้าสู่ระบบในแต่ละเดือน จาก login log (ล่าสุด 200 รายการ)
  const monthlyLogins = Object.values(
    loginLogs.reduce((acc, log) => {
      if (!log.login_time) return acc;
      const d = new Date(log.login_time);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!acc[key]) acc[key] = { key, date: d, users: new Set() };
      acc[key].users.add(log.user_id);
      return acc;
    }, {})
  )
    .sort((a, b) => a.key.localeCompare(b.key))
    .slice(-6);
  const maxMonthly = Math.max(1, ...monthlyLogins.map((m) => m.users.size));

  const startedReports = reports.filter((r) => r.words_practiced > 0);
  const reportWordsPracticed = reports.reduce((sum, r) => sum + (r.words_practiced || 0), 0);
  const reportAvgCorrectness = startedReports.length
    ? Math.round(startedReports.reduce((sum, r) => sum + (r.correctness_percentage || 0), 0) / startedReports.length)
    : 0;

  const renderUserTable = (list) => (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="text-left">
            <th className={TH}>ผู้ใช้</th>
            <th className={TH}>สิทธิ์</th>
            <th className={`${TH} text-center`}>จัดการสิทธิ์</th>
            <th className={`${TH} text-center`}>ความคืบหน้า</th>
          </tr>
        </thead>
        <tbody>
          {list.map((u) => (
            <tr key={u.id} className="border-t border-gray-100">
              <td className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <Avatar text={u.username || u.email} index={u.id} />
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-800 truncate">{u.username}</p>
                    <p className="text-xs text-gray-400 truncate">{u.email}</p>
                  </div>
                </div>
              </td>
              <td className="px-4 py-3">
                <span
                  className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                    u.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  {u.role === 'admin' ? 'ผู้ดูแลระบบ' : 'ผู้ใช้งาน'}
                </span>
              </td>
              <td className="px-4 py-3 text-center whitespace-nowrap">
                {u.role !== 'admin' ? (
                  <button
                    onClick={() => handleChangeRole(u.id, u.role, 'admin')}
                    className="px-3 py-1 rounded-lg border border-gray-200 text-xs font-medium text-gray-600 hover:bg-gray-50 transition"
                  >
                    ⭐ ตั้งเป็น Admin
                  </button>
                ) : (
                  <button
                    onClick={() => handleChangeRole(u.id, u.role, 'user', u.username)}
                    className="px-3 py-1 rounded-lg border border-red-200 text-xs font-medium text-red-600 hover:bg-red-50 transition"
                  >
                    ⬇ ลดเป็น User
                  </button>
                )}
              </td>
              <td className="px-4 py-3 text-center whitespace-nowrap">
                <button
                  onClick={() => handleViewUserProgress(u.id, u.email || u.username)}
                  className="px-3 py-1 rounded-lg bg-blue-50 text-blue-600 text-xs font-medium hover:bg-blue-100 transition"
                >
                  ดูความคืบหน้า
                </button>
              </td>
            </tr>
          ))}
          {list.length === 0 && (
            <tr>
              <td colSpan="4" className="px-4 py-8 text-center text-sm text-gray-400">
                ไม่พบผู้ใช้ที่ตรงกับคำค้นหา
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 md:flex">
      {/* Sidebar — จอใหญ่เป็นแถบซ้ายสูงเต็มจอ จอเล็กเป็นแถบบนที่เลื่อนแนวนอนได้ */}
      <aside className="bg-white text-gray-600 border-b md:border-b-0 md:border-r border-gray-200 md:w-60 md:shrink-0 md:h-screen md:sticky md:top-0 flex flex-col">
        <div className="flex items-center gap-2.5 px-5 py-5">
          <span className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center text-sm">✋</span>
          <span className="font-bold text-gray-800">Thai Sign Admin</span>
        </div>

        <nav className="flex md:flex-col gap-1 px-3 pb-3 md:pb-0 overflow-x-auto md:overflow-visible md:flex-1">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.key}
              onClick={() => (item.key === 'summary' ? handleOpenLoginLogs() : setActiveTab(item.key))}
              className={`shrink-0 flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition text-left whitespace-nowrap ${
                highlightedNavKey === item.key ? 'bg-blue-600 text-white shadow-sm' : 'hover:bg-gray-100 hover:text-gray-900'
              }`}
            >
              <span className="w-5 text-center">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>

        <div className="flex md:flex-col gap-1 border-t border-gray-200 mx-3 py-3">
          <button
            onClick={() => navigate('/home')}
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm hover:bg-gray-100 hover:text-gray-900 transition"
          >
            <span className="w-5 text-center">←</span>
            กลับหน้าเว็บไซต์
          </button>
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-semibold text-red-500 hover:bg-red-50 transition"
          >
            <span className="w-5 text-center">⏻</span>
            ออกจากระบบ
          </button>
        </div>
      </aside>

      {/* เนื้อหาหลัก — เปลี่ยนตามเมนูที่เลือกทางซ้าย */}
      <main className="flex-1 min-w-0 px-4 sm:px-8 py-6 sm:py-8">
        <div className="max-w-6xl mx-auto space-y-6">
          <header className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-gray-900">{activeNav.title}</h1>
                <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 text-[11px] font-semibold">
                  Admin Panel
                </span>
              </div>
              <p className="text-sm text-gray-500 mt-1">{activeNav.subtitle}</p>
            </div>
            <div className="flex items-center gap-2 bg-white rounded-full pl-1.5 pr-4 py-1.5 shadow-sm">
              <span className="w-7 h-7 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center text-xs font-bold">
                {adminName.charAt(0).toUpperCase()}
              </span>
              <span className="text-sm font-medium text-gray-700">{adminName}</span>
            </div>
          </header>

          {/* ───────────── Dashboard ───────────── */}
          {activeTab === 'overview' && (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard icon="👥" tint="bg-green-100" value={users.length} label="ผู้ใช้งานทั้งหมด" />
                <StatCard icon="🗂️" tint="bg-indigo-50" value={categories.length} label="หมวดหมู่บทเรียน" />
                <StatCard icon="📚" tint="bg-purple-50" value={lessons.length} label="คำศัพท์ทั้งหมด" />
                <div className={`${CARD} p-5 flex items-center gap-4`}>
                  <Ring percent={activeLessonPct} />
                  <div>
                    <p className="text-xl font-bold text-gray-900">{activeLessonPct}%</p>
                    <p className="text-xs text-gray-500">
                      คำศัพท์ที่เปิดใช้งาน ({activeLessonCount}/{lessons.length})
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className={`${CARD} p-5 lg:col-span-2`}>
                  <h3 className="font-bold text-gray-800 mb-4">จำนวนคำศัพท์ต่อหมวดหมู่</h3>
                  <div className="space-y-4">
                    {categories.map((cat, i) => {
                      const count = lessonCountByCategory(cat.id);
                      const pct = Math.round((count / maxLessonsPerCategory) * 100);
                      return (
                        <div key={cat.id}>
                          <div className="flex justify-between text-sm mb-1.5">
                            <span className="text-gray-600">{cat.name}</span>
                            <span className="font-semibold text-gray-700">{count} คำ</span>
                          </div>
                          <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                            <div
                              className={`h-2 rounded-full ${CATEGORY_BAR_COLORS[i % CATEGORY_BAR_COLORS.length]}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                    {categories.length === 0 && (
                      <p className="text-sm text-gray-400">ยังไม่มีหมวดหมู่ — ไปเพิ่มที่เมนู "จัดการบทเรียน"</p>
                    )}
                  </div>
                </div>

                <div className={`${CARD} p-5`}>
                  <h3 className="font-bold text-gray-800 mb-4">กิจกรรมล่าสุด</h3>
                  {loginLogs.length === 0 ? (
                    <p className="text-sm text-gray-400">ยังไม่มีข้อมูลการเข้าสู่ระบบ</p>
                  ) : (
                    <ul className="space-y-4">
                      {loginLogs.slice(0, 5).map((log) => (
                        <li key={log.id} className="flex items-start gap-3">
                          <Avatar text={log.email} index={log.user_id} small />
                          <div className="min-w-0 text-sm">
                            <p className="text-gray-700 truncate">
                              <span className="font-semibold">{log.email}</span> เข้าสู่ระบบ
                            </p>
                            <p className="text-gray-400 text-xs">{new Date(log.login_time).toLocaleString('th-TH')}</p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              <div className={`${CARD} p-5`}>
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div>
                    <h3 className="font-bold text-gray-800">ผู้ใช้งานล่าสุด</h3>
                    <p className="text-xs text-gray-400">5 บัญชีที่สมัครล่าสุด</p>
                  </div>
                  <button
                    onClick={() => setActiveTab('users')}
                    className="text-sm font-semibold text-blue-600 hover:underline"
                  >
                    ดูทั้งหมด →
                  </button>
                </div>
                {renderUserTable(recentUsers)}
              </div>
            </>
          )}

          {/* ───────────── จัดการผู้ใช้งาน ───────────── */}
          {activeTab === 'users' && (
            <div className={`${CARD} p-5`}>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
                <h3 className="font-bold text-gray-800">รายชื่อผู้ใช้งาน ({users.length})</h3>
                <SearchInput value={userSearch} onChange={setUserSearch} placeholder="ค้นหาชื่อหรืออีเมล..." />
              </div>
              {renderUserTable(filteredUsers)}
            </div>
          )}

          {/* ───────────── จัดการบทเรียน (หมวดหมู่) ───────────── */}
          {activeTab === 'categories' && (
            <>
              <div className={`${CARD} p-5 border-2 !border-blue-200`}>
                <h3 className="font-bold text-gray-800 mb-4">＋ เพิ่มหมวดหมู่ใหม่</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Field label="ชื่อหมวดหมู่">
                    <input
                      type="text"
                      placeholder="เช่น ครอบครัว"
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                      className={INPUT}
                    />
                  </Field>
                  <Field label="ระดับความยาก">
                    <select value={newCategoryLevel} onChange={(e) => setNewCategoryLevel(e.target.value)} className={INPUT}>
                      <option value="ง่าย">ง่าย</option>
                      <option value="ปานกลาง">ปานกลาง</option>
                      <option value="ยาก">ยาก</option>
                    </select>
                  </Field>
                </div>
                <Field label="คำอธิบายหมวดหมู่" className="mt-4">
                  <textarea
                    placeholder="คำอธิบายหมวดหมู่ (ไม่บังคับ)"
                    value={newCategoryDescription}
                    onChange={(e) => setNewCategoryDescription(e.target.value)}
                    rows={2}
                    className={INPUT}
                  />
                </Field>
                <div className="flex justify-end gap-2 mt-4">
                  <button
                    onClick={() => {
                      setNewCategoryName('');
                      setNewCategoryLevel('ง่าย');
                      setNewCategoryDescription('');
                    }}
                    className={BTN_GHOST}
                  >
                    ล้าง
                  </button>
                  <button onClick={handleAddCategory} disabled={addingCategory} className={BTN_PRIMARY}>
                    {addingCategory ? 'กำลังบันทึก...' : 'บันทึกหมวดหมู่'}
                  </button>
                </div>
              </div>

              <div className={`${CARD} p-5`}>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
                  <h3 className="font-bold text-gray-800">หมวดหมู่ทั้งหมด ({categories.length})</h3>
                  <SearchInput value={categorySearch} onChange={setCategorySearch} placeholder="ค้นหาหมวดหมู่..." />
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="text-left">
                        <th className={TH}>หมวดหมู่</th>
                        <th className={TH}>จำนวนคำศัพท์</th>
                        <th className={TH}>ระดับ</th>
                        <th className={TH}>เปิดใช้งาน</th>
                        <th className={TH}>คำอธิบาย</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredCategories.map((cat) => {
                        const total = lessonCountByCategory(cat.id);
                        const active = activeCountByCategory(cat.id);
                        return (
                          <tr key={cat.id} className="border-t border-gray-100">
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-3">
                                <Avatar text={cat.name} index={cat.id} small />
                                <span className="font-semibold text-gray-800">{cat.name}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{total} คำ</td>
                            <td className="px-4 py-3"><LevelBadge level={cat.level} /></td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <span
                                className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                                  active > 0 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                                }`}
                              >
                                {active}/{total} คำ
                              </span>
                            </td>
                            <td className="px-4 py-3 text-gray-500">
                              {editingCategoryId === cat.id ? (
                                <div className="flex flex-col gap-2 min-w-[240px]">
                                  <textarea
                                    value={editingDescription}
                                    onChange={(e) => setEditingDescription(e.target.value)}
                                    rows={2}
                                    autoFocus
                                    className={INPUT}
                                  />
                                  <div className="flex gap-2">
                                    <button
                                      onClick={() => handleSaveDescription(cat.id)}
                                      disabled={savingDescription}
                                      className="px-3 py-1 rounded-lg bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 disabled:opacity-60 transition"
                                    >
                                      {savingDescription ? 'กำลังบันทึก...' : 'บันทึก'}
                                    </button>
                                    <button
                                      onClick={cancelEditDescription}
                                      disabled={savingDescription}
                                      className="px-3 py-1 rounded-lg border border-gray-200 text-xs font-medium text-gray-600 hover:bg-gray-50 transition"
                                    >
                                      ยกเลิก
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex items-start justify-between gap-3">
                                  <span>{cat.description || '-'}</span>
                                  <button
                                    onClick={() => startEditDescription(cat)}
                                    className="shrink-0 px-2.5 py-1 rounded-lg bg-blue-50 text-blue-600 text-xs font-medium hover:bg-blue-100 transition whitespace-nowrap"
                                  >
                                    ✏️ แก้ไข
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                      {filteredCategories.length === 0 && (
                        <tr>
                          <td colSpan="5" className="px-4 py-8 text-center text-sm text-gray-400">
                            ยังไม่มีหมวดหมู่ — เพิ่มด้านบนได้เลย
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {/* ───────────── จัดการคำศัพท์ + Ground Truth ───────────── */}
          {activeTab === 'lessons' && (
            <LessonManager lessons={lessons} setLessons={setLessons} categories={categories} onRefresh={fetchAllData} />
          )}

          {/* ───────────── ผลการประเมิน ───────────── */}
          {activeTab === 'reports' && (
            <>
              <div className={`${CARD} p-5 flex flex-col sm:flex-row sm:items-center gap-3`}>
                <label className="text-sm font-semibold text-gray-700 shrink-0">เลือกผู้ใช้</label>
                <select
                  value={reportUserId}
                  onChange={(e) => {
                    const u = users.find((x) => String(x.id) === e.target.value);
                    if (u) handleViewUserProgress(u.id, u.email || u.username);
                  }}
                  className={`${INPUT} sm:max-w-sm`}
                >
                  <option value="">-- เลือกผู้ใช้เพื่อดูผลการประเมิน --</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>{u.username} ({u.email})</option>
                  ))}
                </select>
              </div>

              {reports.length === 0 ? (
                <div className={`${CARD} p-8 text-center text-sm text-gray-400`}>
                  ยังไม่ได้เลือกผู้ใช้ หรือผู้ใช้นี้ยังไม่มีข้อมูลความคืบหน้า
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className={`${CARD} p-5`}>
                      <p className="text-2xl font-bold text-gray-900">{startedReports.length}/{reports.length}</p>
                      <p className="text-xs text-gray-500 mt-1">หมวดหมู่ที่เริ่มฝึกแล้ว</p>
                    </div>
                    <div className={`${CARD} p-5`}>
                      <p className="text-2xl font-bold text-gray-900">{reportWordsPracticed}</p>
                      <p className="text-xs text-gray-500 mt-1">คำศัพท์ที่เคยฝึก</p>
                    </div>
                    <div className={`${CARD} p-5`}>
                      <p className="text-2xl font-bold text-gray-900">{reportAvgCorrectness}%</p>
                      <p className="text-xs text-gray-500 mt-1">ความแม่นยำเฉลี่ย (เฉพาะหมวดที่ฝึกแล้ว)</p>
                    </div>
                  </div>

                  <div className={`${CARD} p-5`}>
                    <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                      <h3 className="font-bold text-gray-800">
                        ความคืบหน้าของ <span className="text-blue-600">{selectedUserLabel}</span> แยกตามหมวดหมู่
                      </h3>
                      {/* legend — 2 series ต้องมี legend เสมอ */}
                      <div className="flex items-center gap-5 text-xs text-gray-500">
                        <span className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-sm" style={{ background: SERIES_COMPLETION }} />
                          ความคืบหน้า (% คำที่เคยฝึก)
                        </span>
                        <span className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-sm" style={{ background: SERIES_CORRECTNESS }} />
                          ความแม่นยำเฉลี่ย (%)
                        </span>
                      </div>
                    </div>

                    {/* กราฟแท่งเทียบ 2 ตัวชี้วัดต่อหมวดหมู่ */}
                    <div className="overflow-x-auto mb-4">
                      <svg
                        viewBox={`0 0 560 ${28 + reports.length * 56 + 8}`}
                        role="img"
                        aria-label={`กราฟความคืบหน้าและความแม่นยำเฉลี่ยของ ${selectedUserLabel || 'ผู้ใช้'} แยกตามหมวดหมู่`}
                        className="w-full"
                        style={{ minWidth: 480 }}
                      >
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
                              <text x={leftX - 10} y={groupCenter} textAnchor="end" dominantBaseline="middle" fontSize="12" fill="#374151">
                                {r.category_name}
                              </text>
                              <path d={roundedBar(completion, bar1Y)} fill={SERIES_COMPLETION} />
                              <text x={leftX + (completion / 100) * plotW + 6} y={bar1Y + 7} dominantBaseline="middle" fontSize="10" fill="#52514e">
                                {completion}%
                              </text>
                              <path d={roundedBar(correctness, bar2Y)} fill={SERIES_CORRECTNESS} />
                              <text x={leftX + (correctness / 100) * plotW + 6} y={bar2Y + 7} dominantBaseline="middle" fontSize="10" fill="#52514e">
                                {correctness}%
                              </text>
                            </g>
                          );
                        })}
                      </svg>
                    </div>

                    {/* table view — ตัวเลขจริงครบทุกหมวด */}
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-sm">
                        <thead>
                          <tr className="text-left">
                            <th className={TH}>หมวดหมู่</th>
                            <th className={TH}>ฝึกไปแล้ว</th>
                            <th className={TH}>ความคืบหน้า</th>
                            <th className={TH}>ความแม่นยำเฉลี่ย</th>
                          </tr>
                        </thead>
                        <tbody>
                          {reports.map((r) => (
                            <tr key={r.category_id} className="border-t border-gray-100">
                              <td className="px-4 py-3 text-gray-700">{r.category_name}</td>
                              <td className="px-4 py-3 text-gray-500">{r.words_practiced} / {r.total_words} คำ</td>
                              <td className="px-4 py-3 text-gray-500">{r.completion_percentage}%</td>
                              <td className="px-4 py-3">
                                <span
                                  className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                                    r.words_practiced === 0
                                      ? 'bg-gray-100 text-gray-500'
                                      : r.correctness_percentage >= 50
                                      ? 'bg-green-100 text-green-700'
                                      : 'bg-red-50 text-red-600'
                                  }`}
                                >
                                  {r.correctness_percentage}%
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
            </>
          )}

          {/* ───────────── รายงาน ───────────── */}
          {activeTab === 'summary' && (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className={`${CARD} p-5`}>
                  <h3 className="font-bold text-gray-800">ผู้ใช้ที่เข้าสู่ระบบรายเดือน</h3>
                  <p className="text-xs text-gray-400 mb-4">นับผู้ใช้ไม่ซ้ำ จากประวัติเข้าสู่ระบบล่าสุด {loginLogs.length} รายการ</p>
                  {monthlyLogins.length === 0 ? (
                    <p className="text-sm text-gray-400">ยังไม่มีข้อมูลการเข้าสู่ระบบ</p>
                  ) : (
                    <div className="space-y-4">
                      {monthlyLogins.map((m, i) => (
                        <div key={m.key}>
                          <div className="flex justify-between text-sm mb-1.5">
                            <span className="text-gray-600">
                              {m.date.toLocaleDateString('th-TH', { month: 'short', year: 'numeric' })}
                            </span>
                            <span className="font-semibold text-gray-800">{m.users.size} คน</span>
                          </div>
                          <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                            <div
                              className={`h-2 rounded-full ${i === monthlyLogins.length - 1 ? 'bg-blue-600' : 'bg-blue-300'}`}
                              style={{ width: `${Math.round((m.users.size / maxMonthly) * 100)}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className={`${CARD} p-5`}>
                  <h3 className="font-bold text-gray-800 mb-2">สรุปภาพรวม</h3>
                  <dl className="divide-y divide-gray-100 text-sm">
                    {[
                      ['ผู้ใช้งานทั้งหมด', `${users.length} คน`],
                      ['ผู้ดูแลระบบ', `${adminCount} คน`],
                      ['หมวดหมู่บทเรียน', `${categories.length} หมวด`],
                      ['คำศัพท์ที่เปิดใช้งาน', `${activeLessonCount}/${lessons.length} คำ (${activeLessonPct}%)`],
                      ['หมวดหมู่ที่มีคำศัพท์มากที่สุด', topCategory ? `${topCategory.name} (${lessonCountByCategory(topCategory.id)} คำ)` : '-'],
                    ].map(([label, value]) => (
                      <div key={label} className="flex items-center justify-between gap-4 py-3">
                        <dt className="text-gray-500">{label}</dt>
                        <dd className="font-semibold text-gray-800 text-right">{value}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              </div>

              <div className={`${CARD} p-5`}>
                <h3 className="font-bold text-gray-800 mb-3">ประวัติการเข้าสู่ระบบ</h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="text-left">
                        <th className={TH}>ผู้ใช้</th>
                        <th className={TH}>ID ผู้ใช้</th>
                        <th className={TH}>เวลาที่เข้าสู่ระบบ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loginLogs.length > 0 ? (
                        loginLogs.map((log) => (
                          <tr key={log.id} className="border-t border-gray-100">
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-3">
                                <Avatar text={log.email} index={log.user_id} small />
                                <span className="font-medium text-gray-800">{log.email}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-gray-500">{log.user_id}</td>
                            <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                              {new Date(log.login_time).toLocaleString('th-TH')}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="3" className="px-4 py-8 text-center text-sm text-gray-400">
                            ไม่มีข้อมูลประวัติการเข้าสู่ระบบ
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

const AVATAR_TINTS = [
  'bg-green-100 text-green-700',
  'bg-orange-50 text-orange-700',
  'bg-purple-50 text-purple-700',
  'bg-pink-50 text-pink-700',
  'bg-sky-50 text-sky-700',
];

function Avatar({ text, index = 0, small = false }) {
  const tint = AVATAR_TINTS[Math.abs(Number(index) || 0) % AVATAR_TINTS.length];
  return (
    <span
      className={`shrink-0 rounded-full flex items-center justify-center font-bold ${tint} ${
        small ? 'w-8 h-8 text-xs' : 'w-9 h-9 text-sm'
      }`}
    >
      {(text || '?').slice(0, 2).toUpperCase()}
    </span>
  );
}

function StatCard({ icon, tint, value, label }) {
  return (
    <div className={`${CARD} p-5`}>
      <span className={`w-9 h-9 rounded-xl flex items-center justify-center ${tint}`}>{icon}</span>
      <p className="text-2xl font-bold text-gray-900 mt-3">{value}</p>
      <p className="text-xs text-gray-500">{label}</p>
    </div>
  );
}

function Ring({ percent, size = 56, stroke = 6 }) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, Number(percent) || 0));
  return (
    <svg width={size} height={size} className="-rotate-90 shrink-0">
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" strokeWidth={stroke} stroke="#e5e7eb" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        strokeWidth={stroke}
        strokeLinecap="round"
        stroke="#2563eb"
        strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - clamped / 100)}
      />
    </svg>
  );
}

function LevelBadge({ level }) {
  const style =
    level === 'ง่าย'
      ? 'bg-green-100 text-green-700'
      : level === 'ยาก'
      ? 'bg-red-50 text-red-600'
      : level === 'ปานกลาง'
      ? 'bg-orange-50 text-orange-600'
      : 'bg-gray-100 text-gray-500';
  return <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${style}`}>{level || '-'}</span>;
}