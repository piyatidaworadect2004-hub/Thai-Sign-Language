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

const TARGET_WORD = "ขอบคุณ";
const RECORD_DURATION_MS = 3000;

export default function Practice() {
    const { id } = useParams();
    const navigate = useNavigate();

    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const mediaRecorderRef = useRef(null);
    const recordedChunksRef = useRef([]);

    const [cameraOn, setCameraOn] = useState(false);
    const [handDetected, setHandDetected] = useState(false);

    const [prediction, setPrediction] = useState("");
    const [confidence, setConfidence] = useState(0);
    const [debug, setDebug] = useState("");

    const [isRecording, setIsRecording] = useState(false);
    const [isComparing, setIsComparing] = useState(false);
    const [compareResult, setCompareResult] = useState(null);
    const [compareError, setCompareError] = useState("");

    const lastPredictTime = useRef(0);
    const isMounted = useRef(true);

    async function predictSign(handData, worldHandData) {
        try {
            const token = localStorage.getItem("token");
            const response = await fetch("http://localhost:8000/predict", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...(token && { Authorization: `Bearer ${token}` })
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
                setPrediction(result.word || "");
                setConfidence(result.confidence || 0);
            }
        } catch (error) {
            console.log("Predict API ยังไม่พร้อม");
        }
    }

    function startRecordingAndCompare() {
        if (!videoRef.current?.srcObject) {
            setCompareError("กล้องยังไม่พร้อม");
            return;
        }

        setCompareResult(null);
        setCompareError("");
        recordedChunksRef.current = [];

        const stream = videoRef.current.srcObject;

        // รองรับการใช้งานบน Safari/iOS
        let mimeType = "video/webm";
        if (MediaRecorder.isTypeSupported("video/webm;codecs=vp8")) {
            mimeType = "video/webm;codecs=vp8";
        } else if (MediaRecorder.isTypeSupported("video/mp4")) {
            mimeType = "video/mp4";
        }

        try {
            const recorder = new MediaRecorder(stream, { mimeType });
            mediaRecorderRef.current = recorder;

            recorder.ondataavailable = (e) => {
                if (e.data.size > 0) recordedChunksRef.current.push(e.data);
            };

            recorder.onstop = async () => {
                if (isMounted.current) setIsRecording(false);
                const blob = new Blob(recordedChunksRef.current, { type: mimeType });
                await sendVideoForCompare(blob);
            };

            recorder.start();
            setIsRecording(true);

            setTimeout(() => {
                if (mediaRecorderRef.current?.state === "recording") {
                    mediaRecorderRef.current.stop();
                }
            }, RECORD_DURATION_MS);
        } catch (err) {
            setCompareError("เบราว์เซอร์ไม่รองรับการบันทึกวิดีโอรูปแบบนี้");
        }
    }

    async function sendVideoForCompare(blob) {
        setIsComparing(true);
        setCompareError("");

        try {
            const token = localStorage.getItem("token");
            const formData = new FormData();
            formData.append("word", TARGET_WORD);
            formData.append("lesson_id", id || "1");
            formData.append("file", blob, "practice.webm");

            const response = await fetch("http://localhost:8000/practice-compare/compare", {
                method: "POST",
                headers: {
                    ...(token && { Authorization: `Bearer ${token}` })
                },
                body: formData,
            });

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(errText || `เกิดข้อผิดพลาด (${response.status})`);
            }

            const result = await response.json();
            if (isMounted.current) setCompareResult(result);
        } catch (error) {
            console.error("Compare API error:", error);
            if (isMounted.current) setCompareError(error.message || "เกิดข้อผิดพลาดในการเปรียบเทียบ");
        } finally {
            if (isMounted.current) setIsComparing(false);
        }
    }

    useEffect(() => {
        isMounted.current = true;
        let handLandmarkerInstance = null;
        let animationId = null;
        let currentStream = null;
        let localHandDetected = false;

        async function setup() {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: true,
                    audio: false,
                });

                if (!isMounted.current) {
                    stream.getTracks().forEach(track => track.stop());
                    return;
                }

                currentStream = stream;
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                    await videoRef.current.play();
                }

                const vision = await FilesetResolver.forVisionTasks(
                    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm"
                );

                if (!isMounted.current) return;

                handLandmarkerInstance = await HandLandmarker.createFromOptions(
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
                        isMounted.current &&
                        videoRef.current &&
                        videoRef.current.readyState === 4 &&
                        canvasRef.current &&
                        handLandmarkerInstance
                    ) {
                        // แก้ไข: ใช้ performance.now() แทน Date.now()
                        const results = handLandmarkerInstance.detectForVideo(
                            videoRef.current,
                            performance.now()
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

                            landmarks.forEach((point) => {
                                handData.push(point.x, point.y, point.z);
                            });

                            worldLandmarks.forEach((point) => {
                                worldHandData.push(point.x, point.y, point.z);
                            });

                            const now = Date.now();
                            if (now - lastPredictTime.current > 500) {
                                lastPredictTime.current = now;
                                predictSign(handData, worldHandData);
                            }

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

                    if (isMounted.current) {
                        animationId = requestAnimationFrame(detectHands);
                    }
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
            if (currentStream) {
                currentStream.getTracks().forEach(track => track.stop());
            }
            if (videoRef.current?.srcObject) {
                videoRef.current.srcObject.getTracks().forEach(track => track.stop());
            }
            if (handLandmarkerInstance) {
                handLandmarkerInstance.close();
            }
        };

    }, [id]);

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
            <p className="text-lg mt-1 text-gray-600">คำที่กำลังฝึก: <span className="font-bold text-blue-600">{TARGET_WORD}</span></p>

            <a
                href="https://dic.ttrs.or.th/video/view/61c5797966b04b724e244611"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 mt-4 bg-blue-500 text-white px-5 py-2 rounded-xl hover:bg-blue-600 transition"
            >
                ดูตัวอย่างท่าภาษามือจาก TTRS
            </a>

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

                {isRecording && (
                    <div className="absolute top-4 right-4 bg-red-600 text-white px-4 py-2 rounded-full font-bold animate-pulse">
                        🔴 กำลังอัด...
                    </div>
                )}
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
                    <h2 className="text-2xl font-bold mb-3">ผลการตรวจจับ (Preview สด)</h2>
                    <p className="text-4xl font-bold text-blue-600">{prediction}</p>
                    <p className="mt-2 text-lg">
                        ค่าความมั่นใจ : {((confidence || 0) * 100).toFixed(2)}%
                    </p>
                </div>
            )}

            <div className="mt-8">
                <button
                    onClick={startRecordingAndCompare}
                    disabled={!cameraOn || isRecording || isComparing}
                    className="bg-red-500 hover:bg-red-600 disabled:bg-gray-400 text-white px-8 py-4 rounded-xl font-bold text-lg transition"
                >
                    {isRecording
                        ? "🔴 กำลังอัด..."
                        : isComparing
                        ? "⏳ กำลังตรวจสอบ..."
                        : `🎥 เริ่มบันทึกท่า (${RECORD_DURATION_MS / 1000} วินาที)`}
                </button>
            </div>

            {compareError && (
                <div className="mt-4 max-w-md bg-red-50 border-2 border-red-300 rounded-2xl p-4">
                    <p className="text-red-600 font-semibold">{compareError}</p>
                </div>
            )}

            {compareResult && (
                <div className={`mt-6 max-w-md rounded-2xl shadow-lg p-6 border-2 ${
                    compareResult.is_pass ? "bg-green-50 border-green-400" : "bg-red-50 border-red-400"
                }`}>
                    <h2 className="text-2xl font-bold mb-3">ผลการตรวจสอบท่า (เทียบกับ Ground Truth)</h2>
                    <p className={`text-4xl font-bold ${compareResult.is_pass ? "text-green-600" : "text-red-600"}`}>
                        {compareResult.is_pass ? "✅ ผ่าน" : "❌ ยังไม่ผ่าน"}
                    </p>
                    <p className="mt-2 text-lg">
                        ความแม่นยำ: {compareResult.correctness_percentage}%
                    </p>
                    <p className="mt-1 text-sm text-gray-500">
                        DTW Score: {compareResult.best_score} (threshold = {compareResult.threshold})
                    </p>
                    {compareResult.log_id && (
                        <p className="mt-1 text-sm text-gray-500">บันทึกผลแล้ว (Log ID: {compareResult.log_id})</p>
                    )}
                </div>
            )}
        </div>
    );
}