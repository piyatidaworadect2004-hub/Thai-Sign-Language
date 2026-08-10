import { useNavigate } from "react-router-dom";

const levelBorderColor = {
  ง่าย: "#4ade80",    
  ปานกลาง: "#facc15",  
  ยาก: "#f87171"     
};

export default function CategoryCard({
  id,
  title,
  lessons,
  level,
  progress = 0,
  image,
}) {
  const navigate = useNavigate();

  const levelColor = {
    ง่าย: "bg-green-100 text-green-700",
    ปานกลาง: "bg-yellow-100 text-yellow-700",
    ยาก: "bg-red-100 text-red-700",
  };

  return (
    <div
      className="rounded-3xl shadow-lg hover:shadow-2xl duration-300 p-6 cursor-pointer bg-white"
      style={{
        borderTop: `8px solid ${levelBorderColor[level] || "#94a3b8"}`,
      }}
    >

      {/* รูปหรือ Emoji */}
      <div className="flex justify-center mb-4">
        {image ? (
          image.startsWith("/") ? (
            <img
              src={image}
              alt={title}
              className="w-full h-40 object-cover rounded-xl"
            />
          ) : (
            <div className="text-6xl">
              {image}
            </div>
          )
        ) : (
          <div className="text-6xl">
            🤟
          </div>
        )}
      </div>


      {/* ชื่อหมวด */}
      <h3 className="text-2xl font-bold text-center">
        {title}
      </h3>


      {/* จำนวนคำศัพท์ */}
      <p className="text-center text-gray-500 mt-2">
        {lessons} คำศัพท์
      </p>


      {/* ระดับความยาก */}
      <div className="flex justify-center mt-4">
        <span
          className={`px-4 py-1 rounded-full text-sm font-medium ${
            levelColor[level] ||
            "bg-gray-100 text-gray-700"
          }`}
        >
          {level || "ไม่ระบุ"}
        </span>
      </div>


      {/* Progress */}
      <div className="mt-6">

        <div className="flex justify-between text-sm mb-2">
          <span>
            ความคืบหน้า
          </span>

          <span>
            {progress}%
          </span>
        </div>


        <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">

          <div
            className="h-full bg-sky-500 rounded-full transition-all duration-500"
            style={{
              width: `${progress}%`,
            }}
          />

        </div>

      </div>


      {/* ปุ่มเริ่มเรียน */}
      <button
        onClick={() => navigate("/lessons", { state: { categoryId: id, categoryTitle: title } })}
        className="
          w-full
          mt-6
          bg-sky-500
          hover:bg-sky-600
          text-white
          py-3
          rounded-xl
          font-semibold
          duration-300
        "
      >
        เริ่มเรียน
      </button>


    </div>
  );
}