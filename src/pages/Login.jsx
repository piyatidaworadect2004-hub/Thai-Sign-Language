import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Login() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const navigate = useNavigate();

    const handleLogin = async (e) => {
        e.preventDefault(); // ป้องกันไม่ให้หน้าเว็บ Refresh

        console.log("กำลังส่งข้อมูล Login...", { username, password });

        try {
            const response = await fetch('http://127.0.0.1:8000/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username, password }),
            });

            const data = await response.json();
            console.log("Response จาก Backend:", data);
            
            if (response.ok) {
                // 1. เซฟ Token
                localStorage.setItem('token', data.access_token);

                // 2. เซฟชื่อผู้ใช้
                localStorage.setItem('username', data.username);

                // 3. 🟢 เซฟ role ของผู้ใช้งาน (สำคัญมากสำหรับแอดมิน)
                localStorage.setItem('role', data.role);

                // 4. บังคับเปลี่ยนหน้าไปยัง /home
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
        <div className="login-container">
            <form onSubmit={handleLogin} className="login-box">
                <h2>Login</h2>

                <input
                    type="text"
                    placeholder="Username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                />

                <input
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                />

                <button type="submit" className="btn-login">
                    Login
                </button>

                <button
                    type="button"
                    className="btn-signup"
                    onClick={() => navigate('/register')}
                >
                    Sign up
                </button>
            </form>
        </div>
    );
}