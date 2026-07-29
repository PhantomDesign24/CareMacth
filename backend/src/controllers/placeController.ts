import { Request, Response, NextFunction } from 'express';
import axios from 'axios';
import { AppError } from '../middlewares/errorHandler';

// GET /api/places/hospitals?query=...
// 카카오 로컬(장소) 키워드 검색을 서버에서 프록시 — 병원(HP8) 카테고리로 한정.
// REST 키(KAKAO_CLIENT_ID)를 KakaoAK 헤더로 사용 → 키가 클라이언트에 노출되지 않음.
export const searchHospitals = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = String(req.query.query || '').trim();
    if (query.length < 2) {
      return res.json({ success: true, data: { places: [] } });
    }
    const key = process.env.KAKAO_REST_API_KEY || process.env.KAKAO_CLIENT_ID;
    if (!key) throw new AppError('카카오 REST 키가 설정되지 않았습니다.', 500);

    const { data } = await axios.get('https://dapi.kakao.com/v2/local/search/keyword.json', {
      params: { query, category_group_code: 'HP8', size: 15 },
      headers: { Authorization: `KakaoAK ${key}` },
      timeout: 5000,
    });

    const places = (data?.documents || []).map((d: any) => ({
      name: d.place_name,
      address: d.road_address_name || d.address_name || '',
      roadAddress: d.road_address_name || '',
      jibunAddress: d.address_name || '',
      phone: d.phone || '',
      lat: d.y ? parseFloat(d.y) : null,
      lng: d.x ? parseFloat(d.x) : null,
      category: d.category_name || '',
      placeUrl: d.place_url || '',
    }));

    res.json({ success: true, data: { places } });
  } catch (error: any) {
    if (error?.response) {
      // 카카오 API 오류(키/카카오맵 미활성 등) — 상태코드 노출해 진단 가능하게
      const status = error.response.status;
      const msg = error.response.data?.msg || error.response.data?.message || '카카오 장소검색 오류';
      return next(new AppError(`카카오 장소검색 실패(${status}): ${msg}`, 502));
    }
    next(error);
  }
};
