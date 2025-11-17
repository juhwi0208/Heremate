// client/src/api/axiosInstance.js
import axiosBase from "axios";

/*
 * CRA(Create React App) 기준 환경 변수 규칙
 * - REACT_APP_API_BASE_URL            → 배포 서버 URL
 * - 로컬이면 4000 포트 기본 사용
 */
export const API_BASE =
  process.env.REACT_APP_API_BASE_URL ||
  (window.location.hostname === "localhost"
    ? "http://localhost:4000"
    : "https://heremate-production.up.railway.app"); // 배포 fallback

/*
 * Axios 인스턴스
 */
const axios = axiosBase.create({
  baseURL: API_BASE.replace(/\/$/, ""),
  withCredentials: true,
});

/*
 * Boot-time Authorization 적용
 */
const bootToken = localStorage.getItem("token");
if (bootToken) {
  axios.defaults.headers.common.Authorization = `Bearer ${bootToken}`;
}

/*
 * 요청 인터셉터 (Bearer 자동 부착)
 */
axios.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers = config.headers ?? {};
    if (!config.headers.Authorization) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

/*
 * 응답 인터셉터 (401 + TOKEN_EXPIRED → refresh)
 */
let refreshing = null;
const subscribers = [];
const onRefreshed = (newToken) =>
  subscribers.splice(0).forEach((cb) => cb(newToken));

axios.interceptors.response.use(
  (res) => res,
  async (err) => {
    const { response, config: original } = err || {};
    if (!response) return Promise.reject(err);

    if (original?._retry || original?.url?.includes("/auth/refresh")) {
      if (response.status === 401) {
        localStorage.removeItem("token");
        if (window.location.pathname !== "/login") window.location.href = "/login";
      }
      return Promise.reject(err);
    }

    const expired =
      response.status === 401 &&
      (response.data?.code === "TOKEN_EXPIRED" ||
        (typeof response.data?.error === "string" &&
          response.data.error.includes("만료")));

    if (!expired) return Promise.reject(err);

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

    refreshing = axios
      .post("/auth/refresh")
      .then((r) => {
        const newToken = r.data?.accessToken || r.data?.token;
        if (newToken) {
          localStorage.setItem("token", newToken);
          axios.defaults.headers.common.Authorization = `Bearer ${newToken}`;
        }
        onRefreshed(newToken);
        return newToken;
      })
      .catch(() => {
        onRefreshed(null);
        localStorage.removeItem("token");
        if (window.location.pathname !== "/login") window.location.href = "/login";
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
