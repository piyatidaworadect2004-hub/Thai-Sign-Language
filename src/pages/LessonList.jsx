import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { getPracticeHistory, isSaved } from "../services/practiceService";

export default function LessonList() {
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [history, setHistory] = useState([]);
    const navigate = useNavigate();
    const location = useLocation();

    // อ่านค่า categoryId ที่ CategoryCard.jsx ส่งมาผ่าน navigate state
    // ถ้ามี = ผู้ใช้กดมาจากหมวดใดหมวดหนึ่งในหน้าแรก ให้โชว์แค่หมวดนั้น
    // ถ้าไม่มี (เช่น เข้า /lessons ตรงๆ ผ่าน URL) ให้โชว์ทุกหมวดเหมือนเดิม (fallback)
    const selectedCategoryId = location.state?.categoryId;

    useEffect(() => {
        async function fetchLessons() {
            try {
                const response = await fetch("http://localhost:8000/categories");
                if (response.ok) {
                    const data = await response.json();
                    setCategories(data);
                }
            } catch (error) {
                console.error("ไม่สามารถดึงข้อมูลบทเรียนได้:", error);
            } finally {
                setLoading(false);
            }
        }

        fetchLessons();
    }, []);

    // ประวัติการฝึกของ user ที่ login อยู่ ดึงมาครั้งเดียวแล้วเช็ค isSaved ต่อคำจากในนี้
    // (กันไม่ให้ยิง API แยกต่อการ์ดคำศัพท์แต่ละใบ)
    useEffect(() => {
        getPracticeHistory().then(setHistory);
    }, []);

    // กรองให้เหลือแค่หมวดที่เลือกมา (ถ้ามี categoryId ติดมา)
    const displayedCategories = selectedCategoryId
        ? categories.filter((c) => String(c.id) === String(selectedCategoryId))
        : categories;

    if (loading) {
        return (
            <div className="min-h-screen bg-sky-100 flex items-center justify-center">
                <p className="text-xl font-bold text-blue-600">กำลังโหลดบทเรียน...</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-sky-100 p-8">
            {selectedCategoryId && (
                <button
                    onClick={() => navigate("/home")}
                    className="bg-gray-500 text-white px-5 py-2 rounded-xl mb-6 hover:bg-gray-600 transition"
                >
                    ← กลับหน้าหลัก
                </button>
            )}

            <h1 className="text-4xl font-bold text-gray-800 mb-2">
                {selectedCategoryId
                    ? location.state?.categoryTitle || "คำศัพท์ในหมวดนี้"
                    : "รายการบทเรียนภาษามือ"}
            </h1>
            <p className="text-lg text-gray-600 mb-8">เลือกคำศัพท์ที่คุณต้องการฝึกซ้อม</p>

            {displayedCategories.length === 0 ? (
                <div className="bg-white rounded-2xl shadow-md p-6 text-center max-w-md mx-auto">
                    <p className="text-gray-500">ยังไม่มีข้อมูลบทเรียนในระบบ</p>
                </div>
            ) : (
                <div className="space-y-8">
                    {displayedCategories.map((category) => (
                        <div key={category.id} className="bg-white rounded-3xl shadow-md p-6 border-2 border-white">
                            <h2 className="text-2xl font-bold text-blue-600 mb-4">
                                {category.name}
                            </h2>

                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                                {category.lessons && category.lessons.map((lesson) => {
                                    const isActive = lesson.is_active ?? lesson.isActive ?? false;
                                    const word = lesson.word || lesson.title;
                                    const passed = isSaved(history, word);

                                    return (
                                        <div
                                            key={lesson.id}
                                            onClick={() => {
                                                if (!isActive) return;
                                                navigate(`/practice/${lesson.id}`, {
                                                    state: {
                                                        word,
                                                        isActive,
                                                    },
                                                });
                                            }}
                                            className={`rounded-2xl p-5 shadow-sm flex flex-col justify-between transition border-2 ${
                                                isActive
                                                    ? "bg-sky-50 border-sky-200 cursor-pointer hover:bg-sky-100 hover:border-blue-400"
                                                    : "bg-gray-100 border-gray-200 cursor-not-allowed opacity-60"
                                            }`}
                                        >
                                            <div>
                                                <div className="flex items-start justify-between gap-2">
                                                    <h3 className="text-xl font-bold text-gray-800 mb-1">
                                                        {word}
                                                    </h3>
                                                    {passed && (
                                                        <span className="shrink-0 text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-semibold">
                                                            ✅ ฝึกผ่านแล้ว
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-sm text-gray-500 line-clamp-2">
                                                    {lesson.description || "ฝึกท่าทางภาษามือบทเรียนนี้"}
                                                </p>
                                            </div>
                                            <div className="mt-4 flex items-center justify-between">
                                                {isActive ? (
                                                    <>
                                                        <span className="text-xs bg-blue-500 text-white px-3 py-1 rounded-full font-semibold">
                                                            {passed ? "ฝึกอีกครั้ง" : "เริ่มฝึกซ้อม"}
                                                        </span>
                                                        <span className="text-blue-600 font-bold">→</span>
                                                    </>
                                                ) : (
                                                    <span className="text-xs bg-gray-400 text-white px-3 py-1 rounded-full font-semibold">
                                                        🔒 เร็วๆ นี้
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}