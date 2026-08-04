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

export default function Practice() {
    const { id } = useParams();
    const navigate = useNavigate();

    const videoRef = useRef(null);
    const canvasRef = useRef(null);

    const [cameraOn, setCameraOn] = useState(false);
    const [handDetected, setHandDetected] = useState(false);

    const [prediction, setPrediction] = useState("");
    const [confidence, setConfidence] = useState(0);
    const [debug, setDebug] = useState("");

    const lastPredictTime = useRef(0);
    // ใช้ Ref เพื่อเช็กว่า Component ยังอยู่ไหมก่อน setState
    const isMounted = useRef(true); 

    // ==========================
    // ส่งข้อมูลไป AI พร้อมแนบ Token ยืนยันตัวตน
    // ==========================
    async function predictSign(handData, worldHandData) {
        try {
            const token = localStorage.getItem("token"); // ดึง Token ของผู้ใช้ที่ล็อกอินอยู่
            const response = await fetch("http://localhost:8000/predict", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...(token && { Authorization: `Bearer ${token}` }) // แนบ Token ไปด้วย
                },
                body: JSON.stringify({
                    lesson_id: id,
                    hand_landmarks: handData,
                    world_landmarks: worldHandData
                })
            });

            if (!response.ok) return;

            const result = await response.json();

            if (isMounted.current) {
                setPrediction(result.word);
                setConfidence(result.confidence);
            }
        } catch (error) {
            console.log("Predict API ยังไม่พร้อม");
        }
    }

    useEffect(() => {
        isMounted.current = true;
        let handLandmarker;
        let animationId;
        let localHandDetected = false; // ตัวแปรคุม Local State ไม่ให้สั่ง React Re-render ทุกเฟรม

        async function setup() {
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
                    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm"
                );

                handLandmarker = await HandLandmarker.createFromOptions(
                    vision,
                    {
                        baseOptions: {
                            modelAssetPath: "/models/hand_landmarker.task",
                        },
                        runningMode: "VIDEO",
                        numHands: 1,
                    }
                );

                console.log("MediaPipe Ready");
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

                        canvas.width = videoRef.current.videoWidth;
                        canvas.height = videoRef.current.videoHeight;

                        ctx.clearRect(0, 0, canvas.width, canvas.height);

                        if (results.landmarks && results.landmarks.length > 0) {
                            if (!localHandDetected) {
                                localHandDetected = true;
                                if (isMounted.current) setHandDetected(true);
                            }

                            const landmarks = results.landmarks[0];
                            const worldLandmarks = results.worldLandmarks?.[0] || [];

                            const handData = [];
                            const worldHandData = [];

                            // Landmarks (Normalized)
                            landmarks.forEach((point) => {
                                handData.push(point.x, point.y, point.z);
                            });

                            // World Landmarks (3D)
                            worldLandmarks.forEach((point) => {
                                worldHandData.push(point.x, point.y, point.z);
                            });

                            // Throttle การยิง API ทุกๆ 500ms
                            const now = Date.now();
                            if (now - lastPredictTime.current > 500) {
                                lastPredictTime.current = now;
                                predictSign(handData, worldHandData);
                            }

                            // 🟢 1. วาดเส้นเชื่อมต่อ (Skeleton Lines)
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

                            // 🔴 2. วาดจุด Joint (21 จุด)
                            landmarks.forEach((point) => {
                                ctx.beginPath();
                                ctx.arc(
                                    point.x * canvas.width,
                                    point.y * canvas.height,
                                    6,
                                    0,
                                    2 * Math.PI
                                );
                                ctx.fillStyle = "#FF007F";
                                ctx.fill();
                                ctx.strokeStyle = "#FFFFFF";
                                ctx.lineWidth = 1.5;
                                ctx.stroke();
                            });

                        } else {
                            if (localHandDetected) {
                                localHandDetected = false;
                                if (isMounted.current) {
                                    setHandDetected(false);
                                    setPrediction("");
                                    setConfidence(0);
                                    setDebug("");
                                }
                            }
                        }
                    }

                    animationId = requestAnimationFrame(detectHands);
                }

                detectHands();

            } catch (error) {
                console.error("MediaPipe/Camera Error:", error);
            }
        }

        setup();

        return () => {
            isMounted.current = false;
            if (animationId) cancelAnimationFrame(animationId);
            if (videoRef.current?.srcObject) {
                videoRef.current.srcObject
                    .getTracks()
                    .forEach(track => track.stop());
            }
        };

    }, []);

    return (
        <div className="min-h-screen bg-sky-100 p-8">
            <button
                onClick={() => navigate(-1)}
                className="bg-gray-500 text-white px-5 py-2 rounded-xl mb-8 hover:bg-gray-600 transition"
            >
                ← กลับ
            </button>

            <h1 className="text-4xl font-bold">ฝึกท่าทางภาษามือ</h1>

            <p className="text-xl mt-4">สวัสดี ID : {id}</p>

            <a
                href="https://dic.ttrs.or.th/video/view/61c5797966b04b724e244611"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 mt-4 bg-blue-500 text-white px-5 py-2 rounded-xl hover:bg-blue-600 transition"
            >
                ดูตัวอย่างท่าภาษามือจาก TTRS
            </a>

            {/* 🟢 วิดีโอและ Canvas พร้อมสไตล์ Mirror */}
            <div className="relative max-w-3xl mt-8 overflow-hidden rounded-3xl border-4 border-white shadow-xl bg-black">
                <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    className="w-full h-full object-cover"
                    style={{ transform: "scaleX(-1)" }}
                />

                <canvas
                    ref={canvasRef}
                    className="absolute top-0 left-0 w-full h-full pointer-events-none"
                    style={{ transform: "scaleX(-1)" }}
                />
            </div>

            {cameraOn && (
                <p className="mt-5 text-green-600 font-bold"> กล้องทำงาน</p>
            )}

            {handDetected && (
                <p className="mt-2 text-blue-600 font-bold">ตรวจพบมือ</p>
            )}

            {debug && (
                <p className="mt-2 text-purple-600 font-bold">{debug}</p>
            )}

            {prediction && (
                <div className="mt-6 max-w-md bg-white rounded-2xl shadow-lg p-6 border-2 border-blue-400">
                    <h2 className="text-2xl font-bold mb-3">ผลการตรวจจับ</h2>
                    <p className="text-4xl font-bold text-blue-600">{prediction}</p>
                    <p className="mt-2 text-lg">
                        ค่าความมั่นใจ : {(confidence * 100).toFixed(2)}%
                    </p>
                </div>
            )}
        </div>
    );
}