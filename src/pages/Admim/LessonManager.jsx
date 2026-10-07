import React, { useEffect, useMemo, useState } from 'react';
import { API, CARD, TH, INPUT, BTN_PRIMARY, BTN_GHOST, Field, SearchInput } from './adminUi';

// หน้า "จัดการคำศัพท์" รวมกับ Ground Truth ไว้ที่เดียว:
// ตารางคำศัพท์ (ซ้าย) + แผงแก้ไขคำที่เลือก (ขวา) — วิดีโอที่อัปโหลดในแผงใช้เป็นทั้งวิดีโอตัวอย่างให้ผู้ใช้ดู
// และท่าต้นแบบ (Ground Truth) ที่ระบบใช้ให้คะแนน กดบันทึกครั้งเดียวจบ

const PAGE_SIZE = 10;
const MAX_CLIPS = 10;
const STORED_VIDEO_PREFIX = `${API}/uploaded-videos/`;

const isStoredVideoUrl = (url) => (url || '').startsWith(STORED_VIDEO_PREFIX);

function authHeaders(json = false) {
  const token = localStorage.getItem('token');
  return {
    Authorization: `Bearer ${token}`,
    ...(json && { 'Content-Type': 'application/json' }),
  };
}

async function readJson(res) {
  return res.json().catch(() => ({}));
}

const SESSION_EXPIRED = 'เซสชันหมดอายุ กรุณาออกจากระบบแล้วเข้าสู่ระบบใหม่';

function errorText(res, data, fallback) {
  if (res.status === 401 || res.status === 403) return SESSION_EXPIRED;
  return data.detail || fallback;
}

// ให้ backend ดาวน์โหลดวิดีโอจากลิงก์มาเก็บ + ตรวจว่าเป็นวิดีโอจริง คืน URL ของไฟล์ที่เก็บแล้ว
async function importVideoUrl(url) {
  const res = await fetch(`${API}/lessons/import-video-url`, {
    method: 'POST',
    headers: authHeaders(true),
    body: JSON.stringify({ url: url.trim() }),
  });
  const data = await readJson(res);
  if (!res.ok) throw new Error(errorText(res, data, 'นำเข้าวิดีโอจากลิงก์ไม่สำเร็จ'));
  return data.video_url;
}

async function uploadVideoFile(file) {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(`${API}/lessons/upload-video`, { method: 'POST', headers: authHeaders(), body: formData });
  const data = await readJson(res);
  if (!res.ok) throw new Error(errorText(res, data, 'อัปโหลดวิดีโอไม่สำเร็จ'));
  return data.video_url;
}

const emptyPanel = (categoryId = '') => ({
  mode: 'new',
  id: null,
  title: '',
  category_id: categoryId,
  description: '',
  instructions: '',
  video_url: '',
  original_video_url: '',
});


function GtBadge({ gt, hasVideo, unknown }) {
  if (unknown) {
    return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-400">—</span>;
  }
  if (!gt) {
    return hasVideo ? (
      <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700">มีวิดีโอ · ยังไม่มีท่าต้นแบบ</span>
    ) : (
      <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-500">ยังไม่มีวิดีโอ</span>
    );
  }
  if (gt.is_stale) {
    return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-orange-100 text-orange-700">ต้องสร้างใหม่</span>;
  }
  return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700">{gt.num_samples} คลิป</span>;
}

