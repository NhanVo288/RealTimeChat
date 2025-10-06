import { create } from 'zustand'


export const useAuthStore = create((set) => ({
    authUser: {name,id,age},
    isLoggedin: false,
    isLoading:false
}))