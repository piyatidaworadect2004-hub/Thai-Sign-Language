import { useState } from "react";
import { useNavigate } from "react-router-dom";

import "./Login.css"; // ดึงไฟล์ CSS เข้ามาใช้งาน

export default function Login() {
    const navigate = useNavigate();

    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");

    const handleLogin = async () => {
        if (!username.trim() || !password.trim()) {
            alert("กรุณากรอก Username และ Password");
            return;
        }

        try {
            const response = await fetch("http://localhost:8000/auth/login", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    username: username,
                    password: password
                }),
            });

            const data = await response.json();

            if (response.ok) {
                // 💾 บันทึกทั้ง Token และ Username ลงเครื่องเพื่อเตรียมเอาไปโชว์ที่แท็บบาร์
                localStorage.setItem("token", data.access_token);
                localStorage.setItem("username", username); 
                
                alert("เข้าสู่ระบบสำเร็จ!");
                navigate("/home"); // ย้ายไปหน้าหลัก
            } else {
                alert(data.detail || "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง");
            }
        } catch (error) {
            console.error(error);
            alert("ไม่สามารถเชื่อมต่อกับ Server ได้");
        }
    };

    return (
        <div className="login-container">
            <h1>Login</h1>

            <input
                type="text"
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            />

            <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            />

            <button className="btn-login" onClick={handleLogin}>
                Login
            </button>

            <button className="btn-signup" onClick={() => navigate("/register")}>
                Sign up
            </button>
        </div>
    );
}