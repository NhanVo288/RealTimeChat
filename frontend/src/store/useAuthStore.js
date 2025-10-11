import { create } from 'zustand'
import { axiosInstance } from '../lib/axios'
import toast from 'react-hot-toast'

export const useAuthStore = create((set) => ({
    authUser: null,
    isCheckingAuth: true,
    isSigingUp:false,
    checkAuth: async () => {
        try {
            const res = await axiosInstance.get("/auth/check")
            set({authUser: res.data})
        } catch (error) {
            console.log(error)
            set({authUser: null})
        } finally {
            set({isCheckingAuth: false})
        }
    },
    signUp: async (data) => {
        set({isSigingUp: true})
        try {
            const res = await axiosInstance.post("/auth/signup",data)
            set({authUser: res.data})
            toast.success('Tao tai khoan thanh cong')
        } catch (error) {
            toast.error(error.response.data.message)
        } finally {
            set({isSigingUp: false})
        }
    }
}))