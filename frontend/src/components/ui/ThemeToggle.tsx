import { useTheme } from '../../lib/theme'

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()

  return (
    <button
      onClick={toggleTheme}
      className="rounded-sm p-2 text-text-secondary transition-colors hover:bg-bg-secondary hover:text-text-primary"
      aria-label="Toggle theme"
    >
      <i
        className={`ti ${theme === 'dark' ? 'ti-sun' : 'ti-moon'} text-xl`}
      ></i>
    </button>
  )
}
