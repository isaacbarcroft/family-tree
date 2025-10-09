import { db, app } from "./firebase"
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage"
import {
  collection,
  addDoc,
  getDocs,
  getDoc,
  doc,
  query,
  where,
  orderBy,
  updateDoc,
  setDoc,
} from "firebase/firestore"
import type { Person } from "@/models/Person"
import type { Event } from "@/models/Event"
import type { Memory } from "@/models/Memory"


const storage = getStorage(app)

// ---- Person ----
export async function addPerson(person: Omit<Person, "id">) {
  const ref = await addDoc(collection(db, "people"), person)
  return { id: ref.id, ...person }
}

export async function listPeople() {
  const snapshot = await getDocs(collection(db, "people"))
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as Person[]
}

export async function getPersonById(id: string) {
  const docRef = doc(db, "people", id)
  const snap = await getDoc(docRef)
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as Person) : null
}

// Create or update a person
export async function savePerson(person: Person) {
  const docRef = doc(db, "people", person.id)
  await setDoc(docRef, person, { merge: true })
  return person
}

// Update existing person fields
export async function updatePerson(id: string, updates: Partial<Person>) {
  const docRef = doc(db, "people", id)
  await updateDoc(docRef, updates)
}

export async function uploadProfilePhoto(userId: string, personId: string, file: File) {
  const fileRef = ref(storage, `people/${personId}/profile/${file.name}`)
  await uploadBytes(fileRef, file)
  return await getDownloadURL(fileRef)
}

export async function uploadMemoryPhoto(personId: string, file: File) {
  const fileRef = ref(storage, `people/${personId}/memories/${file.name}`)
  await uploadBytes(fileRef, file)
  return await getDownloadURL(fileRef)
}

// ---- Events ----
export async function addEvent(event: Omit<Event, "id">) {
  const ref = await addDoc(collection(db, "events"), event)
  return { id: ref.id, ...event }
}

export async function listEvents() {
  const q = query(collection(db, "events"), orderBy("date", "asc"))
  const snapshot = await getDocs(q)
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as Event[]
}

// ---- Memories ----
export async function addMemory(memory: Omit<Memory, "id">) {
  const ref = await addDoc(collection(db, "memories"), memory)
  return { id: ref.id, ...memory }
}

export async function listMemories() {
  const snapshot = await getDocs(collection(db, "memories"))
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as Memory[]
}
