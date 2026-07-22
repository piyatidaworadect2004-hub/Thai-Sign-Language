import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";

export default function Lesson() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [words, setWords] = useState([]);
  const [loading, setLoading] = useState(true);

  const [selectedWord, setSelectedWord] = useState(null);
  const [isCameraActive, setIsCameraActive] = useState(false);

  const [accuracy, setAccuracy] = useState(0);
  const [detectedText, setDetectedText] = useState("ปิดกล้องอยู่จ้า");

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const wsRef = useRef(null); 
  const intervalRef = useRef(null); 
  
  // 📸 [แก้จุดที่ 1] เพิ่มการประกาศตัวจับ Element Canvas สำหรับวาดจุด
  const canvasRef = useRef(null);

  useEffect(() => {
    fetch(`http://127.0.0.1:8000/categories/${id}/words`)
      .then((res) => {
        if (!res.ok) throw new Error("API Error");
        return res.json();
      })
      .then((data) => {
        setWords(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Fetch error:", err);
        setLoading(false);
      });
  }, [id]);

  useEffect(() => {
    async function startCameraAndWS() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480 }, 
          audio: false,
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          streamRef.current = stream;
        }

        wsRef.current = new WebSocket("ws://127.0.0.1:8000/ws/stream");

        wsRef.current.onopen = () => {
          console.log("🔌 WebSocket เชื่อมต่อสำเร็จแล้ว");
          setDetectedText("กำลังรอสัญญาณมือ...");
          startSendingFrames();
        };

        wsRef.current.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            setAccuracy(data.accuracy || 0);
            setDetectedText(data.detected || "ไม่พบท่าทาง");

            // 🎨 [แก้จุดที่ 2] สั่งวาดจุดเมื่อมีข้อมูลพิกัดส่งมาจากหลังบ้าน
            if (data.landmarks && canvasRef.current) {
              drawHandLandmarks(data.landmarks);
            } else {
              clearCanvas();
            }
          } catch (e) {
            console.error("Error parsing WS data", e);
          }
        };

        // 🛠️ แก้ไขตรงนี้: เปลี่ยนจาก print() เป็น console.log() เพื่อไม่ให้หน้าต่างพิมพ์งานเด้งขึ้นมา
        wsRef.current.onclose = () => {
          console.log("❌ ปิดการเชื่อมต่อ WebSocket");
        };

      } catch (err) {
        console.error("พังพินาศ:", err);
        alert("เปิดกล้องหรือเชื่อมต่อ Server ไม่สำเร็จ");
        setIsCameraActive(false);
      }
    }

    function startSendingFrames() {
      const canvas = document.createElement("canvas");
      canvas.width = 320; 
      canvas.height = 240;
      const ctx = canvas.getContext("2d");

      intervalRef.current = setInterval(() => {
        if (videoRef.current && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
          const base64Image = canvas.toDataURL("image/jpeg", 0.6); 
          
          const payload = {
            image: base64Image,
            word: selectedWord?.word || ""
          };
          
          wsRef.current.send(JSON.stringify(payload));
        }
      }, 100);
    }

    function stopEverything() {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      clearCanvas();
      setAccuracy(0);
      setDetectedText("กล้องกำลังปิด");
    }

    if (isCameraActive) {
      startCameraAndWS();
    } else {
      stopEverything();
    }

    return () => stopEverything();
  }, [isCameraActive, selectedWord]);

  // 🎨 [แก้จุดที่ 3] เพิ่มฟังก์ชันสำหรับคำนวณและวาดจุดพร้อมเส้นโครงกระดูกลงคอมโพเนนต์
  const drawHandLandmarks = (landmarks) => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    const ctx = canvas.getContext("2d");
    const displayWidth = video.clientWidth;
    const displayHeight = video.clientHeight;

    if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
      canvas.width = displayWidth;
      canvas.height = displayHeight;
    }
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    ctx.fillStyle = "#FF3366";   
    ctx.strokeStyle = "#FFFF00"; 
    ctx.lineWidth = 2.5;

    // 1. วาดจุดเชื่อมโยง (Landmarks) ทั้ง 21 จุดร่วมกับการแก้บั๊กกลับด้าน (Mirror)
    landmarks.forEach((lm) => {
      const x = (1 - lm.x) * canvas.width; 
      const y = lm.y * canvas.height;

      ctx.beginPath();
      ctx.arc(x, y, 5, 0, 2 * Math.PI); 
      ctx.fill();
    });

    // 2. วาดเส้นเชื่อมโยงนิ้วมือ
    const HAND_CONNECTIONS = [
      [0,1], [1,2], [2,3], [3,4],      
      [0,5], [5,6], [6,7], [7,8],      
      [5,9], [9,10], [10,11], [11,12],  
      [9,13], [13,14], [14,15], [15,16],
      [13,17], [17,18], [18,19], [19,20],
      [0,17] 
    ];

    HAND_CONNECTIONS.forEach(([start, end]) => {
      const pt1 = landmarks[start];
      const pt2 = landmarks[end];
      if (pt1 && pt2) {
        const x1 = (1 - pt1.x) * canvas.width;
        const y1 = pt1.y * canvas.height;
        const x2 = (1 - pt2.x) * canvas.width;
        const y2 = pt2.y * canvas.height;

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }
    });
  };

  const clearCanvas = () => {
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext("2d");
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
  };

  const getDifficultyStyles = (level) => {
    if (level === "ง่าย" || level === "Easy") return "bg-[#E8FFF0] text-[#5B9B6E]";
    if (level === "ปานกลาง" || level === "Medium") return "bg-[#FFF8E0] text-[#E8A870]";
    if (level === "ยาก" || level === "Hard") return "bg-[#FFE8E8] text-[#FFB0B0]";
    return "bg-[#EDE5D8] text-[#111111]";
  };

  const renderWordList = () => (
    <div className="max-w-6xl mx-auto">
      <button onClick={() => navigate("/")} className="bg-[#FAF6F0] text-[#111111] px-5 py-2.5 rounded-2xl mb-8 font-semibold shadow-sm hover:bg-[#F2EAE0]">
        ← กลับ
      </button>

      <h1 className="text-3xl font-bold mb-2 font-['Noto_Sans_Thai']">บทเรียนภาษามือ</h1>
      <p className="text-black/45 text-sm mb-8 font-medium">เลือกคำศัพท์ที่สนใจเพื่อเริ่มเปิดกล้องตรวจพิกัดท่าทาง</p>

      {loading ? (
        <p className="text-center py-12 text-black/45 animate-pulse">กำลังโหลดคำศัพท์...</p>
      ) : words.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {words.map((item) => (
            <div key={item.id} onClick={() => setSelectedWord(item)} className="bg-[#FAF6F0] rounded-[28px] p-6 cursor-pointer border border-black/5 hover:shadow-md transition-all flex flex-col justify-between relative">
              {item.difficulty && <span className={`absolute top-4 right-4 px-3 py-1 rounded-full text-[11px] font-bold ${getDifficultyStyles(item.difficulty)}`}>{item.difficulty}</span>}
              <div className="text-center py-4">
                <div className="text-6xl mb-4 select-none">{item.image}</div>
                <h2 className="text-xl font-bold font-['Noto_Sans_Thai']">{item.word}</h2>
                <p className="text-xs text-black/45 mt-2 line-clamp-2">{item.meaning}</p>
              </div>
              <button className="w-full mt-4 bg-[#EDE5D8] text-[#111111] py-2.5 rounded-xl text-xs font-bold">ฝึกท่าทาง</button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-center py-12 text-black/45">ไม่พบคำศัพท์</p>
      )}
    </div>
  );

  const renderPracticeView = () => (
    <div className="max-w-5xl mx-auto">
      <button onClick={() => { setSelectedWord(null); setIsCameraActive(false); }} className="bg-[#FAF6F0] text-[#111111] px-5 py-2.5 rounded-2xl mb-8 font-semibold shadow-sm hover:bg-[#F2EAE0]">
        ← ย้อนกลับ
      </button>

      <div className="bg-[#FAF6F0] rounded-[32px] p-8 mb-8 border border-black/5">
        <div className="flex items-center gap-4 mb-4">
          <span className="text-4xl">{selectedWord.image}</span>
          <h2 className="text-3xl font-bold font-['Noto_Sans_Thai']">คำศัพท์: {selectedWord.word}</h2>
        </div>
        <p className="text-black/50 text-sm leading-relaxed">{selectedWord.meaning}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 flex flex-col gap-4">
          <div className="bg-[#111111] rounded-[32px] aspect-[16/10] relative overflow-hidden flex items-center justify-center shadow-inner">
            <div className={`absolute inset-0 flex flex-col items-center justify-center p-6 text-center ${isCameraActive ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
              <div className="text-white/40 text-sm font-medium">🎞️ วิดีโอต้นแบบสาธิตท่าคำว่า "{selectedWord.word}"</div>
            </div>

            <video ref={videoRef} autoPlay playsInline className={`w-full h-full object-cover transform -scale-x-100 bg-slate-900 ${isCameraActive ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} />
            
            {/* 🎨 [แก้จุดที่ 4] ซ้อน Canvas ไว้เหนือแท็ก Video เพื่อวาดเส้นโครงกระดูกแบบครอบคลุมมิดชิด */}
            <canvas
              ref={canvasRef}
              className="absolute inset-0 w-full h-full object-cover pointer-events-none"
            />
          </div>

          <button onClick={() => setIsCameraActive(!isCameraActive)} className={`w-full py-4 rounded-[20px] font-bold text-center transition-all shadow-sm ${isCameraActive ? "bg-rose-100 text-rose-600 hover:bg-rose-200" : "bg-[#FAF6F0] text-[#111111] hover:bg-[#F2EAE0]"}`}>
            {isCameraActive ? "🛑 ปิดกล้องเว็บแคม" : "📷 เปิดกล้องเชื่อมระบบ AI"}
          </button>
        </div>

        <div className="bg-[#FAF6F0] rounded-[32px] p-6 border border-black/5 flex flex-col justify-between">
          <div>
            <h3 className="text-base font-bold mb-4 font-['Noto_Sans_Thai']">ผลการประเมินท่าทาง</h3>
            <div className="space-y-6">
              <div className="text-center py-4">
                <span className="text-xs font-semibold text-black/40 block mb-1">ผลลัพธ์จากโมเดล</span>
                <div className={`text-2xl font-black ${isCameraActive ? 'text-emerald-600' : 'text-gray-400'}`}>{detectedText}</div>
              </div>
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-medium">
                  <span>ความแม่นยำ</span>
                  <span className="font-bold">{accuracy}%</span>
                </div>
                <div className="w-full bg-[#EDE5D8] h-2.5 rounded-full overflow-hidden">
                  <div className="bg-emerald-500 h-full transition-all duration-150" style={{ width: `${accuracy}%` }}></div>
                </div>
              </div>
            </div>
          </div>
          <div className="text-[10px] text-black/40 border-t border-black/5 pt-4 mt-6 leading-relaxed">
            *กำลังสตรีมเฟรมสดเข้า Server ดึงจุดเชื่อมโยงโครงสร้างนิ้วมือ
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#A8C8E0] p-8 text-[#111111]">
      {!selectedWord ? renderWordList() : renderPracticeView()}
    </div>
  );
}