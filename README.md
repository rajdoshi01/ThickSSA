# ThickSSA (Thick Client Static Security Analyzer)

ThickSSA is an automated static analysis tool designed to identify security vulnerabilities, misconfigurations, and sensitive data in Thick Client applications (Windows PE and Linux ELF binaries). It performs comprehensive checks on both the executable and its installation directory without needing the source code.

## Features

- **Dual Platform Support**: Analyzes both Windows PE (`.exe`, `.dll`) and Linux ELF binaries.
- **Binary Hardening Checks**:
  - **Windows**: DEP, ASLR, SafeSEH, CFG, Stack Cookies (`/GS`), Authenticode Signatures.
  - **Linux**: NX/DEP, PIE, RELRO, Stack Canaries, RPATH/RUNPATH.
- **Directory Auditing**: Recursively scans the application's installation folder for insecure files.
- **Secrets Detection**: Finds hardcoded API keys, database credentials, tokens, and URIs in binary sections and config files.
- **Logic Visibility**: Extracts cleartext strings from non-obfuscated sections to identify leaked business logic.
- **Insecure API Usage**: Scans Import Address Tables (IAT) and dynamic symbols (`.dynsym`) for vulnerable functions (e.g., `strcpy`, `memcpy`, `system`).
- **File & Folder Permissions**: Detects weak access control lists (ACLs) using `icacls`.
- **Database & Network Checks**: Identifies unencrypted local databases (SQLite) and insecure protocols (HTTP, TCP, FTP).
- **Report Generation**: Automatically generates detailed Excel and PDF reports.

## Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/yourusername/ThickSSA.git
   cd ThickSSA
   ```

2. **Install dependencies**:
   Ensure you have Python 3.8+ installed. Then, run:
   ```bash
   pip install -r requirements.txt
   ```
   *(Note: The main dependency required is `pyelftools` for Linux binary analysis).*

## Usage

1. **Run the production server:**
   ```bash
   python app.pyc
   ```
   *Note: Using the compiled `app.pyc` is recommended for optimized performance and environment integrity.*

2. **Access the Web UI:**
   Open your browser and navigate to `http://127.0.0.1:5000`

3. **Analyze:**
   Enter the paths for the target executable (Windows PE or Linux ELF) and its installation directory into the interface and click "Start Thick Client Audit". Export the results as PDF or Excel when finished.

## Legal Disclaimer

This tool is created for educational and authorized penetration testing purposes only. The author is not responsible for any misuse or damage caused by this program.

---
**Author:** Raj Doshi (rajdoshi01)
