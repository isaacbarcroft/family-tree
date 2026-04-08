"use client"

import { useState } from "react"
import { parseGedcom, type ParsedPerson, type GedcomParseResult } from "@/utils/gedcom"
import { addPerson, linkParentChild, linkSpouses } from "@/lib/db"
import { useAuth } from "@/components/AuthProvider"
import type { Person } from "@/models/Person"

interface ImportGedcomModalProps {
  onClose: () => void
  onImported: () => void
}

type ImportStep = "upload" | "preview" | "importing" | "done"

export default function ImportGedcomModal({ onClose, onImported }: ImportGedcomModalProps) {
  const { user } = useAuth()
  const [step, setStep] = useState<ImportStep>("upload")
  const [parseResult, setParseResult] = useState<GedcomParseResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState({ current: 0, total: 0 })
  const [importedCount, setImportedCount] = useState(0)

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null)

    try {
      const text = await file.text()
      const result = parseGedcom(text)

      if (result.people.length === 0) {
        setError("No individuals found in this GEDCOM file.")
        return
      }

      setParseResult(result)
      setStep("preview")
    } catch {
      setError("Failed to parse the GEDCOM file. Please check the file format.")
    }
  }

  const handleImport = async () => {
    if (!parseResult || !user) return

    setStep("importing")
    const total = parseResult.people.length
    setProgress({ current: 0, total })

    try {
      // Map GEDCOM xref IDs to newly created database IDs
      const idMap = new Map<string, string>()

      // Step 1: Create all people
      for (let i = 0; i < parseResult.people.length; i++) {
        const p = parseResult.people[i]
        const newPerson: Omit<Person, "id"> = {
          firstName: p.firstName || "Unknown",
          lastName: p.lastName || "",
          roleType: "family member",
          createdBy: user.id,
          createdAt: new Date().toISOString(),
          ...(p.middleName && { middleName: p.middleName }),
          ...(p.birthDate && { birthDate: p.birthDate }),
          ...(p.birthPlace && { birthPlace: p.birthPlace }),
          ...(p.deathDate && { deathDate: p.deathDate }),
          ...(p.deathPlace && { deathPlace: p.deathPlace }),
          ...(p.email && { email: p.email }),
          ...(p.bio && { bio: p.bio }),
        }

        const created = await addPerson(newPerson)
        idMap.set(p.gedcomId, created.id)
        setProgress({ current: i + 1, total })
      }

      // Step 2: Link relationships from FAM records
      for (const fam of parseResult.families) {
        const spouseIds: string[] = []

        if (fam.husbandRef && idMap.has(fam.husbandRef)) {
          spouseIds.push(idMap.get(fam.husbandRef)!)
        }
        if (fam.wifeRef && idMap.has(fam.wifeRef)) {
          spouseIds.push(idMap.get(fam.wifeRef)!)
        }

        // Link spouses
        if (spouseIds.length === 2) {
          try {
            await linkSpouses(spouseIds[0], spouseIds[1])
          } catch (err) {
            console.error("Failed to link spouses:", err)
          }
        }

        // Link parent-child relationships
        for (const childRef of fam.childRefs) {
          const childId = idMap.get(childRef)
          if (!childId) continue

          for (const parentId of spouseIds) {
            try {
              await linkParentChild(parentId, childId)
            } catch (err) {
              console.error("Failed to link parent-child:", err)
            }
          }
        }
      }

      setImportedCount(parseResult.people.length)
      setStep("done")
    } catch (err) {
      console.error("Import failed:", err)
      setError("Import failed. Some records may have been partially created.")
      setStep("preview")
    }
  }

  const handleDone = () => {
    onImported()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-full max-w-lg mx-4 max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-white">Import GEDCOM</h2>
          {step !== "importing" && (
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white text-xl px-2"
            >
              &times;
            </button>
          )}
        </div>

        {error && (
          <div className="bg-red-900/30 border border-red-700 text-red-300 rounded-lg p-3 mb-4 text-sm">
            {error}
          </div>
        )}

        {step === "upload" && (
          <div>
            <p className="text-gray-300 text-sm mb-4">
              Upload a GEDCOM file (.ged) exported from Ancestry, MyHeritage, FamilySearch, or other genealogy software.
            </p>
            <label className="flex flex-col items-center justify-center border-2 border-dashed border-gray-600 rounded-xl p-8 cursor-pointer hover:border-gray-500 transition">
              <span className="text-gray-400 text-base mb-2">Choose a .ged file</span>
              <span className="text-gray-500 text-sm">or drag and drop</span>
              <input
                type="file"
                accept=".ged,.gedcom"
                onChange={handleFileSelect}
                className="hidden"
              />
            </label>
          </div>
        )}

        {step === "preview" && parseResult && (
          <div>
            <div className="bg-gray-800 rounded-lg p-4 mb-4">
              <h3 className="text-white font-medium mb-2">File Summary</h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="text-gray-400">Individuals:</div>
                <div className="text-white">{parseResult.people.length}</div>
                <div className="text-gray-400">Families:</div>
                <div className="text-white">{parseResult.families.length}</div>
              </div>
            </div>

            <div className="bg-gray-800 rounded-lg p-4 mb-4 max-h-48 overflow-y-auto">
              <h3 className="text-white font-medium mb-2">People to Import</h3>
              <ul className="space-y-1">
                {parseResult.people.slice(0, 50).map((p, i) => (
                  <li key={i} className="text-sm text-gray-300">
                    {p.firstName} {p.middleName ? `${p.middleName} ` : ""}{p.lastName}
                    {p.birthDate && <span className="text-gray-500 ml-1">b. {p.birthDate}</span>}
                    {p.deathDate && <span className="text-gray-500 ml-1">d. {p.deathDate}</span>}
                  </li>
                ))}
                {parseResult.people.length > 50 && (
                  <li className="text-sm text-gray-500">
                    ...and {parseResult.people.length - 50} more
                  </li>
                )}
              </ul>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleImport}
                className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-lg text-base font-medium min-h-[44px] flex-1"
              >
                Import {parseResult.people.length} People
              </button>
              <button
                onClick={() => { setStep("upload"); setParseResult(null) }}
                className="bg-gray-700 hover:bg-gray-600 text-white px-5 py-2.5 rounded-lg text-base font-medium min-h-[44px]"
              >
                Back
              </button>
            </div>
          </div>
        )}

        {step === "importing" && (
          <div className="text-center py-6">
            <p className="text-white text-lg mb-4">Importing...</p>
            <div className="w-full bg-gray-700 rounded-full h-3 mb-3">
              <div
                className="bg-blue-600 rounded-full h-3 transition-all duration-200"
                style={{ width: `${progress.total ? (progress.current / progress.total) * 100 : 0}%` }}
              />
            </div>
            <p className="text-gray-400 text-sm">
              {progress.current} of {progress.total} people created
            </p>
          </div>
        )}

        {step === "done" && (
          <div className="text-center py-6">
            <p className="text-green-400 text-lg mb-2">Import Complete</p>
            <p className="text-gray-300 text-sm mb-4">
              Successfully imported {importedCount} people with their family relationships.
            </p>
            <button
              onClick={handleDone}
              className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2.5 rounded-lg text-base font-medium min-h-[44px]"
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
