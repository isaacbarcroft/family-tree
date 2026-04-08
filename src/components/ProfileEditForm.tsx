"use client"

import type { Person } from "@/models/Person"
import FamilyList from "@/components/FamilyList"
import FamilyListCompact from "@/components/FamilyListCompact"

interface ProfileEditFormProps {
  form: Partial<Person>
  person: Person
  showDeceased: boolean
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void
  onShowDeceasedChange: (checked: boolean) => void
  onFormUpdate: (updater: (prev: Partial<Person>) => Partial<Person>) => void
  onSave: () => void
  onRemoveParent: (id: string) => void
  onRemoveSpouse: (id: string) => void
  onRemoveChild: (id: string) => void
  onAddFamilyMember: () => void
  onAddToFamily: () => void
}

export default function ProfileEditForm({
  form,
  person,
  showDeceased,
  onChange,
  onShowDeceasedChange,
  onFormUpdate,
  onSave,
  onRemoveParent,
  onRemoveSpouse,
  onRemoveChild,
  onAddFamilyMember,
  onAddToFamily,
}: ProfileEditFormProps) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-6">
      <section>
        <h2 className="text-lg font-semibold mb-3 text-white">Basic Info</h2>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-base mb-1 text-gray-300">First Name</label>
            <input
              type="text"
              name="firstName"
              value={form.firstName || ""}
              onChange={onChange}
              className="border border-gray-700 bg-gray-800 text-gray-100 p-3 text-base rounded-lg w-full"
            />
          </div>
          <div>
            <label className="block text-base mb-1 text-gray-300">Middle Name</label>
            <input
              type="text"
              name="middleName"
              value={form.middleName || ""}
              onChange={onChange}
              className="border border-gray-700 bg-gray-800 text-gray-100 p-3 text-base rounded-lg w-full"
            />
          </div>
          <div>
            <label className="block text-base mb-1 text-gray-300">Last Name</label>
            <input
              type="text"
              name="lastName"
              value={form.lastName || ""}
              onChange={onChange}
              className="border border-gray-700 bg-gray-800 text-gray-100 p-3 text-base rounded-lg w-full"
            />
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3 text-white">Biography</h2>
        <textarea
          name="bio"
          rows={4}
          value={form.bio || ""}
          onChange={onChange}
          placeholder="Tell their story..."
          className="border border-gray-700 bg-gray-800 text-white p-3 rounded-lg w-full"
        />
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3 text-white">Contact Info</h2>
        <div className="grid grid-cols-2 gap-4">
          {["email", "phone", "address", "city", "state", "country"].map((field) => (
            <div key={field}>
              <label className="block text-sm mb-1 capitalize text-gray-400">{field}</label>
              <input
                type="text"
                name={field}
                value={(form[field as keyof Person] as string) || ""}
                onChange={onChange}
                className="border border-gray-700 bg-gray-800 text-gray-100 p-3 text-base rounded-lg w-full"
              />
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3 text-white">Life Dates</h2>
        <div className="space-y-4">
          <div className="max-w-xs">
            <label className="block text-base mb-1 text-gray-300">Birth Date</label>
            <input
              type="date"
              name="birthDate"
              value={(form.birthDate as string) || ""}
              onChange={onChange}
              className="border border-gray-700 bg-gray-800 text-gray-100 p-3 text-base rounded-lg w-full"
            />
          </div>
          <label className="inline-flex items-center gap-2 cursor-pointer text-gray-300">
            <input
              type="checkbox"
              checked={showDeceased}
              onChange={(e) => {
                onShowDeceasedChange(e.target.checked)
                if (!e.target.checked) {
                  onFormUpdate((prev) => ({ ...prev, deathDate: "" }))
                }
              }}
              className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-base">In heaven</span>
          </label>
          {showDeceased && (
            <div className="max-w-xs">
              <label className="block text-base mb-1 text-gray-300">Date of Passing</label>
              <input
                type="date"
                name="deathDate"
                value={(form.deathDate as string) || ""}
                onChange={onChange}
                className="border border-gray-700 bg-gray-800 text-gray-100 p-3 text-base rounded-lg w-full"
              />
            </div>
          )}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3 text-white">Role</h2>
        <select
          name="roleType"
          value={form.roleType || "family member"}
          onChange={onChange}
          className="border border-gray-700 bg-gray-800 text-white p-3 text-base rounded-lg"
        >
          <option value="family member">Family Member</option>
          <option value="friend">Friend</option>
          <option value="neighbor">Neighbor</option>
          <option value="pastor">Pastor</option>
          <option value="other">Other</option>
        </select>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3 text-white">Online Presence</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-base mb-1 text-gray-300">Facebook URL</label>
            <input
              type="url"
              name="facebookUrl"
              placeholder="https://facebook.com/username"
              value={form.facebookUrl || ""}
              onChange={onChange}
              className="border border-gray-700 bg-gray-800 text-gray-100 p-3 text-base rounded-lg w-full"
            />
          </div>
          <div>
            <label className="block text-base mb-1 text-gray-300">Website / Memorial URL</label>
            <input
              type="url"
              name="websiteUrl"
              placeholder="https://example.com"
              value={form.websiteUrl || ""}
              onChange={onChange}
              className="border border-gray-700 bg-gray-800 text-gray-100 p-3 text-base rounded-lg w-full"
            />
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3 text-white">Family Relationships</h2>
        <FamilyList title="Parents" ids={person.parentIds} onRemove={onRemoveParent} />
        <FamilyList title="Spouses" ids={person.spouseIds} onRemove={onRemoveSpouse} />
        <FamilyList title="Children" ids={person.childIds} onRemove={onRemoveChild} />
        <button
          onClick={onAddFamilyMember}
          className="mt-3 bg-gray-800 hover:bg-gray-700 text-gray-300 text-base px-5 py-2.5 rounded-lg border border-gray-700 min-h-[44px] font-medium transition"
        >
          + Add Family Member
        </button>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3 text-white">Family Groups</h2>
        <FamilyListCompact ids={person.familyIds} />
        <button
          onClick={onAddToFamily}
          className="mt-3 bg-gray-800 hover:bg-gray-700 text-gray-300 text-base px-5 py-2.5 rounded-lg border border-gray-700 min-h-[44px] font-medium transition"
        >
          + Add to Family
        </button>
      </section>

      <div className="flex justify-end pt-2">
        <button
          onClick={onSave}
          className="bg-green-600 text-white px-6 py-2.5 rounded-lg hover:bg-green-500 text-base font-medium min-h-[44px] transition"
        >
          Save Changes
        </button>
      </div>
    </div>
  )
}
