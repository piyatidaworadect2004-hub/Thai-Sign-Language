// สไตล์และคอมโพเนนต์ย่อยที่ใช้ร่วมกันในหน้า Admin (AdminDashboard / LessonManager)

export const API = 'http://127.0.0.1:8000';

export const CARD = 'bg-white rounded-2xl shadow-sm border border-black/5';
export const TH = 'px-4 py-3 text-xs font-medium text-gray-400 whitespace-nowrap';
export const INPUT = 'w-full border border-gray-200 bg-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500';
export const BTN_PRIMARY = 'bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg text-sm font-semibold transition disabled:bg-gray-300';
export const BTN_GHOST = 'bg-gray-100 hover:bg-gray-200 text-gray-700 px-5 py-2 rounded-lg text-sm font-semibold transition';

export function Field({ label, className = '', children }) {
  return (
    <div className={className}>
      <label className="block text-xs font-semibold text-gray-600 mb-1.5">{label}</label>
      {children}
    </div>
  );
}

export function SearchInput({ value, onChange, placeholder }) {
  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">🔍</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`${INPUT} !py-1.5 pl-8 text-sm sm:w-60`}
      />
    </div>
  );
}
