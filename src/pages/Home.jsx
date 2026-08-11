import { useEffect, useState } from "react";

import Navbar from "../components/Navbar";
import Hero from "../components/Hero";
import CategoryCard from "../components/CategoryCard";
import RecommendationCard from "../components/RecommendationCard";
import ContinueLearningCard from "../components/ContinueLearningCard";
import { getProgressOverview } from "../services/practiceService";

export default function Home() {
  const [categories, setCategories] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [continueCategories, setContinueCategories] = useState([]);

  useEffect(() => {
    const token = localStorage.getItem("token");

    const headers = {
      "Content-Type": "application/json",
    };

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    fetch("http://127.0.0.1:8000/categories", {
      method: "GET",
      headers: headers,
    })
      .then((res) => {
        if (!res.ok) {
          throw new Error(`ดึงข้อมูลไม่สำเร็จ (Status: ${res.status})`);
        }
        return res.json();
      })
      .then((data) => {
        setCategories(data);
      })
      .catch((err) => {
        console.error("ดึงข้อมูลล้มเหลว:", err);
        setErrorMsg(err.message);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  // การ์ด "เรียนต่อจากเดิม" — เอาทุกหมวดที่เริ่มฝึกไปแล้วแต่ยังไม่ครบมาโชว์ (ไม่ใช่แค่หมวดเดียว)
  // เรียงตาม "ฝึกล่าสุดเมื่อไหร่" (last_practiced_at) ให้หมวดที่เพิ่งไปฝึกมาขึ้นก่อน
  useEffect(() => {
    getProgressOverview().then((overview) => {
      const started = overview
        .filter((c) => c.words_practiced > 0 && c.completion_percentage < 100)
        .sort((a, b) => new Date(b.last_practiced_at) - new Date(a.last_practiced_at));
      setContinueCategories(started);
    });
  }, []);

  return (
    <div className="min-h-screen bg-sky-100">
      <Navbar />

      <Hero />

      {/* เรียนต่อจากเดิม */}
      {continueCategories.length > 0 && (
        <section className="max-w-7xl mx-auto pt-12 px-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold">เรียนต่อจากเดิม</h2>
            <span className="text-sm text-gray-400">หมวดที่คุณเริ่มไว้แล้ว</span>
          </div>

          <div className="flex flex-wrap gap-6">
            {continueCategories.map((c) => (
              <ContinueLearningCard
                key={c.category_id}
                categoryId={c.category_id}
                title={c.category_name}
                image={categories.find((cat) => cat.id === c.category_id)?.image}
                remainingWords={c.total_words - c.words_practiced}
                progress={c.completion_percentage}
              />
            ))}
          </div>
        </section>
      )}

      {/* คำแนะนำสำหรับคุณ */}
      <section className="max-w-7xl mx-auto py-16 px-8">
        <h2 className="text-4xl font-bold mb-8">คำแนะนำสำหรับคุณ</h2>

        <div className="grid lg:grid-cols-3 gap-8">
          {isLoading ? (
            <p className="text-gray-500 font-medium animate-pulse">กำลังโหลดคำแนะนำ...</p>
          ) : errorMsg ? (
            <p className="text-red-500 font-medium">เกิดข้อผิดพลาด: {errorMsg}</p>
          ) : categories.length > 0 ? (
            categories.slice(0, 3).map((category) => (
              <RecommendationCard
                key={category.id}
                id={category.id}
                title={category.name}
                level={category.level}
              />
            ))
          ) : (
            <p className="text-gray-500">ไม่พบข้อมูลคำแนะนำ</p>
          )}
        </div>
      </section>

      {/* หมวดหมู่บทเรียน */}
      <section className="max-w-7xl mx-auto py-16 px-8">
        <h2 className="text-4xl font-bold mb-8">หมวดหมู่บทเรียน</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {isLoading ? (
            <p className="text-gray-500 font-medium animate-pulse">กำลังโหลดข้อมูล...</p>
          ) : errorMsg ? (
            <p className="text-red-500 font-medium">เกิดข้อผิดพลาด: {errorMsg}</p>
          ) : categories.length > 0 ? (
            categories.map((category) => (
              <CategoryCard
                key={category.id}
                id={category.id}
                title={category.name}
                lessons={category.total_words}
                level={category.level}
                progress={category.progress}
                image={category.image}
              />
            ))
          ) : (
            <p className="text-gray-500">ไม่พบข้อมูลหมวดหมู่บทเรียน</p>
          )}
        </div>
      </section>
    </div>
  );
}