import { useState } from "react";
import './Register.css';
import { useNavigate } from "react-router-dom";

export default function Register() {
    const navigate = useNavigate();

    // 1. เก็บเฉพาะ 3 ค่าที่มีช่องให้กรอกจริงบนหน้าเว็บ
    const [username, setUsername] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

    const handleRegister = async (e) => {
        e.preventDefault();
        try {
            const response = await fetch("http://localhost:8000/auth/register", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    username,
                    email,
                    password,
                }),
            });

            const data = await response.json();

            if (response.ok) {
                alert("สมัครสมาชิกสำเร็จ!");
            } else {
                // แทนที่จะแสดง [object Object] ให้ดึง detail หรือ message ออกมา
                alert(data.detail || "เกิดข้อผิดพลาดในการสมัครสมาชิก");
            }
        } catch (err) {
            console.error(err); // ดู error จริงใน console
            alert("ไม่สามารถเชื่อมต่อกับ Server ได้: " + err.message);
        }
    };

    return (
        <div className="auth-page-wrapper">
            <div className="login-container">
                <h1>ระบบเรียนรู้ภาษามือไทย</h1>
                <p>สมัครสมาชิก</p>

                {/* แท็บสลับหน้าตามแบบ Figma */}
                <div className="auth-tab-box">
                    <button type="button" className="auth-tab-item" onClick={() => navigate("/login")}>เข้าสู่ระบบ</button>
                    <button type="button" className="auth-tab-item active">สมัครสมาชิก</button>
                </div>

                <form onSubmit={(e) => e.preventDefault()}>
                    {/* ช่องกรอก Username */}
                    <div>
                        <label>Username</label>
                        <input
                            type="text"
                            placeholder="กรุณากรอก Username..."
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                        />
                    </div>

                    {/* ช่องกรอก อีเมล */}
                    <div>
                        <label>อีเมล</label>
                        <input
                            type="email"
                            placeholder="example@email.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        />
                    </div>

                    {/* ช่องกรอก รหัสผ่าน */}
                    <div>
                        <label>รหัสผ่าน</label>
                        <input
                            type="password"
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />
                    </div>

                    <button type="button" className="btn-login" onClick={handleRegister}>
                        สมัครสมาชิก
                    </button>
                </form>

                <div className="divider" style={{ textAlign: 'center', fontSize: '12px', color: 'rgba(0,0,0,0.3)', margin: '6px 0' }}>หรือ</div>

                <button type="button" className="btn-signup" onClick={() => navigate("/login")}>
                    มีบัญชีอยู่แล้ว? เข้าสู่ระบบ
                </button>
            </div>
        </div>
    );
}