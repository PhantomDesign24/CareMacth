export default function LocationTermsPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-16 md:py-24">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">위치기반서비스 이용약관</h1>
      <div className="prose prose-gray max-w-none space-y-8">
        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">제1조 (목적)</h2>
          <p className="text-gray-600 leading-relaxed">
            이 약관은 주식회사 케어매치가 제공하는 위치기반서비스에 대해 회사와 이용자 간의 권리·의무 및 책임사항을 규정함을 목적으로 합니다.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">제2조 (서비스 내용)</h2>
          <ul className="list-disc list-inside text-gray-600 space-y-1">
            <li>간병인 위치 기반 매칭 서비스 (간병인의 현재 위치와 간병 장소 간 거리 계산)</li>
            <li>간병인 출퇴근 위치 확인 서비스 (선택)</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">제3조 (위치정보 수집)</h2>
          <p className="text-gray-600 leading-relaxed">
            위치정보는 이용자의 명시적 동의 하에 수집되며, 출퇴근 체크 시 선택적으로 GPS 위치가 기록될 수 있습니다.
            위치정보는 매칭 알고리즘에 활용되며, 서비스 종료 후 즉시 파기됩니다.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">제4조 (위치정보 이용·제공)</h2>
          <p className="text-gray-600 leading-relaxed">
            수집된 위치정보는 간병인 매칭 및 출퇴근 확인 목적으로만 사용되며,
            이용자의 동의 없이 제3자에게 제공하지 않습니다.
          </p>
        </section>

        <p className="text-sm text-gray-400 pt-8 border-t border-gray-100">
          시행일: 2024년 1월 1일
        </p>
      </div>
    </div>
  );
}
