import type { Metadata } from "next";
import { SITE } from "@/config/site";

export const metadata: Metadata = {
  title: "회사소개",
  description: "케어매치는 AI 인공지능 기술로 요양환자와 간병인을 실시간 매칭하는 간병 매칭 플랫폼입니다.",
};

const SECTIONS = [
  {
    no: "01",
    title: "요양환자와 간병인이 행복합니다.",
    body: "행복한 간병 문화를 이끌어가는 케어매치 간병서비스는 복지를 추구하는 사회에 꼭 필요한 일입니다. 하지만 믿고 맡길 수 있는 좋은 간병인을 찾기란 쉽지 않고, 간병을 필요로 하는 환자는 많아지는데 훈련된 전문 간병인은 부족한 것이 현실입니다.",
  },
  {
    no: "02",
    title: "선진 간병 문화를 만들어갑니다.",
    body: "케어매치(CARE MATCH) 플랫폼은 요양환자와 간병인 간 쉽고 편한 매칭을 위하여 만들어졌습니다. 케어매치는 AI 인공지능 기술을 이용하여 환자(보호자)가 좋은 평가를 받는 간병인을 쉽게 찾을 수 있도록 하고, 성실하고 능력 있는 간병인이 질 높은 대우를 받고 일자리를 구할 수 있도록 함으로써 간병 서비스를 바꿔나가고 있습니다.",
  },
  {
    no: "03",
    title: "전문 간병인을 양성하여 파견합니다.",
    body: "병원간병(질병, 교통사고, 산재사고, 기타 일반 상해·질병), 재택간병, 방문요양, 생활돌봄간병, 중증환자 집중 간병서비스까지 전문적이고 훈련된 간병인들이 표준화된 매뉴얼을 바탕으로 여러분과 함께 할 수 있도록 케어매치 간병 서비스는 노력하고 있습니다.",
  },
  {
    no: "04",
    title: "평생간병 파트너가 되어드립니다.",
    body: "종합병원, 한방병원, 재활병원, 개인병원, 요양병원, 요양원, 일반가정 등 요양을 필요로 하는 환자가 있는 곳이면 어디든 간병인을 파견합니다. 가족의 마음으로 정성을 다하여 환자를 보살피고 환자 가족의 고충을 확실히 덜어드리겠습니다.",
  },
];

const VALUES = [
  { name: "공존", desc: "가족, 이웃, 친구, 회사 동료 등 모든 사람이 서로 도와 함께 행복을 누리고 삶을 영위하여야 한다." },
  { name: "존중", desc: "요양환자, 환자의 가족, 병원 관계자, 간병인, 회사 모든 임직원을 서로 존중하는 삶을 추구합니다." },
  { name: "혁신", desc: "잘못된 습관, 관습, 행동양식, 관행을 버리고 발전된 방향으로 나아가는 진취적 삶을 추구합니다." },
  { name: "소통", desc: "환자와 간병인, 회사의 임직원 모두가 수평적 관계를 형성하고 막힘없는 의견을 교환합니다." },
  { name: "성과", desc: "도전적 목표를 세우고 최선을 다하여 성과를 창출하고 능력과 성과에 따라 공정하게 평가받고 보상한다." },
  { name: "열정", desc: "내게 주어진 모든 일에 열렬한 애정을 가지고 온 마음을 다하여 임하고 그 결과에 만족한다." },
];

export default function CompanyPage() {
  return (
    <div className="bg-white">
      {/* Hero */}
      <section className="bg-gradient-to-br from-primary-50 via-white to-secondary-50 py-14 sm:py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <p className="text-primary-500 font-semibold text-sm tracking-wider uppercase mb-3">Company</p>
          <h1 className="text-2xl sm:text-4xl font-bold text-gray-900 leading-snug">
            케어매치는 <span className="text-primary-500">AI 간병 매칭 플랫폼</span>입니다.
          </h1>
          <p className="mt-4 text-gray-600 text-sm sm:text-lg">
            간병인과 요양환자의 평생 파트너가 되겠습니다.
          </p>
        </div>
      </section>

      {/* 4 sections */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 py-12 sm:py-16 space-y-10 sm:space-y-14">
        {SECTIONS.map((s) => (
          <div key={s.no} className="flex flex-col sm:flex-row gap-4 sm:gap-6">
            <div className="flex-shrink-0">
              <span className="text-3xl sm:text-4xl font-extrabold text-primary-200">{s.no}</span>
            </div>
            <div>
              <h2 className="text-lg sm:text-2xl font-bold text-gray-900 mb-2">{s.title}</h2>
              <p className="text-gray-600 leading-relaxed text-sm sm:text-base">{s.body}</p>
            </div>
          </div>
        ))}
      </section>

      {/* 6대 경영이념 */}
      <section className="bg-gray-50 py-12 sm:py-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-8 sm:mb-12">
            <h2 className="text-xl sm:text-3xl font-bold text-gray-900">케어매치 6대 경영이념</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            {VALUES.map((v) => (
              <div key={v.name} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 sm:p-6">
                <h3 className="text-lg font-bold text-primary-500 mb-2">{v.name}</h3>
                <p className="text-sm text-gray-600 leading-relaxed">{v.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Closing */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 py-12 sm:py-16 text-center">
        <h2 className="text-lg sm:text-2xl font-bold text-gray-900 mb-4 leading-snug">
          간병인들이 존중받으며 일할 수 있는<br className="hidden sm:block" />
          직업 문화를 만들어 가겠습니다.
        </h2>
        <p className="text-gray-600 leading-relaxed text-sm sm:text-base">
          케어매치의 임직원은 현장에서 일어나는 다양한 일에 대하여 적극적으로 참여하고 해결책을 찾아 드리겠습니다.
          고통받고 있는 환자를 보살피는 일은 천사의 일입니다. 이보다 더 의미 있고 소중한 일은 없습니다.
          케어매치의 임직원은 언제나 환우님과 환우님의 보호자, 그리고 간병인님을 존경하고 사랑할 것임을 약속드립니다.
        </p>
        <div className="mt-8 inline-flex flex-col items-center gap-1 bg-primary-50 rounded-2xl px-8 py-5">
          <span className="text-xs text-gray-500">고객센터</span>
          <a href={`tel:${SITE.phone}`} className="text-2xl font-bold text-primary-600">{SITE.phone}</a>
          <span className="text-xs text-gray-400 mt-1">평일 09:30 ~ 17:30 (점심 12:00 ~ 13:00)</span>
        </div>
      </section>
    </div>
  );
}
