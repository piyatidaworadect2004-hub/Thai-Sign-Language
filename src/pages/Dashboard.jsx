import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

export default function Dashboard() {
    const [progressData, setProgressData] = useState([]);
    const [stats, setStats] = useState({ totalPracticed: 0, avgConfidence: 0 });
    const [categoryOverview, setCategoryOverview] = useState([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        async function fetchProgress() {
            try {
                const token = localStorage.getItem("token");
                // ปรับ URL ตาม Endpoint ของ Backend ที่คุณใช้ดึงประวัติการฝึกซ้อมของผู้ใช้
                const response = await fetch("http://localhost:8000/progress", {
                    headers: {
                        ...(token && { Authorization: `Bearer ${token}` })
                    }
                });

                if (response.ok) {
                    const data = await response.json();
                    setProgressData(data);

                    // คำนวณสถิติเบื้องต้น
                    const total = data.length;
                    const avgConf = total > 0
                        ? data.reduce((acc, curr) => acc + (curr.confidence || 0), 0) / total
                        : 0;

                    setStats({
                        totalPracticed: total,
                        avgConfidence: (avgConf * 100).toFixed(1)
                    });
                }

                // ความคืบหน้าแยกตามหมวดหมู่ (% ฝึกไปกี่คำจากทั้งหมดในหมวดนั้น)
                const overviewRes = await fetch("http://localhost:8000/progress/me/overview", {
                    headers: {
                        ...(token && { Authorization: `Bearer ${token}` })
                    }
                });
                if (overviewRes.ok) {
                    setCategoryOverview(await overviewRes.json());
                }
            } catch (error) {
                console.error("ไม่สามารถดึงข้อมูลความคืบหน้าได้:", error);
            } finally {
                setLoading(false);
            }
        }

        fetchProgress();
    }, []);

    // จัดกลุ่มประวัติตามหมวดหมู่ — คงลำดับตาม created_at desc เดิมไว้ (กลุ่มที่ฝึกล่าสุดขึ้นก่อน)
    const groupedHistory = progressData.reduce((groups, item) => {
        const key = item.category_name || "ไม่ทราบหมวดหมู่";
        let group = groups.find((g) => g.category_name === key);
        if (!group) {
            group = { category_name: key, items: [] };
            groups.push(group);
        }
        group.items.push(item);
        return groups;
    }, []);

    if (loading) {
        return (
            <div className="min-h-screen bg-sky-100 flex items-center justify-center">
                <p className="text-xl font-bold text-blue-600">กำลังโหลดข้อมูลแดชบอร์ด...</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-sky-100 p-8">
            {/* ส่วนหัว */}
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-4xl font-bold text-gray-800 mb-1">แดชบอร์ดความคืบหน้า</h1>
                    <p className="text-lg text-gray-600">ติดตามผลการฝึกซ้อมภาษามือของคุณ</p>
                </div>
                <button
                    onClick={() => navigate("/lessons")}
                    className="bg-blue-600 text-white px-6 py-3 rounded-2xl font-bold shadow-md hover:bg-blue-700 transition"
                >
                    + ไปเลือกบทเรียนฝึกซ้อม
                </button>
            </div>

            {/* กล่องสรุปสถิติภาพรวม */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <div className="bg-white rounded-3xl shadow-md p-6 border-2 border-white flex items-center justify-between">
                    <div>
                        <p className="text-gray-500 font-medium">บทเรียนที่ฝึกซ้อมไปแล้ว</p>
                        <h2 className="text-4xl font-extrabold text-blue-600 mt-1">{stats.totalPracticed} <span className="text-xl text-gray-400">รายการ</span></h2>
                    </div>
                    <div className="bg-sky-100 p-4 rounded-2xl text-3xl">📚</div>
                </div>

                <div className="bg-white rounded-3xl shadow-md p-6 border-2 border-white flex items-center justify-between">
                    <div>
                        <p className="text-gray-500 font-medium">ค่าความถูกต้องเฉลี่ย</p>
                        <h2 className="text-4xl font-extrabold text-green-600 mt-1">{stats.avgConfidence}%</h2>
                    </div>
                    <div className="bg-green-100 p-4 rounded-2xl text-3xl">🎯</div>
                </div>
            </div>

            {/* ความคืบหน้าแยกตามหมวดหมู่ */}
            {categoryOverview.length > 0 && (
                <div className="bg-white rounded-3xl shadow-md p-6 border-2 border-white mb-8">
                    <h2 className="text-2xl font-bold text-gray-800 mb-4">ความคืบหน้าแยกตามหมวดหมู่</h2>
                    <div className="space-y-4">
                        {categoryOverview.map((cat) => (
                            <div key={cat.category_id}>
                                <div className="flex items-center justify-between mb-1">
                                    <span className="font-semibold text-gray-700">{cat.category_name}</span>
                                    <span className="text-sm font-bold text-blue-600">
                                        {cat.completion_percentage}%
                                    </span>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden mb-1">
                                    <div
                                        className="h-3 rounded-full bg-blue-500 transition-all"
                                        style={{ width: `${Math.min(cat.completion_percentage, 100)}%` }}
                                    />
                                </div>
                                <p className="text-xs text-gray-400">
                                    ฝึกไปแล้ว {cat.words_practiced} / {cat.total_words} คำ
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ประวัติการฝึกซ้อมล่าสุด */}
            <div className="bg-white rounded-3xl shadow-md p-6 border-2 border-white">
                <h2 className="text-2xl font-bold text-gray-800 mb-4">ประวัติการฝึกซ้อมล่าสุด</h2>

                {progressData.length === 0 ? (
                    <div className="text-center py-8 text-gray-400">
                        <p>ยังไม่มีประวัติการฝึกซ้อม เริ่มต้นฝึกคำแรกกันเลย!</p>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {groupedHistory.map((group) => (
                            <div key={group.category_name}>
                                <div className="flex items-center gap-2 mb-2">
                                    <h3 className="font-bold text-gray-700">{group.category_name}</h3>
                                    <span className="text-xs text-gray-400">({group.items.length} รายการ)</span>
                                </div>

                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="border-b border-gray-100 text-gray-400 text-sm">
                                                <th className="py-3 px-4">บทเรียน / คำศัพท์</th>
                                                <th className="py-3 px-4">ความมั่นใจ</th>
                                                <th className="py-3 px-4">เวลาที่ฝึก</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {group.items.map((item, index) => (
                                                <tr key={index} className="border-b border-gray-50 hover:bg-sky-50 transition">
                                                    <td className="py-4 px-4 font-bold text-gray-800">
                                                        {item.lesson?.word || `บทเรียนที่ ${item.lesson_id}`}
                                                    </td>
                                                    <td className="py-4 px-4">
                                                        <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm font-semibold">
                                                            {(item.confidence * 100).toFixed(1)}%
                                                        </span>
                                                    </td>
                                                    <td className="py-4 px-4 text-gray-500 text-sm">
                                                        {new Date(item.created_at || Date.now()).toLocaleString("th-TH")}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}