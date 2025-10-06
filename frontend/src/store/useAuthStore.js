import { create } from 'zustand'

export const useAuthStore = create((set) => ({
    authUser: {name: "hi",id: "2",age: "12"},
    isLoggedin: false,
    isLoading:false
}))