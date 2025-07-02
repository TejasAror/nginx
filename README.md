# 🌐 Nginx Config Manager (TypeScript + Node.js)

A TypeScript-powered CLI/server utility to manage, validate, or generate **Nginx configurations**, using a simple `config.yaml` file.

---

## 📁 Project Structure

├── src/ # Source code (TS)
├── dist/ # Compiled output (JS)
├── config.yaml # Your Nginx or app configuration
├── package.json # Project metadata
├── pnpm-lock.yaml # Lockfile for pnpm
├── tsconfig.json # TypeScript config
├── node_modules/ # Dependencies

## 🚀 Features

- ⚙️ Generates Nginx config files from YAML
- ✅ Validates reverse proxy targets and port bindings
- 🧾 Optional: serves dynamic Nginx config via API
- 📦 Built with TypeScript and uses `pnpm`
- 🔄 Can auto-reload Nginx (if enabled)
