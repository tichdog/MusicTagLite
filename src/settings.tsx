import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type Language = "en" | "ru";
export type ThemePreference = "dark" | "light" | "system";
export type ResolvedTheme = "dark" | "light";

const LANGUAGE_KEY = "musictag.language";
const THEME_KEY = "musictag.theme";

const en = {
  "common.unknownArtist": "Unknown artist",
  "common.untagged": "Untagged",
  "common.dismiss": "Dismiss notification",
  "errors.unexpected": "An unexpected error occurred.",

  "app.noSupported":
    "No supported audio files found. Use MP3, FLAC, OGG, M4A or WAV.",
  "app.alreadyAdded": "Those tracks are already in the list.",
  "app.addedOne": "Added 1 track.",
  "app.addedMany": "Added {count} tracks.",
  "app.fileError": "{name}: {message}",
  "app.moreErrors": "{count} more files could not be read.",
  "app.skippedOne": "Skipped 1 unsupported file.",
  "app.skippedMany": "Skipped {count} unsupported files.",
  "app.loadFailed": "Could not load files — {message}",
  "app.dragUnavailable": "Drag and drop unavailable — {message}",
  "app.confirmDiscard": "You have unsaved changes. Discard them?",
  "app.confirmRemove":
    "This track has unsaved changes. Remove it from the list anyway?",
  "app.dropTitle": "Drop to add tracks",
  "app.formatsShort": "MP3, FLAC, OGG, M4A or WAV",
  "app.browserNote":
    "Browser preview — file access is available in the desktop app.",

  "dialog.addFiles": "Add music files",
  "dialog.audioFiles": "Audio files",
  "dialog.desktopOnly":
    "The file picker is only available in the desktop app.",

  "sidebar.addTracks": "Add tracks",
  "sidebar.adding": "Adding tracks…",
  "sidebar.tracks": "Tracks",
  "sidebar.emptyTitle": "Nothing here yet.",
  "sidebar.emptyHint": "Add a few audio files to begin.",
  "sidebar.footer": "Tags are written directly to your files",

  "empty.eyebrow": "A tiny tag editor",
  "empty.title": "Your music, properly tagged.",
  "empty.copy":
    "Open audio files, fix their metadata, and save the changes straight back to disk. No re-encoding, no library, no fuss.",
  "empty.choose": "Choose audio files",
  "empty.dropHint": "…or drop files anywhere in this window",
  "empty.supportedFormats": "Supported formats",

  "editor.remove": "Remove from list",
  "editor.removeAria": "Remove track from list",
  "editor.tagFormatTitle": "Tag format detected in this file",
  "editor.tabTags": "Tags",
  "editor.tabLyrics": "Lyrics",
  "editor.tabDetails": "Details",
  "editor.metadata": "Metadata",
  "editor.metadataHint":
    "Written into the file itself — audio is never re-encoded.",
  "editor.detailsHint":
    "Optional identifiers, credits and notes stored in the tag.",
  "editor.newTag": "New tag",
  "editor.fieldTitle": "Title",
  "editor.fieldArtist": "Artist",
  "editor.fieldAlbum": "Album",
  "editor.fieldYear": "Year",
  "editor.fieldGenre": "Genre",
  "editor.fieldTrack": "Track no.",
  "editor.fieldAlbumArtist": "Album artist",
  "editor.fieldTrackTotal": "Track total",
  "editor.fieldDisc": "Disc no.",
  "editor.fieldDiscTotal": "Total discs",
  "editor.fieldComposer": "Composer",
  "editor.fieldComment": "Comment",
  "editor.fieldLyrics": "Lyrics",
  "editor.fieldBpm": "BPM",
  "editor.fieldIsrc": "ISRC",
  "editor.fieldCopyright": "Copyright",
  "editor.fieldLanguage": "Language",
  "editor.fieldGrouping": "Grouping",
  "editor.fieldLabel": "Label",
  "editor.fieldCatalog": "Catalog no.",
  "editor.placeholderTitle": "Song title",
  "editor.placeholderArtist": "Artist or band",
  "editor.placeholderAlbum": "Album name",
  "editor.placeholderYear": "2026",
  "editor.placeholderGenre": "Genre",
  "editor.placeholderTrack": "1",
  "editor.placeholderAlbumArtist": "Album artist",
  "editor.placeholderTrackTotal": "12",
  "editor.placeholderDisc": "1",
  "editor.placeholderDiscTotal": "1",
  "editor.placeholderComposer": "Composer",
  "editor.placeholderComment": "Notes or comment",
  "editor.placeholderLyrics": "Paste the lyrics here…",
  "editor.placeholderBpm": "120",
  "editor.placeholderIsrc": "USRC17607839",
  "editor.placeholderCopyright": "© 2026 …",
  "editor.placeholderLanguage": "eng",
  "editor.placeholderGrouping": "Grouping",
  "editor.placeholderLabel": "Record label",
  "editor.placeholderCatalog": "CAT-001",
  "editor.lyricsHint":
    "Stored inside the file as unsynchronized lyrics.",
  "editor.lyricsStats": "{lines} lines · {chars} characters",
  "editor.artwork": "Cover art",
  "editor.artworkEmpty": "No artwork embedded",
  "editor.artworkHint": "Embedded image · {size}",
  "editor.coverLoading": "Loading artwork…",
  "editor.changeCover": "Change cover",
  "editor.removeCover": "Remove",
  "editor.chooseImage": "Choose cover art",
  "editor.imageFilter": "Images",
  "editor.coverFailed": "Could not load artwork — {message}",
  "editor.mbTitle": "Fill metadata from MusicBrainz",
  "editor.mbHint":
    "Search using the title and artist above, then pick a match.",
  "editor.lookup": "Look up",
  "editor.dirty": "Unsaved changes",
  "editor.clean": "No unsaved changes",
  "editor.reset": "Reset",
  "editor.save": "Save changes",
  "editor.saving": "Saving…",
  "editor.saveTitle": "Save changes (Ctrl+S)",
  "editor.saved": "Tags saved to {name}.",
  "editor.saveFailed": "Could not save tags — {message}",
  "editor.mbApplied": "Metadata applied. Review it, then save your changes.",
  "validation.year": "Enter a year from 0 to 9999.",
  "validation.track": "Track number must be between 1 and 9999.",
  "validation.trackTotal": "Track total must be between 1 and 9999.",
  "validation.disc": "Disc number must be between 1 and 9999.",
  "validation.discTotal": "Total discs must be between 1 and 9999.",
  "validation.bpm": "BPM must be between 1 and 999.",

  "mb.kicker": "Autofill",
  "mb.title": "MusicBrainz lookup",
  "mb.hint":
    "Pick a recording to fill the title, artist, album, year and track.",
  "mb.close": "Close MusicBrainz lookup",
  "mb.searchAria": "Search MusicBrainz",
  "mb.placeholder": "Artist, title, or album",
  "mb.search": "Search",
  "mb.searching": "Searching MusicBrainz",
  "mb.searchFailed": "Search failed",
  "mb.idleTitle": "Find the right release",
  "mb.idleHint": "Start with an artist and title, then narrow it down.",
  "mb.noResultsTitle": "No matches found",
  "mb.noResultsHint": "Try a shorter query, or remove the album name.",
  "mb.track": "Track {count}",
  "mb.use": "Use",
  "mb.attribution": "Data from MusicBrainz, licensed under CC0.",
  "mb.results": "{count} results",
  "mb.emptyQuery": "Enter a title, artist, or album to search.",

  "prefs.language": "Language",
  "prefs.theme": "Theme",
  "theme.dark": "Dark",
  "theme.light": "Light",
  "theme.system": "System",
} as const;

