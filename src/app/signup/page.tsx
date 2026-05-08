"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { supabase } from "@/lib/supabase";
import AuthHero from "@/components/AuthHero";
import { Button, Icon } from "@/components/ui";

export default function SignupPage() {
  return (
    <Suspense
      fallback={
        <div
          className="display-italic muted"
          style={{ textAlign: "center", padding: "96px 24px", fontSize: 18 }}
        >
          Loading…
        </div>
      }
    >
      <SignupContent />
    </Suspense>
  );
}

function SignupContent() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [pendingEmailConfirmation, setPendingEmailConfirmation] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const familyId = searchParams.get("family");
  const claimPersonId = searchParams.get("claim");
  const { user } = useAuth();

  useEffect(() => {
    if (user) router.push("/");
  }, [user, router]);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }
    setError("");
    const emailRedirectTo =
      typeof window !== "undefined" ? `${window.location.origin}/auth/callback` : undefined;
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        ...(emailRedirectTo ? { emailRedirectTo } : {}),
        data: {
          first_name: firstName,
          last_name: lastName,
          ...(familyId ? { family_id: familyId } : {}),
          ...(claimPersonId ? { claim_person_id: claimPersonId } : {}),
        },
      },
    });
    if (signUpError) {
      setError(signUpError.message);
      return;
    }
    if (data?.access_token) {
      router.push("/");
      return;
    }
    setPendingEmailConfirmation(true);
  };

  if (pendingEmailConfirmation) {
    return (
      <div
        className="flex min-h-[80vh] items-center justify-center px-6"
        style={{ background: "var(--paper)" }}
      >
        <div
          className="w-full max-w-sm rounded-lg p-10 text-center"
          style={{ background: "var(--paper-2)", border: "1px solid var(--hairline)" }}
        >
          <div className="mb-4 flex justify-center">
            <div
              className="flex h-12 w-12 items-center justify-center rounded-full"
              style={{ background: "var(--sage-tint)", color: "var(--sage-deep)" }}
            >
              <Icon name="bell" size={20} />
            </div>
          </div>
          <h1
            className="display"
            style={{ fontSize: 26, margin: 0, fontWeight: 500 }}
          >
            Confirm your email
          </h1>
          <p
            className="mt-3"
            style={{ fontSize: 15, lineHeight: 1.6, color: "var(--ink-2)" }}
          >
            We sent a confirmation link to{" "}
            <span style={{ fontFamily: "var(--font-display)", fontStyle: "italic" }}>
              {email}
            </span>
            . Please confirm your email, then sign in.
          </p>
          <div className="mt-6">
            <Link href="/login?verify=1" style={{ textDecoration: "none" }}>
              <Button variant="primary" icon="arrow">
                Go to login
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="grid min-h-[calc(100vh-72px)] items-center px-6 py-12 md:grid-cols-2 md:gap-16 md:px-16"
      style={{ background: "var(--paper)" }}
    >
      <div className="hidden md:block">
        <AuthHero />
      </div>

      <form
        onSubmit={handleSignup}
        className="mx-auto w-full max-w-sm space-y-4 rounded-lg p-8"
        style={{ background: "var(--paper-2)", border: "1px solid var(--hairline)" }}
      >
        <div className="text-center">
          <p className="eyebrow" style={{ marginBottom: 6 }}>
            Create account
          </p>
          <h1 className="display" style={{ fontSize: 28, margin: 0, fontWeight: 500 }}>
            Join the page
          </h1>
        </div>

        {familyId || claimPersonId ? (
          <p
            className="display-italic text-center"
            style={{ fontSize: 14, color: "var(--sage-deep)" }}
          >
            {claimPersonId
              ? "You\u2019ve been invited to claim your profile."
              : "You\u2019ve been invited to join a family."}
          </p>
        ) : null}
        {error ? (
          <p className="text-center" style={{ color: "var(--clay-deep)", fontSize: 14 }}>
            {error}
          </p>
        ) : null}

        <div className="grid grid-cols-2 gap-3">
          <AuthInput
            type="text"
            placeholder="First name"
            value={firstName}
            onChange={setFirstName}
            autoComplete="given-name"
            required
          />
          <AuthInput
            type="text"
            placeholder="Last name"
            value={lastName}
            onChange={setLastName}
            autoComplete="family-name"
            required
          />
        </div>
        <AuthInput
          type="email"
          placeholder="Email"
          value={email}
          onChange={setEmail}
          autoComplete="email"
        />
        <AuthInput
          type="password"
          placeholder="Password"
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
        />
        <AuthInput
          type="password"
          placeholder="Confirm password"
          value={confirm}
          onChange={setConfirm}
          autoComplete="new-password"
        />
        <Button type="submit" variant="primary" className="w-full">
          Sign up
        </Button>
        <p className="text-center" style={{ fontSize: 14, color: "var(--ink-3)" }}>
          Already have an account?{" "}
          <Link href="/login" style={{ color: "var(--sage-deep)" }}>
            Log in
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
  required,
}: {
  type: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete?: string;
  required?: boolean;
}) {
  return (
    <input
      type={type}
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      autoComplete={autoComplete}
      required={required}
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
