use std::path::Path;
use lopdf::{Document, Object, StringFormat};
use crate::CoreError;

#[derive(Debug, Clone, Default, serde::Serialize, serde::Deserialize)]
pub struct DocumentMetadata {
    pub title: Option<String>,
    pub author: Option<String>,
    pub subject: Option<String>,
    pub keywords: Option<String>,
    pub creator: Option<String>,
    pub producer: Option<String>,
    pub creation_date: Option<String>,
    pub mod_date: Option<String>,
    pub version: Option<String>,
    pub is_encrypted: bool,
    pub page_count: usize,
}

impl DocumentMetadata {
    pub fn read_from_file(path: &Path) -> Result<Self, CoreError> {
        let doc = Document::load(path)?;
        Self::from_document(&doc)
    }

    pub fn from_document(doc: &Document) -> Result<Self, CoreError> {
        let mut meta = DocumentMetadata::default();
        meta.version = Some(doc.version.clone());
        meta.is_encrypted = doc.is_encrypted();
        meta.page_count = doc.get_pages().len();

        if let Ok(info_dict) = doc.trailer.get(b"Info")
            .and_then(Object::as_reference)
            .and_then(|id| doc.get_dictionary(id))
        {
            meta.title = info_dict.get(b"Title").ok().and_then(|o| o.as_str().map(|s| String::from_utf8_lossy(s).to_string()).ok());
            meta.author = info_dict.get(b"Author").ok().and_then(|o| o.as_str().map(|s| String::from_utf8_lossy(s).to_string()).ok());
            meta.subject = info_dict.get(b"Subject").ok().and_then(|o| o.as_str().map(|s| String::from_utf8_lossy(s).to_string()).ok());
            meta.keywords = info_dict.get(b"Keywords").ok().and_then(|o| o.as_str().map(|s| String::from_utf8_lossy(s).to_string()).ok());
            meta.creator = info_dict.get(b"Creator").ok().and_then(|o| o.as_str().map(|s| String::from_utf8_lossy(s).to_string()).ok());
            meta.producer = info_dict.get(b"Producer").ok().and_then(|o| o.as_str().map(|s| String::from_utf8_lossy(s).to_string()).ok());
            meta.creation_date = info_dict.get(b"CreationDate").ok().and_then(|o| o.as_str().map(|s| String::from_utf8_lossy(s).to_string()).ok());
            meta.mod_date = info_dict.get(b"ModDate").ok().and_then(|o| o.as_str().map(|s| String::from_utf8_lossy(s).to_string()).ok());
        }

        Ok(meta)
    }

    pub fn sanitize_and_save(input: &Path, output: &Path) -> Result<(), CoreError> {
        let mut doc = Document::load(input)?;
        // Strip info dictionary completely for privacy
        doc.trailer.remove(b"Info");
        doc.save(output)?;
        Ok(())
    }

    pub fn write_to_document(input: &Path, meta: &DocumentMetadata, output: &Path) -> Result<(), CoreError> {
        let mut doc = Document::load(input)?;
        let mut dict = lopdf::Dictionary::new();

        if let Some(ref title) = meta.title {
            dict.set("Title", Object::String(title.as_bytes().to_vec(), StringFormat::Literal));
        }
        if let Some(ref author) = meta.author {
            dict.set("Author", Object::String(author.as_bytes().to_vec(), StringFormat::Literal));
        }
        if let Some(ref subject) = meta.subject {
            dict.set("Subject", Object::String(subject.as_bytes().to_vec(), StringFormat::Literal));
        }
        if let Some(ref creator) = meta.creator {
            dict.set("Creator", Object::String(creator.as_bytes().to_vec(), StringFormat::Literal));
        }
        if let Some(ref producer) = meta.producer {
            dict.set("Producer", Object::String(producer.as_bytes().to_vec(), StringFormat::Literal));
        }

        let info_id = doc.add_object(Object::Dictionary(dict));
        doc.trailer.set("Info", Object::Reference(info_id));
        doc.save(output)?;
        Ok(())
    }
}