export type MessageKey = keyof typeof en;

const ru: Record<MessageKey, string> = {
  "common.unknownArtist": "Неизвестный исполнитель",
  "common.untagged": "Без тегов",
  "common.dismiss": "Закрыть уведомление",
  "errors.unexpected": "Произошла непредвиденная ошибка.",

  "app.noSupported":
    "Поддерживаемые аудиофайлы не найдены. Используйте MP3, FLAC, OGG, M4A или WAV.",
  "app.alreadyAdded": "Эти треки уже есть в списке.",
  "app.addedOne": "Добавлен 1 трек.",
  "app.addedMany": "Добавлено треков: {count}.",
  "app.fileError": "{name}: {message}",
  "app.moreErrors": "Не удалось прочитать ещё файлов: {count}.",
  "app.skippedOne": "Пропущен 1 неподдерживаемый файл.",
  "app.skippedMany": "Пропущено неподдерживаемых файлов: {count}.",
  "app.loadFailed": "Не удалось загрузить файлы — {message}",
  "app.dragUnavailable": "Перетаскивание недоступно — {message}",
  "app.confirmDiscard": "Есть несохранённые изменения. Отменить их?",
  "app.confirmRemove":
    "У этого трека есть несохранённые изменения. Всё равно убрать его из списка?",
  "app.dropTitle": "Отпустите, чтобы добавить треки",
  "app.formatsShort": "MP3, FLAC, OGG, M4A или WAV",
  "app.browserNote":
    "Предпросмотр в браузере — доступ к файлам есть в настольном приложении.",

  "dialog.addFiles": "Добавить аудиофайлы",
  "dialog.audioFiles": "Аудиофайлы",
  "dialog.desktopOnly":
    "Выбор файлов доступен только в настольном приложении.",

  "sidebar.addTracks": "Добавить треки",
  "sidebar.adding": "Добавление…",
  "sidebar.tracks": "Треки",
  "sidebar.emptyTitle": "Пока пусто.",
  "sidebar.emptyHint": "Добавьте несколько аудиофайлов, чтобы начать.",
  "sidebar.footer": "Теги записываются прямо в ваши файлы",

  "empty.eyebrow": "Маленький редактор тегов",
  "empty.title": "Ваша музыка — с правильными тегами.",
  "empty.copy":
    "Откройте аудиофайлы, исправьте метаданные и сохраните изменения прямо на диск. Без перекодирования, библиотеки и лишней возни.",
  "empty.choose": "Выбрать аудиофайлы",
  "empty.dropHint": "…или перетащите файлы в это окно",
  "empty.supportedFormats": "Поддерживаемые форматы",

  "editor.remove": "Убрать из списка",
  "editor.removeAria": "Убрать трек из списка",
  "editor.tagFormatTitle": "Формат тегов, найденный в файле",
  "editor.tabTags": "Теги",
  "editor.tabLyrics": "Текст песни",
  "editor.tabDetails": "Детали",
  "editor.metadata": "Метаданные",
  "editor.metadataHint":
    "Записываются прямо в файл — аудио не перекодируется.",
  "editor.detailsHint":
    "Необязательные идентификаторы, сведения и заметки в теге.",
  "editor.newTag": "Новый тег",
  "editor.fieldTitle": "Название",
  "editor.fieldArtist": "Исполнитель",
  "editor.fieldAlbum": "Альбом",
  "editor.fieldYear": "Год",
  "editor.fieldGenre": "Жанр",
  "editor.fieldTrack": "Номер трека",
  "editor.fieldAlbumArtist": "Исполнитель альбома",
  "editor.fieldTrackTotal": "Всего треков",
  "editor.fieldDisc": "Номер диска",
  "editor.fieldDiscTotal": "Всего дисков",
  "editor.fieldComposer": "Композитор",
  "editor.fieldComment": "Комментарий",
  "editor.fieldLyrics": "Текст песни",
  "editor.fieldBpm": "BPM",
  "editor.fieldIsrc": "ISRC",
  "editor.fieldCopyright": "Права",
  "editor.fieldLanguage": "Язык",
  "editor.fieldGrouping": "Группировка",
  "editor.fieldLabel": "Лейбл",
  "editor.fieldCatalog": "Номер каталога",
  "editor.placeholderTitle": "Название песни",
  "editor.placeholderArtist": "Исполнитель или группа",
  "editor.placeholderAlbum": "Название альбома",
  "editor.placeholderYear": "2026",
  "editor.placeholderGenre": "Жанр",
  "editor.placeholderTrack": "1",
  "editor.placeholderAlbumArtist": "Исполнитель альбома",
  "editor.placeholderTrackTotal": "12",
  "editor.placeholderDisc": "1",
  "editor.placeholderDiscTotal": "1",
  "editor.placeholderComposer": "Композитор",
  "editor.placeholderComment": "Заметка или комментарий",
  "editor.placeholderLyrics": "Вставьте текст песни…",
  "editor.placeholderBpm": "120",
  "editor.placeholderIsrc": "USRC17607839",
  "editor.placeholderCopyright": "© 2026 …",
  "editor.placeholderLanguage": "rus",
  "editor.placeholderGrouping": "Группировка",
  "editor.placeholderLabel": "Лейбл",
  "editor.placeholderCatalog": "CAT-001",
  "editor.lyricsHint":
    "Сохраняется внутри файла как текст песни.",
  "editor.lyricsStats": "Строк: {lines} · Символов: {chars}",
  "editor.artwork": "Обложка",
  "editor.artworkEmpty": "Обложка не встроена",
  "editor.artworkHint": "Встроенное изображение · {size}",
  "editor.coverLoading": "Загрузка обложки…",
  "editor.changeCover": "Изменить",
  "editor.removeCover": "Удалить",
  "editor.chooseImage": "Выбрать обложку",
  "editor.imageFilter": "Изображения",
  "editor.coverFailed": "Не удалось загрузить обложку — {message}",
  "editor.mbTitle": "Заполнить метаданные из MusicBrainz",
  "editor.mbHint":
    "Поиск по названию и исполнителю выше, затем выберите подходящий результат.",
  "editor.lookup": "Найти",
  "editor.dirty": "Есть несохранённые изменения",
  "editor.clean": "Нет несохранённых изменений",
  "editor.reset": "Сбросить",
  "editor.save": "Сохранить изменения",
  "editor.saving": "Сохранение…",
  "editor.saveTitle": "Сохранить изменения (Ctrl+S)",
  "editor.saved": "Теги сохранены в {name}.",
  "editor.saveFailed": "Не удалось сохранить теги — {message}",
  "editor.mbApplied":
    "Метаданные применены. Проверьте их и сохраните изменения.",
  "validation.year": "Введите год от 0 до 9999.",
  "validation.track": "Номер трека должен быть от 1 до 9999.",
  "validation.trackTotal": "Всего треков должно быть от 1 до 9999.",
  "validation.disc": "Номер диска должен быть от 1 до 9999.",
  "validation.discTotal": "Всего дисков должно быть от 1 до 9999.",
  "validation.bpm": "BPM должен быть от 1 до 999.",

  "mb.kicker": "Автозаполнение",
  "mb.title": "Поиск в MusicBrainz",
  "mb.hint":
    "Выберите запись, чтобы заполнить название, исполнителя, альбом, год и номер трека.",
  "mb.close": "Закрыть поиск MusicBrainz",
  "mb.searchAria": "Поиск в MusicBrainz",
  "mb.placeholder": "Исполнитель, название или альбом",
  "mb.search": "Искать",
  "mb.searching": "Идёт поиск в MusicBrainz",
  "mb.searchFailed": "Ошибка поиска",
  "mb.idleTitle": "Найдите нужный релиз",
  "mb.idleHint": "Начните с исполнителя и названия, затем уточните запрос.",
  "mb.noResultsTitle": "Совпадений не найдено",
  "mb.noResultsHint":
    "Попробуйте более короткий запрос или уберите название альбома.",
  "mb.track": "Трек {count}",
  "mb.use": "Выбрать",
  "mb.attribution": "Данные из MusicBrainz, лицензия CC0.",
  "mb.results": "Результатов: {count}",
  "mb.emptyQuery": "Введите название, исполнителя или альбом для поиска.",

  "prefs.language": "Язык",
  "prefs.theme": "Тема",
  "theme.dark": "Тёмная",
  "theme.light": "Светлая",
  "theme.system": "Системная",
};

