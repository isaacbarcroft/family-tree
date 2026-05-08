/**
 * Inline script that runs before React hydration to apply the user's saved
 * theme preference. Without this, dark-mode users see a flash of light theme
 * on every page load.
 */
export function ThemeScript() {
  const code = `
(function () {
  try {
    var saved = localStorage.getItem('theme');
    var prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    var dark = saved === 'dark' || (saved === null && prefersDark);
    if (dark) document.documentElement.classList.add('theme-dark');
  } catch (e) {}
})();
`;
  return <script dangerouslySetInnerHTML={{ __html: code }} />;
}
