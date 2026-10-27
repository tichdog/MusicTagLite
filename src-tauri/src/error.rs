use serde::Serialize;

/// Walks an error's source chain to produce a message that includes the
/// underlying cause (Lofty's top-level errors are intentionally generic).
fn describe(error: &(dyn std::error::Error + 'static)) -> String {
    let mut message = error.to_string();
    let mut source = error.source();

    while let Some(cause) = source {
        let text = cause.to_string();
        if !text.is_empty() && !message.contains(&text) {
            message.push_str(": ");
            message.push_str(&text);
        }
        source = cause.source();
    }

    message
}

/// A single application error type. Tauri commands require the error type to
/// implement `Serialize`; the frontend only needs a readable message, so we
/// serialize the display form of the error.
#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("Could not access the file: {0}")]
    Io(#[from] std::io::Error),

    #[error("Could not read the audio file: {0}")]
    Parse(String),

    #[error("Could not write the audio file: {0}")]
    Encoding(String),

    #[error("Could not reach MusicBrainz: {0}")]
    Network(#[from] reqwest::Error),

    #[error("MusicBrainz returned an error: {0}")]
    Upstream(String),

    #[error("Invalid request: {0}")]
    Invalid(String),

    #[error("{0}")]
    Message(String),
}

impl From<lofty::error::FileParseError> for AppError {
    fn from(error: lofty::error::FileParseError) -> Self {
        Self::Parse(describe(&error))
    }
}

impl From<lofty::error::FileEncodingError> for AppError {
    fn from(error: lofty::error::FileEncodingError) -> Self {
        Self::Encoding(describe(&error))
    }
}

impl Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

pub type AppResult<T> = Result<T, AppError>;
