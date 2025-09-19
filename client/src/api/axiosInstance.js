// client/src/api/axiosInstance.js
import axiosBase from 'axios';

// 환경별 baseURL 설정 (없으면 프록시 '/' 사용)
const API_BASE =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL) ||
  process.env.REACT_APP_API_BASE_URL ||
  '/';

const axios = axiosBase.create({
  baseURL: API_BASE,
  withCredentials: true, // refresh 쿠키 사용 시 필요
});

// --- 요청 인터셉터 ---
// 매 요청마다 localStorage에서 토큰을 읽어 Authorization 자동 주입
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

// --- 응답 인터셉터 ---
// 401 처리: 만료면 /api/auth/refresh로 새 토큰 받고 원요청 재시도
let refreshing = null;
const subscribers = [];
const onRefreshed = (newToken) => subscribers.splice(0).forEach((cb) => cb(newToken));

axios.interceptors.response.use(
  (res) => res,
  async (err) => {
    const { config: original, response } = err || {};
    if (!response) return Promise.reject(err); // 네트워크 오류 등

    const isRefreshCall = original?.url?.includes('/api/auth/refresh');
    if (isRefreshCall || original?._retry) return Promise.reject(err);

    const isUnauthorized = response.status === 401;
    const serverSaysExpired =
      response.data?.code === 'TOKEN_EXPIRED' ||
      (typeof response.data?.error === 'string' && response.data.error.includes('만료'));

    if (!isUnauthorized || !serverSaysExpired) {
      return Promise.reject(err);
    }

    // 이미 갱신 중이면 큐잉
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

    // 리프레시 시작
    refreshing = axios
      .post('/auth/refresh')
      .then((r) => {
        const newToken = r.data?.accessToken || r.data?.token;
        if (newToken) {
          localStorage.setItem('token', newToken);
          axios.defaults.headers.common.Authorization = `Bearer ${newToken}`;
        }
        onRefreshed(newToken || null);
        return newToken || null;
      })
      .catch(() => {
        onRefreshed(null);
        localStorage.removeItem('token');
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
        return null;
      })
      .finally(() => {
        refreshing = null;
      });

    const newToken = await refreshing;
    if (!newToken) return Promise.reject(err);

    original.headers = original.headers ?? {};
    original.headers.Authorization = `Bearer ${newToken}`;
    original._retry = true;
    return axios(original);
  }
);

export default axios;
