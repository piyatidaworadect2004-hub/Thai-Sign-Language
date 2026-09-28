import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';

export default function Login() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [rememberMe, setRememberMe] = useState(true);
    const navigate = useNavigate();

    const handleLogin = async (e) => {
        e.preventDefault();

        try {
            const response = await fetch('http://127.0.0.1:8000/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username, password }),
            });

            const data = await response.json();

            if (response.ok) {
                localStorage.setItem('token', data.access_token);
                localStorage.setItem('username', data.username);
                localStorage.setItem('role', data.role);
                window.location.href = '/home';
            } else {
                alert(data.detail || 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
            }
        } catch (error) {
            console.error('Fetch Error:', error);
            alert('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้');
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
                            เรียนรู้ภาษามือไทยได้ทุกที่ทุกเวลา
                        </h2>
                        <p className="text-blue-100/80 text-sm leading-relaxed">
                            เข้าสู่ระบบเพื่อกลับไปฝึกคำศัพท์และติดตามความคืบหน้าการเรียนของคุณต่อ
                        </p>
                    </div>

                    <p className="text-xs text-blue-100/60">© {new Date().getFullYear()} Thai Sign Learning</p>
                </div>

                {/* แผงขวา: ฟอร์มเข้าสู่ระบบ */}
                <div className="bg-white p-8 sm:p-10 flex flex-col justify-center">
                    <h1 className="text-2xl font-bold text-gray-800">เข้าสู่ระบบ</h1>
                    <p className="text-sm text-gray-500 mt-1 mb-6">ยินดีต้อนรับกลับมา กรอกข้อมูลเพื่อเข้าใช้งาน</p>

                    <form onSubmit={handleLogin} className="space-y-4">
                        <div>
                            <label className="text-sm font-semibold text-gray-700">ชื่อผู้ใช้ (Username)</label>
                            <input
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                required
                                className="w-full mt-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-400"
                            />
                        </div>

                        <div>
                            <label className="text-sm font-semibold text-gray-700">รหัสผ่าน</label>
                            <div className="relative mt-1">
                                <input
                                    type={showPassword ? 'text' : 'password'}
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
                        </div>

                        <div className="flex items-center justify-between text-sm">
                            <label className="flex items-center gap-2 text-gray-600 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={rememberMe}
                                    onChange={(e) => setRememberMe(e.target.checked)}
                                    className="rounded accent-blue-600"
                                />
                                จดจำฉันไว้
                            </label>
                            <button type="button" className="text-blue-600 hover:underline">
                                ลืมรหัสผ่าน?
                            </button>
                        </div>

                        <button
                            type="submit"
                            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:opacity-90 text-white font-semibold py-3 rounded-xl transition"
                        >
                            เข้าสู่ระบบ
                        </button>
                    </form>

                    <div className="flex items-center gap-3 my-5">
                        <div className="flex-1 h-px bg-gray-200" />
                        <span className="text-xs text-gray-400">หรือ</span>
                        <div className="flex-1 h-px bg-gray-200" />
                    </div>

                    <button
                        type="button"
                        onClick={() => navigate('/register')}
                        className="w-full border border-gray-200 rounded-xl py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
                    >
                        ยังไม่มีบัญชี? สมัครสมาชิก
                    </button>
                </div>
            </div>
        </div>
    );
}