const dictionaries: Record<Language, Record<MessageKey, string>> = { en, ru };

type MessageValues = Record<string, string | number>;

const SettingsContext = createContext<SettingsContextValue | null>(null);

interface SettingsContextValue {
  language: Language;
  setLanguage: (language: Language) => void;
  theme: ThemePreference;
  setTheme: (theme: ThemePreference) => void;
  resolvedTheme: ResolvedTheme;
  t: (key: MessageKey, values?: MessageValues) => string;
}

function formatMessage(template: string, values?: MessageValues): string {
  if (!values) {
    return template;
  }
  return template.replace(/\{(\w+)\}/g, (match, key: string) => {
    const value = values[key];
    return value === undefined ? match : String(value);
  });
}

function storedLanguage(): Language {
  try {
    const stored = window.localStorage.getItem(LANGUAGE_KEY);
    if (stored === "en" || stored === "ru") {
      return stored;
    }
  } catch {
    // Storage can be unavailable in restricted webviews.
  }

  return navigator.language?.toLowerCase().startsWith("ru") ? "ru" : "en";
}

function storedTheme(): ThemePreference {
  try {
    const stored = window.localStorage.getItem(THEME_KEY);
    if (stored === "dark" || stored === "light" || stored === "system") {
      return stored;
    }
  } catch {
    // Fall through to the default.
  }

  return "dark";
}

