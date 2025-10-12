export const stringToColor = (str: string) => {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
  }
  const color = Math.floor(
    Math.abs(Math.sin(hash) * 16777215) % 16777215
  ).toString(16)
  return `#${"000000".substring(0, 6 - color.length)}${color}`
}