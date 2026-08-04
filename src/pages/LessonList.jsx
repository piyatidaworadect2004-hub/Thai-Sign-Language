import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

export default function LessonList() {
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    // ดึงข้อมูลหมวดหมู่และบทเรียนจาก Backend ของคุณ
    useEffect(() => {
        async function fetchLessons() {
            try {
                // ปรับ URL ตาม Endpoint ของ Backend ที่คุณเตรียมไว้สำหรับดึงหมวดหมู่และบทเรียน
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

    if (loading) {
        return (
            <div className="min-h-screen bg-sky-100 flex items-center justify-center">
                <p className="text-xl font-bold text-blue-600">กำลังโหลดบทเรียน...</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-sky-100 p-8">
            <h1 className="text-4xl font-bold text-gray-800 mb-2">รายการบทเรียนภาษามือ</h1>
            <p className="text-lg text-gray-600 mb-8">เลือกหมวดหมู่และคำศัพท์ที่คุณต้องการฝึกซ้อม</p>

            {categories.length === 0 ? (
                <div className="bg-white rounded-2xl shadow-md p-6 text-center max-w-md mx-auto">
                    <p className="text-gray-500">ยังไม่มีข้อมูลบทเรียนในระบบ</p>
                </div>
            ) : (
                <div className="space-y-8">
                    {categories.map((category) => (
                        <div key={category.id} className="bg-white rounded-3xl shadow-md p-6 border-2 border-white">
                            <h2 className="text-2xl font-bold text-blue-600 mb-4">
                                {category.name}
                            </h2>
                            
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                                {category.lessons && category.lessons.map((lesson) => (
                                    <div
                                        key={lesson.id}
                                        onClick={() => navigate(`/practice/${lesson.id}`)}
                                        className="bg-sky-50 border-2 border-sky-200 rounded-2xl p-5 cursor-pointer hover:bg-sky-100 hover:border-blue-400 transition shadow-sm flex flex-col justify-between"
                                    >
                                        <div>
                                            <h3 className="text-xl font-bold text-gray-800 mb-1">
                                                {lesson.word || lesson.title}
                                            </h3>
                                            <p className="text-sm text-gray-500 line-clamp-2">
                                                {lesson.description || "ฝึกท่าทางภาษามือบทเรียนนี้"}
                                            </p>
                                        </div>
                                        <div className="mt-4 flex items-center justify-between">
                                            <span className="text-xs bg-blue-500 text-white px-3 py-1 rounded-full font-semibold">
                                                เริ่มฝึกซ้อม
                                            </span>
                                            <span className="text-blue-600 font-bold">→</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}