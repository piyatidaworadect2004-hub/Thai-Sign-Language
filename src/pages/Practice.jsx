import { Fragment, useEffect, useRef, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { FilesetResolver, HandLandmarker, PoseLandmarker } from "@mediapipe/tasks-vision";
import Navbar from "../components/Navbar";
import { saveAfterPractice } from "../services/practiceService";

const HAND_CONNECTIONS = [
    [0, 1], [1, 2], [2, 3], [3, 4],
    [0, 5], [5, 6], [6, 7], [7, 8],
    [5, 9], [9, 10], [10, 11], [11, 12],
    [9, 13], [13, 14], [14, 15], [15, 16],
    [13, 17], [17, 18], [18, 19], [19, 20],
    [0, 17]
];

const RECORD_DURATION_MS = 3000;
const PREDICT_WINDOW_MS = 3000;       // เก็บ buffer ย้อนหลังกี่ ms เพื่อส่งไปเทียบ real-time
const BUFFER_PUSH_INTERVAL_MS = 100;  // ความถี่เก็บเฟรมเข้า buffer (~10fps พอสำหรับ DTW)

const STEPS = [
    { n: 1, label: "ดูตัวอย่างท่าภาษามือ" },
    { n: 2, label: "ฝึกและดูผลลัพธ์" },
];

export default function Practice() {
    const { id } = useParams();
    const navigate = useNavigate();
    const location = useLocation();

    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const mediaRecorderRef = useRef(null);
    const recordedChunksRef = useRef([]);

    const [step, setStep] = useState(1);
    const [cameraOn, setCameraOn] = useState(false);
    const [handDetected, setHandDetected] = useState(false);
    const [practiceStarted, setPracticeStarted] = useState(false);
    const [exampleVideoAvailable, setExampleVideoAvailable] = useState(true);

    const [prediction, setPrediction] = useState("");
    const [confidence, setConfidence] = useState(0);

    const [isRecording, setIsRecording] = useState(false);
    const [isComparing, setIsComparing] = useState(false);
    const [compareResult, setCompareResult] = useState(null);
    const [compareError, setCompareError] = useState("");

    const [targetWord, setTargetWord] = useState(location.state?.word || "");
    const [isActive, setIsActive] = useState(location.state?.isActive ?? null);
    const [lessonLoading, setLessonLoading] = useState(!location.state);
    const [nextLesson, setNextLesson] = useState(null);
    const [videoUrl, setVideoUrl] = useState(null);
    const [instructions, setInstructions] = useState("");
    const [dbVideoFailed, setDbVideoFailed] = useState(false);

    const lastPredictTime = useRef(0);
    const isMounted = useRef(true);
    const frameBufferRef = useRef([]);
    const lastBufferPushTime = useRef(0);

    useEffect(() => {
        if (location.state?.word) return;

        async function fetchLessonInfo() {
            try {
                const response = await fetch("http://localhost:8000/categories");
                if (!response.ok) throw new Error("โหลดข้อมูลบทเรียนไม่สำเร็จ");
                const data = await response.json();

                let found = null;
                for (const category of data) {
                    const lesson = category.lessons?.find(
                        (l) => String(l.id) === String(id)
                    );
                    if (lesson) {
                        found = lesson;
                        break;
                    }
                }

                if (found) {
                    setTargetWord(found.word || found.title || "");
                    setIsActive(found.is_active ?? found.isActive ?? false);
                } else {
                    setIsActive(false);
                }
            } catch (error) {
                console.error("โหลดข้อมูลบทเรียนล้มเหลว:", error);
                setIsActive(false);
            } finally {
                setLessonLoading(false);
            }
        }

        fetchLessonInfo();
    }, [id, location.state]);

    // หาคำถัดไปในหมวดหมู่เดียวกัน (สำหรับปุ่ม "ฝึกคำถัดไป" หลังฝึกผ่าน)
    useEffect(() => {
        let cancelled = false;

        async function fetchNextLesson() {
            try {
                const response = await fetch("http://localhost:8000/categories");
                if (!response.ok) return;
                const data = await response.json();

                for (const category of data) {
                    const lessons = category.lessons || [];
                    const index = lessons.findIndex((l) => String(l.id) === String(id));
                    if (index === -1) continue;

                    const upcoming = lessons.slice(index + 1).find((l) => l.is_active);
                    if (!cancelled) setNextLesson(upcoming || null);
                    return;
                }
                if (!cancelled) setNextLesson(null);
            } catch (error) {
                console.error("หาคำถัดไปไม่สำเร็จ:", error);
            }
        }

        fetchNextLesson();
        return () => { cancelled = true; };
    }, [id]);

    // วิดีโอตัวอย่างท่า — ใช้ video_url จาก DB เป็นหลัก (ที่มาเดียวกับหน้า Lesson.jsx)
    // ถ้าไม่มีหรือเล่นไม่ได้ ค่อย fallback ไปไฟล์ local /videos/{คำ}.mp4
    useEffect(() => {
        let cancelled = false;

        async function fetchVideoUrl() {
            setInstructions("");
            try {
                const response = await fetch(`http://localhost:8000/lessons/${id}`);
                if (!response.ok) return;
                const data = await response.json();
                if (!cancelled) {
                    setVideoUrl(data.video_url || null);
                    setInstructions(data.instructions || "");
                }
            } catch (error) {
                console.error("โหลด video_url ไม่สำเร็จ:", error);
            }
        }

        fetchVideoUrl();
        return () => { cancelled = true; };
    }, [id]);

    useEffect(() => {
        setExampleVideoAvailable(true);
    }, [targetWord]);

    useEffect(() => {
        setStep(1);
        setCompareResult(null);
        setCompareError("");
    }, [id]);

    async function predictSign(frames) {
        if (!frames.length) return;
        if (!targetWord) return;

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
                    target_word: targetWord,
                    frames,
                })
            });

            if (!response.ok) {
                const errText = await response.text();
                console.error("predict API error:", response.status, errText);
                return;
            }

            const result = await response.json();

            if (result.status === "no_ground_truth") {
                if (isMounted.current) {
                    setPrediction("");
                    setConfidence(0);
                }
                return;
            }

            if (isMounted.current) {
                setPrediction(result.word || "");
                setConfidence(result.confidence || 0);
            }
        } catch (error) {
            console.error("predict API network error:", error);
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
            const result = await saveAfterPractice({
                word: targetWord,
                lessonId: id,
                videoBlob: blob,
            });
            if (isMounted.current) setCompareResult(result);
        } catch (error) {
            console.error("Compare API error:", error);
            if (isMounted.current) setCompareError(error.message || "เกิดข้อผิดพลาดในการเปรียบเทียบ");
        } finally {
            if (isMounted.current) setIsComparing(false);
        }
    }

    useEffect(() => {
        if (lessonLoading) return;
        if (isActive === false) return;
        if (!practiceStarted) return;

        isMounted.current = true;
        let handLandmarkerInstance = null;
        let poseLandmarkerInstance = null;
        let animationId = null;
        let currentStream = null;
        let localHandDetected = false;
        frameBufferRef.current = [];

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

                // ใช้ไฟล์ WASM จาก public/wasm (คัดลอกมาจาก node_modules/@mediapipe/tasks-vision/wasm)
                // เพื่อให้เวอร์ชันตรงกับ package ที่ติดตั้งเสมอ ไม่พึ่ง CDN
                const vision = await FilesetResolver.forVisionTasks("/wasm");

                if (!isMounted.current) return;

                handLandmarkerInstance = await HandLandmarker.createFromOptions(
                    vision,
                    {
                        baseOptions: {
                            modelAssetPath: "/models/hand_landmarker.task",
                        },
                        runningMode: "VIDEO",
                        numHands: 2,
                    }
                );

                poseLandmarkerInstance = await PoseLandmarker.createFromOptions(
                    vision,
                    {
                        baseOptions: {
                            modelAssetPath: "/models/pose_landmarker.task",
                        },
                        runningMode: "VIDEO",
                        numPoses: 1,
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
                        handLandmarkerInstance &&
                        poseLandmarkerInstance
                    ) {
                        const nowMs = performance.now();
                        const results = handLandmarkerInstance.detectForVideo(
                            videoRef.current,
                            nowMs
                        );
                        const poseResults = poseLandmarkerInstance.detectForVideo(
                            videoRef.current,
                            nowMs
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

                            let handLeftWorld = null;
                            let handRightWorld = null;

                            results.landmarks.forEach((landmarks, handIndex) => {
                                const worldLandmarks = results.worldLandmarks?.[handIndex] || [];
                                const handedLabel = results.handedness?.[handIndex]?.[0]?.categoryName;
                                const worldPoints = worldLandmarks.map((p) => ({ x: p.x, y: p.y, z: p.z }));

                                if (handedLabel === "Left") {
                                    handLeftWorld = worldPoints;
                                } else if (handedLabel === "Right") {
                                    handRightWorld = worldPoints;
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
                            });

                            const poseWorldLandmarks = poseResults.worldLandmarks?.[0] || null;
                            const poseWorld = poseWorldLandmarks
                                ? poseWorldLandmarks.map((p) => ({ x: p.x, y: p.y, z: p.z }))
                                : null;

                            const now = Date.now();

                            // เก็บเฟรมเข้า buffer แบบ sliding window (เฉพาะตอนมี pose ด้วย เพราะ
                            // compute_features ฝั่ง backend ต้องใช้ pose คู่กับ hand เสมอ)
                            if (poseWorld && now - lastBufferPushTime.current > BUFFER_PUSH_INTERVAL_MS) {
                                lastBufferPushTime.current = now;
                                frameBufferRef.current.push({
                                    t: now,
                                    pose_world: poseWorld,
                                    hand_left_world: handLeftWorld,
                                    hand_right_world: handRightWorld,
                                });
                                frameBufferRef.current = frameBufferRef.current.filter(
                                    (f) => now - f.t <= PREDICT_WINDOW_MS
                                );
                            }

                            if (now - lastPredictTime.current > 500) {
                                lastPredictTime.current = now;
                                const framesToSend = frameBufferRef.current.map(
                                    ({ pose_world: pw, hand_left_world: hl, hand_right_world: hr }) => ({
                                        pose_world: pw,
                                        hand_left_world: hl,
                                        hand_right_world: hr,
                                    })
                                );
                                predictSign(framesToSend);
                            }

                        } else {
                            if (localHandDetected) {
                                localHandDetected = false;
                                if (isMounted.current) {
                                    setHandDetected(false);
                                    setPrediction("");
                                    setConfidence(0);
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
            if (poseLandmarkerInstance) {
                poseLandmarkerInstance.close();
            }
            setCameraOn(false);
            setHandDetected(false);
            setPrediction("");
            setConfidence(0);
        };

    }, [id, lessonLoading, isActive, practiceStarted]);

    if (lessonLoading) {
        return (
            <div className="min-h-screen bg-sky-100 flex items-center justify-center">
                <p className="text-xl font-bold text-blue-600">กำลังโหลดข้อมูลบทเรียน...</p>
            </div>
        );
    }

    if (isActive === false) {
        return (
            <div className="min-h-screen bg-sky-100">
                <Navbar />
                <div className="max-w-6xl mx-auto p-8">
                    <button
                        onClick={() => navigate(-1)}
                        className="bg-gray-500 text-white px-5 py-2 rounded-xl mb-8 hover:bg-gray-600 transition"
                    >
                        ← กลับ
                    </button>

                    <div className="max-w-md mx-auto bg-white rounded-3xl shadow-md p-8 text-center">
                        <p className="text-5xl mb-4">🔒</p>
                        <h1 className="text-2xl font-bold text-gray-800 mb-2">คำนี้ยังฝึกไม่ได้</h1>
                        <p className="text-gray-500">
                            ระบบยังไม่รองรับการตรวจจับท่ามือคำนี้ กรุณาเลือกคำอื่นที่พร้อมฝึกก่อน
                        </p>
                    </div>
                </div>
            </div>
        );
    }


    return (
        <div className="min-h-screen bg-sky-100">
            <Navbar />

            <div className="max-w-4xl mx-auto p-4 sm:p-8">
                <button
                    onClick={() => navigate(-1)}
                    className="bg-gray-500 text-white px-5 py-2 rounded-xl mb-6 hover:bg-gray-600 transition"
                >
                    ← กลับ
                </button>

                <p className="text-sm text-gray-500">{targetWord} · ID {id}</p>
                <h1 className="text-3xl font-bold text-gray-800 mt-1">ฝึกท่าทางภาษามือ</h1>
                <p className="text-lg mt-1 text-gray-600">
                    คำศัพท์ : <span className="font-bold text-blue-600">{targetWord}</span>
                </p>

                {/* Step indicator — ขั้นแรกชิดซ้าย ขั้นสุดท้ายชิดขวา เส้นเชื่อมยืดเต็มพื้นที่ตรงกลาง */}
                <div className="flex items-center gap-3 mt-6 mb-6">
                    {STEPS.map((s, idx) => (
                        <Fragment key={s.n}>
                            <div className="flex items-center gap-2 shrink-0">
                                <span
                                    className={`flex items-center justify-center w-7 h-7 shrink-0 rounded-full text-sm font-bold ${step > s.n
                                        ? "bg-green-100 text-green-600"
                                        : step === s.n
                                            ? "bg-blue-600 text-white"
                                            : "bg-gray-200 text-gray-500"
                                        }`}
                                >
                                    {step > s.n ? "✓" : s.n}
                                </span>
                                <span
                                    className={`text-sm font-semibold ${step === s.n ? "text-gray-800" : "text-gray-500"
                                        }`}
                                >
                                    {s.label}
                                </span>
                            </div>
                            {idx < STEPS.length - 1 && (
                                <div className={`flex-1 h-0.5 rounded ${step > s.n ? "bg-blue-600" : "bg-gray-300"}`} />
                            )}
                        </Fragment>
                    ))}
                </div>

                {/* ขั้นที่ 1: ดูตัวอย่าง */}
                <div className={step === 1 ? "max-w-2xl mx-auto space-y-6" : "hidden"}>
                    {/* วิดีโอตัวอย่างท่าภาษามือ */}
                    <div className="bg-white rounded-2xl shadow-md p-5">
                        <h2 className="text-lg font-bold text-gray-800">วิดีโอตัวอย่างท่าภาษามือ</h2>
                        <p className="text-sm text-gray-500 mb-3">ท่าภาษามือสำหรับคำว่า " {targetWord} "</p>

                        <div className="relative aspect-video rounded-xl overflow-hidden bg-black">
                            {videoUrl && !dbVideoFailed ? (
                                <video
                                    src={videoUrl}
                                    controls
                                    className="w-full h-full object-contain"
                                    onError={() => setDbVideoFailed(true)}
                                />
                            ) : exampleVideoAvailable ? (
                                <video
                                    src={`/videos/${targetWord}.mp4`}
                                    controls
                                    className="w-full h-full object-contain"
                                    onError={() => setExampleVideoAvailable(false)}
                                />
                            ) : (
                                <div className="w-full h-full flex flex-col items-center justify-center text-gray-400 text-sm gap-2">
                                    <span className="text-3xl">🎬</span>
                                    ยังไม่มีวิดีโอตัวอย่างสำหรับคำนี้
                                </div>
                            )}
                        </div>

                        <p className="text-xs text-gray-400 mt-2">
                            {(videoUrl && !dbVideoFailed) || exampleVideoAvailable
                                ? "พร้อมเล่นวิดีโอตัวอย่าง"
                                : "ยังไม่มีวิดีโอตัวอย่างสำหรับคำนี้ในระบบ"}
                        </p>
                        {videoUrl && dbVideoFailed && (
                            <a
                                href={videoUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 mt-2 text-sm text-blue-600 hover:text-blue-700 underline"
                            >
                                เล่นในหน้านี้ไม่ได้ — เปิดวิดีโอในแท็บใหม่แทน
                            </a>
                        )}
                    </div>

                    {/* วิธีฝึกท่าทางภาษามือ */}
                    <div className="bg-white rounded-3xl p-6 shadow">
                        <h3 className="font-bold text-lg mb-3">วิธีการใช้กล้องฝึกท่าทางภาษามือ</h3>
                        {instructions ? (
                            <p className="whitespace-pre-line text-gray-700 leading-8">
                                {instructions}
                            </p>
                        ) : (
                            <p className="text-sm text-gray-400">
                                1. จัดตำแหน่งให้เห็นฝ่ามือชัด มีแสงสว่างเพียงพอ <br />
                                2. กดปุ่ม "เริ่มฝึกท่าภาษามือ" เพื่อบึนทึกวิดีโอการฝึกซ้อม <br />
                                3. ระบบจะตรวจสอบความเหมือนของท่าภาษามือของผู้ใช้กับวิดีโอตัวอย่าง และแสดงผลลัพธ์ให้ทราบ
                            </p>
                        )}
                    </div>
                    <div className="flex justify-end">
                        <button
                            onClick={() => {
                                setPracticeStarted(true);
                                setStep(2);
                            }}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl font-bold transition"
                        >
                            เริ่มฝึกท่าทางภาษามือ →
                        </button>
                    </div>
                </div>

                {/* ขั้นที่ 2: ฝึกกับกล้อง + ผลลัพธ์ในหน้าเดียวกัน */}
                <div className={step === 2 ? "space-y-6" : "hidden"}>
                    <div className="bg-white rounded-2xl shadow-md p-5 sm:p-6">
                        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                            <div>
                                <h2 className="text-lg font-bold text-gray-800">ฝึกท่ากับกล้อง</h2>
                                <p className="text-sm text-gray-500">
                                    ทำท่าภาษามือคำว่า " {targetWord} " ให้เหมือนตัวอย่างมากที่สุด
                                </p>
                            </div>
                            <button
                                onClick={() => setStep(1)}
                                disabled={isRecording || isComparing}
                                className="flex items-center gap-2 bg-gray-50 hover:bg-gray-100 disabled:opacity-50 border border-gray-200 rounded-xl p-1.5 pr-3 text-sm text-gray-600 transition"
                            >
                                <span className="flex items-center justify-center w-10 h-7 rounded-md bg-gray-800 text-white text-[10px]">
                                    ▶
                                </span>
                                ดูวิดีโอตัวอย่างท่าภาษามืออีกครั้ง
                            </button>
                        </div>

                        <div className="flex flex-wrap gap-2 mb-4">
                            <button
                                onClick={() => setPracticeStarted((prev) => !prev)}
                                disabled={isRecording || isComparing}
                                className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold transition disabled:opacity-50 ${practiceStarted
                                    ? "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
                                    : "bg-blue-600 text-white hover:bg-blue-700"
                                    }`}
                            >
                                <span className={`w-2 h-2 rounded-full ${practiceStarted ? "bg-gray-400" : "bg-yellow-300"}`} />
                                {practiceStarted ? "ปิดกล้อง" : "เปิดกล้อง"}
                            </button>
                        </div>

                        <div className="grid gap-6 md:grid-cols-[3fr_2fr] md:items-start">
                            {/* ซ้าย: กล้อง → ปุ่มฝึก → สถานะ */}
                            <div>
                                <div className="relative aspect-video rounded-xl overflow-hidden bg-gray-900">
                                    {practiceStarted ? (
                                        <>
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
                                        </>
                                    ) : (
                                        <div className="w-full h-full flex flex-col items-center justify-center text-gray-400 text-sm gap-2">
                                            <span className="text-3xl">📹</span>
                                            กล้องยังไม่ทำงาน — กดเปิดกล้องเพื่อเริ่มต้น
                                        </div>
                                    )}
                                </div>

                                <div className="flex justify-center mt-4">
                                    <button
                                        onClick={startRecordingAndCompare}
                                        disabled={!cameraOn || isRecording || isComparing}
                                        className="flex items-center gap-2 bg-red-50 hover:bg-red-100 border border-red-200 text-red-600 disabled:opacity-50 disabled:hover:bg-red-50 px-5 py-2.5 rounded-full text-sm font-bold transition"
                                    >
                                        <span className={`w-2 h-2 rounded-full bg-red-500 ${isRecording ? "animate-pulse" : ""}`} />
                                        {isRecording
                                            ? "กำลังอัด..."
                                            : isComparing
                                                ? "กำลังตรวจสอบ..."
                                                : "เริ่มฝึกท่าทางภาษามือ"}
                                    </button>
                                </div>

                                {/* min-height กันกล่องกระตุก — จองที่ไว้สำหรับสูงสุด 2 บรรทัดที่ขึ้น/หายสลับกันตอนตรวจจับมือ */}
                                <div className="mt-2 space-y-1 min-h-[3rem] text-center">
                                    {cameraOn && <p className="fade-in text-green-600 text-sm font-bold">กล้องทำงาน</p>}
                                    {handDetected && <p className="fade-in text-blue-600 text-sm font-bold">ตรวจพบมือ</p>}
                                    {!cameraOn && !practiceStarted && (
                                        <p className="fade-in text-gray-400 text-sm">กล้องไม่ทำงาน</p>
                                    )}
                                </div>
                            </div>

                            {/* ขวา: ผลลัพธ์หลังบันทึกท่า (แทนที่วงแหวนความใกล้เคียงเดิม) */}
                            <div className="space-y-4">
                                {compareError && (
                                    <div className="fade-in bg-red-50 border-2 border-red-300 rounded-2xl p-4">
                                        <p className="text-red-600 text-sm font-semibold">{compareError}</p>
                                    </div>
                                )}

                                {isComparing ? (
                                    <div className="fade-in border-2 border-dashed border-gray-200 rounded-2xl p-6 min-h-[16rem] flex items-center justify-center text-center text-sm text-gray-500">
                                        ⏳ กำลังเทียบท่าของคุณกับ Ground Truth...
                                    </div>
                                ) : compareResult ? (
                                    <div
                                        className={`fade-in rounded-2xl p-5 border-2 text-center ${compareResult.is_pass ? "border-green-200" : "border-red-200"
                                            }`}
                                    >
                                        <div className="flex justify-center">
                                            <ScoreRing
                                                percent={compareResult.correctness_percentage}
                                                size={110}
                                                colorClass={compareResult.is_pass ? "stroke-green-500" : "stroke-red-500"}
                                            />
                                        </div>
                                        <span
                                            className={`inline-block px-3 py-1 rounded-full text-xs font-bold mt-4 mb-2 ${compareResult.is_pass
                                                ? "bg-green-100 text-green-700"
                                                : "bg-red-100 text-red-600"
                                                }`}
                                        >
                                            {compareResult.is_pass ? "✓ ผ่านเกณฑ์แล้ว" : "✕ ยังไม่ผ่านเกณฑ์"}
                                        </span>
                                        <h3 className="text-base font-bold text-gray-800">
                                            {compareResult.is_pass
                                                ? "เยี่ยมมาก! ท่าภาษามือของคุณใกล้เคียงกับวิดีโอตัวอย่างมาก"
                                                : "ยังไม่ผ่าน ดูวิดีโอตัวอย่างแล้วบันทึกท่าภาษามืออีกครั้ง"}
                                        </h3>
                                        {/* ผ่านเมื่อ best_score <= threshold ซึ่งตามสูตรแปลง % ใน backend ตรงกับ 50% พอดี */}
                                        <p className="text-xs text-gray-500 mt-1">
                                            เกณฑ์ผ่านของคำนี้อยู่ที่ 50% ขึ้นไป
                                        </p>
                                        <p className="text-xs text-gray-400">
                                            DTW Score: {compareResult.best_score} (threshold = {compareResult.threshold})
                                        </p>

                                        <div className="border-t border-gray-100 mt-4 pt-3">
                                            {compareResult.log_id ? (
                                                <p className="text-xs text-gray-500">
                                                    บันทึกผลแล้ว (Log ID: {compareResult.log_id})
                                                </p>
                                            ) : (
                                                <p className="text-xs text-orange-500 font-semibold">
                                                    ⚠ ผลนี้ยังไม่ถูกบันทึก เนื่องจากคุณยังไม่ได้เข้าสู่ระบบ —{" "}
                                                    <button
                                                        onClick={() => navigate("/login")}
                                                        className="underline hover:text-orange-600"
                                                    >
                                                        เข้าสู่ระบบ
                                                    </button>
                                                    {" "}เพื่อบันทึกความคืบหน้า
                                                </p>
                                            )}

                                            {compareResult.is_pass && (
                                                <div className="mt-4 flex flex-wrap justify-center gap-2">
                                                    <button
                                                        onClick={() => {
                                                            setCompareResult(null);
                                                            setCompareError("");
                                                        }}
                                                        className="border-2 border-blue-500 text-blue-600 px-4 py-2 rounded-xl text-sm font-bold transition hover:bg-blue-50"
                                                    >
                                                        🔁 ฝึกคำนี้อีกครั้ง
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            if (!nextLesson) return;
                                                            navigate(`/practice/${nextLesson.id}`, {
                                                                state: {
                                                                    word: nextLesson.word || nextLesson.title,
                                                                    isActive: true,
                                                                },
                                                            });
                                                        }}
                                                        disabled={!nextLesson}
                                                        title={!nextLesson ? "ยังไม่มีคำถัดไปในหมวดนี้" : undefined}
                                                        className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white px-4 py-2 rounded-xl text-sm font-bold transition"
                                                    >
                                                        ▶ ฝึกคำถัดไป
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="border-2 border-dashed border-gray-200 rounded-2xl p-6 min-h-[16rem] flex flex-col items-center justify-center text-center gap-2 text-gray-400">
                                        <span className="text-3xl">📊</span>
                                        <p className="text-sm font-semibold text-gray-500">ผลลัพธ์</p>
                                        <p className="text-xs">ผลลัพธ์จะแสดงที่นี่หลังกด "เริ่มฝึกท่าทาง"</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function ScoreRing({ percent, size = 120, stroke = 10, colorClass }) {
    const radius = (size - stroke) / 2;
    const circumference = 2 * Math.PI * radius;
    const clamped = Math.max(0, Math.min(100, Number(percent) || 0));

    return (
        <div className="relative shrink-0" style={{ width: size, height: size }}>
            <svg width={size} height={size} className="-rotate-90">
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    strokeWidth={stroke}
                    className="stroke-gray-200"
                />
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    strokeWidth={stroke}
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={circumference * (1 - clamped / 100)}
                    className={`${colorClass} transition-all duration-700 ease-out`}
                />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-2xl font-bold text-gray-800">
                {Math.round(clamped)}%
            </span>
        </div>
    );
}