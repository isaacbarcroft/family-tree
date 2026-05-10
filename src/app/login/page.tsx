"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { supabase } from "@/lib/supabase";
import AuthHero from "@/components/AuthHero";
import { Button } from "@/components/ui";

function deriveInfo(params: URLSearchParams | null): string {
  if (!params) return "";
  if (params.get("confirmed") === "1") return "Email confirmed. You can sign in now.";
  if (params.get("verify") === "1") return "Check your inbox and confirm your email before signing in.";
  return "";
}

function LoginPageContent() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const info = deriveInfo(searchParams);

  useEffect(() => {
    if (user) router.push("/");
  }, [user, router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (signInError) {
      const message = signInError.message.toLowerCase();
      if (message.includes("email") && message.includes("confirm")) {
        setError("Please confirm your email before signing in.");
        return;
      }
      setError("Invalid email or password");
      return;
    }
    router.push("/");
  };

  return (
    <div
      className="grid min-h-[calc(100vh-72px)] items-center px-6 py-12 md:grid-cols-2 md:gap-16 md:px-16"
      style={{ background: "var(--paper)" }}
    >
      <div className="hidden md:block">
        <AuthHero />
      </div>

      <form
        onSubmit={handleLogin}
        className="mx-auto w-full max-w-sm space-y-4 rounded-lg p-8"
        style={{ background: "var(--paper-2)", border: "1px solid var(--hairline)" }}
      >
        <div className="text-center">
          <p className="eyebrow" style={{ marginBottom: 6 }}>
            Sign in
          </p>
          <h1
            className="display"
            style={{ fontSize: 28, margin: 0, fontWeight: 500 }}
          >
            Welcome back
          </h1>
        </div>

        {info ? (
          <p
            className="display-italic text-center"
            style={{ color: "var(--sage-deep)", fontSize: 14 }}
          >
            {info}
          </p>
        ) : null}
        {error ? (
          <p
            className="text-center"
            style={{ color: "var(--clay-deep)", fontSize: 14 }}
          >
            {error}
          </p>
        ) : null}

        <AuthInput
          type="email"
          placeholder="Email"
          value={email}
          onChange={(v) => setEmail(v)}
          autoComplete="email"
        />
        <AuthInput
          type="password"
          placeholder="Password"
          value={password}
          onChange={(v) => setPassword(v)}
          autoComplete="current-password"
        />
        <Button type="submit" variant="primary" className="w-full">
          Log in
        </Button>

        <p className="text-center" style={{ fontSize: 14 }}>
          <Link href="/forgot-password" style={{ color: "var(--sage-deep)" }}>
            Forgot your password?
          </Link>
        </p>
        <p className="text-center" style={{ fontSize: 14, color: "var(--ink-3)" }}>
          Don&rsquo;t have an account?{" "}
          <Link href="/signup" style={{ color: "var(--sage-deep)" }}>
            Sign up
          </Link>
        </p>
      </form>
    </div>
  );
}

function AuthInput({
  type,
  placeholder,
  value,
  onChange,
  autoComplete,
}: {
  type: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete?: string;
}) {
  return (
    <input
      type={type}
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      autoComplete={autoComplete}
      className="w-full rounded-md p-3"
      style={{
        background: "var(--paper)",
        color: "var(--ink)",
        border: "1px solid var(--hairline)",
        fontSize: 15,
      }}
    />
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div
          className="flex min-h-[80vh] items-center justify-center"
          style={{ background: "var(--paper)", color: "var(--ink-3)" }}
        >
          <p style={{ fontSize: 15 }}>Loading…</p>
        </div>
      }
    >
      <LoginPageContent />
    </Suspense>
  );
}
