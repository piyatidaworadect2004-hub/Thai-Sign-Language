import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";

export default function Lesson() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [lessonData, setLessonData] = useState(null);

  // ดึงข้อมูลรายละเอียดบทเรียนจาก Backend ตาม ID (ถ้ามี API สามารถเปิดใช้งานส่วนนี้ได้ครับ)
  useEffect(() => {
    async function fetchLessonDetail() {
      try {
        const token = localStorage.getItem("token");
        const response = await fetch(`http://localhost:8000/lessons/${id}`, {
          headers: {
            ...(token && { Authorization: `Bearer ${token}` })
          }
        });
        if (response.ok) {
          const data = await response.json();
          setLessonData(data);
        }
      } catch (error) {
        console.log("ไม่สามารถดึงข้อมูลบทเรียนได้ ใช้ค่าเริ่มต้นแทน");
      }
    }
    fetchLessonDetail();
  }, [id]);

  return (
    <div className="min-h-screen bg-sky-100 p-8 flex flex-col items-center">
      {/* ปุ่มย้อนกลับ */}
      <div className="w-full max-w-3xl">
        <button
          onClick={() => navigate("/home")}
          className="bg-gray-500 text-white px-5 py-2 rounded-xl mb-6 hover:bg-gray-600 transition shadow"
        >
          ← กลับหน้าหลัก
        </button>
      </div>

      {/* กล่องแสดงรายละเอียดบทเรียน */}
      <div className="bg-white rounded-3xl shadow-xl p-8 max-w-3xl w-full">
        <h1 className="text-3xl font-bold text-slate-800">
          {lessonData?.title || `บทเรียนภาษามือ (ID: ${id})`}
        </h1>
        <p className="text-gray-500 mt-1">
          {lessonData?.description || "ศึกษาท่าทางและคำแนะนำด้านล่างนี้ให้เข้าใจก่อนเริ่มฝึกปฏิบัติจริงกับ AI"}
        </p>

        {/* ส่วนแสดงวิดีโอตัวอย่างท่าทาง */}
        <div className="mt-6 aspect-video bg-black rounded-2xl overflow-hidden shadow-inner flex items-center justify-center relative">
          {lessonData?.video_url ? (
            <video
              src={lessonData.video_url}
              controls
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="text-center p-6">
              <span className="text-white text-lg font-medium block">
                🎥 วิดีโอตัวอย่างท่าทางภาษามือ
              </span>
              <a
                href="https://dic.ttrs.or.th/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 text-sm underline mt-2 inline-block"
              >
                ดูตัวอย่างเพิ่มเติมจากแหล่งข้อมูลภายนอก (TTRS)
              </a>
            </div>
          )}
        </div>

        {/* คำแนะนำเพิ่มเติมสำหรับผู้เรียน */}
        <div className="mt-6 bg-sky-50 p-5 rounded-2xl border border-sky-200">
          <h2 className="text-lg font-bold text-slate-700">📌 คำแนะนำในการฝึก</h2>
          <ul className="list-disc list-inside text-gray-600 mt-2 space-y-1">
            <li>จัดตำแหน่งตัวให้พอดีกับกล้องและมีแสงสว่างเพียงพอ</li>
            <li>สังเกตลักษณะนิ้วและทิศทางมือจากวิดีโอตัวอย่าง</li>
            <li>เมื่อพร้อมแล้ว สามารถกดปุ่มเปิดกล้องเพื่อเริ่มประเมินท่าทางกับ AI ได้ทันที</li>
          </ul>
        </div>

        {/* ปุ่มกดเปิดกล้องเพื่อไปหน้า Practice */}
        <div className="mt-8 flex justify-end">
          <button
            onClick={() => navigate(`/practice/${id}`)}
            className="bg-blue-600 text-white px-8 py-3 rounded-2xl font-bold text-lg hover:bg-blue-700 transition shadow-lg flex items-center gap-2"
          >
            🚀 พร้อมแล้ว เปิดกล้องฝึกกับ AI
          </button>
        </div>
      </div>
    </div>
  );
}