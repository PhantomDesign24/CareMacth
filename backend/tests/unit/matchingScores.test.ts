import {
  calculateDistance,
  getDistanceScore,
  getExperienceScore,
  getReviewScore,
  getRehireScore,
  getCancelPenalty,
  calculateTotalScore,
} from '../../src/utils/matchingScores';

describe('매칭 점수 계산', () => {
  // ========================================
  // Haversine 거리 계산
  // ========================================
  describe('calculateDistance', () => {
    it('같은 좌표 → 거리 0km', () => {
      const d = calculateDistance(37.5665, 126.978, 37.5665, 126.978);
      expect(d).toBeCloseTo(0, 1);
    });

    it('서울시청 ↔ 강남역 ≈ 8~10km', () => {
      // 서울시청 (37.5665, 126.978) ↔ 강남역 (37.498, 127.028)
      const d = calculateDistance(37.5665, 126.978, 37.498, 127.028);
      expect(d).toBeGreaterThan(7);
      expect(d).toBeLessThan(12);
    });

    it('서울 ↔ 부산 ≈ 325km', () => {
      // 서울 (37.5665, 126.978) ↔ 부산 (35.1796, 129.0756)
      const d = calculateDistance(37.5665, 126.978, 35.1796, 129.0756);
      expect(d).toBeGreaterThan(300);
      expect(d).toBeLessThan(350);
    });

    it('음수 좌표도 정상 처리', () => {
      const d = calculateDistance(-33.8688, 151.2093, 40.7128, -74.006);
      expect(d).toBeGreaterThan(15000);
    });
  });

  // ========================================
  // 거리 점수
  // ========================================
  describe('getDistanceScore', () => {
    it('5km 이내 → 30점', () => {
      expect(getDistanceScore(0)).toBe(30);
      expect(getDistanceScore(3)).toBe(30);
      expect(getDistanceScore(5)).toBe(30);
    });

    it('10km 이내 → 25점', () => {
      expect(getDistanceScore(6)).toBe(25);
      expect(getDistanceScore(10)).toBe(25);
    });

    it('20km 이내 → 20점', () => {
      expect(getDistanceScore(11)).toBe(20);
      expect(getDistanceScore(20)).toBe(20);
    });

    it('50km 이내 → 10점', () => {
      expect(getDistanceScore(21)).toBe(10);
      expect(getDistanceScore(50)).toBe(10);
    });

    it('50km 초과 → 5점', () => {
      expect(getDistanceScore(51)).toBe(5);
      expect(getDistanceScore(500)).toBe(5);
    });
  });

  // ========================================
  // 경력 적합도 점수
  // ========================================
  describe('getExperienceScore', () => {
    const baseNeeds = { hasDementia: false, hasInfection: false, mobilityStatus: 'INDEPENDENT' };

    it('경력 0년 → 0점', () => {
      expect(getExperienceScore(0, [], baseNeeds)).toBe(0);
    });

    it('경력 3년 → 7.5점', () => {
      expect(getExperienceScore(3, [], baseNeeds)).toBe(7.5);
    });

    it('경력 6년 이상 → 최대 15점 (전문분야 없이)', () => {
      expect(getExperienceScore(6, [], baseNeeds)).toBe(15);
      expect(getExperienceScore(20, [], baseNeeds)).toBe(15);
    });

    it('치매 환자 + 치매 전문 → +5 보너스', () => {
      const needs = { ...baseNeeds, hasDementia: true };
      expect(getExperienceScore(6, ['치매'], needs)).toBe(20);
    });

    it('감염 환자 + 감염관리 전문 → +3 보너스', () => {
      const needs = { ...baseNeeds, hasInfection: true };
      expect(getExperienceScore(6, ['감염관리'], needs)).toBe(18);
    });

    it('완전의존 + 중환자 전문 → +2 보너스', () => {
      const needs = { ...baseNeeds, mobilityStatus: 'DEPENDENT' };
      expect(getExperienceScore(6, ['중환자'], needs)).toBe(17);
    });

    it('모든 전문분야 매칭 → 최대 25점 캡', () => {
      const needs = { hasDementia: true, hasInfection: true, mobilityStatus: 'DEPENDENT' };
      expect(getExperienceScore(10, ['치매', '감염관리', '중환자'], needs)).toBe(25);
    });

    it('전문분야 불일치 → 보너스 없음', () => {
      const needs = { hasDementia: true, hasInfection: false, mobilityStatus: 'INDEPENDENT' };
      expect(getExperienceScore(4, ['감염관리'], needs)).toBe(10);
    });
  });

  // ========================================
  // 리뷰 점수
  // ========================================
  describe('getReviewScore', () => {
    it('신규 간병인 (매칭 0회) → 기본 10점', () => {
      expect(getReviewScore(0, 0)).toBe(10);
    });

    it('평점 5.0 → 20점 만점', () => {
      expect(getReviewScore(5, 10)).toBe(20);
    });

    it('평점 4.0 → 16점', () => {
      expect(getReviewScore(4, 5)).toBe(16);
    });

    it('평점 3.0 → 12점', () => {
      expect(getReviewScore(3, 3)).toBe(12);
    });

    it('평점 1.0 → 4점', () => {
      expect(getReviewScore(1, 1)).toBe(4);
    });
  });

  // ========================================
  // 재고용률 점수
  // ========================================
  describe('getRehireScore', () => {
    it('재고용률 0% → 0점', () => {
      expect(getRehireScore(0)).toBe(0);
    });

    it('재고용률 100% → 15점 만점', () => {
      expect(getRehireScore(1)).toBe(15);
    });

    it('재고용률 50% → 7.5점', () => {
      expect(getRehireScore(0.5)).toBe(7.5);
    });
  });

  // ========================================
  // 취소 감점
  // ========================================
  describe('getCancelPenalty', () => {
    it('취소율 0%, 노쇼 0 → 감점 0', () => {
      expect(getCancelPenalty(0, 0)).toBeCloseTo(0);
    });

    it('취소율 50%, 노쇼 0 → -2.5', () => {
      expect(getCancelPenalty(0.5, 0)).toBeCloseTo(-2.5);
    });

    it('노쇼 3회 → -5.01', () => {
      expect(getCancelPenalty(0, 3)).toBeCloseTo(-5.01);
    });

    it('노쇼 5회 → 최대 3회까지만 계산', () => {
      // 노쇼는 min(count, 3)이므로 5회여도 3회로 계산
      expect(getCancelPenalty(0, 5)).toBeCloseTo(-5.01);
    });

    it('취소율 100% + 노쇼 3회 → 최대 감점', () => {
      const penalty = getCancelPenalty(1, 3);
      expect(penalty).toBeCloseTo(-10.01);
    });
  });

  // ========================================
  // 종합 점수 계산
  // ========================================
  describe('calculateTotalScore', () => {
    it('모든 점수 최대 + 뱃지 + 즉시 → 최고 점수', () => {
      const score = calculateTotalScore({
        distanceScore: 30,
        experienceScore: 25,
        reviewScore: 20,
        rehireScore: 15,
        cancelPenalty: 0,
        hasBadge: true,
        isImmediate: true,
      });
      expect(score).toBe(98); // 30+25+20+15+0+5+3
    });

    it('최소 점수 → 0 이하는 0으로', () => {
      const score = calculateTotalScore({
        distanceScore: 5,
        experienceScore: 0,
        reviewScore: 4,
        rehireScore: 0,
        cancelPenalty: -10,
        hasBadge: false,
        isImmediate: false,
      });
      expect(score).toBe(0);
    });

    it('뱃지 보너스 +5', () => {
      const withBadge = calculateTotalScore({
        distanceScore: 20, experienceScore: 15, reviewScore: 12,
        rehireScore: 7, cancelPenalty: -2, hasBadge: true, isImmediate: false,
      });
      const withoutBadge = calculateTotalScore({
        distanceScore: 20, experienceScore: 15, reviewScore: 12,
        rehireScore: 7, cancelPenalty: -2, hasBadge: false, isImmediate: false,
      });
      expect(withBadge - withoutBadge).toBe(5);
    });

    it('즉시가능 보너스 +3', () => {
      const immediate = calculateTotalScore({
        distanceScore: 20, experienceScore: 15, reviewScore: 12,
        rehireScore: 7, cancelPenalty: -2, hasBadge: false, isImmediate: true,
      });
      const available = calculateTotalScore({
        distanceScore: 20, experienceScore: 15, reviewScore: 12,
        rehireScore: 7, cancelPenalty: -2, hasBadge: false, isImmediate: false,
      });
      expect(immediate - available).toBe(3);
    });
  });
});
