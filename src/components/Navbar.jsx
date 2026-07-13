export default function Navbar() {
  return (
    <nav className="bg-white shadow-sm">
      <div className="max-w-7xl mx-auto h-20 px-8 flex items-center justify-between">

        <h1 className="text-3xl font-bold text-blue-600">
          Thai Sign Learning
        </h1>

        <ul className="flex gap-10 text-lg font-medium">
          <li><a href="#">หน้าหลัก</a></li>
          <li><a href="#">บทเรียน</a></li>
          <li><a href="#">ฝึก AI</a></li>
          <li><a href="#">แบบทดสอบ</a></li>
        </ul>

      </div>
    </nav>
  );
}