import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";


export default function Lesson() {

  const { id } = useParams();
  const navigate = useNavigate();

  const [words, setWords] = useState([]);
  const [loading, setLoading] = useState(true);


  useEffect(() => {

    fetch(`http://127.0.0.1:8000/categories/${id}/words`)
      .then((res) => {
        if (!res.ok) {
          throw new Error("API Error");
        }
        return res.json();
      })
      .then((data) => {
        console.log("words:", data);
        setWords(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Fetch error:", err);
        setLoading(false);
      });

  }, [id]);


  return (
    <div className="min-h-screen bg-sky-100 p-8">


      <button
        onClick={() => navigate("/")}
        className="bg-gray-500 text-white px-5 py-2 rounded-xl mb-8"
      >
        ← กลับ
      </button>


      <h1 className="text-4xl font-bold mb-8">
        บทเรียนภาษามือ
      </h1>


      {loading ? (

        <p>
          กำลังโหลดคำศัพท์...
        </p>

      ) : words.length > 0 ? (


        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">

          {words.map((item) => (

            <div
              key={item.id}
              className="bg-white rounded-3xl shadow-lg p-8 text-center"
            >

              <div className="text-7xl mb-5">
                {item.image}
              </div>


              <h2 className="text-3xl font-bold">
                {item.word}
              </h2>


              <p className="text-gray-500 mt-3">
                {item.meaning}
              </p>


              <button
                onClick={() => navigate(`/practice/${item.id}`)}
                className="
                  mt-6
                  bg-sky-500
                  hover:bg-sky-600
                  text-white
                  px-6
                  py-3
                  rounded-xl
                "
              >
                ฝึกท่าทาง
              </button>

            </div>

          ))}

        </div>


      ) : (

        <p>
          ไม่พบคำศัพท์
        </p>

      )}


    </div>
  );
}