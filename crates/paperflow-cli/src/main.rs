use std::path::PathBuf;
use clap::{Parser, Subcommand};
use paperflow_core::{JobContext, PaperFlowEngine};
use paperflow_core::compress::{Compressor, CompressionPreset};
use paperflow_core::convert::ImageConverter;
use paperflow_core::metadata::DocumentMetadata;

#[derive(Parser)]
#[command(name = "paperflow")]
#[command(about = "Privacy-first, 100% on-device PDF management suite CLI", long_about = None)]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// Retrieve page count and document statistics
    Info {
        #[arg(short, long)]
        input: PathBuf,
    },
    /// Merge multiple PDF documents into a single file
    Merge {
        #[arg(short, long, num_args = 1..)]
        inputs: Vec<PathBuf>,
        #[arg(short, long)]
        output: PathBuf,
    },
    /// Split a PDF by page ranges (e.g. 1-3, 5, 8-10)
    Split {
        #[arg(short, long)]
        input: PathBuf,
        #[arg(short, long)]
        ranges: String,
        #[arg(short, long)]
        output: PathBuf,
    },
    /// Rotate specific pages or the entire document (e.g. 90, 180, 270 degrees)
    Rotate {
        #[arg(short, long)]
        input: PathBuf,
        #[arg(short, long)]
        page: Option<u32>,
        #[arg(short, long, default_value = "90")]
        delta: i64,
        #[arg(short, long)]
        output: PathBuf,
    },
    /// Inspect or sanitize document metadata
    Meta {
        #[arg(short, long)]
        input: PathBuf,
        #[arg(short, long)]
        strip_to: Option<PathBuf>,
    },
    /// Compress document streams
    Compress {
        #[arg(short, long)]
        input: PathBuf,
        #[arg(short, long)]
        output: PathBuf,
        #[arg(short, long, default_value = "recommended")]
        preset: String,
    },
    /// Convert images to a unified PDF document
    Img2Pdf {
        #[arg(short, long, num_args = 1..)]
        images: Vec<PathBuf>,
        #[arg(short, long)]
        output: PathBuf,
    },
}

fn main() -> anyhow::Result<()> {
    let cli = Cli::parse();
    let ctx = JobContext::new_noop(std::env::temp_dir());

    match cli.command {
        Commands::Info { input } => {
            let pages = PaperFlowEngine::get_page_count(&input)?;
            println!("File: {}", input.display());
            println!("Total pages: {}", pages);
        }
        Commands::Merge { inputs, output } => {
            println!("Merging {} documents into {}...", inputs.len(), output.display());
            let count = PaperFlowEngine::merge(&inputs, &output, &ctx)?;
            println!("Successfully merged {} pages into {}", count, output.display());
        }
        Commands::Split { input, ranges, output } => {
            let total = PaperFlowEngine::get_page_count(&input)?;
            let pages_to_keep = PaperFlowEngine::parse_page_ranges(&ranges, total)?;
            println!("Extracting {} pages from {}...", pages_to_keep.len(), input.display());
            let count = PaperFlowEngine::split_range(&input, &pages_to_keep, &output, &ctx)?;
            println!("Saved {} extracted pages to {}", count, output.display());
        }
        Commands::Rotate { input, page, delta, output } => {
            if let Some(p) = page {
                println!("Rotating page {} by {}° in {}...", p, delta, input.display());
                PaperFlowEngine::rotate_page(&input, p, delta, &output)?;
            } else {
                println!("Rotating all pages by {}° in {}...", delta, input.display());
                PaperFlowEngine::rotate_all_pages(&input, delta, &output)?;
            }
            println!("Saved rotated PDF to {}", output.display());
        }
        Commands::Meta { input, strip_to } => {
            let meta = DocumentMetadata::read_from_file(&input)?;
            println!("Document Properties for {}:", input.display());
            println!("  Title:       {}", meta.title.as_deref().unwrap_or("—"));
            println!("  Author:      {}", meta.author.as_deref().unwrap_or("—"));
            println!("  Creator:     {}", meta.creator.as_deref().unwrap_or("—"));
            println!("  Producer:    {}", meta.producer.as_deref().unwrap_or("—"));
            println!("  Version:     PDF {}", meta.version.as_deref().unwrap_or("—"));
            println!("  Pages:       {}", meta.page_count);
            println!("  Encrypted:   {}", if meta.is_encrypted { "Yes" } else { "No" });
            if let Some(clean_out) = strip_to {
                DocumentMetadata::sanitize_and_save(&input, &clean_out)?;
                println!("Cleared metadata saved to {}", clean_out.display());
            }
        }
        Commands::Compress { input, output, preset } => {
            let p = match preset.to_lowercase().as_str() {
                "extreme" => CompressionPreset::Extreme,
                "high" | "highquality" => CompressionPreset::HighQuality,
                _ => CompressionPreset::Recommended,
            };
            println!("Compressing {} with {} preset...", input.display(), preset);
            let (orig, comp) = Compressor::compress_file(&input, &output, p, &ctx)?;
            let saved = if orig > 0 { ((orig - comp) as f64 / orig as f64) * 100.0 } else { 0.0 };
            println!("Compressed {} bytes -> {} bytes ({:.1}% reduction)", orig, comp, saved);
            println!("Output saved to {}", output.display());
        }
        Commands::Img2Pdf { images, output } => {
            println!("Converting {} images to PDF...", images.len());
            let count = ImageConverter::image_to_pdf(&images, &output)?;
            println!("Created {}-page PDF document at {}", count, output.display());
        }
    }

    Ok(())
}
