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

export default function Dashboard() {
    const [progressData, setProgressData] = useState([]);
    const [stats, setStats] = useState({ totalPracticed: 0, avgConfidence: 0 });
    const [categoryOverview, setCategoryOverview] = useState([]);
    const [loading, setLoading] = useState(true);
    const [openTables, setOpenTables] = useState({});
    const navigate = useNavigate();

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

            <div className="max-w-5xl mx-auto px-4 sm:px-8 py-8">
                {/* ส่วนหัว */}
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-8">
                    <div>
                        <h1 className="text-3xl sm:text-4xl font-bold text-gray-800 mb-1">แดชบอร์ดความคืบหน้า</h1>
                        <p className="text-gray-600">ติดตามผลการฝึกซ้อมภาษามือของคุณ</p>
                    </div>
                    <button
                        onClick={() => navigate("/lessons")}
                        className="bg-blue-600 text-white px-5 py-2.5 rounded-xl font-bold shadow-sm hover:bg-blue-700 transition self-start sm:self-auto"
                    >
                        + ไปเลือกบทเรียนฝึกซ้อม
                    </button>
                </div>

                {/* สถิติภาพรวม */}
                <div className="grid grid-cols-2 gap-4 mb-6 sm:max-w-md">
                    <div className="bg-white rounded-2xl shadow-sm p-5 flex items-center justify-between">
                        <div>
                            <p className="text-xs text-gray-500">ฝึกซ้อมไปแล้ว</p>
                            <p className="text-2xl font-extrabold text-blue-600 mt-1">
                                {stats.totalPracticed} <span className="text-sm font-medium text-gray-400">ครั้ง</span>
                            </p>
                        </div>
                        <div className="bg-sky-100 w-10 h-10 rounded-xl flex items-center justify-center text-lg">📚</div>
                    </div>
                    <div className="bg-white rounded-2xl shadow-sm p-5 flex items-center justify-between">
                        <div>
                            <p className="text-xs text-gray-500">ความแม่นยำเฉลี่ย</p>
                            <p className="text-2xl font-extrabold text-green-600 mt-1">{stats.avgConfidence}%</p>
                        </div>
                        <div className="bg-green-100 w-10 h-10 rounded-xl flex items-center justify-center text-lg">🎯</div>
                    </div>
                </div>

                {/* ความคืบหน้าแยกตามหมวดหมู่ */}
                {categoryOverview.length > 0 && (
                    <div className="bg-white rounded-2xl shadow-sm p-6 mb-8">
                        <h2 className="text-xl font-bold text-gray-800">ความคืบหน้าแยกตามหมวดหมู่</h2>
                        <p className="text-sm text-gray-500 mb-5">แสดงเฉพาะหมวดหมู่ที่เริ่มฝึกแล้ว</p>

                        {startedCategories.length === 0 ? (
                            <p className="text-sm text-gray-400">ยังไม่ได้เริ่มฝึกหมวดหมู่ไหนเลย</p>
                        ) : (
                            <div className="space-y-5">
                                {startedCategories.map((cat) => (
                                    <div key={cat.category_id}>
                                        <div className="flex items-center justify-between mb-1.5">
                                            <span className="font-semibold text-gray-700">{cat.category_name}</span>
                                            <span className="text-sm font-bold text-gray-700">{cat.completion_percentage}%</span>
                                        </div>
                                        <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden mb-1">
                                            <div
                                                className="h-2.5 rounded-full bg-blue-500 transition-all"
                                                style={{ width: `${Math.min(cat.completion_percentage, 100)}%` }}
                                            />
                                        </div>
                                        <p className="text-xs text-gray-400">
                                            ฝึกไปแล้ว {cat.words_practiced} / {cat.total_words} คำ
                                        </p>
                                    </div>
                                ))}
                            </div>
                        )}

                        {notStartedCount > 0 && (
                            <div className="mt-5 flex flex-wrap items-center justify-between gap-2 bg-sky-50 border border-sky-100 rounded-xl px-4 py-3 text-sm text-gray-600">
                                <span>ยังมีอีก {notStartedCount} หมวดหมู่ที่ยังไม่ได้เริ่มฝึก</span>
                                <button onClick={() => navigate("/lessons")} className="text-blue-600 font-semibold hover:underline">
                                    ไปเลือกบทเรียน →
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* ประวัติการฝึกซ้อมล่าสุด */}
                <h2 className="text-xl font-bold text-gray-800">ประวัติการฝึกซ้อมล่าสุด</h2>
                <p className="text-sm text-gray-500 mb-4">ความใกล้เคียงของท่าในแต่ละครั้งที่ฝึก แยกตามหมวดหมู่</p>

                {progressData.length === 0 ? (
                    <div className="bg-white rounded-2xl shadow-sm p-8 text-center text-gray-400">
                        ยังไม่มีประวัติการฝึกซ้อม เริ่มต้นฝึกคำแรกกันเลย!
                    </div>
                ) : (
                    <div className="space-y-6">
                        {groupedHistory.map((group) => {
                            const latest = group.items[0];
                            const wordCount = new Set(group.items.map((i) => i.lesson?.word)).size;
                            const isOpen = !!openTables[group.category_name];

                            return (
                                <div key={group.category_name} className="bg-white rounded-2xl shadow-sm p-6">
                                    <div className="flex items-start justify-between gap-3 mb-4">
                                        <div className="flex items-center gap-3">
                                            <div className="bg-sky-100 w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0">📖</div>
                                            <div>
                                                <h3 className="font-bold text-gray-800">{group.category_name}</h3>
                                                <p className="text-xs text-gray-400">
                                                    ฝึก {group.items.length} ครั้ง · {wordCount} คำ
                                                </p>
                                            </div>
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

                                    <div className="flex flex-wrap items-center justify-between gap-3 mt-3">
                                        <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500">
                                            <span className="flex items-center gap-1.5">
                                                <span className="w-2.5 h-2.5 rounded-full bg-green-600" /> ผ่าน
                                            </span>
                                            <span className="flex items-center gap-1.5">
                                                <span className="w-2.5 h-2.5 rounded-full bg-red-600" /> ยังไม่ผ่าน
                                            </span>
                                            <span className="flex items-center gap-1.5">
                                                <span className="w-4 border-t-2 border-dashed border-gray-400" /> เกณฑ์ผ่าน {PASS_MARK}%
                                            </span>
                                        </div>
                                        <button
                                            onClick={() => setOpenTables((prev) => ({ ...prev, [group.category_name]: !isOpen }))}
                                            className="text-sm text-blue-600 font-semibold hover:underline"
                                        >
                                            {isOpen ? "ซ่อนรายการ ↑" : `ดูประวัติทั้งหมด ${group.items.length} ครั้ง →`}
                                        </button>
                                    </div>

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
                )}
            </div>
        </div>
    );
}
