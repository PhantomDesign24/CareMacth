export default function PrivacyPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-10 sm:py-16 md:py-24">
      <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-6 sm:mb-8">개인정보처리방침</h1>
      <div className="prose prose-gray max-w-none space-y-8">
        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">1. 수집하는 개인정보 항목</h2>
          <p className="text-gray-600 leading-relaxed">
            회사는 서비스 제공을 위해 다음의 개인정보를 수집합니다.
          </p>
          <ul className="list-disc list-inside text-gray-600 space-y-1 mt-2">
            <li>필수: 이름, 이메일, 전화번호, 비밀번호</li>
            <li>간병인 추가: 성별, 국적, 생년월일, 자격증 정보, 신분증 사본, 범죄이력조회 결과</li>
            <li>보호자 추가: 환자 정보(성명, 생년월일, 건강상태)</li>
            <li>자동 수집: 접속 IP, 쿠키, 서비스 이용 기록</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">2. 개인정보의 수집 및 이용 목적</h2>
          <ul className="list-disc list-inside text-gray-600 space-y-1">
            <li>회원 가입 및 관리</li>
            <li>간병인-보호자 매칭 서비스 제공</li>
            <li>결제 및 정산 처리</li>
            <li>간병인 신원 확인 및 자격 검증</li>
            <li>서비스 개선 및 통계 분석</li>
            <li>고객 상담 및 민원 처리</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">3. 개인정보의 보유 및 이용 기간</h2>
          <p className="text-gray-600 leading-relaxed">
            회원 탈퇴 시까지 보유하며, 관련 법령에 따라 일정 기간 보관이 필요한 경우 해당 기간 동안 보관합니다.
          </p>
          <ul className="list-disc list-inside text-gray-600 space-y-1 mt-2">
            <li>계약 또는 청약철회에 관한 기록: 5년</li>
            <li>결제 및 재화 공급에 관한 기록: 5년</li>
            <li>소비자 불만 또는 분쟁 처리 기록: 3년</li>
            <li>접속 로그: 3개월</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">4. 개인정보의 제3자 제공</h2>
          <p className="text-gray-600 leading-relaxed">
            회사는 이용자의 동의 없이 개인정보를 제3자에게 제공하지 않습니다.
            다만, 매칭 성사 시 간병 서비스 제공을 위해 필요한 최소한의 정보(이름, 연락처)가
            매칭 상대방에게 제공될 수 있습니다.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">5. 이용자의 권리</h2>
          <p className="text-gray-600 leading-relaxed">
            이용자는 언제든지 자신의 개인정보를 조회, 수정, 삭제할 수 있으며,
            회원 탈퇴를 통해 개인정보 처리 정지를 요청할 수 있습니다.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">6. 개인정보 보호책임자</h2>
          <p className="text-gray-600 leading-relaxed">
            성명: 홍길동<br />
            이메일: privacy@carematch.kr<br />
            전화: 1588-0000
          </p>
        </section>

        <p className="text-sm text-gray-400 pt-8 border-t border-gray-100">
          시행일: 2024년 1월 1일
        </p>
      </div>
    </div>
  );
}
