import axios from 'axios';

const client = axios.create({ baseURL: '/api' });

client.interceptors.request.use((config) => {
  const token = localStorage.getItem('btl_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

client.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('btl_token');
      localStorage.removeItem('btl_user');
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(err);
  }
);

export default client;
