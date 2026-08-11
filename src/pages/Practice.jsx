import { useEffect, useRef, useState } from "react";
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

export default function Practice() {
    const { id } = useParams();
    const navigate = useNavigate();
    const location = useLocation();

    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const mediaRecorderRef = useRef(null);
    const recordedChunksRef = useRef([]);

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
            try {
                const response = await fetch(`http://localhost:8000/lessons/${id}`);
                if (!response.ok) return;
                const data = await response.json();
                if (!cancelled) setVideoUrl(data.video_url || null);
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
                    )

                    {
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

            <div className="max-w-6xl mx-auto p-8">
                <button
                    onClick={() => navigate(-1)}
                    className="bg-gray-500 text-white px-5 py-2 rounded-xl mb-6 hover:bg-gray-600 transition"
                >
                    ← กลับ
                </button>

                <p className="text-sm text-gray-500">สวัสดี · ID {id}</p>
                <h1 className="text-3xl font-bold text-gray-800 mt-1">ฝึกท่าทางภาษามือ</h1>
                <p className="text-lg mt-1 text-gray-600">
                    คำที่กำลังฝึก: <span className="font-bold text-blue-600">{targetWord}</span>
                </p>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
                    {/* วิดีโอตัวอย่างท่า */}
                    <div className="bg-white rounded-2xl shadow-md p-5">
                        <h2 className="text-lg font-bold text-gray-800">วิดีโอตัวอย่างท่า</h2>
                        <p className="text-sm text-gray-500 mb-3">ท่ามือสำหรับคำว่า "{targetWord}"</p>

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

                    {/* กล้องผู้ใช้ + ปุ่มควบคุม */}
                    <div className="bg-white rounded-2xl shadow-md p-5">
                        <div className="flex flex-wrap gap-3 mb-3">
                            <button
                                onClick={() => setPracticeStarted(true)}
                                disabled={practiceStarted}
                                className="border-2 border-blue-500 text-blue-600 disabled:border-gray-300 disabled:text-gray-400 px-4 py-2 rounded-xl font-bold transition hover:bg-blue-50"
                            >
                                🟡 เริ่มฝึกท่า
                            </button>
                            <button
                                onClick={startRecordingAndCompare}
                                disabled={!cameraOn || isRecording || isComparing}
                                className="bg-red-500 hover:bg-red-600 disabled:bg-gray-300 text-white px-4 py-2 rounded-xl font-bold transition"
                            >
                                {isRecording
                                    ? "🔴 กำลังอัด..."
                                    : isComparing
                                    ? "⏳ กำลังตรวจสอบ..."
                                    : `🔴 เริ่มบันทึกท่า (${RECORD_DURATION_MS / 1000} วินาที)`}
                            </button>
                        </div>

                        <div className="relative aspect-video rounded-xl overflow-hidden bg-black">
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

                        {/* min-height กันกล่องกระตุก — จองที่ไว้สำหรับสูงสุด 2 บรรทัดที่ขึ้น/หายสลับกันตอนตรวจจับมือ */}
                        <div className="mt-2 space-y-1 min-h-[3rem]">
                            {cameraOn && <p className="fade-in text-green-600 text-sm font-bold">กล้องทำงาน</p>}
                            {handDetected && <p className="fade-in text-blue-600 text-sm font-bold">ตรวจพบมือ</p>}
                            {!cameraOn && !practiceStarted && (
                                <p className="fade-in text-gray-400 text-sm">กล้องไม่ทำงาน</p>
                            )}
                        </div>

                        {/* แถบความใกล้เคียงของท่าแบบ real-time — เรนเดอร์ตลอด (ไม่ผูกกับ handDetected)
                            กันกล่องกระตุกตอนมือหลุดจากเฟรมแล้วทั้งบล็อกหาย/โผล่ ค่าจะกลับไป 0% เองเพราะ
                            confidence ถูก reset เป็น 0 อยู่แล้วตอนตรวจไม่พบมือ */}
                        <div className="mt-2">
                            <div className="flex items-center justify-between mb-1">
                                <span className="text-sm text-gray-600">ความใกล้เคียงของท่า</span>
                                <span className="text-sm font-bold text-blue-600">
                                    {Math.round(confidence * 100)}%
                                </span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                                <div
                                    className={`h-3 rounded-full transition-all duration-700 ease-out ${
                                        prediction ? "bg-green-500" : "bg-orange-400"
                                    }`}
                                    style={{ width: `${Math.round(confidence * 100)}%` }}
                                />
                            </div>
                        </div>
                    </div>

                    {/* วิธีทำท่ามือ */}
                    <div className="bg-white rounded-2xl shadow-md p-5">
                        <h2 className="text-lg font-bold text-gray-800 mb-3">วิธีทำท่ามือ</h2>
                        <ol className="space-y-2 text-sm text-gray-700 list-decimal list-inside">
                            <li>วางมือทั้งสองข้างบริเวณหน้าอก นิ้วชิดกันเล็กน้อย</li>
                            <li>ก้มศีรษะเล็กน้อยพร้อมโค้งมือลงหน้าอก 2-3 ครั้ง</li>
                            <li>ทำท่าตามตัวอย่างวิดีโอด้านซ้ายให้ช้าและชัดเจน</li>
                        </ol>
                        <p className="text-xs text-gray-400 mt-3">* เนื้อหาตัวอย่าง ยังไม่ใช่ขั้นตอนจริงของทุกคำ</p>
                    </div>

                    {/* ผลการตรวจสอบท่า */}
                    <div className="bg-white rounded-2xl shadow-md p-5">
                        <h2 className="text-lg font-bold text-gray-800 mb-1">
                            ผลการตรวจสอบท่า (เทียบกับ Ground Truth)
                        </h2>

                        {compareError && (
                            <div className="bg-red-50 border-2 border-red-300 rounded-xl p-3 mb-3">
                                <p className="text-red-600 text-sm font-semibold">{compareError}</p>
                            </div>
                        )}

                        {compareResult ? (
                            <div>
                                <p className={`text-3xl font-bold mb-2 ${
                                    compareResult.is_pass ? "text-green-600" : "text-red-600"
                                }`}>
                                    {compareResult.is_pass ? "✅ ผ่าน" : "❌ ยังไม่ผ่าน"}
                                </p>
                                <p className="text-sm">
                                    ความใกล้เคียงของท่า: {compareResult.correctness_percentage}%
                                </p>
                                <p className="text-xs text-gray-500 mt-1">
                                    DTW Score: {compareResult.best_score} (threshold = {compareResult.threshold})
                                </p>
                                {compareResult.log_id ? (
                                    <p className="text-xs text-gray-500 mt-1">
                                        บันทึกผลแล้ว (Log ID: {compareResult.log_id})
                                    </p>
                                ) : (
                                    <p className="text-xs text-orange-500 font-semibold mt-1">
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
                                    <div className="mt-4 flex flex-wrap gap-3">
                                        <button
                                            onClick={() => {
                                                setCompareResult(null);
                                                setCompareError("");
                                            }}
                                            className="border-2 border-blue-500 text-blue-600 px-4 py-2 rounded-xl font-bold transition hover:bg-blue-50"
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
                                            className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white px-4 py-2 rounded-xl font-bold transition"
                                        >
                                            ▶ ฝึกคำถัดไป
                                        </button>
                                    </div>
                                )}
                            </div>
                        ) : (
                            !handDetected && <p className="text-gray-400 text-sm">ยังไม่มีการบันทึกท่า</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}