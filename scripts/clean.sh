#!/bin/bash

# Clean script for CRX Extractor

echo "🧹 Cleaning extracted extensions..."

if [ -d "_extensions" ]; then
    echo "⚠️  This will delete all extracted extensions in _extensions/"
    read -p "Are you sure? (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        rm -rf _extensions/*
        echo "✅ Cleaned _extensions directory"
    else
        echo "❌ Cancelled"
    fi
else
    echo "📁 No _extensions directory found"
fi
