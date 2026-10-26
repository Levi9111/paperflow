use std::path::Path;
use lopdf::Document;
use crate::{CoreError, JobContext};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CompressionPreset {
    Extreme,
    Recommended,
    HighQuality,
}

pub struct Compressor;

impl Compressor {
    pub fn compress_file(
        input: &Path,
        output: &Path,
        preset: CompressionPreset,
        ctx: &JobContext,
    ) -> Result<(usize, usize), CoreError> {
        let original_size = std::fs::metadata(input)?.len() as usize;
        let mut doc = Document::load(input)?;

        ctx.emit_progress("Deduplicating objects", 1, 3);
        ctx.check_cancelled()?;

        // Strip metadata if Extreme
        if preset == CompressionPreset::Extreme {
            doc.trailer.remove(b"Info");
        }

        ctx.emit_progress("Compressing content streams", 2, 3);
        ctx.check_cancelled()?;

        doc.compress();

        ctx.emit_progress("Saving optimized document", 3, 3);
        doc.save(output)?;

        let compressed_size = std::fs::metadata(output)?.len() as usize;
        Ok((original_size, compressed_size))
    }
}
