// client/src/api/axiosInstance.js
import axiosBase from 'axios';

/*
 * ✅ 절대 URL 우선 규칙
 * - 프로덕션: REACT_APP_API_BASE_URL (또는 Vite의 VITE_API_BASE_URL)
 * - 개발:     REACT_APP_API_BASE_URL_DEV (없으면 http://localhost:4000 디폴트)
*/
const PROD_BASE =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL) ||
  process.env.REACT_APP_API_BASE_URL ||
  null;

const DEV_BASE =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL_DEV) ||
  process.env.REACT_APP_API_BASE_URL_DEV ||
  process.env.REACT_APP_API_BASE_URL ||   // ✅ CRA 기본 키도 허용
  'http://localhost:4000';

const API_BASE = (process.env.NODE_ENV === 'production' ? (PROD_BASE || process.env.REACT_APP_API_BASE_URL) : DEV_BASE)
  .replace(/\/$/, ''); // 끝 슬래시 제거

const axios = axiosBase.create({
  baseURL: API_BASE,
  withCredentials: true,
});

// -------- 요청 인터셉터: Bearer 자동 주입 --------
axios.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers = config.headers ?? {};
    if (!config.headers.Authorization) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// -------- 응답 인터셉터: 만료 토큰 자동 리프레시 --------
let refreshing = null;
const subscribers = [];
const onRefreshed = (newToken) => subscribers.splice(0).forEach((cb) => cb(newToken));

axios.interceptors.response.use(
  (res) => res,
  async (err) => {
    const { config: original, response } = err || {};
    if (!response) return Promise.reject(err);

    // 리프레시 요청 자체이거나 이미 재시도한 요청이면 중단
    if (original?._retry || original?.url?.includes('/api/auth/refresh')) {
      // 만약 401이고 리프레시도 실패하면 로그인 페이지로 보냄
      if (response.status === 401) {
        localStorage.removeItem('token');
        if (window.location.pathname !== '/login') window.location.href = '/login';
      }
      return Promise.reject(err);
    }

    const isUnauthorized = response.status === 401;
    const serverSaysExpired =
      response.data?.code === 'TOKEN_EXPIRED' ||
      (typeof response.data?.error === 'string' && response.data.error.includes('만료'));

    if (!isUnauthorized || !serverSaysExpired) {
      return Promise.reject(err);
    }

    // 이미 갱신 중이면 큐에 등록
    if (refreshing) {
      return new Promise((resolve, reject) => {
        subscribers.push((newToken) => {
          if (!newToken) return reject(err);
          original.headers = original.headers ?? {};
          original.headers.Authorization = `Bearer ${newToken}`;
          original._retry = true;
          resolve(axios(original));
        });
      });
    }

    // 새로 갱신 시작
    refreshing = axios
      .post('/auth/refresh')
      .then((r) => {
        const newToken = r.data?.accessToken || r.data?.token || null;
        if (newToken) {
          localStorage.setItem('token', newToken);
          axios.defaults.headers.common.Authorization = `Bearer ${newToken}`;
        }
        onRefreshed(newToken);
        return newToken;
      })
      .catch(() => {
        onRefreshed(null);
        localStorage.removeItem('token');
        if (window.location.pathname !== '/login') window.location.href = '/login';
        return null;
      })
      .finally(() => { refreshing = null; });

    const newToken = await refreshing;
    if (!newToken) return Promise.reject(err);

    original.headers = original.headers ?? {};
    original.headers.Authorization = `Bearer ${newToken}`;
    original._retry = true;
    return axios(original);
  }
);

export default axios;
