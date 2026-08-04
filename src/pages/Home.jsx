import { useEffect, useState } from "react";

import Navbar from "../components/Navbar";
import Hero from "../components/Hero";
import CategoryCard from "../components/CategoryCard";
import RecommendationCard from "../components/RecommendationCard";

export default function Home() {
  const [categories, setCategories] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

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

  return (
    <div className="min-h-screen bg-sky-100">
      <Navbar />

      <Hero />

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
                difficulty={category.difficulty}
                progress={category.progress}
                image={category.image}
                color={category.color}
              />
            ))
          ) : (
            <p className="text-gray-500">ไม่พบข้อมูลหมวดหมู่บทเรียน</p>
          )}
        </div>
      </section>

      {/* คำแนะนำสำหรับคุณ */}
      <section className="max-w-7xl mx-auto py-16 px-8">
        <h2 className="text-4xl font-bold mb-8">คำแนะนำสำหรับคุณ</h2>

        <div className="grid lg:grid-cols-3 gap-8">
          {isLoading ? (
            <p className="text-gray-500 font-medium animate-pulse">กำลังโหลดคำแนะนำ...</p>
          ) : categories.length > 0 ? (
            categories.slice(0, 3).map((category) => (
              <RecommendationCard 
                key={category.id}
                title={category.name} 
                level={category.difficulty} 
              />
            ))
          ) : (
            <p className="text-gray-500">ไม่พบข้อมูลคำแนะนำ</p>
          )}
        </div>
      </section>
    </div>
  );
}