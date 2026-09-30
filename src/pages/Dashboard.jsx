import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";

// is_correct มาจาก DTW score <= threshold ซึ่งเท่ากับความใกล้เคียง >= 50% พอดี (ดู practice_compare.py)
const PASS_MARK = 50;

const CHART_W = 640;
const CHART_H = 220;
const PAD = { left: 40, right: 20, top: 24, bottom: 30 };

function toPercent(confidence) {
    return Math.round((confidence || 0) * 1000) / 10;
}

function shortDate(iso) {
    return new Date(iso).toLocaleDateString("th-TH", { day: "numeric", month: "short" });
}

function HistoryChart({ items }) {
    const [hoverIndex, setHoverIndex] = useState(null);

    // items เรียงล่าสุดก่อน — กราฟต้องเรียงเก่า -> ใหม่ จากซ้ายไปขวา
    const points = [...items].reverse().map((item) => ({
        value: toPercent(item.confidence),
        passed: item.is_correct,
        word: item.lesson?.word || `บทเรียนที่ ${item.lesson_id}`,
        date: item.created_at,
    }));

    const plotW = CHART_W - PAD.left - PAD.right;
    const plotH = CHART_H - PAD.top - PAD.bottom;
    const x = (i) => PAD.left + (points.length === 1 ? plotW / 2 : (i / (points.length - 1)) * plotW);
    const y = (v) => PAD.top + (1 - v / 100) * plotH;

    const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(p.value)}`).join(" ");
    const lastIndex = points.length - 1;
    const tickIndexes = [...new Set([0, Math.floor(lastIndex / 2), lastIndex])];
    const hovered = hoverIndex !== null ? points[hoverIndex] : null;

    return (
        <div className="relative">
            <svg
                viewBox={`0 0 ${CHART_W} ${CHART_H}`}
                className="w-full h-auto"
                role="img"
                aria-label={`กราฟความใกล้เคียงของท่า ${points.length} ครั้งล่าสุด`}
            >
                {[0, 25, 75, 100].map((v) => (
                    <g key={v}>
                        <line x1={PAD.left} x2={CHART_W - PAD.right} y1={y(v)} y2={y(v)} stroke="#e5e7eb" strokeWidth="1" />
                        <text x={PAD.left - 8} y={y(v)} textAnchor="end" dominantBaseline="middle" fontSize="11" fill="#9ca3af">
                            {v}%
                        </text>
                    </g>
                ))}

                <line
                    x1={PAD.left}
                    x2={CHART_W - PAD.right}
                    y1={y(PASS_MARK)}
                    y2={y(PASS_MARK)}
                    stroke="#9ca3af"
                    strokeWidth="1.5"
                    strokeDasharray="5 4"
                />
                <text x={PAD.left - 8} y={y(PASS_MARK)} textAnchor="end" dominantBaseline="middle" fontSize="11" fill="#6b7280">
                    {PASS_MARK}%
                </text>
                <text x={CHART_W - PAD.right} y={y(PASS_MARK) - 6} textAnchor="end" fontSize="11" fill="#6b7280">
                    เกณฑ์ผ่าน {PASS_MARK}%
                </text>

                {points.length > 1 && (
                    <path d={linePath} fill="none" stroke="#2563eb" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
                )}

                {hoverIndex !== null && (
                    <line
                        x1={x(hoverIndex)}
                        x2={x(hoverIndex)}
                        y1={PAD.top}
                        y2={PAD.top + plotH}
                        stroke="#d1d5db"
                        strokeWidth="1"
                    />
                )}

                {points.map((p, i) => (
                    <circle
                        key={i}
                        cx={x(i)}
                        cy={y(p.value)}
                        r={hoverIndex === i ? 7 : 5}
                        fill={p.passed ? "#16a34a" : "#dc2626"}
                        stroke="#ffffff"
                        strokeWidth="2"
                    />
                ))}

                <text x={x(lastIndex)} y={y(points[lastIndex].value) - 12} textAnchor="middle" fontSize="12" fontWeight="700" fill="#374151">
                    {points[lastIndex].value}%
                </text>

                {tickIndexes.map((i) => (
                    <text
                        key={i}
                        x={x(i)}
                        y={CHART_H - 8}
                        textAnchor={points.length === 1 ? "middle" : i === 0 ? "start" : i === lastIndex ? "end" : "middle"}
                        fontSize="11"
                        fill="#9ca3af"
                    >
                        {shortDate(points[i].date)}
                    </text>
                ))}

                {/* hit target ใหญ่กว่าจุดจริง ให้ชี้/แตะโดนง่าย */}
                {points.map((p, i) => (
                    <circle
                        key={`hit-${i}`}
                        cx={x(i)}
                        cy={y(p.value)}
                        r="16"
                        fill="transparent"
                        className="cursor-pointer"
                        onMouseEnter={() => setHoverIndex(i)}
                        onMouseLeave={() => setHoverIndex(null)}
                        onClick={() => setHoverIndex(i)}
                    />
                ))}
            </svg>

            {hovered && (
                <div
                    className="absolute pointer-events-none bg-white border border-gray-200 shadow-md rounded-xl px-3 py-2 text-xs whitespace-nowrap"
                    style={{
                        left: `${(x(hoverIndex) / CHART_W) * 100}%`,
                        top: `${(y(hovered.value) / CHART_H) * 100}%`,
                        transform: "translate(-50%, calc(-100% - 12px))",
                    }}
                >
                    <p className="font-bold text-gray-800">{hovered.word}</p>
                    <p className="text-gray-600">
                        {hovered.value}% · {hovered.passed ? "✅ ผ่าน" : "❌ ยังไม่ผ่าน"}
                    </p>
                    <p className="text-gray-400">{new Date(hovered.date).toLocaleString("th-TH")}</p>
                </div>
            )}
        </div>
    );
}

// สีขอบบน/ไอคอนของการ์ดหมวดหมู่ วนตามลำดับ
const CATEGORY_ACCENTS = [
    { bar: "border-t-orange-400", icon: "bg-orange-100 text-orange-600" },
    { bar: "border-t-purple-400", icon: "bg-purple-100 text-purple-600" },
    { bar: "border-t-blue-400", icon: "bg-blue-100 text-blue-600" },
    { bar: "border-t-green-400", icon: "bg-green-100 text-green-600" },
    { bar: "border-t-pink-400", icon: "bg-pink-100 text-pink-600" },
];

function HeroRing({ percent, size = 96, stroke = 8 }) {
    const radius = (size - stroke) / 2;
    const circumference = 2 * Math.PI * radius;
    const clamped = Math.max(0, Math.min(100, Number(percent) || 0));

    return (
        <div className="relative shrink-0" style={{ width: size, height: size }}>
            <svg width={size} height={size} className="-rotate-90">
                <circle cx={size / 2} cy={size / 2} r={radius} fill="none" strokeWidth={stroke} className="stroke-white/20" />
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    strokeWidth={stroke}
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={circumference * (1 - clamped / 100)}
                    className="stroke-amber-400 transition-all duration-700 ease-out"
                />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-xl font-extrabold text-white">
                {clamped}%
            </span>
        </div>
    );
}

export default function Dashboard() {
    const [progressData, setProgressData] = useState([]);
    const [stats, setStats] = useState({ totalPracticed: 0, avgConfidence: 0 });
    const [categoryOverview, setCategoryOverview] = useState([]);
    const [loading, setLoading] = useState(true);
    const [openTables, setOpenTables] = useState({});
    const navigate = useNavigate();
    const username = localStorage.getItem("username");

    useEffect(() => {
        async function fetchProgress() {
            try {
                const token = localStorage.getItem("token");
                const response = await fetch("http://localhost:8000/progress", {
                    headers: {
                        ...(token && { Authorization: `Bearer ${token}` })
                    }
                });

                if (response.ok) {
                    const data = await response.json();
                    setProgressData(data);

                    const total = data.length;
                    const avgConf = total > 0
                        ? data.reduce((acc, curr) => acc + (curr.confidence || 0), 0) / total
                        : 0;

                    setStats({
                        totalPracticed: total,
                        avgConfidence: (avgConf * 100).toFixed(1)
                    });
                }

                // ความคืบหน้าแยกตามหมวดหมู่ (% ฝึกไปกี่คำจากทั้งหมดในหมวดนั้น)
                const overviewRes = await fetch("http://localhost:8000/progress/me/overview", {
                    headers: {
                        ...(token && { Authorization: `Bearer ${token}` })
                    }
                });
                if (overviewRes.ok) {
                    setCategoryOverview(await overviewRes.json());
                }
            } catch (error) {
                console.error("ไม่สามารถดึงข้อมูลความคืบหน้าได้:", error);
            } finally {
                setLoading(false);
            }
        }

        fetchProgress();
    }, []);

    // จัดกลุ่มประวัติตามหมวดหมู่ — คงลำดับตาม created_at desc เดิมไว้ (กลุ่มที่ฝึกล่าสุดขึ้นก่อน)
    const groupedHistory = progressData.reduce((groups, item) => {
        const key = item.category_name || "ไม่ทราบหมวดหมู่";
        let group = groups.find((g) => g.category_name === key);
        if (!group) {
            group = { category_name: key, items: [] };
            groups.push(group);
        }
        group.items.push(item);
        return groups;
    }, []);

    const startedCategories = categoryOverview.filter((c) => c.words_practiced > 0);
    const notStartedCount = categoryOverview.length - startedCategories.length;

    if (loading) {
        return (
            <div className="min-h-screen bg-sky-100 flex items-center justify-center">
                <p className="text-xl font-bold text-blue-600">กำลังโหลดข้อมูลแดชบอร์ด...</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-sky-100">
            <Navbar />

            <div className="max-w-5xl mx-auto px-4 sm:px-8 py-8 space-y-10">
                {/* Hero: ทักทาย + สรุปภาพรวม */}
                <section className="bg-gradient-to-br from-blue-600 to-blue-800 rounded-3xl shadow-md p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center gap-6">
                    <div className="flex-1 text-white">
                        <span className="inline-flex items-center gap-1.5 bg-white/15 px-3 py-1 rounded-full text-xs font-semibold">
                            📚 ฝึกไปแล้ว {stats.totalPracticed} ครั้ง
                        </span>
                        <h1 className="text-3xl sm:text-4xl font-bold mt-3">
                            สวัสดี{username ? `, ${username}` : ""}
                        </h1>
                        <p className="text-blue-100 text-sm mt-2 max-w-md">
                            {stats.totalPracticed > 0
                                ? `คุณฝึกไปแล้ว ${stats.totalPracticed} ครั้ง ความใกล้เคียงของท่าเฉลี่ยอยู่ที่ ${stats.avgConfidence}% ฝึกต่อเพื่อพัฒนาทักษะให้ดียิ่งขึ้น`
                                : "ยังไม่มีประวัติการฝึกซ้อม เริ่มต้นฝึกคำแรกกันเลย!"}
                        </p>
                        <button
                            onClick={() => navigate("/lessons")}
                            className="mt-5 bg-orange-500 hover:bg-orange-600 text-white px-5 py-2.5 rounded-xl font-bold shadow-sm transition"
                        >
                            ฝึกต่อเลย →
                        </button>
                    </div>

                    <div className="self-center sm:self-auto bg-white/10 rounded-2xl px-6 py-5 flex flex-col items-center gap-2">
                        <HeroRing percent={stats.avgConfidence} />
                        <p className="text-xs text-blue-100">ความใกล้เคียงเฉลี่ย</p>
                    </div>
                </section>

                {/* ความคืบหน้าแยกตามหมวดหมู่ */}
                {categoryOverview.length > 0 && (
                    <section>
                        <h2 className="text-xl font-bold text-gray-800">ความคืบหน้าแยกตามหมวดหมู่</h2>
                        <p className="text-sm text-gray-500 mb-4">แสดงเฉพาะหมวดหมู่ที่เริ่มฝึกแล้ว</p>

                        {startedCategories.length === 0 ? (
                            <div className="bg-white rounded-2xl shadow-sm p-6 text-sm text-gray-400">
                                ยังไม่ได้เริ่มฝึกหมวดหมู่ไหนเลย
                            </div>
                        ) : (
                            <div className="grid gap-4 md:grid-cols-2">
                                {startedCategories.map((cat, idx) => {
                                    const accent = CATEGORY_ACCENTS[idx % CATEGORY_ACCENTS.length];
                                    return (
                                        <div
                                            key={cat.category_id}
                                            className={`bg-white rounded-2xl shadow-sm p-5 border-t-4 ${accent.bar}`}
                                        >
                                            <div className="flex items-center justify-between gap-3 mb-3">
                                                <div className="flex items-center gap-3 min-w-0">
                                                    <span className={`w-9 h-9 shrink-0 rounded-full flex items-center justify-center font-bold ${accent.icon}`}>
                                                        {cat.category_name?.charAt(0)}
                                                    </span>
                                                    <span className="font-semibold text-gray-800 truncate">{cat.category_name}</span>
                                                </div>
                                                <span className="text-sm font-bold text-green-600">{cat.completion_percentage}%</span>
                                            </div>
                                            <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
                                                <div
                                                    className="h-2.5 rounded-full bg-green-500 transition-all"
                                                    style={{ width: `${Math.min(cat.completion_percentage, 100)}%` }}
                                                />
                                            </div>
                                            <div className="flex items-center justify-between mt-2 text-xs">
                                                <span className="text-gray-400">
                                                    ฝึกไปแล้ว {cat.words_practiced} / {cat.total_words} คำ
                                                </span>
                                                <button
                                                    onClick={() =>
                                                        navigate("/lessons", {
                                                            state: { categoryId: cat.category_id, categoryTitle: cat.category_name },
                                                        })
                                                    }
                                                    className="text-blue-600 font-semibold hover:underline"
                                                >
                                                    ฝึกต่อ →
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {notStartedCount > 0 && (
                            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 bg-white border border-sky-100 rounded-xl px-4 py-3 text-sm text-gray-600">
                                <span>ⓘ ยังมีอีก {notStartedCount} หมวดหมู่ที่ยังไม่ได้เริ่มฝึก</span>
                                <button onClick={() => navigate("/lessons")} className="text-blue-600 font-semibold hover:underline">
                                    ไปเลือกบทเรียน →
                                </button>
                            </div>
                        )}
                    </section>
                )}

                {/* ประวัติการฝึกซ้อมล่าสุด */}
                <section>
                    <h2 className="text-xl font-bold text-gray-800">ประวัติการฝึกซ้อมล่าสุด</h2>
                    <p className="text-sm text-gray-500 mb-4">ความใกล้เคียงของท่าในแต่ละครั้งที่ฝึก แยกตามหมวดหมู่</p>

                    {progressData.length === 0 ? (
                        <div className="bg-white rounded-2xl shadow-sm p-8 text-center text-gray-400">
                            ยังไม่มีประวัติการฝึกซ้อม เริ่มต้นฝึกคำแรกกันเลย!
                        </div>
                    ) : (
                        <>
                            <div className="grid gap-4 md:grid-cols-2">
                                {groupedHistory.map((group) => {
                                    const latest = group.items[0];
                                    const wordCount = new Set(group.items.map((i) => i.lesson?.word)).size;
                                    const isOpen = !!openTables[group.category_name];

                                    return (
                                        // เปิดตารางแล้วขยายเต็มแถว ตารางจะได้ไม่เบียดในครึ่งจอ
                                        <div
                                            key={group.category_name}
                                            className={`bg-white rounded-2xl shadow-sm p-5 ${isOpen ? "md:col-span-2" : ""}`}
                                        >
                                            <div className="flex items-start justify-between gap-3 mb-3">
                                                <div className="min-w-0">
                                                    <h3 className="font-bold text-gray-800 truncate">{group.category_name}</h3>
                                                    <p className="text-xs text-gray-400">
                                                        ฝึก {group.items.length} ครั้ง · {wordCount} คำ
                                                    </p>
                                                </div>
                                                <span
                                                    className={`shrink-0 px-3 py-1 rounded-full text-xs font-semibold ${
                                                        latest.is_correct ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                                                    }`}
                                                >
                                                    ล่าสุด {toPercent(latest.confidence)}%
                                                </span>
                                            </div>

                                            <HistoryChart items={group.items} />

                                            <button
                                                onClick={() => setOpenTables((prev) => ({ ...prev, [group.category_name]: !isOpen }))}
                                                className="mt-2 text-sm text-blue-600 font-semibold hover:underline"
                                            >
                                                {isOpen ? "ซ่อนรายการ ↑" : `ดูประวัติทั้งหมด ${group.items.length} รายการ →`}
                                            </button>

                                            {isOpen && (
                                                <div className="overflow-x-auto mt-4">
                                                    <table className="w-full text-left border-collapse">
                                                        <thead>
                                                            <tr className="border-b border-gray-100 text-gray-400 text-sm">
                                                                <th className="py-3 px-4">คำศัพท์</th>
                                                                <th className="py-3 px-4">ความใกล้เคียงของท่า</th>
                                                                <th className="py-3 px-4">ผล</th>
                                                                <th className="py-3 px-4">เวลาที่ฝึก</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {group.items.map((item, index) => (
                                                                <tr key={index} className="border-b border-gray-50 hover:bg-sky-50 transition">
                                                                    <td className="py-3 px-4 font-bold text-gray-800">
                                                                        {item.lesson?.word || `บทเรียนที่ ${item.lesson_id}`}
                                                                    </td>
                                                                    <td className="py-3 px-4 text-gray-700">{toPercent(item.confidence)}%</td>
                                                                    <td className="py-3 px-4">
                                                                        <span
                                                                            className={`px-3 py-1 rounded-full text-xs font-semibold ${
                                                                                item.is_correct ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                                                                            }`}
                                                                        >
                                                                            {item.is_correct ? "✅ ผ่าน" : "❌ ยังไม่ผ่าน"}
                                                                        </span>
                                                                    </td>
                                                                    <td className="py-3 px-4 text-gray-500 text-sm">
                                                                        {new Date(item.created_at || Date.now()).toLocaleString("th-TH")}
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>

                            {/* legend ใช้ร่วมกันทุกกราฟ */}
                            <div className="flex flex-wrap items-center gap-4 mt-4 text-xs text-gray-500">
                                <span className="flex items-center gap-1.5">
                                    <span className="w-2.5 h-2.5 rounded-full bg-green-600" /> ผ่าน (≥ {PASS_MARK}%)
                                </span>
                                <span className="flex items-center gap-1.5">
                                    <span className="w-2.5 h-2.5 rounded-full bg-red-600" /> ยังไม่ผ่าน (&lt; {PASS_MARK}%)
                                </span>
                                <span className="flex items-center gap-1.5">
                                    <span className="w-4 border-t-2 border-dashed border-gray-400" /> เกณฑ์ผ่าน
                                </span>
                            </div>
                        </>
                    )}
                </section>
            </div>
        </div>
    );
}
