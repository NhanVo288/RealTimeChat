import { useState } from "react";
import { useAuthStore } from "../store/useAuthStore";
import BorderAnimatedContainer from "../../chat/components/BorderAnimatedContainer";
import {
  MessageCircleIcon,
  LockIcon,
  MailIcon,
  LoaderIcon,
} from "lucide-react";
import { Link } from "react-router";

function LoginPage() {
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  const { logIn, isLogingIn } = useAuthStore();

  const handleSubmit = (e) => {
    e.preventDefault();
    logIn(formData);
  };

  return (
    <div className="w-full flex items-center justify-center p-4">
      <div className="relative w-full max-w-6xl md:h-[800px] h-[650px]">
        <BorderAnimatedContainer>
          <div className="w-full flex flex-col lg:flex-row rounded-xl shadow-lg overflow-hidden">
            {/* FORM COLUMN - LEFT */}
            <div className="lg:w-1/2 bg-gradient-to-tr  p-10 flex flex-col justify-center items-center">
              <div className="w-full max-w-lg">
                {/* HEADING */}
                <div className="text-center mb-8">
                  <MessageCircleIcon className="w-12 h-12 mx-auto text-slate-400 mb-4" />
                  <h2 className="text-3xl font-extrabold text-white mb-2">
                    Log In
                  </h2>
                  <p className="text-cyan-100 text-sm md:text-base">
                    Welcome Back
                  </p>
                </div>

                {/* FORM */}
                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* EMAIL */}
                  <div>
                    <label className="auth-input-label">Email</label>
                    <div className="relative">
                      <MailIcon className="auth-input-icon" />
                      <input
                        type="email"
                        value={formData.email}
                        onChange={(e) =>
                          setFormData({ ...formData, email: e.target.value })
                        }
                        className="input"
                        placeholder="youremail@example.com"
                      />
                    </div>
                  </div>

                  {/* PASSWORD */}
                  <div>
                    <label className="auth-input-label">Password</label>
                    <div className="relative">
                      <LockIcon className="auth-input-icon" />
                      <input
                        type="password"
                        value={formData.password}
                        onChange={(e) =>
                          setFormData({ ...formData, password: e.target.value })
                        }
                        className="input"
                        placeholder="••••••••"
                      />
                    </div>
                  </div>

                  {/* SUBMIT BUTTON */}
                  <button
                    type="submit"
                    disabled={isLogingIn}
                    className="auth-btn"
                  >
                    {isLogingIn ? (
                      <LoaderIcon className="w-5 h-5 animate-spin" />
                    ) : (
                      "Log In"
                    )}
                  </button>
                </form>

                {/* SignUp LINK */}
                <p className="mt-6 text-center text-cyan-100">
                  Not have an account?{" "}
                  <Link
                    to="/signup"
                    className="underline font-semibold text-white"
                  >
                    SignUp
                  </Link>
                </p>
              </div>
            </div>

            {/* ILLUSTRATION - RIGHT */}
            <div className="hidden lg:flex lg:w-1/2 bg-cyan-950 items-center justify-center p-10">
              <div className="text-center">
                <img
                  src="/signup.png"
                  alt="Illustration"
                  className="w-full max-w-md mx-auto object-contain"
                />
                <h3 className="mt-8 text-2xl font-semibold text-white">
                  Connect with us
                </h3>
                <div className="mt-4 flex justify-center gap-4 flex-wrap">
                  <span className="bg-cyan-100 text-cyan-800 py-1 px-3 rounded-full text-sm font-medium">
                    Free
                  </span>
                  <span className="bg-cyan-100 text-cyan-800 py-1 px-3 rounded-full text-sm font-medium">
                    Fast
                  </span>
                  <span className="bg-cyan-100 text-cyan-800 py-1 px-3 rounded-full text-sm font-medium">
                    Secure
                  </span>
                </div>
              </div>
            </div>
          </div>
        </BorderAnimatedContainer>
      </div>
    </div>
  );
}

export default LoginPage;