export default function LessonManager({ lessons, setLessons, categories, onRefresh }) {
  const [gtInfo, setGtInfo] = useState(null);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [page, setPage] = useState(1);

  const [panel, setPanel] = useState(null);
  // คลิปที่เลือกไว้รอบันทึก: { file, status: pending|processing|done|failed, frames, reason }
  const [clips, setClips] = useState([]);
  const [exampleClipIndex, setExampleClipIndex] = useState(null); // คลิปที่จะใช้เป็นวิดีโอตัวอย่าง
  const [busy, setBusy] = useState(false);
  const [busyText, setBusyText] = useState('');
  const [message, setMessage] = useState(null); // { type: success|error, text }
  const [dragActive, setDragActive] = useState(false);

  const [gtError, setGtError] = useState('');

  const fetchGtInfo = async () => {
    try {
      const res = await fetch(`${API}/practice-compare/ground-truth-info`, { headers: authHeaders() });
      if (res.ok) {
        setGtInfo(await res.json());
        setGtError('');
      } else {
        // token หมดอายุ (60 นาที) → endpoint ของแอดมินตอบ 401 ถ้าไม่แจ้ง ทุกคำจะดูเหมือนไม่มีท่าต้นแบบ
        setGtInfo(null);
        setGtError(
          res.status === 401 || res.status === 403
            ? 'เซสชันหมดอายุ — โหลดข้อมูลท่าต้นแบบไม่ได้ กรุณาออกจากระบบแล้วเข้าสู่ระบบใหม่'
            : `โหลดข้อมูลท่าต้นแบบไม่สำเร็จ (Status: ${res.status})`
        );
      }
    } catch (error) {
      console.error('Error fetching ground truth info:', error);
      setGtInfo(null);
      setGtError('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ — โหลดข้อมูลท่าต้นแบบไม่สำเร็จ');
    }
  };

  useEffect(() => {
    fetchGtInfo();
  }, []);

  // ---------- ข้อมูลตาราง ----------
  const gtByWord = Object.fromEntries((gtInfo?.words || []).map((g) => [g.word, g]));
  const lessonTitles = new Set(lessons.map((l) => l.title));
  const orphanGtWords = (gtInfo?.words || []).filter((g) => !lessonTitles.has(g.word)).map((g) => g.word);
  const lessonsWithGt = lessons.filter((l) => gtByWord[l.title] && !gtByWord[l.title].is_stale).length;
  const totalGtSamples = lessons.reduce((sum, l) => sum + (gtByWord[l.title]?.num_samples || 0), 0);
  const getCategoryName = (id) => categories.find((c) => c.id === id)?.name || `หมวด #${id}`;

  const filtered = lessons.filter(
    (l) =>
      l.title.toLowerCase().includes(search.toLowerCase()) &&
      (!categoryFilter || String(l.category_id) === String(categoryFilter))
  );
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageRows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  // ---------- แผงแก้ไข ----------
  const panelGt = panel?.mode === 'edit' ? gtByWord[panel.title] : null;
  const exampleClip = exampleClipIndex !== null ? clips[exampleClipIndex] : null;
  const exampleClipPreview = useMemo(
    () => (exampleClip && exampleClip.status !== 'done' ? URL.createObjectURL(exampleClip.file) : null),
    [exampleClip]
  );
  useEffect(() => () => exampleClipPreview && URL.revokeObjectURL(exampleClipPreview), [exampleClipPreview]);

  const resetPanelState = () => {
    setClips([]);
    setExampleClipIndex(null);
    setMessage(null);
    setDragActive(false);
  };

  const openNew = () => {
    if (busy) return;
    resetPanelState();
    setPanel(emptyPanel(categoryFilter));
  };

  const openEdit = (lesson) => {
    if (busy) return;
    resetPanelState();
    setPanel({
      mode: 'edit',
      id: lesson.id,
      title: lesson.title,
      category_id: lesson.category_id,
      description: lesson.description || '',
      instructions: lesson.instructions || '',
      video_url: lesson.video_url || '',
      original_video_url: lesson.video_url || '',
    });
  };

  const closePanel = () => {
    if (busy) return;
    setPanel(null);
    resetPanelState();
  };

  const updatePanel = (patch) => setPanel((prev) => ({ ...prev, ...patch }));

  const addClips = (fileList) => {
    const videos = Array.from(fileList).filter((f) => f.type.startsWith('video/'));
    if (videos.length < fileList.length) alert('ข้ามไฟล์ที่ไม่ใช่วิดีโอ');
    setMessage(null);
    const seen = new Set(clips.map((x) => `${x.file.name}-${x.file.size}`));
    const fresh = videos.filter((f) => !seen.has(`${f.name}-${f.size}`)).map((file) => ({ file, status: 'pending' }));
    const next = [...clips, ...fresh].slice(0, MAX_CLIPS);
    if (clips.length + fresh.length > MAX_CLIPS) alert(`เลือกได้ไม่เกิน ${MAX_CLIPS} คลิปต่อครั้ง`);
    setClips(next);
    // ยังไม่มีวิดีโอตัวอย่าง → ใช้คลิปแรกที่เพิ่มเป็นวิดีโอตัวอย่างให้อัตโนมัติ
    if (!panel.video_url.trim() && exampleClipIndex === null && next.length > clips.length) {
      setExampleClipIndex(clips.length);
    }
  };

  const removeClip = (index) => {
    setClips((prev) => prev.filter((_, i) => i !== index));
    setExampleClipIndex((prev) => (prev === null || prev === index ? null : prev > index ? prev - 1 : prev));
  };

  const updateClip = (index, patch) => setClips((prev) => prev.map((x, i) => (i === index ? { ...x, ...patch } : x)));

  const handleImportUrl = async () => {
    if (!panel.video_url.trim() || isStoredVideoUrl(panel.video_url)) return;
    setBusy(true);
    setBusyText('กำลังนำเข้าวิดีโอจากลิงก์...');
    setMessage(null);
    try {
      updatePanel({ video_url: await importVideoUrl(panel.video_url) });
      setExampleClipIndex(null);
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setBusy(false);
    }
  };

  const uploadGtClip = async (lessonId, file) => {
    const formData = new FormData();
    formData.append('files', file);
    const res = await fetch(`${API}/practice-compare/build-ground-truth/${lessonId}/upload`, {
      method: 'POST',
      headers: authHeaders(),
      body: formData,
    });
    const data = await readJson(res);
    if (res.ok && data.added?.length) return { ok: true, frames: data.added[0].num_frames };
    return { ok: false, reason: data.failed?.[0]?.reason || errorText(res, data, 'ประมวลผลไม่สำเร็จ') };
  };

  // 🔑 CORE: บันทึกครั้งเดียว = บันทึกคำศัพท์ + วิดีโอตัวอย่าง + สร้างท่าต้นแบบจากทุกคลิป
  const handleSave = async () => {
    if (!panel.title.trim()) return setMessage({ type: 'error', text: 'กรุณากรอกคำศัพท์' });
    if (!panel.category_id) return setMessage({ type: 'error', text: 'กรุณาเลือกหมวดหมู่' });

    setBusy(true);
    setMessage(null);
    try {
      // 1) วิดีโอตัวอย่าง: คลิปที่ติดดาว > ลิงก์ที่ยังไม่ได้นำเข้า > ของเดิม
      let videoUrl = panel.video_url.trim();
      let exampleIsClip = false;
      if (exampleClip && exampleClip.status !== 'done') {
        setBusyText('กำลังอัปโหลดวิดีโอตัวอย่าง...');
        videoUrl = await uploadVideoFile(exampleClip.file);
        exampleIsClip = true;
      } else if (videoUrl && videoUrl !== panel.original_video_url && !isStoredVideoUrl(videoUrl)) {
        setBusyText('กำลังนำเข้าวิดีโอจากลิงก์...');
        videoUrl = await importVideoUrl(videoUrl);
      }

      // 2) บันทึกคำศัพท์
      setBusyText('กำลังบันทึกคำศัพท์...');
      const body = {
        title: panel.title.trim(),
        category_id: Number(panel.category_id),
        description: panel.description.trim() || null,
        instructions: panel.instructions.trim() || null,
        video_url: videoUrl || null,
      };
      const res = await fetch(panel.mode === 'new' ? `${API}/lessons` : `${API}/lessons/${panel.id}`, {
        method: panel.mode === 'new' ? 'POST' : 'PUT',
        headers: authHeaders(true),
        body: JSON.stringify(panel.mode === 'new' ? { ...body, is_active: false } : body),
      });
      const saved = await readJson(res);
      if (!res.ok) throw new Error(saved.detail || 'บันทึกคำศัพท์ไม่สำเร็จ');

      // 3) ท่าต้นแบบ: ทุกคลิปที่เลือก + วิดีโอตัวอย่างใหม่จากลิงก์ (คลิปที่ติดดาวอยู่ในรายการคลิปแล้ว)
      let added = 0;
      let failed = 0;
      const pending = clips.map((c, i) => ({ ...c, index: i })).filter((c) => c.status !== 'done');
      for (const [n, clip] of pending.entries()) {
        setBusyText(`กำลังสร้างท่าต้นแบบ ${n + 1}/${pending.length} คลิป...`);
        updateClip(clip.index, { status: 'processing', reason: null });
        const result = await uploadGtClip(saved.id, clip.file);
        if (result.ok) {
          added += 1;
          updateClip(clip.index, { status: 'done', frames: result.frames });
        } else {
          failed += 1;
          updateClip(clip.index, { status: 'failed', reason: result.reason });
        }
      }
      const videoChanged = videoUrl && videoUrl !== panel.original_video_url;
      if (videoChanged && !exampleIsClip) {
        setBusyText('กำลังสร้างท่าต้นแบบจากวิดีโอตัวอย่าง...');
        const gtRes = await fetch(`${API}/practice-compare/build-ground-truth/${saved.id}`, {
          method: 'POST',
          headers: authHeaders(),
        });
        if (gtRes.ok) added += 1;
        else failed += 1;
      }

      // 4) อัปเดตหน้าจอ — is_active อาจถูกเปิดโดย backend ตอนสร้างท่าต้นแบบ จึงโหลดรายการใหม่
      await Promise.all([onRefresh(), fetchGtInfo()]);
      setPanel({
        mode: 'edit',
        id: saved.id,
        title: saved.title,
        category_id: saved.category_id,
        description: saved.description || '',
        instructions: saved.instructions || '',
        video_url: videoUrl,
        original_video_url: videoUrl,
      });
      setExampleClipIndex(null);

      const parts = [panel.mode === 'new' ? 'เพิ่มคำศัพท์แล้ว' : 'บันทึกแล้ว'];
      if (added) parts.push(`สร้างท่าต้นแบบ ${added} คลิป — เปิดใช้งานให้อัตโนมัติ`);
      if (failed) parts.push(`ล้มเหลว ${failed} คลิป (ดูเหตุผลในรายการ)`);
      setMessage({ type: failed && !added ? 'error' : 'success', text: parts.join(' · ') });
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setBusy(false);
    }
  };

  const handleToggleActive = async (lesson) => {
    const res = await fetch(`${API}/lessons/${lesson.id}`, {
      method: 'PUT',
      headers: authHeaders(true),
      body: JSON.stringify({ is_active: !lesson.is_active }),
    });
    if (res.ok) {
      setLessons((prev) => prev.map((l) => (l.id === lesson.id ? { ...l, is_active: !lesson.is_active } : l)));
    } else {
      alert('เปลี่ยนสถานะไม่สำเร็จ');
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`ต้องการลบคำว่า "${panel.title}" ใช่หรือไม่?`)) return;
    const res = await fetch(`${API}/lessons/${panel.id}`, { method: 'DELETE', headers: authHeaders() });
    if (res.ok) {
      setPanel(null);
      resetPanelState();
      onRefresh();
    } else {
      alert('ลบคำศัพท์ไม่สำเร็จ');
    }
  };

  // วิดีโอที่แสดงในแผง: คลิปที่ติดดาว (ยังไม่อัปโหลด) > วิดีโอที่บันทึก/นำเข้าแล้ว
  const previewSrc = exampleClipPreview
    || (panel && (isStoredVideoUrl(panel.video_url) || panel.video_url === panel.original_video_url) ? panel.video_url : '');
  const hasExampleVideo = Boolean(previewSrc);

  return (
    <>
      <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 text-sm text-blue-700">
        <b>วิดีโอตัวอย่าง = ท่าต้นแบบ (Ground Truth)</b> อัปโหลดวิดีโอของคำนั้นได้หลายคลิป
        ระบบจะใช้เป็นทั้งวิดีโอให้ผู้ใช้ดูและท่าต้นแบบสำหรับให้คะแนน เมื่ออัปโหลดสำเร็จจะเปิดใช้งานคำนั้นให้อัตโนมัติ ·
        กดที่แถวเพื่อแก้ไขคำศัพท์
      </div>

      {gtError && (
        <div className="bg-red-50 border border-red-100 rounded-2xl p-4 text-sm text-red-600 flex items-center justify-between gap-3">
          <span>⚠ {gtError}</span>
          <button onClick={fetchGtInfo} className="shrink-0 text-xs font-semibold underline">ลองใหม่</button>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className={`${CARD} p-5`}>
          <p className="text-xs text-gray-400">คำที่มีท่าต้นแบบแล้ว</p>
          <p className="mt-1 text-2xl font-bold text-gray-800">
            {lessonsWithGt}
            <span className="text-base font-medium text-gray-400"> / {lessons.length} คำ</span>
          </p>
          <div className="mt-2 h-1.5 rounded-full bg-gray-100 overflow-hidden">
            <div className="h-full bg-blue-600" style={{ width: `${lessons.length ? (lessonsWithGt / lessons.length) * 100 : 0}%` }} />
          </div>
        </div>
        <div className={`${CARD} p-5`}>
          <p className="text-xs text-gray-400">ตัวอย่างท่าต้นแบบทั้งหมด</p>
          <p className="mt-1 text-2xl font-bold text-gray-800">
            {totalGtSamples}
            <span className="text-base font-medium text-gray-400"> คลิป</span>
          </p>
        </div>
        <div className={`${CARD} p-5`}>
          <p className="text-xs text-gray-400">เกณฑ์ผ่าน (DTW threshold)</p>
          <p className="mt-1 text-2xl font-bold text-gray-800">
            {gtInfo ? gtInfo.threshold : '—'}
            <span className="text-base font-medium text-gray-400"> = ความใกล้เคียง 50%</span>
          </p>
        </div>
      </div>

      <div className={`grid grid-cols-1 gap-4 items-start ${panel ? 'xl:grid-cols-[minmax(0,1fr)_400px]' : ''}`}>
        {/* ───── ตารางคำศัพท์ ───── */}
        <div className={`${CARD} p-5 min-w-0`}>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
            <div className="flex flex-wrap items-center gap-3">
              <h3 className="font-bold text-gray-800">คำศัพท์ทั้งหมด ({lessons.length})</h3>
              <select
                value={categoryFilter}
                onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
                className={`${INPUT} !w-auto !py-1.5 text-sm`}
              >
                <option value="">ทุกหมวดหมู่</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="ค้นหาคำศัพท์..." />
              <button onClick={openNew} disabled={busy} className={`${BTN_PRIMARY} !px-4 !py-1.5`}>＋ เพิ่มคำศัพท์</button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left">
                  <th className={TH}>คำศัพท์</th>
                  <th className={TH}>หมวดหมู่</th>
                  <th className={TH}>สถานะ</th>
                  <th className={TH}>วิดีโอตัวอย่าง (ท่าต้นแบบ)</th>
                  <th className={`${TH} text-right`}></th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((lesson) => {
                  const gt = gtByWord[lesson.title];
                  const selected = panel?.mode === 'edit' && panel.id === lesson.id;
                  return (
                    <tr
                      key={lesson.id}
                      onClick={() => openEdit(lesson)}
                      className={`border-t border-gray-100 cursor-pointer transition ${selected ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                    >
                      <td className={`px-4 py-3 font-semibold whitespace-nowrap ${selected ? 'text-blue-700' : 'text-gray-800'}`}>
                        {lesson.title}
                      </td>
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{getCategoryName(lesson.category_id)}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleToggleActive(lesson); }}
                          title="กดเพื่อเปิด/ปิดการใช้งาน"
                          className={`px-2.5 py-1 rounded-full text-xs font-semibold transition ${lesson.is_active ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                            }`}
                        >
                          {lesson.is_active ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}
                        </button>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <GtBadge gt={gt} hasVideo={Boolean(lesson.video_url)} unknown={!gtInfo} />
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <button
                          onClick={(e) => { e.stopPropagation(); openEdit(lesson); }}
                          className={
                            gt
                              ? 'px-3 py-1.5 rounded-lg bg-white border border-blue-200 text-blue-600 text-xs font-semibold hover:bg-blue-50 transition'
                              : 'px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition'
                          }
                        >
                          {gt ? '＋ เพิ่มคลิป' : '⬆ อัปโหลดวิดีโอ'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {pageRows.length === 0 && (
                  <tr>
                    <td colSpan="5" className="px-4 py-8 text-center text-sm text-gray-400">ไม่พบคำศัพท์ที่ตรงกับเงื่อนไข</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-4">
            <p className="text-xs text-gray-400">
              แสดง {filtered.length ? (currentPage - 1) * PAGE_SIZE + 1 : 0}–{Math.min(currentPage * PAGE_SIZE, filtered.length)} จาก {filtered.length} คำ
            </p>
            {pageCount > 1 && (
              <div className="flex gap-1">
                <button
                  onClick={() => setPage(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="w-8 h-8 rounded-lg border border-gray-200 text-gray-500 text-sm disabled:opacity-40"
                >
                  ‹
                </button>
                {Array.from({ length: pageCount }, (_, i) => i + 1).map((n) => (
                  <button
                    key={n}
                    onClick={() => setPage(n)}
                    className={`w-8 h-8 rounded-lg text-sm font-semibold ${n === currentPage ? 'bg-blue-600 text-white' : 'border border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}
                  >
                    {n}
                  </button>
                ))}
                <button
                  onClick={() => setPage(currentPage + 1)}
                  disabled={currentPage === pageCount}
                  className="w-8 h-8 rounded-lg border border-gray-200 text-gray-500 text-sm disabled:opacity-40"
                >
                  ›
                </button>
              </div>
            )}
          </div>

          {orphanGtWords.length > 0 && (
            <div className="mt-4 bg-orange-50 border border-orange-100 rounded-xl p-3 text-xs text-orange-700">
              ⚠ มีท่าต้นแบบที่ไม่ตรงกับชื่อคำศัพท์ใดเลย (ระบบจะไม่นำไปใช้): {orphanGtWords.join(', ')} — ตั้งชื่อคำศัพท์ให้ตรงทุกตัวอักษร
            </div>
          )}
        </div>

        {/* ───── แผงแก้ไข / เพิ่มคำศัพท์ ───── */}
        {panel && (
          <div className={`${CARD} p-5 xl:sticky xl:top-4 border-2 !border-blue-200 space-y-4`}>
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-bold text-gray-800">{panel.mode === 'new' ? 'เพิ่มคำศัพท์ใหม่' : 'แก้ไขคำศัพท์'}</h3>
                {panel.mode === 'edit' && <p className="text-xs text-gray-400">ID {panel.id}</p>}
              </div>
              <button
                onClick={closePanel}
                disabled={busy}
                className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-500 disabled:opacity-40"
                title="ปิด"
              >
                ✕
              </button>
            </div>

            <Field label="คำศัพท์">
              <input
                type="text"
                placeholder="เช่น สวัสดี"
                value={panel.title}
                onChange={(e) => updatePanel({ title: e.target.value })}
                disabled={busy}
                className={INPUT}
              />
            </Field>
            <Field label="หมวดหมู่">
              <select
                value={panel.category_id}
                onChange={(e) => updatePanel({ category_id: e.target.value })}
                disabled={busy}
                className={INPUT}
              >
                <option value="">-- เลือกหมวดหมู่ --</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </Field>
            <Field label="คำอธิบาย (แสดงบนการ์ด)">
              <textarea
                rows={2}
                placeholder="เช่น ฝึกท่าทางภาษามือคำว่า ดีใจ"
                value={panel.description}
                onChange={(e) => updatePanel({ description: e.target.value })}
                disabled={busy}
                className={INPUT}
              />
            </Field>
            <Field label="วิธีฝึกท่าทางภาษามือ (แสดงในหน้าวิดีโอ)">
              <textarea
                rows={4}
                placeholder={'1. ยกมือทั้งสองข้างระดับอก\n2. ...'}
                value={panel.instructions}
                onChange={(e) => updatePanel({ instructions: e.target.value })}
                disabled={busy}
                className={INPUT}
              />
            </Field>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-semibold text-gray-600">วิดีโอตัวอย่างท่า (ท่าต้นแบบ)</span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${hasExampleVideo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                    }`}
                >
                  {hasExampleVideo ? 'มีวิดีโอ' : 'ยังไม่มีวิดีโอ'}
                </span>
              </div>

              <div
                onDragOver={(e) => { e.preventDefault(); if (!busy) setDragActive(true); }}
                onDragLeave={() => setDragActive(false)}
                onDrop={(e) => { e.preventDefault(); setDragActive(false); if (!busy) addClips(e.dataTransfer.files); }}
                className={`aspect-video rounded-xl overflow-hidden flex items-center justify-center transition ${dragActive ? 'bg-blue-50 border-2 border-dashed border-blue-500' : 'bg-gray-900'
                  }`}
              >
                {previewSrc ? (
                  <video key={previewSrc} src={previewSrc} controls className="w-full h-full object-contain" />
                ) : (
                  <p className={`text-sm ${dragActive ? 'text-blue-600' : 'text-gray-400'}`}>ลากวิดีโอมาวางที่นี่</p>
                )}
              </div>

              <label className={`inline-block mt-2 text-xs font-medium ${busy ? 'text-gray-400' : 'text-blue-600 hover:underline cursor-pointer'}`}>
                ⬆ อัปโหลดวิดีโอจากเครื่อง (เลือกได้หลายคลิป)
                <input
                  type="file"
                  multiple
                  accept="video/*"
                  className="hidden"
                  disabled={busy}
                  onChange={(e) => { addClips(e.target.files); e.target.value = ''; }}
                />
              </label>

              <div className="flex gap-2 mt-2">
                <input
                  type="text"
                  placeholder="หรือวาง Video URL (ลิงก์ไฟล์ .mp4, Google Drive, หน้าเว็บที่มีวิดีโอ)"
                  value={isStoredVideoUrl(panel.video_url) ? '' : panel.video_url}
                  onChange={(e) => updatePanel({ video_url: e.target.value })}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleImportUrl(); } }}
                  disabled={busy}
                  className={`${INPUT} text-xs`}
                />
                <button
                  type="button"
                  onClick={handleImportUrl}
                  disabled={busy || !panel.video_url.trim() || isStoredVideoUrl(panel.video_url)}
                  className="shrink-0 px-3 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition disabled:bg-gray-200 disabled:text-gray-400"
                >
                  นำเข้า
                </button>
              </div>
            </div>

            {clips.length > 0 && (
              <ul className="divide-y divide-gray-100 rounded-xl border border-gray-100">
                {clips.map((clip, i) => (
                  <li key={`${clip.file.name}-${i}`} className="flex items-center gap-2 px-3 py-2 text-xs">
                    <span className="w-4 text-center">
                      {clip.status === 'done' ? '✅' : clip.status === 'failed' ? '❌' : clip.status === 'processing' ? '⏳' : '🎬'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-gray-800">{clip.file.name}</p>
                      <p className={clip.status === 'failed' ? 'text-red-500' : 'text-gray-400'}>
                        {(clip.file.size / (1024 * 1024)).toFixed(1)} MB ·{' '}
                        {clip.status === 'pending' && 'รอบันทึก'}
                        {clip.status === 'processing' && 'กำลังประมวลผล...'}
                        {clip.status === 'done' && `ท่าต้นแบบแล้ว (${clip.frames} เฟรม)`}
                        {clip.status === 'failed' && `ล้มเหลว: ${clip.reason}`}
                      </p>
                    </div>
                    {clip.status !== 'done' && !busy && (
                      <>
                        <button
                          onClick={() => setExampleClipIndex(exampleClipIndex === i ? null : i)}
                          title="ใช้คลิปนี้เป็นวิดีโอตัวอย่างให้ผู้ใช้ดู"
                          className={exampleClipIndex === i ? 'text-amber-500' : 'text-gray-300 hover:text-amber-400'}
                        >
                          ★
                        </button>
                        <button onClick={() => removeClip(i)} title="เอาออก" className="text-gray-400 hover:text-red-500">✕</button>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {panelGt && (
              <details className="rounded-xl bg-gray-50 px-3 py-2 text-xs text-gray-600">
                <summary className="cursor-pointer font-semibold">
                  ท่าต้นแบบที่มีอยู่ ({panelGt.num_samples} คลิป · {Math.min(...panelGt.frames_per_sample)}–{Math.max(...panelGt.frames_per_sample)} เฟรม)
                </summary>
                <ol className="mt-2 space-y-0.5 list-decimal list-inside">
                  {panelGt.frames_per_sample.map((frames, i) => (
                    <li key={i}>{panelGt.source_files?.[i] || 'วิดีโอตัวอย่าง'} — {frames} เฟรม</li>
                  ))}
                </ol>
              </details>
            )}

            <div className="rounded-xl bg-blue-50 p-3 text-xs text-blue-700 space-y-2">
              <p>วิดีโอที่อัปโหลดจะใช้เป็นท่าต้นแบบสำหรับให้คะแนนด้วย แนะนำ 3–5 คลิปที่ต่างกัน (มือเดียว/สองมือ, คนละคน) · ★ = คลิปที่ใช้เป็นวิดีโอตัวอย่าง</p>
              <div className="flex flex-wrap gap-1.5">
                <span className="px-2 py-0.5 rounded-full bg-white">1 อัปโหลด</span>
                <span className="px-2 py-0.5 rounded-full bg-white">2 ประมวลผล</span>
                <span className="px-2 py-0.5 rounded-full bg-white">3 เปิดใช้งานอัตโนมัติ</span>
              </div>
            </div>

            {message && (
              <div className={`rounded-xl p-3 text-xs ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
                {message.text}
              </div>
            )}

            <div className="flex items-center justify-between gap-2">
              {panel.mode === 'edit' ? (
                <button onClick={handleDelete} disabled={busy} className="text-xs text-red-500 hover:underline disabled:opacity-40">
                  🗑 ลบคำศัพท์
                </button>
              ) : (
                <span />
              )}
              <div className="flex gap-2">
                <button onClick={closePanel} disabled={busy} className={BTN_GHOST}>ยกเลิก</button>
                <button onClick={handleSave} disabled={busy} className={BTN_PRIMARY}>
                  {busy ? busyText || 'กำลังบันทึก...' : panel.mode === 'new' ? 'บันทึกคำศัพท์' : 'บันทึกการแก้ไข'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
