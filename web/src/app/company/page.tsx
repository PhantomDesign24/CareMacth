import type { Metadata } from "next";
import Image from "next/image";
import { SITE } from "@/config/site";

export const metadata: Metadata = {
  title: "회사소개",
  description: "케어매치는 AI 인공지능 기술로 요양환자와 간병인을 실시간 매칭하는 간병 매칭 플랫폼입니다.",
};

// 4개 소개 섹션 (번호 + 제목 + 본문 + 이미지 좌우 교차)
const SECTIONS = [
  {
    no: "01",
    title: "요양환자와 간병인이 행복합니다.",
    body: "행복한 간병 문화를 이끌어가는 케어매치 간병서비스는 복지를 추구하는 사회에 꼭 필요한 일입니다. 하지만 믿고 맡길 수 있는 좋은 간병인을 찾기란 쉽지 않고, 간병을 필요로 하는 환자는 많아지는데 훈련된 전문 간병인은 부족한 것이 현실입니다.",
    img: "/img/company/familyImgjpg.jpg",
  },
  {
    no: "02",
    title: "선진 간병 문화를 만들어갑니다.",
    body: "케어매치(CARE MATCH) 플랫폼은 요양환자와 간병인 간 쉽고 편한 매칭을 위하여 만들어졌습니다. 케어매치는 AI 인공지능 기술을 이용하여 환자(보호자)가 좋은 평가를 받는 간병인을 쉽게 찾을 수 있도록 하고, 성실하고 능력 있는 간병인이 질 높은 대우를 받고 일자리를 구할 수 있도록 함으로써 간병 서비스를 바꿔나가고 있습니다.",
    img: "/img/company/cIbox02-1.jpg",
  },
  {
    no: "03",
    title: "전문 간병인을 양성하여 파견합니다.",
    body: "병원간병(질병, 교통사고, 산재사고, 기타 일반 상해·질병), 재택간병, 방문요양, 생활돌봄간병, 중증환자 집중 간병서비스까지 전문적이고 훈련된 간병인들이 표준화된 매뉴얼을 바탕으로 여러분과 함께 할 수 있도록 케어매치 간병 서비스는 노력하고 있습니다.",
    img: "/img/company/cIbox03-1.jpg",
  },
  {
    no: "04",
    title: "평생간병 파트너가 되어드립니다.",
    body: "종합병원, 한방병원, 재활병원, 개인병원, 요양병원, 요양원, 일반가정 등 요양을 필요로 하는 환자가 있는 곳이면 어디든 간병인을 파견합니다. 가족의 마음으로 정성을 다하여 환자를 보살피고 환자 가족의 고충을 확실히 덜어드리겠습니다.",
    img: "/img/company/cIbox04.jpg",
  },
];

// 6대 경영이념 (아이콘 + 이름 + 설명)
const VALUES = [
  { name: "공존", img: "/img/company/e_cInfo_img01.jpg", desc: "가족, 이웃, 친구, 회사 동료 등 모든 사람이 서로 도와 함께 행복을 누리고 삶을 영위하여야 한다." },
  { name: "존중", img: "/img/company/e_cInfo_img02.jpg", desc: "요양환자, 환자의 가족, 병원 관계자, 간병인, 회사 모든 임직원을 서로 존중하는 삶을 추구합니다." },
  { name: "혁신", img: "/img/company/e_cInfo_img03.jpg", desc: "잘못된 습관, 관습, 행동양식, 관행을 버리고 발전된 방향으로 나아가는 진취적 삶을 추구합니다." },
  { name: "소통", img: "/img/company/e_cInfo_img04.jpg", desc: "환자와 간병인, 회사의 임직원 모두가 수평적 관계를 형성하고 막힘없는 의견을 교환합니다." },
  { name: "성과", img: "/img/company/e_cInfo_img05.jpg", desc: "도전적 목표를 세우고 최선을 다하여 성과를 창출하고 능력과 성과에 따라 공정하게 평가받고 보상한다." },
  { name: "열정", img: "/img/company/e_cInfo_img06.jpg", desc: "내게 주어진 모든 일에 열렬한 애정을 가지고 온 마음을 다하여 임하고 그 결과에 만족한다." },
];

