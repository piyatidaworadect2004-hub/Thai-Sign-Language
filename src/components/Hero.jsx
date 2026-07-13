export default function Hero() {
  return (
    <section className="max-w-7xl mx-auto px-8 py-20">

      <div className="grid lg:grid-cols-2 gap-16 items-center">

        <div>

          <span className="bg-blue-100 text-blue-600 px-4 py-2 rounded-full">
            เว็บไซต์สื่อการเรียนรู้ภาษามือไทย
          </span>

          <h1 className="text-6xl font-bold mt-6 leading-tight">

            เรียนรู้ภาษามือไทย

            <br />

            ด้วย AI

          </h1>

          <p className="text-xl text-gray-600 mt-8 leading-9">

            เรียนรู้คำศัพท์ภาษามือไทย พร้อมระบบตรวจจับท่าทาง
            และแบบทดสอบเพื่อพัฒนาทักษะ

          </p>

          <div className="mt-10 flex gap-5">

            <button className="bg-blue-600 text-white px-8 py-4 rounded-2xl">
              เริ่มเรียน
            </button>

            <button className="border-2 border-blue-600 text-blue-600 px-8 py-4 rounded-2xl">
              ฝึกกับ AI
            </button>

          </div>

        </div>

        <div className="flex justify-center">

          <div className="bg-white rounded-[40px] w-[420px] h-[420px] shadow-xl flex items-center justify-center">

            <div className="text-[160px]">
              🤟
            </div>

          </div>

        </div>

      </div>

    </section>
  );
}