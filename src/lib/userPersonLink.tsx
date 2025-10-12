import { db } from "@/lib/firebase"
import { collection, addDoc, query, where, getDocs } from "firebase/firestore"
import type { User } from "firebase/auth"

export async function getOrCreatePersonForUser(user: User) {
  // look up existing person linked to this Firebase user
  const q = query(collection(db, "people"), where("userId", "==", user.uid))
  const snap = await getDocs(q)

  if (!snap.empty) {
    return { id: snap.docs[0].id, ...snap.docs[0].data() }
  }

  // none found → create new Person record
  const [firstName, lastName = ""] = user.displayName?.split(" ") || ["", ""]
  const docRef = await addDoc(collection(db, "people"), {
    firstName,
    lastName,
    email: user.email || "",
    userId: user.uid,
    roleType: "member",
    createdBy: user.uid,
    createdAt: new Date().toISOString(),
    searchName: `${firstName} ${lastName}`.toLowerCase().trim(),
  })
  return { id: docRef.id, firstName, lastName, email: user.email }
}
