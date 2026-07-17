import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";

import {
    FilesetResolver,
    HandLandmarker,
} from "@mediapipe/tasks-vision";

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

    // ==========================
    // ส่งข้อมูลไป AI
    // ==========================

    async function predictSign(handData, worldHandData) {
        try {

            const response = await fetch("http://localhost:8000/auth/register", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    username: username,
                    email: email,
                    password: password,
                    full_name: username,
                    role: "user"
                })
            });

            if (!response.ok) return;

            const result = await response.json();

            setPrediction(result.word);
            setConfidence(result.confidence);

        } catch (error) {

            console.log("Predict API ยังไม่พร้อม");

        }

    }

    useEffect(() => {

        let handLandmarker;
        let animationId;

        async function setup() {

            try {

                const stream = await navigator.mediaDevices.getUserMedia({
                    video: true,
                    audio: false,
                });

                videoRef.current.srcObject = stream;

                await videoRef.current.play();

                const vision =
                    await FilesetResolver.forVisionTasks(
                        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm"
                    );

                handLandmarker =
                    await HandLandmarker.createFromOptions(
                        vision,
                        {
                            baseOptions: {
                                modelAssetPath:
                                    "/models/hand_landmarker.task",
                            },
                            runningMode: "VIDEO",
                            numHands: 1,
                        }
                    );

                console.log("MediaPipe Ready");

                setCameraOn(true);

                function detectHands() {

                    if (
                        videoRef.current &&
                        videoRef.current.readyState === 4
                    ) {

                        const results =
                            handLandmarker.detectForVideo(
                                videoRef.current,
                                Date.now()
                            );

                        console.log(results);
                        console.log("Landmarks:", results.landmarks);
                        console.log("WorldLandmarks:", results.worldLandmarks);

                        const canvas = canvasRef.current;
                        const ctx = canvas.getContext("2d");

                        canvas.width = videoRef.current.videoWidth;
                        canvas.height = videoRef.current.videoHeight;

                        ctx.clearRect(
                            0,
                            0,
                            canvas.width,
                            canvas.height
                        );

                        if (
                            results.landmarks &&
                            results.landmarks.length > 0
                        ) {

                            setHandDetected(true);
                            const landmarks = results.landmarks[0];

                            const worldLandmarks =
                                results.worldLandmarks &&
                                    results.worldLandmarks.length > 0
                                    ? results.worldLandmarks[0]
                                    : [];

                            const handData = [];
                            const worldHandData = [];

                            // Landmarks (Normalized)
                            landmarks.forEach((point) => {
                                handData.push(point.x);
                                handData.push(point.y);
                                handData.push(point.z);
                            });

                            // World Landmarks (3D)
                            worldLandmarks.forEach((point) => {
                                worldHandData.push(point.x);
                                worldHandData.push(point.y);
                                worldHandData.push(point.z);
                            });

                            // Debug
                            if (worldLandmarks.length > 0) {
                                setDebug("✅ พบ World Landmarks");
                            } else {
                                setDebug("❌ ไม่พบ World Landmarks");
                            }

                            const now = Date.now();

                            if (
                                now - lastPredictTime.current > 500
                            ) {

                                lastPredictTime.current = now;

                                predictSign(handData, worldHandData);

                            }

                            HAND_CONNECTIONS.forEach(
                                ([start, end]) => {

                                    const p1 = landmarks[start];
                                    const p2 = landmarks[end];

                                    ctx.beginPath();

                                    ctx.moveTo(
                                        p1.x * canvas.width,
                                        p1.y * canvas.height
                                    );

                                    ctx.lineTo(
                                        p2.x * canvas.width,
                                        p2.y * canvas.height
                                    );

                                    ctx.strokeStyle = "red";
                                    ctx.lineWidth = 3;
                                    ctx.stroke();

                                }
                            );

                            landmarks.forEach((point) => {

                                ctx.beginPath();

                                ctx.arc(
                                    point.x * canvas.width,
                                    point.y * canvas.height,
                                    5,
                                    0,
                                    2 * Math.PI
                                );

                                ctx.fillStyle = "red";

                                ctx.fill();

                            });

                        } else {

                            setHandDetected(false);
                            setPrediction("");
                            setConfidence(0);
                            setDebug("");

                        }

                    }

                    animationId =
                        requestAnimationFrame(detectHands);

                }

                detectHands();

            } catch (error) {

                console.error(error);

            }

        }

        setup();

        return () => {

            cancelAnimationFrame(animationId);

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
                className="bg-gray-500 text-white px-5 py-2 rounded-xl mb-8"
            >
                ← กลับ
            </button>

            <h1 className="text-4xl font-bold">
                ฝึกท่าทางภาษามือ
            </h1>

            <p className="text-xl mt-4">
                สวัสดี ID : {id}

            </p>

            <a
                href="https://dic.ttrs.or.th/video/view/61c5797966b04b724e244611"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 mt-4 bg-blue-500 text-white px-5 py-2 rounded-xl hover:bg-blue-600 transition"
            >
                ดูตัวอย่างท่าจาก TTRS
            </a>


            <div className="relative max-w-3xl mt-8">

                <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    className="rounded-3xl w-full"
                />

                <canvas
                    ref={canvasRef}
                    className="absolute top-0 left-0 w-full h-full"
                />

            </div>

            {cameraOn && (
                <p className="mt-5 text-green-600 font-bold">
                    🟢 กล้องทำงาน
                </p>
            )}

            {handDetected && (
                <p className="mt-2 text-blue-600 font-bold">
                    🤟 ตรวจพบมือ
                </p>
            )}

            {debug && (
                <p className="mt-2 text-purple-600 font-bold">
                    {debug}
                </p>
            )}

            {prediction && (

                <div className="mt-6 max-w-md bg-white rounded-2xl shadow-lg p-6">

                    <h2 className="text-2xl font-bold mb-3">
                        ผลการตรวจจับ
                    </h2>

                    <p className="text-4xl font-bold text-blue-600">
                        {prediction}
                    </p>

                    <p className="mt-2 text-lg">
                        ค่าความมั่นใจ : {(confidence * 100).toFixed(2)}%
                    </p>

                </div>

            )}

        </div>

    );

}