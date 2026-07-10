export const metadata = {
  title: "계정 삭제 안내 | 케어매치",
  description: "케어매치 계정 및 데이터 삭제 방법 안내",
};

export default function AccountDeletionPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-10 sm:py-16 md:py-24">
      <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-6 sm:mb-8">계정 삭제 안내</h1>
      <div className="prose prose-gray max-w-none space-y-8">
        <p className="text-gray-600 leading-relaxed">
          케어매치(운영: 케어매치㈜)는 회원이 언제든지 본인의 계정과 개인정보를 삭제할 수 있도록 아래 방법을 제공합니다.
        </p>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">1. 앱/웹에서 직접 삭제</h2>
          <p className="text-gray-600 leading-relaxed mb-2">
            케어매치 앱 또는 웹사이트(care-match.kr)에 로그인 후 다음 경로에서 직접 탈퇴할 수 있습니다.
          </p>
          <ul className="list-disc list-inside text-gray-600 space-y-1">
            <li><strong>보호자</strong>: 로그인 → 대시보드 → 설정 → <strong>회원 탈퇴</strong></li>
            <li><strong>간병인</strong>: 로그인 → 마이페이지 → <strong>회원 탈퇴</strong></li>
            <li>안내에 따라 확인 문구를 입력하면 탈퇴가 즉시 처리됩니다.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">2. 삭제되는 데이터 / 보관되는 데이터</h2>
          <ul className="list-disc list-inside text-gray-600 space-y-1">
            <li><strong>즉시 삭제·익명 처리</strong>: 이름, 이메일, 전화번호, 프로필, 자격·신분 정보 등 개인정보</li>
            <li>계정은 즉시 비활성화되며 로그인할 수 없습니다.</li>
            <li>보유 포인트는 모두 소멸됩니다.</li>
            <li>
              <strong>일정 기간 보관 후 파기</strong>: 결제·정산 내역, 간병 계약 이력 등은
              전자상거래법·세법 등 관련 법령이 정한 기간 동안 보관 후 안전하게 파기됩니다.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">3. 앱으로 삭제가 어려운 경우 (요청)</h2>
          <p className="text-gray-600 leading-relaxed mb-2">
            앱 접근이 어려운 경우 아래로 삭제를 요청하시면 본인 확인 후 처리해 드립니다.
          </p>
          <ul className="list-disc list-inside text-gray-600 space-y-1">
            <li>이메일: <a href="mailto:wooritelceo@hanmail.net" className="text-primary-600 underline">wooritelceo@hanmail.net</a></li>
            <li>고객센터: 1555-0801 (평일 09:30~17:30)</li>
            <li>민원담당자: 박소연 과장 (02-535-6600)</li>
          </ul>
        </section>

        <p className="text-sm text-gray-500">
          모든 거래에 대한 책임과 배송, 환불, 민원 등의 처리는 케어매치㈜에서 진행합니다.
        </p>
      </div>
    </div>
  );
}
