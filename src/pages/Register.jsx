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
    const [showPassword, setShowPassword] = useState(false);

    const strength = getPasswordStrength(password);

    const handleRegister = async (e) => {
        e.preventDefault();
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
            <div className="bg-white rounded-3xl shadow-xl p-8 w-full max-w-md">
                {/* โลโก้ */}
                <div className="flex items-center justify-center gap-2">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xl">
                        🤟
                    </div>
                    <span className="font-bold text-lg text-gray-800">Thai Sign Learning</span>
                </div>

                <h1 className="text-2xl font-bold text-center text-gray-800 mt-6">สร้างบัญชีใหม่</h1>

                {/* แท็บสลับหน้า */}
                <div className="bg-gray-100 rounded-xl p-1 flex mt-6">
                    <button
                        type="button"
                        className="flex-1 py-2 rounded-lg text-sm font-semibold bg-white shadow-sm text-gray-800"
                    >
                        สมัครสมาชิก
                    </button>
                    <button
                        type="button"
                        onClick={() => navigate("/login")}
                        className="flex-1 py-2 rounded-lg text-sm font-medium text-gray-400 hover:text-gray-600"
                    >
                        เข้าสู่ระบบ
                    </button>
                </div>

                <form onSubmit={handleRegister} className="mt-6 space-y-4">
                    <div>
                        <label className="text-sm font-semibold text-gray-700">ชื่อผู้ใช้ (Username)</label>
                        <input
                            type="text"
                            placeholder="กรุณากรอก Username..."
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
                            placeholder="example@email.com"
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

                    <button
                        type="submit"
                        className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:opacity-90 text-white font-semibold py-3 rounded-xl transition"
                    >
                        สมัครสมาชิก
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

                <p className="text-xs text-gray-400 text-center mt-4">
                    การสมัครสมาชิกถือว่าคุณยอมรับ{" "}
                    <span className="text-blue-600">ข้อกำหนดการใช้งาน</span> และ{" "}
                    <span className="text-blue-600">นโยบายความเป็นส่วนตัว</span>
                </p>
            </div>
        </div>
    );
}
