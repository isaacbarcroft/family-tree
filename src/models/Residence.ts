export interface Residence {
  id: string
  personId: string
  rawPlace: string
  dateFrom?: string | null
  dateTo?: string | null
  label?: string | null
  createdBy: string
  createdAt: string
  updatedAt?: string | null
}
