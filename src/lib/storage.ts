import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage"
import { getApps, initializeApp } from "firebase/app"
import { firebaseConfig } from "./firebase"

// ✅ Reuse your initialized Firebase app
import { app } from "./firebase" // if you already export 'app' from firebase.ts

const storage = getStorage(app)

// Upload a profile photo
export async function uploadProfilePhoto(userId: string, personId: string, file: File) {
  const fileRef = ref(storage, `people/${personId}/profile/${file.name}`)
  await uploadBytes(fileRef, file)
  return await getDownloadURL(fileRef)
}

// Upload a memory photo
export async function uploadMemoryPhoto(personId: string, file: File) {
  const fileRef = ref(storage, `people/${personId}/memories/${file.name}`)
  await uploadBytes(fileRef, file)
  return await getDownloadURL(fileRef)
}