export default function CompanyPage() {
  return (
    <div className="bg-white">
      {/* Hero */}
      <section className="bg-gradient-to-br from-primary-50 via-white to-secondary-50 py-14 sm:py-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 text-center">
          <p className="text-primary-500 font-semibold text-sm tracking-wider uppercase mb-3">CARE MATCH</p>
          <h1 className="text-2xl sm:text-4xl font-bold text-gray-900 leading-snug">
            케어매치는 <span className="text-primary-500">AI 간병 매칭 플랫폼</span>입니다.
          </h1>
          <p className="mt-4 text-gray-600 text-sm sm:text-lg">
            간병인과 요양환자의 평생 파트너가 되겠습니다.
          </p>
        </div>
      </section>

      {/* 4개 소개 섹션 — 이미지 좌우 교차 */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-20 space-y-14 sm:space-y-24">
        {SECTIONS.map((s, i) => (
          <div
            key={s.no}
            className={`flex flex-col gap-6 sm:gap-10 md:items-center ${i % 2 === 1 ? "md:flex-row-reverse" : "md:flex-row"}`}
          >
            <div className="md:w-1/2">
              <div className="relative w-full aspect-[16/9] rounded-3xl overflow-hidden shadow-md">
                <Image src={s.img} alt={s.title} fill className="object-cover" sizes="(max-width: 768px) 100vw, 50vw" />
              </div>
            </div>
            <div className="md:w-1/2">
              <span className="text-5xl sm:text-6xl font-extrabold text-primary-100 leading-none block mb-2">{s.no}</span>
              <h2 className="text-xl sm:text-3xl font-bold text-gray-900 mb-3 sm:mb-4">{s.title}</h2>
              <p className="text-gray-600 leading-relaxed text-sm sm:text-base">{s.body}</p>
            </div>
          </div>
        ))}
      </section>

      {/* 6대 경영이념 */}
      <section className="bg-gray-50 py-14 sm:py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-10 sm:mb-14">
            <p className="text-primary-500 font-semibold text-sm tracking-wider uppercase mb-2">VALUES</p>
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">케어매치 6대 경영이념</h2>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {VALUES.map((v) => (
              <div key={v.name} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 sm:p-7 text-center">
                <div className="relative w-16 h-16 sm:w-20 sm:h-20 mx-auto mb-4 rounded-full overflow-hidden">
                  <Image src={v.img} alt={v.name} fill className="object-cover" sizes="80px" />
                </div>
                <h3 className="text-lg font-bold text-primary-500 mb-2">{v.name}</h3>
                <p className="text-xs sm:text-sm text-gray-600 leading-relaxed">{v.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Closing — 제목 + 사진 + 2단 텍스트 + 인용구 (레퍼런스 구성) */}
      <section className="bg-white py-16 sm:py-24">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-10 sm:mb-14">
            <h2 className="text-xl sm:text-3xl font-bold text-gray-900 leading-relaxed">
              간병인들이 존중받으며 일할 수 있는<br className="hidden sm:block" />
              <span className="text-primary-500">직업 문화</span>를 만들어 가겠습니다.
            </h2>
          </div>

          <div className="relative w-full aspect-[16/7] rounded-3xl overflow-hidden shadow-md mb-10 sm:mb-14">
            <Image src="/img/company/careInfoImg.jpg" alt="케어매치 임직원" fill className="object-cover" sizes="100vw" />
          </div>

          {/* 2단 메시지 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-10 mb-12 sm:mb-16">
            <p className="text-sm sm:text-base text-gray-600 leading-loose text-center md:text-right">
              케어매치의 임직원은 현장에서 일어나는 다양한 일에 대하여<br className="hidden lg:block" />
              적극적으로 참여하고 해결책을 찾아 드리겠습니다.
            </p>
            <p className="text-sm sm:text-base text-gray-600 leading-loose text-center md:text-left">
              고통받고 있는 환자를 보살피는 일은 천사의 일입니다.<br className="hidden lg:block" />
              이보다 더 의미 있고 소중한 일은 없습니다.
            </p>
          </div>

          {/* 인용구 — 큰 따옴표로 감싼 약속 메시지 */}
          <div className="relative max-w-3xl mx-auto text-center px-6 sm:px-10 py-8 sm:py-12">
            <span className="absolute left-0 top-0 text-6xl sm:text-8xl font-serif text-primary-200 leading-none select-none">&ldquo;</span>
            <p className="text-base sm:text-2xl font-semibold text-gray-800 leading-relaxed sm:leading-loose">
              케어매치의 임직원은 언제나 환우님과 환우님의 보호자<br className="hidden sm:block" />
              그리고 간병인님을 존경하고 사랑할 것임을 약속드립니다.
            </p>
            <span className="absolute right-0 bottom-0 text-6xl sm:text-8xl font-serif text-primary-200 leading-none select-none translate-y-4">&rdquo;</span>
          </div>
        </div>
      </section>

      {/* 고객센터 — 넓고 여유있게 */}
      <section className="bg-gradient-to-br from-primary-50 via-white to-secondary-50 py-16 sm:py-24">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
          <p className="text-primary-500 font-semibold text-sm tracking-wider uppercase mb-3">CONTACT</p>
          <h2 className="text-xl sm:text-3xl font-bold text-gray-900 mb-2">고객센터</h2>
          <p className="text-sm sm:text-base text-gray-500 mb-8">간병 상담이 필요하신가요? 언제든 편하게 전화 주세요.</p>
          <a
            href={`tel:${SITE.phone}`}
            className="inline-flex items-center gap-3 px-10 sm:px-14 py-5 sm:py-6 bg-primary-500 hover:bg-primary-600 transition-colors rounded-2xl shadow-xl shadow-primary-500/25"
          >
            <svg className="w-7 h-7 sm:w-8 sm:h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" />
            </svg>
            <span className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">{SITE.phone}</span>
          </a>
          <p className="text-xs sm:text-sm text-gray-400 mt-6">평일 09:30 ~ 17:30 · 점심시간 12:00 ~ 13:00</p>
        </div>
      </section>
    </div>
  );
}
