Name:           paperflow
Version:        1.0.0
Release:        1%{?dist}
Summary:        Privacy-first on-device PDF management suite

License:        AGPLv3+
URL:            https://github.com/paperflow/paperflow
Source0:        %{name}-%{version}.tar.gz

BuildRequires:  rust
BuildRequires:  cargo
BuildRequires:  gcc

%description
PaperFlow is a privacy-first, 100% offline PDF manager for Fedora Linux.
It performs all operations locally without external network uploads:
merging, splitting, rotating, compressing, and converting documents.

%prep
%autosetup

%build
cargo build --release --bin paperflow-cli

%install
install -D -m 0755 target/release/paperflow-cli %{buildroot}%{_bindir}/paperflow-cli
install -D -m 0644 packaging/flatpak/io.github.paperflow.PaperFlow.desktop %{buildroot}%{_datadir}/applications/io.github.paperflow.PaperFlow.desktop
install -D -m 0644 packaging/flatpak/io.github.paperflow.PaperFlow.metainfo.xml %{buildroot}%{_metainfodir}/io.github.paperflow.PaperFlow.metainfo.xml

%files
%{_bindir}/paperflow-cli
%{_datadir}/applications/io.github.paperflow.PaperFlow.desktop
%{_metainfodir}/io.github.paperflow.PaperFlow.metainfo.xml

%changelog
* Sun Oct 26 2026 Levi <levi@paperflow.app> - 1.0.0-1
- Initial release of PaperFlow suite for Fedora Linux
