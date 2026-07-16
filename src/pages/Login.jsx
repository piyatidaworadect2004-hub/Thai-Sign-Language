// Login.jsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import SHA256 from 'crypto-js/sha256';

import "./Login.css"; // 👈 ดึงไฟล์ CSS เข้ามาใช้งานที่นี่

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
            const formData = new URLSearchParams();
            formData.append("username", username);
            formData.append("password", SHA256(password).toString());
            console.log("Form Data:", formData.toString()); // Debug: Log the form data
            const response = await fetch(
                "http://localhost:8000/auth/login",
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/x-www-form-urlencoded",
                    },
                    body: formData,
                }
            );
            console.log("Response Status:", response.status); // Debug: Log the response status
            const data = await response.json();

            if (response.ok) {
                localStorage.setItem("token", data.access_token);
                alert("เข้าสู่ระบบสำเร็จ!");
                 navigate("/home");
            } else {
                alert(data.detail || "Username หรือ Password ไม่ถูกต้อง");
            }

        } catch (error) {
            console.error(error);
            alert("เชื่อมต่อ Server ไม่ได้");
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