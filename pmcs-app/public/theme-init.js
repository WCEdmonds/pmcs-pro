// Applies the saved light theme before first paint (external file so the CSP can forbid inline scripts).
try {
  if (localStorage.getItem('pmcs_theme') === 'light') document.documentElement.classList.remove('dark');
} catch (e) {
  // Storage unavailable: keep the default dark theme.
}
