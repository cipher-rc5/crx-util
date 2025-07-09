#!/bin/bash

# Setup script for CRX Extractor

echo "🚀 Setting up CRX Extractor..."

# Install dependencies
echo "📦 Installing dependencies..."
bun install

# Create _extensions directory
echo "📁 Creating _extensions directory..."
mkdir -p _extensions

echo "✅ Setup complete!"
echo ""
echo "You can now run:"
echo "  bun run index.ts <extension-id-or-url>"
echo ""
echo "Extensions will be saved to: ./_extensions/"
