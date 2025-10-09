"use client"

import Link from "next/link"
import { signOut } from "firebase/auth"
import { auth } from "@/lib/firebase"
import { useAuth } from "./AuthProvider"
import { useRouter } from "next/navigation"

export default function NavBar() {
  const { user } = useAuth()
  const router = useRouter()

  const handleLogout = async () => {
    await signOut(auth)
    router.push("/login")
  }

  return (
    <nav className="bg-gray-900 text-white p-4 shadow-sm">
      <div className="container mx-auto flex justify-between items-center">
        <Link href="/" className="font-bold text-xl hover:text-blue-300 transition">
          Family Legacy
        </Link>

        <div className="space-x-4 flex items-center">
          {user ? (
            <>
              <Link href="/family-tree" className="hover:text-blue-300">
                Tree
              </Link>
              <Link href="/timeline" className="hover:text-blue-300">
                Timeline
              </Link>
              <Link href="/memories" className="hover:text-blue-300">
                Memories
              </Link>
              <button
                onClick={handleLogout}
                className="bg-gray-700 px-3 py-1 rounded hover:bg-gray-600"
              >
                Logout
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="hover:text-blue-300">
                Login
              </Link>
              <Link href="/signup" className="hover:text-blue-300">
                Signup
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  )
}
