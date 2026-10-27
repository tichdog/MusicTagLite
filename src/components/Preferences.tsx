import type { Language, ThemePreference } from "../settings";
import { useSettings } from "../settings";
import { MonitorIcon, MoonIcon, SunIcon } from "./Icons";

const LANGUAGES: Array<{ value: Language; short: string; name: string }> = [
  { value: "en", short: "EN", name: "English" },
  { value: "ru", short: "RU", name: "Русский" },
];

const THEMES: Array<{ value: ThemePreference; icon: typeof MoonIcon }> = [
  { value: "dark", icon: MoonIcon },
  { value: "light", icon: SunIcon },
  { value: "system", icon: MonitorIcon },
];

export function Preferences() {
  const { language, setLanguage, theme, setTheme, t } = useSettings();

  return (
    <div className="preferences">
      <div className="pref-row">
        <span className="pref-label">{t("prefs.language")}</span>
        <div className="segmented" role="group" aria-label={t("prefs.language")}>
          {LANGUAGES.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`segmented-option${
                language === option.value ? " is-active" : ""
              }`}
              onClick={() => setLanguage(option.value)}
              aria-pressed={language === option.value}
              aria-label={option.name}
              title={option.name}
            >
              {option.short}
            </button>
          ))}
        </div>
      </div>

      <div className="pref-row">
        <span className="pref-label">{t("prefs.theme")}</span>
        <div className="segmented" role="group" aria-label={t("prefs.theme")}>
          {THEMES.map(({ value, icon: Icon }) => {
            const label = t(
              value === "dark"
                ? "theme.dark"
                : value === "light"
                  ? "theme.light"
                  : "theme.system",
            );

            return (
              <button
                key={value}
                type="button"
                className={`segmented-option${
                  theme === value ? " is-active" : ""
                }`}
                onClick={() => setTheme(value)}
                aria-pressed={theme === value}
                aria-label={label}
                title={label}
              >
                <Icon width={14} height={14} />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
