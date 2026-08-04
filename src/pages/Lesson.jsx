import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { FilesetResolver, HandLandmarker } from "@mediapipe/tasks-vision";

const HAND_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20],
  [0, 17]
];

export default function Lesson() {
  const { id } = useParams();
  const navigate = useNavigate();

  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  const [cameraOn, setCameraOn] = useState(false);
  const [handCount, setHandCount] = useState(0); // นับจำนวนมือที่เจอ (0, 1, 2)
  const [prediction, setPrediction] = useState("");
  const [confidence, setConfidence] = useState(0);

  const lastPredictTime = useRef(0);
  const isMounted = useRef(true);

  // ==========================================
  // 🎯 ส่งข้อมูล Landmarks (ทั้งสองมือ) ไปที่ AI
  // ==========================================
  async function predictSign(allHandData, allWorldHandData) {
    try {
      // 🟢 ดึง JWT Token มาใช้ยืนยันตัวตน
      const token = localStorage.getItem("token");

      const response = await fetch("http://localhost:8000/predict", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          ...(token && { Authorization: `Bearer ${token}` })
        },
        body: JSON.stringify({
          lesson_id: id,
          hand_landmarks: allHandData,
          world_landmarks: allWorldHandData,
        }),
      });

      if (!response.ok) return;

      const result = await response.json();
      if (isMounted.current) {
        setPrediction(result.word);
        setConfidence(result.confidence);
      }
    } catch (error) {
      console.log("Predict API ไม่พร้อมตอบรับ");
    }
  }

  useEffect(() => {
    isMounted.current = true;
    let handLandmarker;
    let animationId;
    let currentHandCount = 0;

    async function setupMediaPipe() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
        );

        handLandmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
            delegate: "GPU",
          },
          runningMode: "VIDEO",
          numHands: 2,
        });

        if (isMounted.current) setCameraOn(true);

        function detectHands() {
          if (
            videoRef.current &&
            videoRef.current.readyState === 4 &&
            canvasRef.current
          ) {
            const results = handLandmarker.detectForVideo(
              videoRef.current,
              Date.now()
            );

            const canvas = canvasRef.current;
            const ctx = canvas.getContext("2d");

            if (videoRef.current.videoWidth > 0) {
              canvas.width = videoRef.current.videoWidth;
              canvas.height = videoRef.current.videoHeight;
            }

            ctx.clearRect(0, 0, canvas.width, canvas.height);

            const detectedNum = results.landmarks ? results.landmarks.length : 0;

            if (detectedNum !== currentHandCount) {
              currentHandCount = detectedNum;
              if (isMounted.current) setHandCount(detectedNum);
            }

            if (detectedNum > 0) {
              const allHandData = [];
              const allWorldHandData = [];

              results.landmarks.forEach((landmarks, index) => {
                const worldLandmarks = results.worldLandmarks?.[index] || [];

                landmarks.forEach((p) => allHandData.push(p.x, p.y, p.z));
                worldLandmarks.forEach((p) => allWorldHandData.push(p.x, p.y, p.z));

                // 🟢 วาดเส้น Skeleton (ใช้สีเขียวสด)
                HAND_CONNECTIONS.forEach(([start, end]) => {
                  const p1 = landmarks[start];
                  const p2 = landmarks[end];
                  ctx.beginPath();
                  ctx.moveTo(p1.x * canvas.width, p1.y * canvas.height);
                  ctx.lineTo(p2.x * canvas.width, p2.y * canvas.height);
                  ctx.strokeStyle = "#00FF00";
                  ctx.lineWidth = 4;
                  ctx.stroke();
                });

                // 🔴 วาดจุด Joint 21 จุด
                landmarks.forEach((p) => {
                  ctx.beginPath();
                  ctx.arc(p.x * canvas.width, p.y * canvas.height, 6, 0, 2 * Math.PI);
                  ctx.fillStyle = "#FF007F";
                  ctx.fill();
                  ctx.strokeStyle = "#FFFFFF";
                  ctx.lineWidth = 1.5;
                  ctx.stroke();
                });
              });

              // Throttle ยิง API ทุกๆ 500ms
              const now = Date.now();
              if (now - lastPredictTime.current > 500) {
                lastPredictTime.current = now;
                predictSign(allHandData, allWorldHandData);
              }

            } else {
              if (isMounted.current && (prediction !== "" || confidence !== 0)) {
                setPrediction("");
                setConfidence(0);
              }
            }
          }
          animationId = requestAnimationFrame(detectHands);
        }

        detectHands();
      } catch (err) {
        console.error("MediaPipe/Camera Error:", err);
      }
    }

    setupMediaPipe();

    return () => {
      isMounted.current = false;
      if (animationId) cancelAnimationFrame(animationId);
      if (videoRef.current?.srcObject) {
        videoRef.current.srcObject.getTracks().forEach((track) => track.stop());
      }
      // 🟢 คืนค่า Resource เมื่อออกจากหน้า
      if (handLandmarker) {
        handLandmarker.close();
      }
    };
  }, []);

  return (
    <div className="min-h-screen bg-slate-100 p-8">
      <button
        onClick={() => navigate(-1)}
        className="bg-gray-600 text-white px-5 py-2 rounded-xl mb-6 hover:bg-gray-700 transition"
      >
        ← กลับ
      </button>

      <h1 className="text-3xl font-bold">บทเรียนภาษามือ</h1>
      <p className="text-gray-600 mt-1">Lesson ID: {id}</p>

      {/* กล้อง Video + Canvas Skeleton */}
      <div className="relative max-w-2xl mt-6 rounded-2xl overflow-hidden shadow-2xl bg-black">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          className="w-full h-full object-cover"
          style={{ transform: "scaleX(-1)" }}
        />
        <canvas
          ref={canvasRef}
          className="absolute top-0 left-0 w-full h-full pointer-events-none z-10"
          style={{ transform: "scaleX(-1)" }}
        />
      </div>

      {/* สถานะการตรวจจับ */}
      <div className="mt-4 flex gap-3">
        <span className={`px-4 py-1.5 rounded-full font-bold text-sm ${cameraOn ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
          {cameraOn ? "🟢 กล้องทำงาน" : "🔴 ปิดกล้อง"}
        </span>
        <span className={`px-4 py-1.5 rounded-full font-bold text-sm ${handCount > 0 ? "bg-blue-100 text-blue-700" : "bg-gray-200 text-gray-600"}`}>
          {handCount === 2 ? "🤟🤟 ตรวจพบ 2 มือ" : handCount === 1 ? "🤟 ตรวจพบ 1 มือ" : "🔍 ไม่พบมือ"}
        </span>
      </div>

      {/* ผลการประเมิน */}
      {prediction && (
        <div className="mt-6 max-w-md bg-white p-6 rounded-2xl shadow-md border-l-4 border-blue-500">
          <h2 className="text-gray-500 text-sm font-semibold">ผลการประเมินท่าทาง</h2>
          <p className="text-4xl font-extrabold text-blue-600 mt-1">{prediction}</p>
          <p className="text-gray-600 mt-2">
            ความแม่นยำ: <span className="font-bold text-slate-800">{(confidence * 100).toFixed(0)}%</span>
          </p>
        </div>
      )}
    </div>
  );
}