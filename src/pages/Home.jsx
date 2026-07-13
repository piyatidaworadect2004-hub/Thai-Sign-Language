import { useEffect, useState } from "react";

import Navbar from "../components/Navbar";
import Hero from "../components/Hero";
import CategoryCard from "../components/CategoryCard";
import RecommendationCard from "../components/RecommendationCard";

export default function Home() {
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    fetch("http://127.0.0.1:8000/categories")
      .then((res) => res.json())
      .then((data) => setCategories(data))
      .catch((err) => console.error(err));
  }, []);

  return (
    <div className="min-h-screen bg-sky-100">
      <Navbar />

      <Hero />

      {/* หมวดหมู่บทเรียน */}
      <section className="max-w-7xl mx-auto py-16 px-8">
        <h2 className="text-4xl font-bold mb-8">
          หมวดหมู่บทเรียน
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">

          {categories.length > 0 ? (
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
            <p>กำลังโหลดข้อมูล...</p>
          )}

        </div>
      </section>


      {/* คำแนะนำ */}
      <section className="max-w-7xl mx-auto py-16 px-8">
        <h2 className="text-4xl font-bold mb-8">
          คำแนะนำสำหรับคุณ
        </h2>

        <div className="grid lg:grid-cols-3 gap-8">

          <RecommendationCard
            title="ทักทาย"
            level="ง่าย"
          />

          <RecommendationCard
            title="ครอบครัว"
            level="ปานกลาง"
          />

          <RecommendationCard
            title="อาหาร"
            level="ง่าย"
          />

        </div>
      </section>

    </div>
  );
}