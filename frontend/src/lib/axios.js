import axios from 'axios'

export const axiosInstance = axios.create({
    baseURL: import.meta.env.MODe === "development" ? "http:localhost:3000/api" : "/api",
    withCredentials: true,
})