function systemTheme(): ResolvedTheme {
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function applyResolvedTheme(theme: ResolvedTheme) {
  document.documentElement.dataset.theme = theme;
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", theme === "dark" ? "#0c0e13" : "#f3f4f8");
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>(storedLanguage);
  const [theme, setTheme] = useState<ThemePreference>(storedTheme);
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() =>
    theme === "system" ? systemTheme() : theme,
  );

  useEffect(() => {
    if (theme !== "system") {
      setResolvedTheme(theme);
      return;
    }

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => setResolvedTheme(media.matches ? "dark" : "light");
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [theme]);

  useEffect(() => {
    applyResolvedTheme(resolvedTheme);
  }, [resolvedTheme]);

  useEffect(() => {
    document.documentElement.lang = language;
    try {
      window.localStorage.setItem(LANGUAGE_KEY, language);
    } catch {
      // Persisting preferences is best-effort.
    }
  }, [language]);

  useEffect(() => {
    try {
      window.localStorage.setItem(THEME_KEY, theme);
    } catch {
      // Persisting preferences is best-effort.
    }
  }, [theme]);

  const t = useCallback(
    (key: MessageKey, values?: MessageValues) =>
      formatMessage(dictionaries[language][key] ?? en[key], values),
    [language],
  );

  const value = useMemo<SettingsContextValue>(
    () => ({
      language,
      setLanguage,
      theme,
      setTheme,
      resolvedTheme,
      t,
    }),
    [language, resolvedTheme, t, theme],
  );

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings(): SettingsContextValue {
  const context = useContext(SettingsContext);

  if (!context) {
    throw new Error("useSettings must be used inside SettingsProvider");
  }

  return context;
}
