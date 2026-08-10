import { useNavigate } from "react-router-dom";

export default function RecommendationCard({
    id,
    title,
    level,
}) {
    const navigate = useNavigate();

    return (

        <div className="bg-white rounded-3xl shadow p-6 hover:shadow-xl duration-300">

            <div className="text-5xl mb-4">
                🤟
            </div>

            <h3 className="text-2xl font-semibold">

                {title}

            </h3>

            <p className="text-gray-500 mt-2">

                ระดับ {level}

            </p>

            <button
                onClick={() => navigate("/lessons", { state: { categoryId: id, categoryTitle: title } })}
                className="mt-6 bg-blue-600 text-white px-5 py-2 rounded-xl hover:bg-blue-700 duration-300"
            >

                เรียนเลย

            </button>

        </div>

    );
}