import axios from 'axios'

const api = axios.create({
  baseURL: '/api/v1',
  timeout: 120000,
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const message = error.response?.data?.detail || error.message || '请求失败'
    return Promise.reject(new Error(message))
  }
)

export default api
