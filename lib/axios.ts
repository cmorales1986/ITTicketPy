import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
});

// Interceptor para manejar 401 (la cookie httpOnly de sesión expiró o falta)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
