use std::path::PathBuf;
use clap::{Parser, Subcommand};
use paperflow_core::{JobContext, PaperFlowEngine};

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
    /// Split a PDF by page ranges (e.g. 1-3, 5)
    Split {
        #[arg(short, long)]
        input: PathBuf,
        #[arg(short, long)]
        ranges: String,
        #[arg(short, long)]
        output: PathBuf,
    },
    /// Rotate a specific page (e.g. 90, 180, 270 degrees)
    Rotate {
        #[arg(short, long)]
        input: PathBuf,
        #[arg(short, long)]
        page: u32,
        #[arg(short, long, default_value = "90")]
        delta: i64,
        #[arg(short, long)]
        output: PathBuf,
    },
}

fn parse_ranges(ranges_str: &str, max_pages: usize) -> Vec<u32> {
    let mut pages = Vec::new();
    for part in ranges_str.split(',') {
        let part = part.trim();
        if part.contains('-') {
            let bounds: Vec<&str> = part.split('-').collect();
            if bounds.len() == 2 {
                if let (Ok(start), Ok(end)) = (bounds[0].trim().parse::<u32>(), bounds[1].trim().parse::<u32>()) {
                    for p in start..=end {
                        if (p as usize) <= max_pages {
                            pages.push(p);
                        }
                    }
                }
            }
        } else if let Ok(page) = part.parse::<u32>() {
            if (page as usize) <= max_pages {
                pages.push(page);
            }
        }
    }
    pages.sort();
    pages.dedup();
    pages
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
            let pages_to_keep = parse_ranges(&ranges, total);
            println!("Extracting {} pages from {}...", pages_to_keep.len(), input.display());
            let count = PaperFlowEngine::split_range(&input, &pages_to_keep, &output, &ctx)?;
            println!("Saved {} extracted pages to {}", count, output.display());
        }
        Commands::Rotate { input, page, delta, output } => {
            println!("Rotating page {} by {}° in {}...", page, delta, input.display());
            PaperFlowEngine::rotate_page(&input, page, delta, &output)?;
            println!("Saved rotated PDF to {}", output.display());
        }
    }

    Ok(())
}
