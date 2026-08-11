import { useNavigate } from "react-router-dom";

export default function ContinueLearningCard({
  categoryId,
  title,
  image,
  remainingWords,
  progress = 0,
}) {
  const navigate = useNavigate();

  return (
    <div className="bg-white rounded-3xl shadow-lg p-6 w-80 shrink-0 hover:shadow-xl duration-300">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-sky-100 flex items-center justify-center text-2xl shrink-0">
          {image || "🤟"}
        </div>
        <div>
          <h3 className="font-bold text-gray-800">{title}</h3>
          <p className="text-sm text-gray-500">เหลืออีก {remainingWords} คำ</p>
        </div>
      </div>

      <div className="mt-4">
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span />
          <span>{progress}%</span>
        </div>
        <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-sky-500 rounded-full transition-all duration-500"
            style={{ width: `${Math.min(progress, 100)}%` }}
          />
        </div>
      </div>

      <button
        onClick={() => navigate("/lessons", { state: { categoryId, categoryTitle: title } })}
        className="mt-4 bg-sky-100 text-sky-700 hover:bg-sky-200 px-4 py-2 rounded-xl font-semibold duration-300"
      >
        เรียนต่อ →
      </button>
    </div>
  );
}
