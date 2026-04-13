export default function TermsPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-10 sm:py-16 md:py-24">
      <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-6 sm:mb-8">이용약관</h1>

      <div className="prose prose-gray max-w-none space-y-8">
        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">제1조 (목적)</h2>
          <p className="text-gray-600 leading-relaxed">
            이 약관은 주식회사 케어매치(이하 &quot;회사&quot;)가 운영하는 케어매치 서비스(이하 &quot;서비스&quot;)의 이용과 관련하여
            회사와 이용자 간의 권리, 의무 및 책임사항, 기타 필요한 사항을 규정함을 목적으로 합니다.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">제2조 (정의)</h2>
          <ul className="list-disc list-inside text-gray-600 space-y-2">
            <li>&quot;서비스&quot;란 회사가 제공하는 간병인 매칭 플랫폼 서비스를 말합니다.</li>
            <li>&quot;이용자&quot;란 이 약관에 따라 서비스를 이용하는 보호자, 간병인, 병원 등을 말합니다.</li>
            <li>&quot;보호자&quot;란 환자의 간병을 위해 간병인을 요청하는 이용자를 말합니다.</li>
            <li>&quot;간병인&quot;이란 회사의 심사를 거쳐 등록된 간병 서비스 제공자를 말합니다.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">제3조 (약관의 효력 및 변경)</h2>
          <p className="text-gray-600 leading-relaxed">
            ① 이 약관은 서비스 화면에 게시하거나 기타의 방법으로 이용자에게 공지함으로써 효력이 발생합니다.<br />
            ② 회사는 관련 법률을 위배하지 않는 범위에서 이 약관을 개정할 수 있습니다.<br />
            ③ 변경된 약관은 공지 후 7일이 경과한 날부터 효력이 발생합니다.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">제4조 (서비스의 제공)</h2>
          <p className="text-gray-600 leading-relaxed">
            회사가 제공하는 서비스는 다음과 같습니다.
          </p>
          <ul className="list-disc list-inside text-gray-600 space-y-2 mt-2">
            <li>간병인과 보호자 간의 매칭 서비스</li>
            <li>간병 관련 정보 제공 서비스</li>
            <li>결제 및 정산 중개 서비스</li>
            <li>간병 교육 콘텐츠 제공 서비스</li>
            <li>기타 회사가 정하는 서비스</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">제5조 (의료행위 금지)</h2>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
            <p className="text-amber-900 leading-relaxed">
              본 플랫폼을 통해 매칭되는 간병사는 「의료법」상 의료인이 아니므로 의료행위를 수행할 수 없습니다.
              보호자가 의료행위를 요청하거나 간병사가 이를 수행할 경우, 관련 법령에 따라 법적 책임이 발생할 수 있습니다.
              의료행위(석션, 도뇨관 삽입·교체 등)는 반드시 의료기관 또는 의료인을 통해 진행해 주시기 바랍니다.
            </p>
          </div>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">제6조 (결제 및 환불)</h2>
          <p className="text-gray-600 leading-relaxed">
            ① 서비스 이용 요금은 에스크로 방식으로 결제되며, 간병 완료 후 간병인에게 정산됩니다.<br />
            ② 간병 취소 시 취소 정책에 따라 환불이 진행됩니다.<br />
            ③ 중도 해지 시 일할 계산하여 정산합니다.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">제7조 (이용자의 의무)</h2>
          <ul className="list-disc list-inside text-gray-600 space-y-2">
            <li>이용자는 정확한 정보를 제공해야 합니다.</li>
            <li>간병인에게 의료행위를 요청해서는 안 됩니다.</li>
            <li>서비스를 부정한 목적으로 이용해서는 안 됩니다.</li>
            <li>타인의 개인정보를 무단으로 수집하거나 이용해서는 안 됩니다.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">제8조 (면책조항)</h2>
          <p className="text-gray-600 leading-relaxed">
            ① 회사는 간병인과 보호자 간의 매칭을 중개하며, 간병 서비스의 직접적인 제공자가 아닙니다.<br />
            ② 간병 과정에서 발생하는 사고 및 분쟁에 대해 회사는 중개자로서의 책임만 부담합니다.<br />
            ③ 천재지변 등 불가항력적 사유로 서비스를 제공할 수 없는 경우 회사는 면책됩니다.
          </p>
        </section>

        <p className="text-sm text-gray-400 pt-8 border-t border-gray-100">
          시행일: 2024년 1월 1일
        </p>
      </div>
    </div>
  );
}
