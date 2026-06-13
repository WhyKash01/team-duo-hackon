import React, { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { type RootState } from "../app/store";
import { authStart, authSuccess, authFailure, clearError, logout } from "../features/auth/authSlice";
import { z } from "zod";
import { AlertCircle, CheckCircle } from "lucide-react";

// Form validation schemas
const loginSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

const registerSchema = z.object({
  firstName: z.string().min(2, "First name must be at least 2 characters"),
  lastName: z.string().min(2, "Last name must be at least 2 characters"),
  email: z.string().email("Enter a valid email address"),
  phoneNumber: z.string().min(10, "Phone number must be at least 10 digits").max(15, "Phone number cannot exceed 15 digits"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

interface AuthPageProps {
  onBackToMarketplace: () => void;
}

export const AuthPage: React.FC<AuthPageProps> = ({ onBackToMarketplace }) => {
  const dispatch = useDispatch();
  const { loading, error } = useSelector((state: RootState) => state.auth);

  const [isRegistering, setIsRegistering] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  // Input states
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [password, setPassword] = useState("");

  // Validation errors
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const handleToggleMode = () => {
    setIsRegistering(!isRegistering);
    setValidationErrors({});
    dispatch(clearError());
    setSuccessMsg("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationErrors({});
    dispatch(clearError());
    setSuccessMsg("");

    const apiBaseUrl = import.meta.env.VITE_API_URL || "http://localhost:8080/api";

    if (isRegistering) {
      // Validate registration
      const validation = registerSchema.safeParse({
        firstName,
        lastName,
        email,
        phoneNumber,
        password,
      });

      if (!validation.success) {
        const errors: Record<string, string> = {};
        validation.error.issues.forEach((issue) => {
          if (issue.path[0]) {
            errors[issue.path[0] as string] = issue.message;
          }
        });
        setValidationErrors(errors);
        return;
      }

      dispatch(authStart());
      try {
        const res = await fetch(`${apiBaseUrl}/register`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            first_name: firstName,
            last_name: lastName,
            email,
            phone_number: phoneNumber,
            password,
            role: "USER", // default registration role
          }),
        });

        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || "Registration failed");
        }

        setSuccessMsg("Account created successfully! You can now sign in.");
        setIsRegistering(false);
        setPassword(""); // Clear password field
        dispatch(logout()); // Reset loading state
      } catch (err: any) {
        dispatch(authFailure(err.message));
      }
    } else {
      // Validate login
      const validation = loginSchema.safeParse({ email, password });

      if (!validation.success) {
        const errors: Record<string, string> = {};
        validation.error.issues.forEach((issue) => {
          if (issue.path[0]) {
            errors[issue.path[0] as string] = issue.message;
          }
        });
        setValidationErrors(errors);
        return;
      }

      dispatch(authStart());
      try {
        const res = await fetch(`${apiBaseUrl}/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });

        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || "Authentication failed");
        }

        const userData = await res.json();
        dispatch(authSuccess(userData));
        onBackToMarketplace();
      } catch (err: any) {
        dispatch(authFailure(err.message));
      }
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col items-center pt-8 px-4 font-sans select-none text-[#111111]">
      {/* Amazon Logo */}
      <div 
        onClick={onBackToMarketplace}
        className="cursor-pointer mb-5 flex items-baseline hover:opacity-95"
      >
        <span className="text-3xl font-extrabold tracking-tight text-[#111] flex items-baseline">
          amazon<span className="text-[#e77600] text-lg font-bold">.in</span>
        </span>
      </div>

      {/* Success alert */}
      {successMsg && (
        <div className="w-full max-w-[350px] border border-green-500 rounded p-4 mb-4 bg-green-50 flex gap-2.5 items-start">
          <CheckCircle className="text-green-600 shrink-0 mt-0.5" size={18} />
          <div className="flex flex-col gap-0.5 text-xs text-green-800">
            <span className="font-bold">Success</span>
            <span>{successMsg}</span>
          </div>
        </div>
      )}

      {/* Error alert */}
      {error && (
        <div className="w-full max-w-[350px] border border-red-500 rounded p-4 mb-4 bg-red-50 flex gap-2.5 items-start animate-in fade-in duration-200">
          <AlertCircle className="text-red-600 shrink-0 mt-0.5" size={18} />
          <div className="flex flex-col gap-0.5 text-xs text-red-800">
            <span className="font-bold">There was a problem</span>
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* Form Container Card */}
      <div className="w-full max-w-[350px] border border-gray-300 rounded-lg p-6 flex flex-col gap-4 shadow-sm bg-white">
        <h1 className="text-2xl font-normal leading-snug">
          {isRegistering ? "Create Account" : "Sign in"}
        </h1>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
          {isRegistering && (
            <>
              {/* First Name */}
              <div className="flex flex-col gap-1 text-[13px] font-bold">
                <label>First name</label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="border border-gray-400 focus:border-[#e77600] focus:ring-1 focus:ring-[#e77600] rounded px-2.5 py-1.5 outline-none font-normal"
                  placeholder="First name"
                />
                {validationErrors.firstName && (
                  <p className="text-xs text-red-600 font-semibold mt-0.5">{validationErrors.firstName}</p>
                )}
              </div>

              {/* Last Name */}
              <div className="flex flex-col gap-1 text-[13px] font-bold">
                <label>Last name</label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="border border-gray-400 focus:border-[#e77600] focus:ring-1 focus:ring-[#e77600] rounded px-2.5 py-1.5 outline-none font-normal"
                  placeholder="Last name"
                />
                {validationErrors.lastName && (
                  <p className="text-xs text-red-600 font-semibold mt-0.5">{validationErrors.lastName}</p>
                )}
              </div>

              {/* Mobile Number */}
              <div className="flex flex-col gap-1 text-[13px] font-bold">
                <label>Mobile number</label>
                <input
                  type="text"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  className="border border-gray-400 focus:border-[#e77600] focus:ring-1 focus:ring-[#e77600] rounded px-2.5 py-1.5 outline-none font-normal"
                  placeholder="At least 10 digits"
                />
                {validationErrors.phoneNumber && (
                  <p className="text-xs text-red-600 font-semibold mt-0.5">{validationErrors.phoneNumber}</p>
                )}
              </div>
            </>
          )}

          {/* Email */}
          <div className="flex flex-col gap-1 text-[13px] font-bold">
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="border border-gray-400 focus:border-[#e77600] focus:ring-1 focus:ring-[#e77600] rounded px-2.5 py-1.5 outline-none font-normal"
              placeholder="Email"
            />
            {validationErrors.email && (
              <p className="text-xs text-red-600 font-semibold mt-0.5">{validationErrors.email}</p>
            )}
          </div>

          {/* Password */}
          <div className="flex flex-col gap-1 text-[13px] font-bold">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="border border-gray-400 focus:border-[#e77600] focus:ring-1 focus:ring-[#e77600] rounded px-2.5 py-1.5 outline-none font-normal"
              placeholder="At least 6 characters"
            />
            {validationErrors.password && (
              <p className="text-xs text-red-600 font-semibold mt-0.5">{validationErrors.password}</p>
            )}
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#ffd814] hover:bg-[#f7ca00] active:bg-[#f2a200] border border-[#f5c200] rounded py-1.5 font-normal text-[13px] cursor-pointer shadow-sm transition active:scale-[0.98] disabled:bg-gray-200 disabled:cursor-not-allowed mt-2"
          >
            {loading ? "Please wait..." : isRegistering ? "Create your Amazon account" : "Sign In"}
          </button>
        </form>

        {/* Info text */}
        <p className="text-xs text-gray-600 leading-normal">
          By continuing, you agree to Amazon's{" "}
          <a href="#" className="text-[#0066c0] hover:underline hover:text-[#c45500]">
            Conditions of Use
          </a>{" "}
          and{" "}
          <a href="#" className="text-[#0066c0] hover:underline hover:text-[#c45500]">
            Privacy Notice
          </a>
          .
        </p>

        {/* Toggle link */}
        <div className="border-t border-gray-300 pt-4 mt-1 text-xs">
          {isRegistering ? (
            <p>
              Already have an account?{" "}
              <button
                onClick={handleToggleMode}
                className="text-[#0066c0] hover:underline hover:text-[#c45500] font-semibold cursor-pointer"
              >
                Sign in
              </button>
            </p>
          ) : (
            <div className="flex flex-col gap-3 items-center">
              <div className="w-full flex items-center justify-center gap-2">
                <hr className="w-full border-gray-200" />
                <span className="text-[11px] text-gray-500 font-medium shrink-0">New to Amazon?</span>
                <hr className="w-full border-gray-200" />
              </div>
              <button
                onClick={handleToggleMode}
                className="w-full border border-gray-300 rounded py-1 bg-[#f0f2f2] hover:bg-[#e3e6e6] cursor-pointer shadow-sm transition text-xs active:scale-[0.98]"
              >
                Create your Amazon account
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Footer copyright */}
      <div className="flex flex-col items-center gap-2 text-[10px] text-gray-500 mt-8 mb-4">
        <div className="flex gap-4">
          <a href="#" className="hover:underline">Conditions of Use</a>
          <a href="#" className="hover:underline">Privacy Notice</a>
          <a href="#" className="hover:underline">Help</a>
        </div>
        <span>© 1996-2026, Amazon.com, Inc. or its affiliates</span>
      </div>
    </div>
  );
};
