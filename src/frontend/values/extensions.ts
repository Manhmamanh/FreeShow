// electron/data/media.ts
export const videoExtensions = ["mp4", "webm", "ogv", "mov", "m4v", "3gp", "3g2", "avi", "mkv", "flv", "mpeg", "mpg", "wmv"]
export const imageExtensions = ["jpg", "jpeg", "png", "gif", "bmp", "svg", "webp", "tiff", "tif", "jfif", "avif", "heic"]
export const audioExtensions = ["mp3", "wav", "ogg", "aac", "m4a", "flac", "wma", "opus", "aiff", "aif", "weba", "mid"]
export const presentationExtensions = ["ppt", "pptx", "key"]
// converted to PDF when dropped in a project (LibreOffice, Keynote/Pages/Numbers or Microsoft Office)
export const documentExtensions = ["doc", "docx", "rtf", "odt", "pages", "xls", "xlsx", "ods", "numbers", "odp"]
export const mediaExtensions = [...videoExtensions, ...imageExtensions]
