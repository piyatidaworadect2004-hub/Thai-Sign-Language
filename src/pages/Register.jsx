import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";

function getPasswordStrength(pw) {
    let score = 0;
    if (pw.length >= 8) score++;
    if (/[0-9]/.test(pw)) score++;
    if (/[a-zA-Z]/.test(pw)) score++;
    if (/[A-Z]/.test(pw) || /[^a-zA-Z0-9]/.test(pw)) score++;
    return score; // 0-4
}

const STRENGTH_COLOR = ["bg-gray-200", "bg-red-400", "bg-orange-400", "bg-yellow-400", "bg-green-500"];

export default function Register() {
    const navigate = useNavigate();

    const [username, setUsername] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [agreeTerms, setAgreeTerms] = useState(false);

    const strength = getPasswordStrength(password);

    const handleRegister = async (e) => {
        e.preventDefault();

        if (password !== confirmPassword) {
            alert("รหัสผ่านและการยืนยันรหัสผ่านไม่ตรงกัน");
            return;
        }

        if (!agreeTerms) {
            alert("กรุณายอมรับข้อกำหนดการใช้งานและนโยบายความเป็นส่วนตัวก่อนสมัครสมาชิก");
            return;
        }

        try {
            const response = await fetch("http://localhost:8000/auth/register", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username, email, password }),
            });

            const data = await response.json();

            if (response.ok) {
                alert("สมัครสมาชิกสำเร็จ!");
                navigate("/login");
            } else {
                alert(data.detail || "เกิดข้อผิดพลาดในการสมัครสมาชิก");
            }
        } catch (err) {
            console.error(err);
            alert("ไม่สามารถเชื่อมต่อกับ Server ได้: " + err.message);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-sky-50 via-blue-50 to-indigo-100 flex items-center justify-center p-4">
            <div className="w-full max-w-4xl bg-white rounded-3xl shadow-xl overflow-hidden grid md:grid-cols-2">
                {/* แผงซ้าย: แบรนด์ดิ้ง */}
                <div className="bg-gradient-to-br from-blue-600 to-indigo-700 text-white p-8 sm:p-10 flex flex-col justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center text-lg">
                            🤟
                        </div>
                        <span className="font-bold text-lg">Thai Sign Learning</span>
                    </div>

                    <div className="py-10">
                        <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center text-2xl mb-6">
                            🤟
                        </div>
                        <h2 className="text-2xl font-bold leading-snug mb-3">
                            เริ่มต้นเรียนภาษามือไทยวันนี้
                        </h2>
                        <p className="text-blue-100/80 text-sm leading-relaxed">
                            สร้างบัญชีฟรี เพื่อบันทึกความคืบหน้า ปลดล็อกบทเรียน และฝึกกับระบบตรวจจับท่ามือด้วย AI
                        </p>
                    </div>

                    <p className="text-xs text-blue-100/60">© {new Date().getFullYear()} Thai Sign Learning</p>
                </div>

                {/* แผงขวา: ฟอร์มสมัครสมาชิก */}
                <div className="bg-white p-8 sm:p-10 flex flex-col justify-center">
                    <h1 className="text-2xl font-bold text-gray-800">สมัครสมาชิก</h1>
                    <p className="text-sm text-gray-500 mt-1 mb-6">กรอกข้อมูลเพื่อสร้างบัญชีใหม่</p>

                    <form onSubmit={handleRegister} className="space-y-4">
                        <div>
                            <label className="text-sm font-semibold text-gray-700">ชื่อผู้ใช้ (Username)</label>
                            <input
                                type="text"
                                placeholder="ชื่อของคุณ"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                required
                                className="w-full mt-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-400"
                            />
                        </div>

                        <div>
                            <label className="text-sm font-semibold text-gray-700">อีเมล</label>
                            <input
                                type="email"
                                placeholder="you@example.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                className="w-full mt-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-400"
                            />
                        </div>

                        <div>
                            <label className="text-sm font-semibold text-gray-700">รหัสผ่าน</label>
                            <div className="relative mt-1">
                                <input
                                    type={showPassword ? "text" : "password"}
                                    placeholder="อย่างน้อย 8 ตัวอักษร"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 pr-11 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-400"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword((v) => !v)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                >
                                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>

                            {password && (
                                <div className="flex gap-1 mt-2">
                                    {[1, 2, 3, 4].map((i) => (
                                        <div
                                            key={i}
                                            className={`h-1.5 flex-1 rounded-full ${
                                                i <= strength ? STRENGTH_COLOR[strength] : "bg-gray-200"
                                            }`}
                                        />
                                    ))}
                                </div>
                            )}
                            <p className="text-xs text-gray-400 mt-1">
                                ควรมีอย่างน้อย 8 ตัวอักษร ผสมตัวเลขและอักษร
                            </p>
                        </div>

                        <div>
                            <label className="text-sm font-semibold text-gray-700">ยืนยันรหัสผ่าน</label>
                            <input
                                type={showPassword ? "text" : "password"}
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                required
                                className={`w-full mt-1 bg-gray-50 border rounded-xl px-4 py-3 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-400 ${
                                    confirmPassword && confirmPassword !== password
                                        ? "border-red-300"
                                        : "border-gray-200"
                                }`}
                            />
                            {confirmPassword && confirmPassword !== password && (
                                <p className="text-xs text-red-500 mt-1">รหัสผ่านไม่ตรงกัน</p>
                            )}
                        </div>

                        <label className="flex items-start gap-2 text-sm text-gray-600 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={agreeTerms}
                                onChange={(e) => setAgreeTerms(e.target.checked)}
                                required
                                className="mt-0.5 rounded accent-blue-600"
                            />
                            <span>
                                ฉันยอมรับ{" "}
                                <span className="text-blue-600 font-medium">ข้อกำหนดการใช้งาน</span> และ{" "}
                                <span className="text-blue-600 font-medium">นโยบายความเป็นส่วนตัว</span>
                            </span>
                        </label>

                        <button
                            type="submit"
                            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:opacity-90 text-white font-semibold py-3 rounded-xl transition"
                        >
                            สร้างบัญชี
                        </button>
                    </form>

                    <div className="flex items-center gap-3 my-5">
                        <div className="flex-1 h-px bg-gray-200" />
                        <span className="text-xs text-gray-400">หรือ</span>
                        <div className="flex-1 h-px bg-gray-200" />
                    </div>

                    <button
                        type="button"
                        onClick={() => navigate("/login")}
                        className="w-full border border-gray-200 rounded-xl py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
                    >
                        มีบัญชีอยู่แล้ว? เข้าสู่ระบบ
                    </button>
                </div>
            </div>
        </div>
    );
}
